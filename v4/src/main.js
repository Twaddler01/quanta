import { Save, State } from "./config.js";
import { UI } from "./ui.js";
import { Game } from "./game.js";
import { Market } from "./market.js";
import { Format } from "./util.js";

Save.read();
UI.build();
Game.boot();

/* ============================================================
   Dev console helpers — open devtools and type QUANTA.<cmd>
   Intended for testing stuck scenarios, reset behavior,
   and forced state transitions. Bypasses UI/confirm where
   useful; exercises real game logic where it matters.
   ============================================================ */
window.QUANTA = {
    /* --- inspection --- */
    state: () => JSON.parse(JSON.stringify(State.get())),
    market: (id) => {
        const mid = id || State.get().activeMarket;
        return JSON.parse(JSON.stringify(State.get().markets[mid]));
    },
    info: () => {
        const s = State.get();
        return {
            bigQ: s.Q,
            entropy: s.entropy,
            activeMarket: s.activeMarket,
            markets: Object.keys(s.markets).map(id => ({
                id,
                q: s.markets[id].q,
                holding: s.markets[id].holding,
                shares: s.markets[id].shares,
                resetCooldown: s.markets[id].resetCooldown,
                canReset: Market.canReset(id).ok
            }))
        };
    },

    /* --- state manipulation --- */
    give: (n) => {
        State.get().Q += n;
        State.get().total += n;
        UI.render();
        return "Big Q: " + Format.num(State.get().Q);
    },
    setQ: (n) => { State.get().Q = n; UI.render(); },
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
    setEntropy: (n) => { State.get().entropy = n; UI.render(); },

    /* --- testing helpers --- */
    stuck: (id) => {
        const mid = id || State.get().activeMarket;
        const mk = State.get().markets[mid];
        mk.q = 0;
        mk.holding = 0;
        mk.costBasis = 0;
        UI.render();
        return "Market " + mid + " forced stuck (q=0, holding=0). Reset button should now appear.";
    },
    resetMarket: (id) => {
        const mid = id || State.get().activeMarket;
        const r = Market.resetMarket(mid);
        if (r.ok) {
            UI.toast("Debug reset · +" + Format.num(r.amount) + " q");
        } else {
            UI.toast("Reset rejected: " + r.reason);
        }
        UI.render();
        return r;
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

    /* --- save management --- */
    save: () => { Save.write(); return "Saved"; },
    wipe: () => { Save.wipe(); location.reload(); }
};