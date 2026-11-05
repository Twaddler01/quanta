import { UI } from "./ui.js";
import { Game } from "./game.js";
import { Save } from "./save.js";
import { WaveScope } from "./waveScope.js";
import { Features } from "./features.js";
import { Config } from "./config.js";
import { State } from "./state.js";
import { Calc } from "./calc.js";

/* 1. Register enabled features BEFORE building UI (cards are built from them). */
for (const feature of Object.values(Config.FEATURES || {})) {
    if (feature.enabled) Features.register(feature);
}

/* 2. Build DOM shell. */
UI.build();
UI.wireShell();

/* 3. Wire actions. */
UI.setActions({
    buy: Game.buy,
    consume: Game.consume,
    collapse: Game.collapse,
    reset: Game.reset
});

/* 4. Canvas first (Save.read may queue a toast). */
WaveScope.init();

/* 5. Load save. */
Save.read();

/* 6. Start loop. */
Game.boot();

/* 7. Dev console helpers — remove this block in production if you like. */
window.QUANTA = {
    Features,
    Config,
    State,
    Calc,
    Save,

    give(q = 10000) {
        const s = State.get();
        s.quanta += q;
        s.total += q;
        UI.render();
    },
    giveCoh(c = 1000) {
        State.get().coherence += c;
        UI.render();
    },
    levelAll(n = 5) {
        const s = State.get();
        for (const k in s.up) s.up[k] = n;
        for (const k in s.mod) s.mod[k] = n;
        for (const k in s.cUp) s.cUp[k] = n;
        for (const k in s.feat) s.feat[k] = n;
        UI.render();
    },
    /** Turn a feature on/off at runtime, no reload. */
    toggle(id) {
        if (Features.has(id)) Features.unregister(id);
        else Features.register(Config.FEATURES[id]);
    }
};
