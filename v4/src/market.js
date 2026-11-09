import { Config, State } from "./config.js";

export const Market = (() => {
    const def = id => Config.MARKETS.find(m => m.id === id);

    function basePrice() {
        const s = State.get();
        return (
            Config.BASE_PRICE * (1 + s.entropy * Config.PRICE_ENTROPY_GROWTH)
        );
    }

    function marketBasePrice(id) {
        return basePrice() * def(id).priceMult;
    }

    function naturalPrice(id, t) {
        const m = def(id);
        const base = marketBasePrice(id);
        const phase = State.get().noisePhase;
        const vol = m.volatility;

        const weather =
            Math.sin((t / Config.WEATHER_PERIOD_1) * Math.PI * 2) *
                Config.WEATHER_AMP_1 *
                vol +
            Math.sin((t / Config.WEATHER_PERIOD_2) * Math.PI * 2 + 0.7) *
                Config.WEATHER_AMP_2 *
                vol;
        const noise =
            Math.sin(t * 3.7 + phase) * Config.NOISE_AMP * 0.6 * vol +
            Math.sin(t * 8.3 + phase * 1.7) * Config.NOISE_AMP * 0.4 * vol;
        return Math.max(base * 0.1, base * (1 + weather + noise));
    }

    function movingAverage(id, t) {
        const N = 60,
            SPAN = 300;
        const m = def(id);
        const base = marketBasePrice(id);
        const phase = State.get().noisePhase;
        const vol = m.volatility;
        let sum = 0;
        for (let i = 0; i < N; i++) {
            const tt = t - SPAN + (i / N) * SPAN;
            const weather =
                Math.sin((tt / Config.WEATHER_PERIOD_1) * Math.PI * 2) *
                    Config.WEATHER_AMP_1 *
                    vol +
                Math.sin((tt / Config.WEATHER_PERIOD_2) * Math.PI * 2 + 0.7) *
                    Config.WEATHER_AMP_2 *
                    vol;
            const noise =
                Math.sin(tt * 3.7 + phase) * Config.NOISE_AMP * 0.6 * vol +
                Math.sin(tt * 8.3 + phase * 1.7) * Config.NOISE_AMP * 0.4 * vol;
            sum += base * (1 + weather + noise);
        }
        return sum / N;
    }

    const buyPrice = (id, t) => naturalPrice(id, t) * (1 + Config.TRADING_FEE);
    const sellPrice = id => t => naturalPrice(id, t);

    function multiplier(id) {
        const m = def(id);
        const lifetime = State.get().markets[id].lifetimeProfit;
        return 1 + Math.sqrt(Math.max(0, lifetime) / m.threshold);
    }

    function contribution(id) {
        return multiplier(id) * def(id).tierWeight;
    }

    function totalContribution() {
        let sum = 0;
        for (const m of Config.MARKETS) sum += contribution(m.id);
        return sum;
    }

    function portfolioBoostMult() {
        const lv = State.get().portfolioBoost || 0;
        return 1 + lv * Config.PORTFOLIO_BOOST_PER_LEVEL;
    }

    function passiveIncome() {
        return totalContribution() * Config.PASSIVE_RATE * portfolioBoostMult();
    }

    function isUnlocked(id) {
        const m = def(id);
        return State.get().total >= m.unlockAt;
    }

    function shareUpgradeCost(id) {
        const shares = State.get().markets[id].shares;
        return (
            Config.SHARE_UPGRADE_BASE *
            Math.pow(Config.SHARE_UPGRADE_MULT, shares)
        );
    }

    function upgradeShares(id) {
        const s = State.get();
        const mk = s.markets[id];
        const cost = shareUpgradeCost(id);
        if (mk.q < cost) return false;
        mk.q -= cost;
        mk.shares += 1;
        return true;
    }

    function buyUnits(id, n, t) {
        const s = State.get();
        const mk = s.markets[id];
        const avail = mk.shares - mk.holding;
        n = Math.min(n, avail);
        if (n <= 0) return { bought: 0, cost: 0 };

        const price = buyPrice(id, t);
        const maxAfford = Math.floor(mk.q / price);
        n = Math.min(n, maxAfford);
        if (n <= 0) return { bought: 0, cost: 0 };

        const cost = n * price;
        mk.q -= cost;
        mk.holding += n;
        mk.costBasis += cost;
        mk.lastBuyPrice = price;
        mk.lastBuyTime = Date.now();
        return { bought: n, cost, price };
    }

    function sellUnits(id, n, t) {
        const s = State.get();
        const mk = s.markets[id];
        n = Math.min(n, mk.holding);
        if (n <= 0) return { sold: 0, gain: 0, profit: 0 };

        const price = sellPrice(id)(t);
        const gain = n * price;
        const avgCost = mk.holding > 0 ? mk.costBasis / mk.holding : 0;
        const profit = n * (price - avgCost);

        mk.q += gain;
        mk.holding -= n;
        mk.costBasis -= avgCost * n;
        if (mk.holding === 0) mk.costBasis = 0;

        if (profit > 0) {
            mk.lifetimeProfit += profit;
            s.entropy += Config.ENTROPY_PER_TRADE;
        }

        mk.lastSellProfit = profit;
        mk.lastSellTotal = gain;
        mk.lastSellTime = Date.now();
        return { sold: n, gain, profit, price };
    }

    function cashOutValue(id) {
        const c = contribution(id);
        const s = State.get();
        const mk = s.markets[id];
        const holdSec = (Date.now() - (mk.lastCashOut || s.start)) / 1000;
        const capped = Math.min(holdSec, Config.CASHOUT_HOLD_CAP_SEC);
        const holdBonus = Math.max(
            0.1,
            Math.pow(capped / 60, Config.CASHOUT_HOLD_EXP)
        );
        const entropyMult = 1 + s.entropy / Config.CASHOUT_ENTROPY_DIVISOR;
        const base = c * Config.CASHOUT_BASE * portfolioBoostMult();
        return base * entropyMult * holdBonus;
    }

    function canCashOut(id) {
        const s = State.get();
        const mk = s.markets[id];
        if (mk.cashOutCooldown > 0)
            return { ok: false, reason: "cooldown", left: mk.cashOutCooldown };
        if (contribution(id) <= 0.01)
            return { ok: false, reason: "low-contribution" };
        return { ok: true };
    }

    function cashOut(id) {
        const check = canCashOut(id);
        if (!check.ok) return { ok: false, reason: check.reason };

        const s = State.get();
        const mk = s.markets[id];
        const value = cashOutValue(id);

        s.Q += value;
        s.total += value;
        mk.lastCashOut = Date.now();
        mk.cashOutCooldown = Config.CASHOUT_COOLDOWN;
        return { ok: true, value };
    }

    function portfolioBoostCost() {
        const lv = State.get().portfolioBoost || 0;
        return (
            Config.PORTFOLIO_BOOST_BASE *
            Math.pow(Config.PORTFOLIO_BOOST_MULT, lv)
        );
    }

    function upgradePortfolio() {
        const s = State.get();
        const cost = portfolioBoostCost();
        if (s.Q < cost) return false;
        s.Q -= cost;
        s.portfolioBoost += 1;
        return true;
    }

    function unlockMarket(id) {
        return isUnlocked(id);
    }

    function totalShares() {
        let sum = 0;
        for (const m of Config.MARKETS) sum += State.get().markets[m.id].shares;
        return sum;
    }

    function tick(dt) {
        const s = State.get();
        s.entropy += Config.ENTROPY_BASE_RATE * dt;
        const income = Config.BASE_INCOME + passiveIncome();
        s.Q += income * dt;
        s.total += income * dt;
        for (const m of Config.MARKETS) {
            const mk = s.markets[m.id];
            if (mk.cashOutCooldown > 0)
                mk.cashOutCooldown = Math.max(0, mk.cashOutCooldown - dt);
        }
    }

    return {
        def,
        basePrice,
        marketBasePrice,
        naturalPrice,
        movingAverage,
        buyPrice,
        sellPrice,
        multiplier,
        contribution,
        totalContribution,
        portfolioBoostMult,
        passiveIncome,
        isUnlocked,
        shareUpgradeCost,
        upgradeShares,
        buyUnits,
        sellUnits,
        cashOutValue,
        canCashOut,
        cashOut,
        portfolioBoostCost,
        upgradePortfolio,
        unlockMarket,
        totalShares,
        tick
    };
})();
