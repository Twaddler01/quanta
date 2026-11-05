import { on } from "./dom.js";
import { Config } from "./config.js";
import { State } from "./state.js";
import { Calc } from "./calc.js";
import { Format } from "./format.js";
import { Save } from "./save.js";
import { UI } from "./ui.js";
import { WaveScope } from "./waveScope.js";
import { Wave } from "./wave.js";
import { Features } from "./features.js";
import { clock } from "./clock.js";

export const Game = (() => {
    let lastFrame = performance.now();
    let renderAcc = 0;
    let lastWall = Date.now();

    /* ---------------- actions ---------------- */

    function observe() {
        const gain = Calc.tapGain();
        const s = State.get();
        s.quanta += gain;
        s.total += gain;
        s.taps += 1;
        UI.floater(document.getElementById("floaters"), "+" + Format.num(gain));
        if (navigator.vibrate) {
            try {
                navigator.vibrate(8);
            } catch (e) {}
        }
    }

    function consume() {
        const s = State.get();
        const cost = Calc.surgeCost();
        if (s.quanta < cost) return;
        const gain = Calc.surgeGain();
        s.quanta -= cost;
        s.surge = (s.surge || 0) + gain;
        UI.floater(
            document.getElementById("floaters"),
            "+" + Format.plain(gain) + " surge",
            "surge"
        );
        if (navigator.vibrate) {
            try {
                navigator.vibrate(10);
            } catch (e) {}
        }
        UI.render();
        Save.write();
    }

    function collapse() {
        const s = State.get();
        const cost = Calc.collapseCost();
        if (s.quanta < cost) return;

        const quality = Wave.quality(clock());
        const gain = Calc.coherenceGain(clock());

        s.quanta -= cost;
        s.coherence += gain;
        s.collapses += 1;

        UI.floater(
            document.getElementById("cohFloaters"),
            "+" + Format.num(gain) + " 𝒞",
            "coh"
        );

        /* Feature hooks — collapse-related */
        Features.hook("onCollapse", s, {
            gain,
            quality,
            floater: (text, cls) =>
                UI.floater(document.getElementById("cohFloaters"), text, cls)
        });

        if (navigator.vibrate) {
            try {
                navigator.vibrate(12);
            } catch (e) {}
        }
        UI.render();
        Save.write();
    }

    /* ---------------- buy (unified) ---------------- */

    function findUpgrade(id) {
        let def = Config.UPGRADES.find(d => d.id === id);
        if (def) return { def, kind: "up", currency: "quanta", store: "up" };

        def = Config.MODIFIERS.find(d => d.id === id);
        if (def) return { def, kind: "mod", currency: "quanta", store: "mod" };

        def = Config.PHASE_UPGRADES.find(d => d.id === id);
        if (def)
            return { def, kind: "cUp", currency: "coherence", store: "cUp" };

        for (const f of Features.all()) {
            const fc = (f.cards || []).find(c => c.id === id);
            if (fc)
                return {
                    def: fc,
                    kind: "feat",
                    currency: fc.currency || "quanta",
                    store: "feat",
                    featureId: f.id
                };
        }
        return null;
    }

    function buy(id /*, kind — legacy arg, unused */) {
        const entry = findUpgrade(id);
        if (!entry) return;

        /* Feature-level guard — ignore if the owning feature is unregistered */
        if (
            entry.kind === "feat" &&
            entry.featureId &&
            !Features.has(entry.featureId)
        )
            return;

        const s = State.get();
        const container = s[entry.store];
        if (!container) return;

        const lv = container[id] || 0;
        const cost = entry.def.cost(lv);
        const bank = entry.currency === "coherence" ? s.coherence : s.quanta;
        if (bank < cost) return;

        if (entry.currency === "coherence") s.coherence -= cost;
        else s.quanta -= cost;

        container[id] = lv + 1;

        UI.flash(entry.kind + "-" + id);
        UI.render();
        Save.write();
    }

    function reset() {
        if (!confirm("Erase all progress and start over?")) return;
        Save.wipe();
        location.reload();
    }

    /* ---------------- entropy ---------------- */

    function checkEntropyUnlock() {
        const s = State.get();
        if (!s.entropyUnlocked && s.total >= Config.ENTROPY.unlockTotal) {
            s.entropyUnlocked = true;
            UI.refreshEntropyVisibility();
            UI.toast(
                "ENTROPY UNLOCKED at " +
                    Format.num(Config.ENTROPY.unlockTotal) +
                    " Q"
            );
        }
    }

    function checkEntropyMilestones() {
        const s = State.get();
        const passed = Config.ENTROPY.milestones.filter(
            m => (s.entropy || 0) >= m.at
        ).length;
        if (passed > (s.entropyMilestoneCount || 0)) {
            const newest = Config.ENTROPY.milestones[passed - 1];
            UI.toast("ENTROPY MILESTONE — " + newest.label);
            s.entropyMilestoneCount = passed;
        }
    }

    /* ---------------- input ---------------- */

    function wireInputs() {
        const tapBtn = document.getElementById("tapBtn");
        on(tapBtn, "pointerdown", e => {
            e.preventDefault();
            tapBtn.classList.add("pressed");
            observe();
        });
        const release = () => tapBtn.classList.remove("pressed");
        on(tapBtn, "pointerup", release);
        on(tapBtn, "pointercancel", release);
        on(tapBtn, "pointerleave", release);

        on(document.getElementById("consumeBtn"), "pointerdown", e => {
            e.preventDefault();
            consume();
        });
        on(document.getElementById("collapseBtn"), "pointerdown", e => {
            e.preventDefault();
            collapse();
        });

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                Save.write();
                return;
            }
            const away = (Date.now() - lastWall) / 1000;
            const s = State.get();

            if (s.surge > 0) {
                s.surge *= Math.pow(
                    1 - Config.SURGE.decay,
                    Math.min(away, Config.OFFLINE_CAP)
                );
                if (s.surge < 0.001) s.surge = 0;
            }
            if (away > 1) {
                const g =
                    Calc.effectiveQps() * Math.min(away, Config.OFFLINE_CAP);
                if (g > 0) {
                    s.quanta += g;
                    s.total += g;
                }
                if (s.entropyUnlocked) {
                    s.entropy +=
                        Calc.entropyRate() * Math.min(away, Config.OFFLINE_CAP);
                }
            }
            lastWall = Date.now();
            lastFrame = performance.now();
            WaveScope.resize();
            UI.render();
        });

        window.addEventListener("pagehide", Save.write);
        window.addEventListener("beforeunload", Save.write);
    }

    /* ---------------- main loop ---------------- */

    function frame(now) {
        let dt = (now - lastFrame) / 1000;
        lastFrame = now;
        lastWall = Date.now();

        if (!isFinite(dt) || dt < 0) dt = 0;
        if (dt > 86400) dt = 86400;

        const s = State.get();

        /* 1. Surge decay */
        if (s.surge > 0) {
            s.surge *= Math.pow(1 - Config.SURGE.decay, dt);
            if (s.surge < 0.001) s.surge = 0;
        }

        /* 2. Passive gain */
        const passive = Calc.effectiveQps() * dt;
        if (passive > 0) {
            s.quanta += passive;
            s.total += passive;
        }

        /* 3. Feature ticks (may add quanta) */
        Features.hook("onTick", s, dt, { tapGain: Calc.tapGain() });

        /* 4. Entropy */
        checkEntropyUnlock();
        if (s.entropyUnlocked) {
            s.entropy = (s.entropy || 0) + Calc.entropyRate() * dt;
            checkEntropyMilestones();
        }

        /* 5. Throttled render */
        renderAcc += dt;
        if (renderAcc >= 0.066) {
            renderAcc = 0;
            UI.render();
        }

        WaveScope.draw();
        requestAnimationFrame(frame);
    }

    function boot() {
        wireInputs();
        checkEntropyUnlock();
        UI.refreshEntropyVisibility();
        WaveScope.setVisible(
            document.querySelector(".view.active").dataset.view === "coherence"
        );
        UI.render();
        setInterval(Save.write, 15000);
        lastFrame = performance.now();
        lastWall = Date.now();
        requestAnimationFrame(frame);
    }

    return { boot, observe, consume, collapse, buy, reset };
})();
