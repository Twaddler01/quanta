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

    const quality = t => 0.1 + 0.9 * value(t);

    return { raw, floor, value, quality };
})();
