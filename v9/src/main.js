import { Config, Save, State } from "./config.js";
import { UI } from "./ui.js";
import { Game } from "./game.js";
import { Market } from "./market.js";
import { Format } from "./util.js";

Save.read();
UI.build();
Game.boot();

window.QUANTA = {
    Config,
    State,
    Market,
    UI,
    Save,
    Format,

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
            passiveTotal: Market.ipoPassiveTotal() + Market.passiveYieldRate(),
            ipoPassive: Market.ipoPassiveTotal(),
            passiveYield: Market.passiveYieldRate(),
            reaction: s.reaction,
            signalMult: Market.signalMult(),
            markets: Config.MARKETS.map(m => ({
                id: m.id,
                debug: !!m.debug,
                type: m.chartSpan ? "fast" : "wave",
                q: s.markets[m.id].q,
                pool: s.markets[m.id].pool,
                poolMax: Market.poolMax(m.id),
                stars: Market.starsOf(m.id),
                isIPO: Market.isIPO(m.id),
                canIPO: Market.canIPO(m.id).ok,
                canReopen: Market.canReopen(m.id).ok
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
        return "Market " + mid + " forced stuck.";
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
    ipoMarket: id => {
        const mid = id || State.get().activeMarket;
        const r = Market.ipoMarket(mid);
        if (r.ok)
            UI.toast(
                "Debug IPO ⭐" +
                    r.newStars +
                    " · +" +
                    Format.num(r.lump) +
                    " Q · +" +
                    Format.num(r.passive) +
                    " Q/s"
            );
        else UI.toast("IPO rejected: " + r.reason);
        UI.render();
        return r;
    },
    reopenMarket: id => {
        const mid = id || State.get().activeMarket;
        const r = Market.reopenMarket(mid);
        if (r.ok) UI.toast("Debug reopen");
        else UI.toast("Reopen rejected: " + r.reason);
        UI.render();
        return r;
    },
    rollback: id => {
        const mid = id || State.get().activeMarket;
        const r = Market.rollbackMarket(mid);
        if (r.ok)
            UI.toast(
                "Debug rollback to ⭐" +
                    r.stars +
                    " · +" +
                    Format.num(r.passive) +
                    " Q/s"
            );
        else UI.toast("Rollback rejected: " + r.reason);
        UI.render();
        return r;
    },
    setStars: (id, n) => {
        const mid = id || State.get().activeMarket;
        State.get().stars[mid] = Math.max(0, Math.min(Config.IPO_MAX_STARS, n));
        UI.render();
        return "Stars: " + State.get().stars[mid];
    },
    fillPool: id => {
        const mid = id || State.get().activeMarket;
        State.get().markets[mid].pool = Market.poolMax(mid);
        UI.render();
        return "Pool filled to " + Format.num(Market.poolMax(mid));
    },
    setLifetime: (id, n) => {
        const mid = id || State.get().activeMarket;
        State.get().markets[mid].lifetimeCashOut = n;
        UI.render();
        return "Lifetime: " + Format.num(n);
    },
    clearCooldowns: () => {
        const s = State.get();
        for (const id in s.markets) {
            s.markets[id].resetCooldown = 0;
            s.markets[id].cashOutCooldown = 0;
            s.markets[id].rideCooldownUntil = 0;
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
