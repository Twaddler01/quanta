import { Config } from "./config.js";
import { State } from "./state.js";
import { Wave } from "./wave.js";

export const Calc = (() => {
    const featLevel = id => State.get().feat?.[id] || 0;
    const gdpStateMult = () => Config.FEATURES?.exchange?.gdpStateMult?.() ?? 1;

    function softcapThreshold(kind) {
        return (
            Config.SOFTCAP[kind].base *
            Math.pow(Config.BUFFER_MULT, State.get().up.buffer)
        );
    }

    function softcap(v, kind) {
        const b = softcapThreshold(kind);
        if (v <= b) return v;
        return b * Math.pow(v / b, Config.SOFTCAP[kind].pow);
    }

    function channelMult(target) {
        let m = 1;
        for (const mod of Config.MODIFIERS) {
            if (mod.target === target || mod.target === "all") {
                m *= 1 + mod.weight * (State.get().mod[mod.id] || 0);
            }
        }
        return m;
    }

    /* --- Entropy --- */
    const entropyUnlocked = () => {
        const s = State.get();
        return !!(s.entropyUnlocked || s.total >= Config.ENTROPY.unlockTotal);
    };

    function totalUpgradeLevels() {
        const s = State.get();
        let n = 0;
        for (const v of Object.values(s.up)) n += v || 0;
        for (const v of Object.values(s.mod)) n += v || 0;
        for (const v of Object.values(s.cUp)) n += v || 0;
        return n;
    }

    function milestonesPassed() {
        const e = State.get().entropy || 0;
        return Config.ENTROPY.milestones.filter(m => e >= m.at);
    }

    function entropyRateMult() {
        let m = 1;
        for (const ms of milestonesPassed()) {
            if (ms.kind === "rateMult") m *= ms.amount;
        }
        return m;
    }

    function entropyMultBonus() {
        let b = 1;
        for (const ms of milestonesPassed()) {
            if (ms.kind === "multBonus") b *= ms.amount;
        }
        return b;
    }

    function entropyRate() {
        if (!entropyUnlocked()) return 0;
        const s = State.get();
        const breadth =
            totalUpgradeLevels() + s.collapses * Config.ENTROPY.collapseWeight;
        return Config.ENTROPY.baseRate * (1 + breadth) * entropyRateMult();
    }

    function entropyMult() {
        if (!entropyUnlocked()) return 1;
        const e = State.get().entropy || 0;
        const base = (1 + Config.ENTROPY.multPerEntropy * e) * entropyMultBonus();
        const wave = Config.FEATURES?.exchange?.entropyWaveMult?.() ?? 1;
        return base * wave;
    }

    function globalMult() {
        const s = State.get();
        return (
            Math.pow(Config.RESONANCE_BASE, s.up.resonance) *
            Math.pow(Config.PHASE_BASE, s.cUp.lock) *
            entropyMult()
        );
    }

    const waveMult = () => Config.FEATURES?.exchange?.waveMult?.() ?? 1;

    const rawTap = () =>
        (1 + State.get().up.observer) *
        channelMult("tap") *
        globalMult() *
        gdpStateMult() *
        waveMult();
    const tapGain = () => softcap(rawTap(), "tap");

    const rawAuto = () =>
        1.0 *
        State.get().up.collector *
        channelMult("auto") *
        globalMult() *
        gdpStateMult() *
        waveMult();
    const qps = () => softcap(rawAuto(), "auto");
    const coherenceBase = () =>
        Math.pow(Config.COHERENCE_BASE, State.get().cUp.harm);
    const coherenceGain = t => coherenceBase() * Wave.quality(t);
    const collapseCost = () => 25 * Math.pow(1.35, State.get().collapses);

    /* --- Surge --- */
    const surgeMult = () =>
        1 + Config.SURGE.coefficient * Math.log10(1 + (State.get().surge || 0));
    const effectiveQps = () => qps() * surgeMult();

    function surgeCost() {
        const q = State.get().quanta;
        return Math.max(Config.SURGE.minCost, q * Config.SURGE.costPct);
    }
    function surgeReference() {
        const q = State.get().quanta;
        return Math.max(Config.SURGE.minReference, Math.sqrt(q * 100));
    }
    function surgeGain() {
        return Math.log10(1 + surgeCost() / surgeReference());
    }
    
    return {
        featLevel,
        gdpStateMult,
        waveMult,
        softcap,
        softcapThreshold,
        channelMult,
        globalMult,
        rawTap,
        tapGain,
        rawAuto,
        qps,
        coherenceBase,
        coherenceGain,
        collapseCost,
        surgeMult,
        effectiveQps,
        surgeCost,
        surgeReference,
        surgeGain,
        entropyUnlocked,
        totalUpgradeLevels,
        milestonesPassed,
        entropyRate,
        entropyMult,
        entropyRateMult,
        entropyMultBonus
    };
})();
