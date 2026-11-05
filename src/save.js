import { Config } from "./config.js";
import { State } from "./state.js";
import { Calc } from "./calc.js";
import { Format } from "./format.js";
import { toast } from "./toast.js";

export const Save = (() => {
    const num = v => (Number.isFinite(+v) ? +v : 0);
    const clampInt = v => Math.max(0, Math.floor(num(v)));

    function write() {
        const s = State.get();
        s.lastSave = Date.now();
        try {
            localStorage.setItem(Config.SAVE_KEY, JSON.stringify(s));
        } catch (e) {}
    }

    function read() {
        let raw;
        try {
            raw = localStorage.getItem(Config.SAVE_KEY);
        } catch (e) {
            return false;
        }
        if (!raw) return false;

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (e) {
            return false;
        }
        if (!parsed || typeof parsed !== "object") return false;

        const def = State.blank();
        const merged = {
            quanta: num(parsed.quanta),
            total: num(parsed.total),
            taps: num(parsed.taps),
            coherence: num(parsed.coherence),
            collapses: clampInt(parsed.collapses),
            surge: num(parsed.surge),
            entropy: num(parsed.entropy),
            entropyUnlocked: !!parsed.entropyUnlocked,
            entropyMilestoneCount: clampInt(parsed.entropyMilestoneCount),
            start: num(parsed.start) || Date.now(),
            lastSave: num(parsed.lastSave) || Date.now(),
            up: Object.assign({}, def.up, parsed.up || {}),
            mod: Object.assign({}, def.mod, parsed.mod || {}),
            cUp: Object.assign({}, def.cUp, parsed.cUp || {}),
            feat: Object.assign({}, def.feat, parsed.feat || {}),
            _tickAcc: num(parsed._tickAcc) // preserves partial tick on reload
        };
        for (const k in merged.up) merged.up[k] = clampInt(merged.up[k]);
        for (const k in merged.mod) merged.mod[k] = clampInt(merged.mod[k]);
        for (const k in merged.cUp) merged.cUp[k] = clampInt(merged.cUp[k]);
        for (const k in merged.feat) merged.feat[k] = clampInt(merged.feat[k]);

        /* Migration: auto-unlock if saved total already crosses the bar */
        if (merged.total >= Config.ENTROPY.unlockTotal)
            merged.entropyUnlocked = true;

        /* Derive milestone count from current entropy (defensive) */
        merged.entropyMilestoneCount = Config.ENTROPY.milestones.filter(
            m => merged.entropy >= m.at
        ).length;

        State.replace(merged);

        const away = Math.min(
            (Date.now() - merged.lastSave) / 1000,
            Config.OFFLINE_CAP
        );

        if (away > 0.5 && merged.surge > 0) {
            merged.surge *= Math.pow(1 - Config.SURGE.decay, away);
            if (merged.surge < 0.001) merged.surge = 0;
        }

        /* Entropy also accumulates offline (at the rate as of load) */
        if (away > 1 && merged.entropyUnlocked) {
            merged.entropy += Calc.entropyRate() * away;
            merged.entropyMilestoneCount = Config.ENTROPY.milestones.filter(
                m => merged.entropy >= m.at
            ).length;
        }

        if (away > 5) {
            const gain = Calc.effectiveQps() * away;
            if (gain > 0) {
                const s = State.get();
                s.quanta += gain;
                s.total += gain;
                setTimeout(
                    () =>
                        toast(
                            "Offline " +
                                Format.time(away) +
                                " → +" +
                                Format.num(gain) +
                                " Q"
                        ),
                    400
                );
            }
        }
        return true;
    }

    function wipe() {
        try {
            localStorage.removeItem(Config.SAVE_KEY);
        } catch (e) {}
    }

    return { write, read, wipe };
})();
