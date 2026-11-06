import { Config, WaveFloor } from "./config.js";
import { State } from "./state.js";

export const Wave = (() => {
    const W = Config.WAVE;

    function raw(t) {
        return (
            0.5 +
            W.a1 * Math.sin(t * W.speed) +
            W.a2 * Math.sin(t * W.speed * 2.7 + 1.3) +
            W.a3 * Math.sin(t * W.speed * 4.3 + 2.1)
        );
    }

    const floor = () => WaveFloor.at(State.get().cUp.stab);

    function value(t) {
        const f = floor();
        const r = Math.min(1, Math.max(0, raw(t)));
        return f + (1 - f) * r;
    }

    const baseQuality = t =>
        W.qualityMin + (W.qualityMax - W.qualityMin) * value(t);

    function entropyBoost() {
        const ent = State.get().entropy || 0;
        return Math.min(
            W.maxEntropyQualityBoost,
            ent * W.entropyQualityPerPoint
        );
    }

    const quality = t => baseQuality(t) * (1 + entropyBoost());

    return { raw, floor, value, baseQuality, entropyBoost, quality };
})();
