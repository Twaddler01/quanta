export const State = (() => {
    function blank() {
        const emptyHoldings = {};
        const emptyBasis = {};
        const emptyAuto = {};
        for (const m of ["calm", "tidal", "vortex", "chaos"]) {
            emptyHoldings[m] = 0;
            emptyBasis[m] = 0;
            emptyAuto[m] = false;
        }
        return {
            quanta: 1000, // ← starting capital
            total: 1000,
            taps: 0,
            coherence: 0,
            collapses: 0,
            surge: 0,
            entropy: 0,
            entropyUnlocked: false,
            entropyMilestoneCount: 0,
            start: Date.now(),
            lastSave: Date.now(),
            up: { resonance: 0, buffer: 0 },
            mod: { psi: 0, phi: 0, lam: 0 },
            cUp: { stab: 0, harm: 0, lock: 0 },
            feat: { tickRate: 0, collapseEcho: 0, exchange: 0 },
            portfolio: {
                holdings: emptyHoldings,
                costBasis: emptyBasis,
                auto: emptyAuto,
                activeMarket: "calm",
                everVisited: false
            },
            gdp: 10,
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
