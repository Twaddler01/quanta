import { Format } from "./format.js";

export const WaveFloor = {
    at(lv) {
        return Math.min(Config.WAVE.floorMax, Config.WAVE.floorStep * lv);
    }
};

export const Config = (() => {
    const SAVE_KEY = "quanta_save_v5";
    const RESONANCE_BASE = 1.25;
    const PHASE_BASE = 1.15;
    const COHERENCE_BASE = 1.8;
    const OFFLINE_CAP = 8 * 3600;

    const UPGRADES = [
        {
            id: "observer",
            name: "Observer Precision",
            flavor: "Sharper measurement collapses the wavefunction into more quanta.",
            cost: lv => 10 * Math.pow(1.55, lv),
            effect: lv => "+" + lv + " base observation yield"
        },
        {
            id: "collector",
            name: "Vacuum Collector",
            flavor: "Drone lattices siphon zero-point fluctuations automatically.",
            cost: lv => 25 * Math.pow(1.62, lv),
            effect: lv => "+" + Format.num(1.0 * lv) + " Q/s"
        },
        {
            id: "resonance",
            name: "Resonance Cascade",
            flavor: "Constructive interference amplifies every measurement channel.",
            cost: lv => 400 * Math.pow(4.2, lv),
            effect: lv =>
                "×" + Format.num(Math.pow(RESONANCE_BASE, lv)) + " to ALL gains"
        },
        {
            id: "buffer",
            name: "Saturation Buffer",
            flavor: "Widens the flux ceiling. Past the cap, output compresses as a power law.",
            cost: lv => 2000 * Math.pow(8, lv),
            effect: lv => "softcap threshold ×" + Format.num(Math.pow(2.5, lv))
        }
    ];

    const MODIFIERS = [
        {
            id: "psi",
            sym: "Ψ",
            name: "Wavefunction Weight",
            weight: 0.1,
            target: "tap",
            flavor: "Adds 10% of base per level to observation yield.",
            cost: lv => 40 * Math.pow(2.35, lv)
        },
        {
            id: "phi",
            sym: "Φ",
            name: "Entanglement Weight",
            weight: 0.12,
            target: "auto",
            flavor: "Adds 12% of base per level to automatic yield.",
            cost: lv => 70 * Math.pow(2.35, lv)
        },
        {
            id: "lam",
            sym: "Λ",
            name: "Cosmological Weight",
            weight: 0.06,
            target: "all",
            flavor: "Adds 6% of base per level to every channel.",
            cost: lv => 300 * Math.pow(3.1, lv)
        }
    ];

    const PHASE_UPGRADES = [
        {
            id: "stab",
            name: "Stabilizer",
            flavor: "Pins the coherence wave upward. Raises the trough of the oscillation.",
            cost: lv => 4 * Math.pow(1.9, lv),
            effect: lv =>
                "wave floor " +
                Format.plain(WaveFloor.at(lv)) +
                " → " +
                Format.plain(WaveFloor.at(lv + 1))
        },
        {
            id: "harm",
            name: "Harmonic Amplifier",
            flavor: "Resonant cavities stack the collapsed amplitude.",
            cost: lv => 12 * Math.pow(2.1, lv),
            effect: lv =>
                "×" +
                Format.num(Math.pow(COHERENCE_BASE, lv)) +
                " coherence per collapse"
        },
        {
            id: "lock",
            name: "Phase Lock",
            flavor: "Locked coherence bleeds back into ordinary quanta production.",
            cost: lv => 30 * Math.pow(2.4, lv),
            effect: lv =>
                "×" +
                Format.num(Math.pow(PHASE_BASE, lv)) +
                " to ALL quanta gains"
        }
    ];

    const SOFTCAP = {
        tap: { base: 250, pow: 0.72 },
        auto: { base: 150, pow: 0.7 }
    };
    const BUFFER_MULT = 2.5;

    const WAVE = {
        speed: 1.55,
        a1: 0.3,
        a2: 0.11,
        a3: 0.06,
        span: 3.2,
        floorStep: 0.08,
        floorMax: 0.8
    };

    const SURGE = {
        costPct: 0.2,
        minCost: 10,
        referenceFactor: 0.02,
        minReference: 10,
        decay: 0.1,
        coefficient: 2.5
    };

    /* NEW — Entropy */
    const ENTROPY = {
        unlockTotal: 20000,
        baseRate: 0.05,
        collapseWeight: 0.05,
        multPerEntropy: 0.003,
        milestones: [
            { at: 100, kind: "rateMult", amount: 2, label: "entropy rate ×2" },
            {
                at: 500,
                kind: "multBonus",
                amount: 1.5,
                label: "entropy effect ×1.5"
            },
            { at: 2000, kind: "rateMult", amount: 2, label: "entropy rate ×2" },
            {
                at: 10000,
                kind: "multBonus",
                amount: 2,
                label: "entropy effect ×2"
            }
        ]
    };

    /* ============================================================
   Feature definitions
   ------------------------------------------------------------
   Each entry is consumed by features.js. Set `enabled: false`
   to disable without editing any other file.

   To add a new feature: append an entry here.
   To remove one:        delete its entry (or set enabled false).
   Runtime on/off:       Features.unregister('id') / register(...)
   ============================================================ */
    const FEATURES = {
        /* --- 1. Tick Rate ----------------------------------------
     Speeds up a discrete "fluctuation clock". Each tick has a
     chance to grant a tapGain-scaled bonus to Quanta.
     Level 0 = off, so adding this feature doesn't change the
     existing game until the player buys it. */
        tickRate: {
            enabled: true,
            id: "tickRate",

            /* tuning — everything below is live-editable */
            baseInterval: 0.1, // seconds per tick at level 1
            intervalPerLevel: 0.92, // multiply the interval per level
            minInterval: 0.015, // hard floor (≈67 ticks/s)
            fluctuationChance: 0.02, // per tick
            fluctuationGainMult: 0.5, // fluctGain = tapGain × mult × (1 + levelBonus × lv)
            levelBonus: 0.03,

            cards: [
                {
                    id: "tickRate",
                    name: "Tick Rate",
                    currency: "quanta",
                    flavor: "Speeds the internal fluctuation clock. Each tick has a chance to grant bonus quanta.",
                    cost: lv => 200 * Math.pow(2.2, lv),
                    effect: lv => {
                        const c = FEATURES.tickRate;
                        const iv = Math.max(
                            c.minInterval,
                            c.baseInterval * Math.pow(c.intervalPerLevel, lv)
                        );
                        const hz = 1 / iv;
                        return `${(iv * 1000).toFixed(0)}ms · ${hz.toFixed(0)} ticks/s`;
                    }
                }
            ],

            hooks: {
                onTick(s, dt, ctx) {
                    const c = FEATURES.tickRate;
                    const lv = s.feat?.tickRate || 0;
                    if (lv === 0) return;

                    const iv = Math.max(
                        c.minInterval,
                        c.baseInterval * Math.pow(c.intervalPerLevel, lv)
                    );
                    s._tickAcc = (s._tickAcc || 0) + dt;

                    /* guard against pathological frame spikes */
                    let guard = 0;
                    while (s._tickAcc >= iv && guard < 2000) {
                        s._tickAcc -= iv;
                        guard++;
                        if (Math.random() < c.fluctuationChance) {
                            const gain =
                                ctx.tapGain *
                                c.fluctuationGainMult *
                                (1 + c.levelBonus * lv);
                            s.quanta += gain;
                            s.total += gain;
                        }
                    }
                }
            },

            formula(s, ctx) {
                const c = FEATURES.tickRate;
                const lv = s.feat?.tickRate || 0;
                if (lv === 0) return null;

                const iv = Math.max(
                    c.minInterval,
                    c.baseInterval * Math.pow(c.intervalPerLevel, lv)
                );
                const hz = 1 / iv;
                const fps = hz * c.fluctuationChance;
                const gain =
                    ctx.tapGain *
                    c.fluctuationGainMult *
                    (1 + c.levelBonus * lv);
                const rate = fps * gain;

                return {
                    text: `TICK ${(iv * 1000).toFixed(0)}ms (${hz.toFixed(0)}/s) · fluct ≈ +${Format.num(rate)}/s`,
                    accent: "quanta"
                };
            }
        },

        /* --- 2. Collapse Echo ------------------------------------
     Each collapse has a chance to fire again for free at the
     same snapshot. Chance caps at 60%, echoes cap at lv/4. */
        collapseEcho: {
            enabled: true,
            id: "collapseEcho",

            chancePerLevel: 0.03,
            maxChance: 0.6,
            echoesPerBonus: 4, // +1 max echo every N levels

            cards: [
                {
                    id: "collapseEcho",
                    name: "Collapse Echo",
                    currency: "coherence", // priced in coherence, not quanta
                    flavor: "Sometimes a collapse ripples back through spacetime.",
                    cost: lv => 5 * Math.pow(2.0, lv),
                    effect: lv => {
                        const c = FEATURES.collapseEcho;
                        const p = Math.min(c.maxChance, lv * c.chancePerLevel);
                        const m = Math.floor(lv / c.echoesPerBonus);
                        return `${(p * 100).toFixed(0)}% · max ${m} echo${m === 1 ? "" : "es"}`;
                    }
                }
            ],

            hooks: {
                onCollapse(s, ctx) {
                    const c = FEATURES.collapseEcho;
                    const lv = s.feat?.collapseEcho || 0;
                    if (lv === 0) return;

                    const chance = Math.min(c.maxChance, lv * c.chancePerLevel);
                    const maxE = Math.floor(lv / c.echoesPerBonus);
                    let bonus = 0;

                    for (let i = 0; i < maxE; i++) {
                        if (Math.random() >= chance) break;
                        bonus += ctx.gain;
                    }
                    if (bonus > 0) {
                        s.coherence += bonus;
                        ctx.floater(`+${Format.num(bonus)} ECHO`, "coh");
                    }
                }
            },

            formula(s) {
                const c = FEATURES.collapseEcho;
                const lv = s.feat?.collapseEcho || 0;
                if (lv === 0) return null;

                const p = Math.min(c.maxChance, lv * c.chancePerLevel);
                const m = Math.floor(lv / c.echoesPerBonus);

                /* EV = 1 + p + p² + ... + p^m (geometric, p < 1) */
                let ev = 1;
                if (m > 0 && p > 0) {
                    ev =
                        p >= 1
                            ? 1 + m
                            : 1 + (p * (1 - Math.pow(p, m))) / (1 - p);
                }

                return {
                    text: `ECHO ${(p * 100).toFixed(0)}% · max ${m} · EV ×${ev.toFixed(2)}`,
                    accent: "coh"
                };
            }
        }
    };

    return {
        SAVE_KEY,
        RESONANCE_BASE,
        PHASE_BASE,
        COHERENCE_BASE,
        OFFLINE_CAP,
        UPGRADES,
        MODIFIERS,
        PHASE_UPGRADES,
        SOFTCAP,
        BUFFER_MULT,
        WAVE,
        SURGE,
        ENTROPY,
        FEATURES
    };
})();
