import { Config, Save, State } from "./config.js";
import { UI } from "./ui.js";
import { Game } from "./game.js";
import { Market } from "./market.js";
import { Format } from "./util.js";

Save.read();
UI.build();
Game.boot();

window.QUANTA = {
    state: () => JSON.parse(JSON.stringify(State.get())),
    market: id => {
        const mid = id || State.get().activeMarket;
        return JSON.parse(JSON.stringify(State.get().markets[mid]));
    },
    info: () => {
        const s = State.get();
        return {
            bigQ: s.Q,
            activeMarket: s.activeMarket,
            portfolioBoost: s.portfolioBoost,
            interestBooster: s.interestBooster,
            totalInterestRate: Market.totalInterestRate(),
            markets: Object.keys(s.markets).map(id => ({
                id,
                q: s.markets[id].q,
                holding: s.markets[id].holding,
                shares: s.markets[id].shares,
                pool: s.markets[id].pool,
                poolMax: Market.poolMax(id),
                canReset: Market.canReset(id).ok,
                canCashOut: Market.canCashOut(id).ok
            }))
        };
    },
    give: n => {
        State.get().Q += n;
        State.get().total += n;
        UI.render();
        return "Big Q: " + Format.num(State.get().Q);
    },
    setQ: n => {
        State.get().Q = n;
        UI.render();
    },
    giveMarket: (id, n) => {
        const mid = id || State.get().activeMarket;
        State.get().markets[mid].q += n;
        UI.render();
    },
    setMarketQ: (id, n) => {
        const mid = id || State.get().activeMarket;
        State.get().markets[mid].q = n;
        UI.render();
    },
    setPool: (id, n) => {
        const mid = id || State.get().activeMarket;
        State.get().markets[mid].pool = n;
        UI.render();
    },
    stuck: id => {
        const mid = id || State.get().activeMarket;
        const mk = State.get().markets[mid];
        mk.q = 0;
        mk.holding = 0;
        mk.costBasis = 0;
        UI.render();
        return "Market " + mid + " forced stuck. Reset button should appear.";
    },
    resetMarket: id => {
        const mid = id || State.get().activeMarket;
        const r = Market.resetMarket(mid);
        if (r.ok) UI.toast("Debug reset · +" + Format.num(r.amount) + " q");
        else UI.toast("Reset rejected: " + r.reason);
        UI.render();
        return r;
    },
    cashOut: id => {
        const mid = id || State.get().activeMarket;
        const r = Market.cashOut(mid);
        UI.render();
        return r;
    },
    profit: (amount, id) => {
        const mid = id || State.get().activeMarket;
        const mk = State.get().markets[mid];
        const amt = amount ?? 100;

        mk.q += amt;

        if (amt > 0) {
            mk.lifetimeProfit += amt;

            /* Route to pool using updated poolMax (multiplier grew) */
            const cap = Market.poolMax(mid);
            const route = amt * Config.POOL_ROUTE;
            mk.pool = Math.min(cap, mk.pool + route);

            /* Settle the full 60s of interest from this trade.
           ∫₀⁶⁰ amt × COEF × boost × √(1 − t/60) dt = amt × COEF × boost × 40 */
            const interestMult = Market.interestBoostMult();
            const totalInterest =
                amt * Config.INTEREST_COEF * interestMult * 40;
            mk.pool = Math.min(cap, mk.pool + totalInterest);

            /* Mirror what sellUnits writes — "Last sell" row updates */
            mk.lastSellProfit = amt;
            mk.lastSellTotal = amt;
            mk.lastSellTime = Date.now();
        }

        /* Interest window considered fully elapsed */
        mk.recentProfit = 0;
        mk.interestExpiresAt = 0;

        Save.write();
        UI.render();

        if (amt > 0) {
            UI.toast("+" + Format.num(amt) + " q profit · pool fed");
        } else if (amt < 0) {
            UI.toast("−" + Format.num(Math.abs(amt)) + " q loss");
        }

        return {
            profit: amt,
            pool: mk.pool,
            cap: Market.poolMax(mid),
            lifetimeProfit: mk.lifetimeProfit,
            multiplier: Market.marketMultiplier(mid)
        };
    },
    tradeCycle: (id, n = 1) => {
        const mid = id || State.get().activeMarket;
        const mk = State.get().markets[mid];
        const t = Date.now() / 1000;
        const nat = Market.naturalPrice(mid, t);

        const lowPrice = nat * 0.7 * (1 + Config.TRADING_FEE);
        const highPrice = nat * 1.3;

        const needed = lowPrice * n;
        let toppedUp = 0;
        if (mk.q < needed) {
            toppedUp = needed - mk.q;
            mk.q = needed;
        }

        const buyR = Market.buyUnits(mid, n, t, lowPrice);
        if (buyR.bought === 0) {
            UI.toast("Debug trade: buy failed");
            return { error: "buy-failed", buyR, toppedUp };
        }

        const sellR = Market.sellUnits(mid, n, t, highPrice);
        if (sellR.sold === 0) {
            UI.toast("Debug trade: sell failed");
            return { error: "sell-failed", sellR, toppedUp };
        }

        /* Interest window is now LIVE. Do NOT settle.
       Use QUANTA.advance(60) to simulate the accrual, or
       QUANTA.profit(n) for instant settled math. */

        Save.write();
        UI.render();

        if (sellR.profit > 0) {
            UI.toast(
                "+" +
                    Format.num(sellR.profit) +
                    " q profit · interest window open"
            );
        }

        return {
            bought: buyR.bought,
            sold: sellR.sold,
            profit: sellR.profit,
            buyPrice: lowPrice,
            sellPrice: highPrice,
            pool: mk.pool,
            poolCap: Market.poolMax(mid),
            lifetimeProfit: mk.lifetimeProfit,
            multiplier: Market.marketMultiplier(mid),
            interestRate: Market.currentInterestRate(mid),
            toppedUp
        };
    },

    advance: (seconds, id) => {
        const mid = id || State.get().activeMarket;
        const mk = State.get().markets[mid];
        const startPool = mk.pool;
        const startRate = Market.currentInterestRate(mid);

        /* Run tick in small steps with a fake clock so the interest
       decay curve integrates properly (not one big instant step). */
        const stepDt = 0.1;
        const steps = Math.ceil(seconds / stepDt);
        const actualDt = seconds / steps;
        const startNow = Date.now();
        for (let i = 0; i < steps; i++) {
            Market.tick(actualDt, startNow + i * actualDt * 1000);
        }

        UI.render();

        return {
            advanced: seconds + "s",
            poolBefore: startPool,
            poolAfter: mk.pool,
            gained: mk.pool - startPool,
            interestStart: startRate,
            interestEnd: Market.currentInterestRate(mid),
            interestExpiredAt: mk.interestExpiresAt
        };
    },
    fillPool: id => {
        const mid = id || State.get().activeMarket;
        State.get().markets[mid].pool = Market.poolMax(mid);
        UI.render();
        return "Pool filled to cap (" + Format.num(Market.poolMax(mid)) + " q)";
    },
    canCashOut: id => {
        const mid = id || State.get().activeMarket;
        return Market.canCashOut(mid);
    },
    clearCooldowns: () => {
        const s = State.get();
        for (const id in s.markets) {
            s.markets[id].resetCooldown = 0;
            s.markets[id].cashOutCooldown = 0;
        }
        UI.render();
        return "All cooldowns cleared";
    },
    save: () => {
        Save.write();
        return "Saved";
    },
    wipe: () => {
        Save.wipe();
        location.reload();
    }
};


/*
// Fresh market, verify every step
QUANTA.tradeCycle()
// 1. Real buy: q -= buyPrice, holding += 1, costBasis += buyPrice
// 2. Real sell: q += sellPrice, holding -= 1, profit computed
// 3. Pool route: pool += profit × 0.5
// 4. Interest window: recentProfit set, expiresAt = now + 60s
// 5. Toast, save, render

QUANTA.advance(60)
// 6. Interest accrues over 60s via tick(), using proper √(1 - t/60) decay
// 7. Pool caps at poolMax if necessary
// 8. Cooldowns decay

QUANTA.cashOut()
// 9. Pool → Big Q, milestone check, reset

// Full cycle hit, no shortcuts.
*/