import { el, div, span, on } from "./dom.js";
import { Format } from "./format.js";
import { State } from "./state.js";

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
        tap: { base: 250, pow: 0.78 },
        auto: { base: 150, pow: 0.76 }
    };
    const BUFFER_MULT = 2.8;

    const WAVE = {
        speed: 1.55,
        a1: 0.3,
        a2: 0.11,
        a3: 0.06,
        span: 3.2,
        floorStep: 0.08,
        floorMax: 0.8,

        /* Quality curve — the wave's raw contribution, before entropy */
        qualityMin: 0.1, // trough
        qualityMax: 1.0, // peak
        /* ↑ Bump qualityMin to 0.20–0.30 for a friendlier early game before
         entropy unlocks. Bump qualityMax to 1.20+ if you want the peak
         to feel more "rewarding" even at entropy 0. */

        /* Entropy scaling — quality × (1 + boost), boost capped */
        entropyQualityPerPoint: 0.01, // +1% quality per point of entropy
        maxEntropyQualityBoost: 10 // +1000% cap (quality max 11× base)
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
        baseRate: 0.01,
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
        },
        /* --- 3. Quantum Bond Fund --------------------------------
   Buy bonds when cheap; hold for passive dividends that
   compound with holdings and milestones. */
        exchange: {
            enabled: true,
            id: "exchange",

            /* price curve (unchanged from before) */
            basePrice: 1.0,
            priceAmp1: 0.35,
            priceAmp2: 0.15,
            period1: 0.35,
            period2: 0.91,
            phase2: 1.7,
            minPrice: 0.15,
            maxPrice: 3.0,

            /* volatility amplifies with entropy */
            volatilityPerEntropy: 0.001,
            maxVolatility: 2.5,

            /* bond economics */
            unitCost: 100, // Q per bond at P = 1.0
            spread: 0.05, // sell at P × unitCost × (1 − spread)

            /* dividend yield */
            baseDividend: 0.05, // Q/s per bond, before milestones

            milestones: [
                {
                    at: 10,
                    divMult: 1.5,
                    gdpRateMult: 1.2,
                    label: "dividend ×1.5 · GDP growth ×1.2"
                },
                {
                    at: 200,
                    divMult: 2,
                    gdpRateMult: 1.5,
                    label: "dividend ×2 · GDP growth ×1.5"
                },
                {
                    at: 300,
                    divMult: 1,
                    gdpRateMult: 3,
                    label: "GDP growth ×3"
                },
                {
                    at: 350,
                    divMult: 1,
                    gdpRateMult: 4,
                    label: "GDP growth ×4"
                }
            ],

            /* capacity */
            baseCapacity: 100,
            capacityPerLevel: 25,

            /* auto-invest */
            autoInvestUnlockAt: 25,
            autoInvestPct: 0.1,
            autoInvestAccCap: 5, // max bonds' worth of accumulated budget

            /* license card */
            levelCost: 2000,
            levelCostMult: 5,

            /* ===== NEW: Fictional GDP ===== */
            gdp: {
                baseRate: 1.0,
                perBondBonus: 0.01,
                baselineGdp: 10,
                stateCoefficient: 0.5,
                minStateMult: 0.25,
                maxStateMult: 5.0,
                quantaPerGdp: 50,
                waveLockSeconds: 8,
                requireBondsForGrowth: true, // GDP rate scales with bonds; 0 bonds = 0 growth
                minBondsForCashOutPct: 1.0, // must be at full capacity (lower to 0.75 for lenient)
                cashOutCooldownSeconds: 30, // min time between cash outs
                entropyRateFactor: 0,
                entropyCostFactor: 1.0,
                maxUnitCostMult: 500,
                milestones: [
                    {
                        at: 100,
                        coefBonus: 0.05,
                        label: "+0.05 GDP coefficient"
                    },
                    {
                        at: 1000,
                        coefBonus: 0.1,
                        label: "+0.10 GDP coefficient"
                    },
                    {
                        at: 10000,
                        coefBonus: 0.15,
                        label: "+0.15 GDP coefficient"
                    },
                    {
                        at: 100000,
                        coefBonus: 0.2,
                        label: "+0.20 GDP coefficient"
                    }
                ]
            },

            /* ----- API ----- */

            price(t) {
                if (Date.now() < (State.get()._waveLockUntil || 0)) return 0;
                return FEATURES.exchange._naturalPrice(t);
            },

            _naturalPrice(t) {
                const c = FEATURES.exchange;
                const ent = State.get().entropy || 0;
                const vol = Math.min(
                    c.maxVolatility,
                    1 + ent * c.volatilityPerEntropy
                );
                const raw =
                    c.basePrice +
                    (c.priceAmp1 * Math.sin(t * c.period1) +
                        c.priceAmp2 * Math.sin(t * c.period2 + c.phase2)) *
                        vol;
                return Math.max(c.minPrice, Math.min(c.maxPrice, raw));
            },

            effectiveUnitCost() {
                const c = FEATURES.exchange;
                const ent = State.get().entropy || 0;
                const factor = Math.min(
                    c.gdp.maxUnitCostMult,
                    1 + ent * c.gdp.entropyCostFactor
                );
                return c.unitCost * factor;
            },

            isLocked() {
                return Date.now() < (State.get()._waveLockUntil || 0);
            },

            capacity() {
                const c = FEATURES.exchange;
                return (
                    c.baseCapacity +
                    c.capacityPerLevel * (State.get().feat.exchange || 0)
                );
            },

            ensurePortfolio() {
                const s = State.get();
                if (!s.portfolio) {
                    s.portfolio = {
                        holdings: { bonds: 0 },
                        auto: { bonds: false },
                        everVisited: false
                    };
                }
                if (!s.portfolio.holdings) s.portfolio.holdings = { bonds: 0 };
                if (!s.portfolio.auto) s.portfolio.auto = { bonds: false };
                return s.portfolio;
            },

            calcDividend() {
                const c = FEATURES.exchange;
                const holdings = State.get().portfolio?.holdings?.bonds || 0;
                if (holdings === 0) return 0;
                let mult = 1;
                for (const ms of c.milestones) {
                    if (holdings >= ms.at && ms.divMult) mult *= ms.divMult;
                }
                mult *= FEATURES.exchange.economyMult();
                const result = holdings * c.baseDividend * mult;
                return Number.isFinite(result) ? result : 0;
            },

            buyBonds(n) {
                const c = FEATURES.exchange;
                const s = State.get();
                if (Date.now() < (s._waveLockUntil || 0))
                    return { amount: 0, cost: 0, locked: true };
                const m = FEATURES.exchange.ensurePortfolio();

                const held = m.holdings.bonds || 0;
                const space = Math.max(0, c.capacity() - held);
                if (space <= 0) return { amount: 0, cost: 0 };
                
                const unit = c._naturalPrice(Date.now() / 1000) * c.effectiveUnitCost();
                const canAfford = Math.floor(s.quanta / unit);
                const amount = Math.min(n, space, canAfford);
                if (amount <= 0) return { amount: 0, cost: 0 };

                const cost = unit * amount;
                s.quanta -= cost;
                m.holdings.bonds = held + amount;
                return { amount, cost };
            },

            sellBonds(n) {
                const c = FEATURES.exchange;
                const s = State.get();
                const m = FEATURES.exchange.ensurePortfolio();

                const held = m.holdings.bonds || 0;
                const amount = Math.min(n, held);
                if (amount <= 0) return { amount: 0, gain: 0 };

                const unit =
                    c._naturalPrice(Date.now() / 1000) *
                    c.effectiveUnitCost() *
                    (1 - c.spread);
                const gain = unit * amount;
                s.quanta += gain;
                s.total += gain;
                m.holdings.bonds = held - amount;
                return { amount, gain };
            },

            bondGdpRateMult(state) {
                const c = FEATURES.exchange;
                const src = state || State.get();
                const holdings = src.portfolio?.holdings?.bonds || 0;
                let m = 1;
                for (const ms of c.milestones) {
                    if (holdings >= ms.at && ms.gdpRateMult)
                        m *= ms.gdpRateMult;
                }
                return m;
            },

            gdpRate() {
                const c = FEATURES.exchange;
                const s = State.get();
                const bonds = s.portfolio?.holdings?.bonds || 0;
                if (c.gdp.requireBondsForGrowth && bonds <= 0) return 0;
                const bondFactor = c.gdp.requireBondsForGrowth
                    ? bonds * c.gdp.perBondBonus
                    : 1 + bonds * c.gdp.perBondBonus;
                const entropyFactor =
                    1 + (s.entropy || 0) * c.gdp.entropyRateFactor;
                const milestoneFactor = FEATURES.exchange.bondGdpRateMult();
                return (
                    c.gdp.baseRate *
                    bondFactor *
                    entropyFactor *
                    milestoneFactor
                );
            },

            gdpCatchUp(state, seconds) {
                if (!(seconds > 0)) return;
                if (!state.portfolio?.everVisited) return;
                const c = FEATURES.exchange;
                const bonds = state.portfolio?.holdings?.bonds || 0;
                if (c.gdp.requireBondsForGrowth && bonds <= 0) return;
                const bondFactor = c.gdp.requireBondsForGrowth
                    ? bonds * c.gdp.perBondBonus
                    : 1 + bonds * c.gdp.perBondBonus;
                const entropyFactor =
                    1 + (state.entropy || 0) * c.gdp.entropyRateFactor;
                const milestoneFactor =
                    FEATURES.exchange.bondGdpRateMult(state);
                const rate =
                    c.gdp.baseRate *
                    bondFactor *
                    entropyFactor *
                    milestoneFactor;
                state.gdp = (state.gdp || 0) + rate * seconds;
            },

            economyMult() {
                const s = State.get();
                const reson = Math.pow(
                    Config.RESONANCE_BASE,
                    s.up.resonance || 0
                );
                const phase = Math.pow(Config.PHASE_BASE, s.cUp.lock || 0);
                let entMult = 1;
                if (
                    s.entropyUnlocked ||
                    s.total >= Config.ENTROPY.unlockTotal
                ) {
                    const e = s.entropy || 0;
                    let bonus = 1;
                    for (const ms of Config.ENTROPY.milestones) {
                        if (e >= ms.at && ms.kind === "multBonus")
                            bonus *= ms.amount;
                    }
                    entMult = (1 + Config.ENTROPY.multPerEntropy * e) * bonus;
                }
                return reson * phase * entMult;
            },

            gdpCoefficient() {
                const c = FEATURES.exchange;
                let coef = c.gdp.stateCoefficient;
                for (const ms of c.gdp.milestones) {
                    if ((State.get().gdp || 0) >= ms.at) coef += ms.coefBonus;
                }
                return coef;
            },

            gdpMilestonesPassed() {
                const gdp = State.get().gdp || 0;
                return FEATURES.exchange.gdp.milestones.filter(m => gdp >= m.at)
                    .length;
            },

            gdpStateMult() {
                const c = FEATURES.exchange;
                const gdp = Math.max(0.001, State.get().gdp || 0);
                const coef = FEATURES.exchange.gdpCoefficient();
                const raw = 1 + coef * Math.log10(gdp / c.gdp.baselineGdp);
                return Math.max(
                    c.gdp.minStateMult,
                    Math.min(c.gdp.maxStateMult, raw)
                );
            },

            gdpSellPayout() {
                const c = FEATURES.exchange;
                const gdp = State.get().gdp || 0;
                return (
                    Math.max(0, gdp - c.gdp.baselineGdp) * c.gdp.quantaPerGdp
                );
            },

            cashOutPayout(ctx) {
                const c = FEATURES.exchange;
                const s = State.get();
                const surplus = Math.max(0, (s.gdp || 0) - c.gdp.baselineGdp);
                if (surplus <= 0) return 0;

                /* Bonds always liquidate at market value — no cap, no multiplier */
                const held = s.portfolio?.holdings?.bonds || 0;
                const bondsValue = held > 0
                    ? c._naturalPrice(Date.now() / 1000) *
                      c.effectiveUnitCost() * (1 - c.spread) * held
                    : 0;

                /* GDP bonus grows superlinearly with hold time */
                const gdpRaw = surplus * c.gdp.quantaPerGdp;
                const lastReset = s._lastCashOutAt || s.start || Date.now();
                const holdSeconds = Math.max(
                    0,
                    (Date.now() - lastReset) / 1000
                );
                const holdMult = 1 + Math.pow(holdSeconds / 60, 1.5);

                let gdpBonus = gdpRaw * holdMult;

                /* Early cap: first 30s after a cash-out, limit only the GDP bonus.
       Bonds always liquidate at value (your own money back). */
                if (holdSeconds < 30 && ctx) {
                    const earlyCap = Math.max(
                        10 * (ctx.tapGain || 0),
                        ctx.qps || 0
                    );
                    if (earlyCap > 0) gdpBonus = Math.min(gdpBonus, earlyCap);
                }

                return bondsValue + gdpBonus;
            },

            holdMult() {
                const s = State.get();
                const lastReset = s._lastCashOutAt || s.start || Date.now();
                const holdSeconds = Math.max(
                    0,
                    (Date.now() - lastReset) / 1000
                );
                return {
                    seconds: holdSeconds,
                    mult: 1 + Math.pow(holdSeconds / 60, 1.5)
                };
            },

            canCashOut() {
                const c = FEATURES.exchange;
                const s = State.get();

                // 1. Cooldown
                const cooldownLeft =
                    ((s._cashOutCooldownUntil || 0) - Date.now()) / 1000;
                if (cooldownLeft > 0) {
                    return { ok: false, reason: "cooldown", cooldownLeft };
                }

                // 2. GDP must exceed baseline
                const surplus = Math.max(0, (s.gdp || 0) - c.gdp.baselineGdp);
                if (surplus <= 0) {
                    return { ok: false, reason: "no-gdp-surplus" };
                }

                // 3. Bond threshold
                const held = s.portfolio?.holdings?.bonds || 0;
                const required = Math.ceil(
                    c.capacity() * c.gdp.minBondsForCashOutPct
                );
                if (held < required) {
                    return {
                        ok: false,
                        reason: "insufficient-bonds",
                        required,
                        held
                    };
                }

                return { ok: true };
            },

            withdrawGdp(ctx) {
                const c = FEATURES.exchange;
                const s = State.get();

                const check = FEATURES.exchange.canCashOut();
                if (!check.ok) {
                    return {
                        payout: 0,
                        bondsSold: 0,
                        previousGdp: s.gdp || 0,
                        waveLockMs: 0,
                        rejected: check.reason
                    };
                }

                const m = FEATURES.exchange.ensurePortfolio();
                const gdp = s.gdp || 0;
                const totalPayout = FEATURES.exchange.cashOutPayout(ctx);
                if (totalPayout <= 0) {
                    return {
                        payout: 0,
                        bondsSold: 0,
                        previousGdp: gdp,
                        waveLockMs: 0,
                        rejected: "no-payout"
                    };
                }

                const held = m.holdings.bonds || 0;
                const { seconds: holdSeconds, mult: holdMult } =
                    FEATURES.exchange.holdMult();

                m.holdings.bonds = 0;
                s.gdp = c.gdp.baselineGdp;
                s.quanta += totalPayout;
                s.total += totalPayout;

                const now = Date.now();
                const lockMs = (c.gdp.waveLockSeconds || 8) * 1000;
                const cooldownMs = (c.gdp.cashOutCooldownSeconds || 30) * 1000;
                s._waveLockUntil = now + lockMs;
                s._cashOutCooldownUntil = now + cooldownMs;
                s._lastCashOutAt = now;

                return {
                    payout: totalPayout,
                    bondsSold: held,
                    previousGdp: gdp,
                    holdSeconds,
                    holdMult,
                    waveLockMs: lockMs,
                    cooldownMs
                };
            },

            /* ----- card ----- */
            cards: [
                {
                    id: "exchange",
                    name: "Bond Fund License",
                    currency: "quanta",
                    flavor: "Expands your bond portfolio's storage capacity.",
                    cost: lv =>
                        FEATURES.exchange.levelCost *
                        Math.pow(FEATURES.exchange.levelCostMult, lv),
                    effect: lv => {
                        const c = FEATURES.exchange;
                        const now = c.baseCapacity + c.capacityPerLevel * lv;
                        const nxt =
                            c.baseCapacity + c.capacityPerLevel * (lv + 1);
                        return `${now} → ${nxt} bonds`;
                    }
                }
            ],

            /* ----- hooks ----- */
            hooks: {
                onTick(s, dt, ctx) {
                    const holdings = s.portfolio?.holdings?.bonds || 0;
                    const autoOn = !!s.portfolio?.auto?.bonds;

                    FEATURES.exchange.gdpCatchUp(s, dt);

                    if (holdings === 0 && !autoOn) return;

                    if (holdings > 0) {
                        const mult = FEATURES.exchange.gdpStateMult();
                        const gain =
                            FEATURES.exchange.calcDividend() * mult * dt;
                        s.quanta += gain;
                        s.total += gain;
                    }

                    if (autoOn) {
                        const c = FEATURES.exchange;
                        if (Date.now() < (s._waveLockUntil || 0)) return; // skip during lock
                        const cap = c.capacity();
                        if ((s.portfolio.holdings.bonds || 0) >= cap) return;

                        const budget = (ctx.qps || 0) * dt * c.autoInvestPct;
                        if (budget <= 0) return;

                        const bondCost = c._naturalPrice(Date.now() / 1000) * c.effectiveUnitCost();
                        s._autoAcc = (s._autoAcc || 0) + budget;
                        const accCap = bondCost * c.autoInvestAccCap;
                        if (s._autoAcc > accCap) s._autoAcc = accCap;

                        while (
                            s._autoAcc >= bondCost &&
                            s.quanta >= bondCost &&
                            (s.portfolio.holdings.bonds || 0) < cap
                        ) {
                            s._autoAcc -= bondCost;
                            s.quanta -= bondCost;
                            s.portfolio.holdings.bonds =
                                (s.portfolio.holdings.bonds || 0) + 1;
                        }
                    }
                }
            },

            /* ----- formula line ----- */
            formula() {
                const s = State.get();
                const gdp = s.gdp || 0;
                const stateMult = FEATURES.exchange.gdpStateMult();
                const div = FEATURES.exchange.calcDividend();

                const parts = [];
                if (div > 0)
                    parts.push(`BONDS +${Format.num(div * stateMult)} Q/s`);
                if (Math.abs(stateMult - 1) > 0.005) {
                    parts.push(`GDP ×${stateMult.toFixed(2)}`);
                }
                if (parts.length === 0) return null;
                return { text: parts.join(" · "), accent: "market" };
            },

            /* ----- view ----- */
            views: [
                {
                    id: "exchange",
                    icon: "Ⓠ",
                    label: "MARKET",
                    mount({ UI, Save, Calc }) {
                        const c = FEATURES.exchange;

                        /* ---- element refs ---- */
                        const elPrice = span(
                            { className: "exchange-price" },
                            "1.00"
                        );
                        const suppressBadge = span(
                            {
                                className: "market-suppress-badge hidden",
                                id: "marketSuppress"
                            },
                            "SUPPRESSED"
                        );
                        const elHeld = span(
                            { className: "exchange-holdings" },
                            "0 / 100"
                        );
                        const elDiv = el("b", {}, "+0.00 Q/s");
                        const elValue = el("b", {}, "0 Q");
                        const elCostMult = el("b", { id: "costMult" }, "×1.00" );
                        const elBuy1Cost = span(
                            { className: "amount" },
                            "100 Q"
                        );
                        const elBuyMaxCost = span({ className: "amount" }, "—");
                        const elSell1Cost = span(
                            { className: "amount" },
                            "95 Q"
                        );
                        const elSellAllCost = span(
                            { className: "amount" },
                            "—"
                        );

                        const btnBuy1 = el(
                            "button",
                            { className: "exchange-btn buy" },
                            ["BUY 1", elBuy1Cost]
                        );
                        const btnBuyMax = el(
                            "button",
                            { className: "exchange-btn buy" },
                            ["BUY MAX", elBuyMaxCost]
                        );
                        const btnSell1 = el(
                            "button",
                            { className: "exchange-btn sell" },
                            ["SELL 1", elSell1Cost]
                        );
                        const btnSellAll = el(
                            "button",
                            { className: "exchange-btn sell" },
                            ["SELL ALL", elSellAllCost]
                        );

                        const canvas = el("canvas", { id: "marketCanvas" });
                        const floaters = div({
                            className: "floatHost",
                            id: "marketFloaters"
                        });

                        /* ---- GDP panel refs ---- */
                        const elGdp = el("b", {}, "10");
                        const elGdpRate = span(
                            { className: "gdp-rate" },
                            " (+0.00/s)"
                        );
                        const elGdpMult = el("b", {}, "×1.00");
                        const elGdpMile = el(
                            "b",
                            {},
                            "0 / " + c.gdp.milestones.length
                        );
                        const elSellPayout = span({ className: "amount" }, "+0 Q");
                        const elHoldTime = el("b", {}, "0s");

                        const sellBtn = el(
                            "button",
                            { className: "exchange-btn sell gdp-sell" },
                            [span({}, "CASH OUT"), elSellPayout]
                        );

                        const gdpPanel = div(
                            { className: "panel gdp-panel hidden" },
                            [
                                div({ className: "panel-title" }, "Economy"),
                                div({ className: "stat-row" }, [
                                    span({}, "GDP"),
                                    el("b", {}, [elGdp, " ", elGdpRate])
                                ]),
                                div({ className: "stat-row" }, [
                                    span({}, "GDP state mult"),
                                    elGdpMult
                                ]),
                                div({ className: "stat-row" }, [
                                    span({}, "GDP milestones"),
                                    elGdpMile
                                ]),
                                div({ className: "stat-row" }, [
                                    span({}, "Hold time"),
                                    elHoldTime
                                ]),
                                sellBtn
                            ]
                        );

                        /* ---- auto-invest panel ---- */
                        const autoBtn = el(
                            "button",
                            { className: "exchange-btn locked" },
                            "AUTO-INVEST: LOCKED"
                        );
                        const autoHint = div(
                            { className: "hint", style: { marginTop: "8px" } },
                            `Unlocks at ${c.autoInvestUnlockAt} bonds.`
                        );
                        const autoPanel = div({ className: "panel" }, [
                            div({ className: "panel-title" }, "Auto-Invest"),
                            autoBtn,
                            autoHint
                        ]);

                        /* ---- milestones ---- */
                        const milestoneList = div({ className: "list" });
                        const milestoneRows = [];
                        for (const ms of c.milestones) {
                            const row = div({ className: "milestone" }, [
                                span({ className: "dot" }),
                                span({ className: "label" }, ms.label),
                                span({ className: "at" }, `${ms.at} bonds`)
                            ]);
                            milestoneList.appendChild(row);
                            milestoneRows.push({ el: row, at: ms.at });
                        }
                        const milestonePanel = div({ className: "panel" }, [
                            div({ className: "panel-title" }, "Milestones"),
                            milestoneList
                        ]);

                        const section = el(
                            "section",
                            {
                                className: "view",
                                dataset: {
                                    view: "exchange",
                                    feature: "exchange"
                                }
                            },
                            [
                                div({ className: "panel exchange-panel" }, [
                                    div(
                                        { className: "panel-title" },
                                        "Quantum Bond Fund"
                                    ),
                                    div({ className: "exchange-chart-wrap" }, [
                                        canvas,
                                        floaters
                                    ]),
                                    div({ className: "exchange-readout" }, [
                                        div({ className: "price-group" }, [
                                            elPrice,
                                            suppressBadge
                                        ]),
                                        elHeld
                                    ]),
                                    div({ className: "stat-row" }, [
                                        span({}, "Dividend"),
                                        elDiv
                                    ]),
                                    div({ className: "stat-row" }, [
                                        span({}, "Portfolio value"),
                                        elValue
                                    ]),
                                    div({ className: "stat-row" }, [
                                        span({}, "Cost multiplier"),
                                        el("b", { id: "costMult" }, "×1.00")
                                    ]),
                                    div({ className: "exchange-buttons" }, [
                                        div({ className: "exchange-row" }, [
                                            btnBuy1,
                                            btnBuyMax
                                        ]),
                                        div({ className: "exchange-row" }, [
                                            btnSell1,
                                            btnSellAll
                                        ])
                                    ])
                                ]),
                                autoPanel,
                                milestonePanel,
                                gdpPanel,
                                div(
                                    { className: "hint" },
                                    "Buy bonds when the price is low (green). Holdings pay passive dividends. " +
                                        "GDP multiplies ALL Q/s — tap, passive, and dividends — but can also drag you below ×1. " +
                                        "Sell GDP to cash out for Quanta, resetting the economy to neutral."
                                )
                            ]
                        );

                        /* ---- canvas ---- */
                        let ctx = null,
                            W = 0,
                            H = 0;
                        function resize() {
                            if (!canvas) return;
                            const rect = canvas.getBoundingClientRect();
                            if (rect.width < 2 || rect.height < 2) {
                                ctx = null;
                                return;
                            }
                            const dpr = Math.min(
                                window.devicePixelRatio || 1,
                                2
                            );
                            canvas.width = Math.round(rect.width * dpr);
                            canvas.height = Math.round(rect.height * dpr);
                            ctx = canvas.getContext("2d");
                            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                            W = rect.width;
                            H = rect.height;
                        }

                        function drawChart() {
                            if (!ctx) {
                                resize();
                                if (!ctx) return;
                            }
                            const now = Date.now() / 1000;
                            const SPAN = 20,
                                N = 80,
                                pad = 6;
                            const ih = H - pad * 2;
                            const range = c.maxPrice - c.minPrice;

                            ctx.clearRect(0, 0, W, H);

                            const midY =
                                H - pad - ((1.0 - c.minPrice) / range) * ih;
                            ctx.beginPath();
                            ctx.setLineDash([3, 5]);
                            ctx.moveTo(0, midY);
                            ctx.lineTo(W, midY);
                            ctx.strokeStyle = "rgba(74, 222, 128, 0.22)";
                            ctx.lineWidth = 1;
                            ctx.stroke();
                            ctx.setLineDash([]);

                            const pts = new Array(N + 1);
                            for (let i = 0; i <= N; i++) {
                                const t = now - SPAN + (i / N) * SPAN;
                                const p = c.price(t);
                                pts[i] = [
                                    (i / N) * W,
                                    H - pad - ((p - c.minPrice) / range) * ih
                                ];
                            }

                            ctx.beginPath();
                            ctx.moveTo(0, H);
                            for (let i = 0; i <= N; i++)
                                ctx.lineTo(pts[i][0], pts[i][1]);
                            ctx.lineTo(W, H);
                            ctx.closePath();
                            const grad = ctx.createLinearGradient(0, 0, 0, H);
                            grad.addColorStop(0, "rgba(74, 222, 128, 0.30)");
                            grad.addColorStop(1, "rgba(74, 222, 128, 0.02)");
                            ctx.fillStyle = grad;
                            ctx.fill();

                            const cur = c.price(now);
                            const color = cur > 1.15 ? "#ffd166" : "#4ade80";
                            ctx.beginPath();
                            ctx.moveTo(pts[0][0], pts[0][1]);
                            for (let i = 1; i <= N; i++)
                                ctx.lineTo(pts[i][0], pts[i][1]);
                            ctx.strokeStyle = color;
                            ctx.lineWidth = 2;
                            ctx.lineJoin = "round";
                            ctx.shadowColor = color;
                            ctx.shadowBlur = 12;
                            ctx.stroke();
                            ctx.shadowBlur = 0;

                            const cy =
                                H - pad - ((cur - c.minPrice) / range) * ih;
                            ctx.beginPath();
                            ctx.arc(W - 2, cy, 3.5, 0, Math.PI * 2);
                            ctx.fillStyle = color;
                            ctx.shadowColor = color;
                            ctx.shadowBlur = 16;
                            ctx.fill();
                            ctx.shadowBlur = 0;
                        }

                        /* ---- render ---- */
                        function render() {
                            const s = State.get();
                            const m = FEATURES.exchange.ensurePortfolio();
                            const locked = FEATURES.exchange.isLocked();

                            const max = c.capacity();
                            const held = m.holdings.bonds || 0;
                            const now = Date.now() / 1000;
                            const displayPrice = c.price(now); // 0 during lock
                            const naturalPrice = c._naturalPrice(now); // true price
                            const unitCost = c.effectiveUnitCost();    // entropy-scaled
                            const buyUnit = naturalPrice * unitCost;
                            const sellUnit = naturalPrice * unitCost * (1 - c.spread);

                            elPrice.textContent =
                                "Ⓠ " + Format.plain(displayPrice);
                            elPrice.classList.toggle("suppressed", locked);
                            suppressBadge.classList.toggle("hidden", !locked);

                            elHeld.textContent = held + " / " + max;

                            const divRate = FEATURES.exchange.calcDividend();
                            elDiv.textContent =
                                "+" + Format.num(divRate) + " Q/s";
                            elValue.textContent =
                                Format.num(held * buyUnit) + " Q";

                            const costMult = unitCost / c.unitCost;
                            elCostMult.textContent = "×" + Format.plain(costMult);

                            /* ---- GDP panel ---- */
                            const gdp = s.gdp || 0;
                            if (held > 0 || gdp > c.gdp.baselineGdp * 1.01) {
                                gdpPanel.classList.remove("hidden");
                                elGdp.textContent = Format.num(gdp);
                                const rateMult =
                                    FEATURES.exchange.bondGdpRateMult();
                                elGdpRate.textContent =
                                    " (+" +
                                    Format.plain(FEATURES.exchange.gdpRate()) +
                                    "/s" +
                                    (rateMult > 1.001
                                        ? " ×" + Format.plain(rateMult)
                                        : "") +
                                    ")";
                                elGdpMult.textContent =
                                    "×" +
                                    Format.plain(
                                        FEATURES.exchange.gdpStateMult()
                                    );
                                elGdpMile.textContent =
                                    FEATURES.exchange.gdpMilestonesPassed() +
                                    " / " +
                                    c.gdp.milestones.length;
                                const check = FEATURES.exchange.canCashOut();
                                const s2 = State.get();
                                if (check.ok) {
                                    const payout =
                                        FEATURES.exchange.cashOutPayout({
                                            tapGain: Calc.tapGain(),
                                            qps: Calc.effectiveQps()
                                        });
                                    const { seconds: holdSec, mult: holdMul } =
                                        FEATURES.exchange.holdMult();
                                    elSellPayout.textContent =
                                        "+" +
                                        Format.num(payout) +
                                        " Q · ×" +
                                        Format.plain(holdMul);
                                    elHoldTime.textContent =
                                        Format.time(holdSec);
                                    sellBtn.classList.add("can");
                                    sellBtn.classList.remove("poor");
                                } else {
                                    sellBtn.classList.remove("can");
                                    sellBtn.classList.add("poor");
                                    if (check.reason === "cooldown") {
                                        elSellPayout.textContent =
                                            "COOLDOWN " +
                                            Math.ceil(check.cooldownLeft) +
                                            "s";
                                    } else if (
                                        check.reason === "insufficient-bonds"
                                    ) {
                                        elSellPayout.textContent =
                                            "NEED " +
                                            (check.required - check.held) +
                                            " BONDS";
                                    } else {
                                        elSellPayout.textContent =
                                            "GDP AT BASELINE";
                                    }
                                }
                            } else {
                                gdpPanel.classList.add("hidden");
                            }

                            if (locked) {
                                elBuy1Cost.textContent = "LOCKED";
                                elBuyMaxCost.textContent = "LOCKED";
                                btnBuy1.classList.add("poor");
                                btnBuy1.classList.remove("can");
                                btnBuyMax.classList.add("poor");
                                btnBuyMax.classList.remove("can");
                            } else {
                                const space = Math.max(0, max - held);
                                const canAfford = Math.floor(
                                    s.quanta / buyUnit
                                );
                                const buyMaxAmt = Math.min(space, canAfford);
                                const buy1Amt = Math.min(1, buyMaxAmt);

                                elBuy1Cost.textContent =
                                    Format.num(buyUnit) + " Q";
                                elBuyMaxCost.textContent =
                                    buyMaxAmt > 0
                                        ? Format.num(buyUnit * buyMaxAmt) + " Q"
                                        : "—";
                                btnBuy1.classList.toggle("can", buy1Amt >= 1);
                                btnBuy1.classList.toggle("poor", buy1Amt < 1);
                                btnBuyMax.classList.toggle(
                                    "can",
                                    buyMaxAmt >= 1
                                );
                                btnBuyMax.classList.toggle(
                                    "poor",
                                    buyMaxAmt < 1
                                );
                            }

                            elSell1Cost.textContent =
                                Format.num(sellUnit) + " Q";
                            elSellAllCost.textContent =
                                held > 0
                                    ? Format.num(sellUnit * held) + " Q"
                                    : "—";
                            btnSell1.classList.toggle("can", held >= 1);
                            btnSell1.classList.toggle("poor", held < 1);
                            btnSellAll.classList.toggle("can", held >= 1);
                            btnSellAll.classList.toggle("poor", held < 1);

                            const autoUnlocked = held >= c.autoInvestUnlockAt;
                            const autoOn = !!m.auto.bonds;
                            if (autoUnlocked) {
                                autoBtn.textContent = `AUTO-INVEST: ${autoOn ? "ON" : "OFF"}`;
                                autoBtn.classList.toggle("on", autoOn);
                                autoBtn.classList.remove("locked", "poor");
                                autoHint.textContent = autoOn
                                    ? `Diverting ${(c.autoInvestPct * 100).toFixed(0)}% of Q/s into bonds automatically.`
                                    : `Toggle to divert ${(c.autoInvestPct * 100).toFixed(0)}% of your Q/s into bonds.`;
                            } else {
                                autoBtn.textContent = "AUTO-INVEST: LOCKED";
                                autoBtn.classList.add("locked");
                                autoBtn.classList.remove("on", "poor");
                                autoHint.textContent =
                                    `Unlocks at ${c.autoInvestUnlockAt} bonds ` +
                                    `(${c.autoInvestUnlockAt - held} more).`;
                            }

                            for (const mr of milestoneRows) {
                                mr.el.classList.toggle("done", held >= mr.at);
                            }

                            drawChart();
                        }

                        /* ---- actions ---- */
                        function doBuy(n) {
                            const r = FEATURES.exchange.buyBonds(n);
                            if (r.amount <= 0) return;
                            UI.floater(
                                floaters,
                                "+" + r.amount + " Ⓠ",
                                "market"
                            );
                            if (navigator.vibrate) {
                                try {
                                    navigator.vibrate(8);
                                } catch (e) {}
                            }
                            render();
                            Save.write();
                        }
                        function doSell(n) {
                            const r = FEATURES.exchange.sellBonds(n);
                            if (r.amount <= 0) return;
                            UI.floater(
                                floaters,
                                "+" + Format.num(r.gain) + " Q",
                                "gold"
                            );
                            if (navigator.vibrate) {
                                try {
                                    navigator.vibrate(8);
                                } catch (e) {}
                            }
                            render();
                            Save.write();
                        }
                        function toggleAuto() {
                            const m = FEATURES.exchange.ensurePortfolio();
                            if ((m.holdings.bonds || 0) < c.autoInvestUnlockAt)
                                return;
                            m.auto.bonds = !m.auto.bonds;
                            render();
                            Save.write();
                        }

                        on(btnBuy1, "click", () => doBuy(1));
                        on(btnBuyMax, "click", () => doBuy(9999));
                        on(btnSell1, "click", () => doSell(1));
                        on(btnSellAll, "click", () => doSell(9999));
                        on(autoBtn, "click", toggleAuto);
                        on(sellBtn, "click", () => {
                            const r = FEATURES.exchange.withdrawGdp({
                                tapGain: Calc.tapGain(),
                                qps: Calc.effectiveQps()
                            });
                            if (r.payout <= 0) {
                                if (r.rejected === "cooldown") {
                                    UI.toast("Cash-out on cooldown");
                                } else if (
                                    r.rejected === "insufficient-bonds"
                                ) {
                                    UI.toast("Buy to full bond capacity first");
                                } else if (r.rejected === "no-gdp-surplus") {
                                    UI.toast(
                                        "GDP is at baseline — wait for growth"
                                    );
                                }
                                return;
                            }

                            UI.floater(
                                floaters,
                                "+" + Format.num(r.payout) + " Q",
                                "gold"
                            );

                            const heldPart =
                                Format.time(r.holdSeconds) +
                                " · ×" +
                                Format.plain(r.holdMult);
                            const bondsPart =
                                r.bondsSold > 0
                                    ? " · " + r.bondsSold + " bonds liquidated"
                                    : "";

                            UI.toast(
                                "Cashed out: +" +
                                    Format.num(r.payout) +
                                    " Q (" +
                                    heldPart +
                                    bondsPart +
                                    ") · next in " +
                                    (r.cooldownMs / 1000).toFixed(0) +
                                    "s"
                            );

                            if (navigator.vibrate) {
                                try {
                                    navigator.vibrate(15);
                                } catch (e) {}
                            }
                            render();
                            Save.write();
                        });

                        return {
                            element: section,
                            render,
                            onShow() {
                                const m = FEATURES.exchange.ensurePortfolio();
                                m.everVisited = true;
                                document
                                    .getElementById("exchangePill")
                                    ?.classList.add("revealed");
                                requestAnimationFrame(() => {
                                    resize();
                                    drawChart();
                                });
                            },
                            onHide() {}
                        };
                    }
                }
            ]
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
