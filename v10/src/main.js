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
            passiveTotal:
                Market.levelPassiveTotal() + Market.passiveYieldRate(),
            levelPassive: Market.levelPassiveTotal(),
            passiveYield: Market.passiveYieldRate(),
            reaction: s.reaction,
            brokerLicense: s.brokerLicense || 0,
            signalMult: Market.signalMult(),
            totalLevels: Market.totalLevels(),
            streakBonus: Market.streakBonus(s.activeMarket),
            markets: Config.MARKETS.map(m => ({
                id: m.id,
                debug: !!m.debug,
                q: s.markets[m.id].q,
                pool: s.markets[m.id].pool,
                poolMax: Market.poolMax(m.id),
                cashOuts: s.markets[m.id].cashOutCount,
                level: s.markets[m.id].level || 0,
                speedLevel: s.markets[m.id].speedLevel || 0,
                streak: s.markets[m.id].streak || 0,
                streakTimeLeftMs: Market.streakTimeLeftMs(m.id),
                sellPrice: Market.sellPrice(m.id)(Date.now() / 1000),
                sellPriceBoosted: Market.sellPriceBoosted(m.id, Date.now() / 1000),
                stars: s.markets[m.id].stars || 0,
                starMult: Market.starMult(m.id),
                levelPassive: Market.levelPassiveRate(m.id)
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
    fillPool: id => {
        const mid = id || State.get().activeMarket;
        State.get().markets[mid].pool = Market.poolMax(mid);
        UI.render();
        return "Pool filled to " + Format.num(Market.poolMax(mid));
    },
    setSpeedLevel: (id, n) => {
        const mid = id || State.get().activeMarket;
        const mk = State.get().markets[mid];
        mk.speedLevel = Math.max(0, Math.min(Config.SPEED_MAX_LEVEL, n | 0));
        UI.render();
        return (
            "Speed level: " +
            mk.speedLevel +
            " · wave ×" +
            Market.marketSpeedMult(mid).toFixed(2)
        );
    },
    setStreak: (id, n) => {
        const mid = id || State.get().activeMarket;
        const mk = State.get().markets[mid];
        mk.streak = Math.max(0, n | 0);
        mk.lastStreakAt = Date.now();
        UI.render();
        return (
            "Streak: " +
            mk.streak +
            " · bonus ×" +
            (1 + Market.streakBonus(mid)).toFixed(2)
        );
    },
    setStars: (id, n) => {
        const mid = id || State.get().activeMarket;
        const mk = State.get().markets[mid];
        mk.stars = Math.max(0, n | 0);
        UI.render();
        return (
            "Stars: ⭐×" + mk.stars + " · ×" + Market.starMult(mid).toFixed(2)
        );
    },
    setCashOuts: (id, n) => {
        const mid = id || State.get().activeMarket;
        const mk = State.get().markets[mid];
        mk.cashOutCount = Math.max(0, n | 0);
        mk.level = Config.computeLevel(mk.cashOutCount);
        UI.render();
        return "Cash outs: " + mk.cashOutCount + " · Level: " + mk.level;
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
