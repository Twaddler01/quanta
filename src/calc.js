import { Config } from "./config.js";
import { State } from "./state.js";
import { Wave } from "./wave.js";

export const Calc = (() => {
    const featLevel = id => State.get().feat?.[id] || 0;
    const gdpStateMult = () => Config.FEATURES?.exchange?.gdpStateMult?.() ?? 1;
    const waveMult = () => Config.FEATURES?.exchange?.waveMult?.() ?? 1;

    const baselineIncome = () => Config.BASE_INCOME;
    const dividendIncome = () =>
        Config.FEATURES?.exchange?.totalDividends?.() ?? 0;
    const income = () => baselineIncome() + dividendIncome();

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
        for (const ms of milestonesPassed())
            if (ms.kind === "rateMult") m *= ms.amount;
        return m;
    }

    function entropyMultBonus() {
        let b = 1;
        for (const ms of milestonesPassed())
            if (ms.kind === "multBonus") b *= ms.amount;
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
        const base =
            (1 + Config.ENTROPY.multPerEntropy * e) * entropyMultBonus();
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

    const coherenceBase = () =>
        Math.pow(Config.COHERENCE_BASE, State.get().cUp.harm);
    const coherenceGain = t => coherenceBase() * Wave.quality(t);
    const collapseCost = () => 25 * Math.pow(1.35, State.get().collapses);

    return {
        featLevel,
        gdpStateMult,
        waveMult,
        globalMult,
        baselineIncome,
        dividendIncome,
        income,
        coherenceBase,
        coherenceGain,
        collapseCost,
        entropyUnlocked,
        totalUpgradeLevels,
        milestonesPassed,
        entropyRate,
        entropyMult,
        entropyRateMult,
        entropyMultBonus
    };
})();
