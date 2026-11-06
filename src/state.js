export const State = (() => {
    function blank() {
        return {
            quanta: 0,
            total: 0,
            taps: 0,
            coherence: 0,
            collapses: 0,
            surge: 0,
            entropy: 0,
            entropyUnlocked: false,
            entropyMilestoneCount: 0,
            start: Date.now(),
            lastSave: Date.now(),
            up: { observer: 0, collector: 0, resonance: 0, buffer: 0 },
            mod: { psi: 0, phi: 0, lam: 0 },
            cUp: { stab: 0, harm: 0, lock: 0 },
            feat: { tickRate: 0, collapseEcho: 0, exchange: 0 },
            portfolio: {
                holdings: { bonds: 0 },
                auto: { bonds: false },
                everVisited: false
            },
            gdp: 0,
            _waveLockUntil: 0,
            _cashOutCooldownUntil: 0,
            _lastCashOutAt: 0
        };
    }
    let s = blank();
    return {
        get: () => s,
        blank,
        replace(next) {
            s = next;
            return s;
        }
    };
})();
