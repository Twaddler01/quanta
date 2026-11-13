export const Config = (() => {
    const DEBUG_MODE = false;

    /* ---- level curve constants ---- */
    const LEVEL_BASE_STEP = 6; // cash-outs for L1
    const LEVEL_ADD = 3; // step increment per level
    const LEVEL_QUAD = 0.5; // extra quadratic growth per level
    const LEVEL_BONUS_BASE = 0.6; // Q/s at L1, scaled by L^exp
    const LEVEL_BONUS_EXP = 0.9;
    const LEVEL_TIP_PCT = 0.05; // per-cash-out lump tip = value × this

    function levelStepAt(n) {
        if (n <= 0) return 0;
        return Math.floor(
            LEVEL_BASE_STEP +
                LEVEL_ADD * (n - 1) +
                (LEVEL_QUAD * (n - 1) * (n - 2)) / 2
        );
    }
    function levelThreshold(L) {
        let sum = 0;
        for (let n = 1; n <= L; n++) sum += levelStepAt(n);
        return sum;
    }
    function computeLevel(cashOuts) {
        if (cashOuts <= 0) return 0;
        let L = 0;
        while (levelThreshold(L + 1) <= cashOuts && L < 1000) L++;
        return L;
    }
    function bonusAtLevel(n) {
        if (n <= 0) return 0;
        return LEVEL_BONUS_BASE * Math.pow(n, LEVEL_BONUS_EXP);
    }
    function totalLevelBonus(L) {
        let sum = 0;
        for (let n = 1; n <= L; n++) sum += bonusAtLevel(n);
        return sum;
    }

    function prestigeStars(level) {
        if (level < 5) return 0;
        const n = level - 4;
        return Math.floor((n * (n + 1)) / 2);
    }
    
    const BASE_MARKETS = [
        {
            id: "calm",
            name: "Calm Waters",
            tierWeight: 1.0,
            priceMult: 1.0,
            threshold: 1000,
            unlockAt: 0,
            wave: {
                amp1: 0.25,
                period1: 15,
                amp2: 0.05,
                period2: 10,
                noiseAmp: 0.015,
                periodMult: 1.5
            }
        },
        {
            id: "resonance",
            name: "Resonance",
            tierWeight: 1.2,
            priceMult: 1.2,
            threshold: 1500,
            unlockAt: 0, // testing — raise later
            chartSpan: 3.2,
            chartYRange: 0.52,
            wave: {
                amp1: 0.3,
                period1: 4.05,
                amp2: 0.11,
                period2: 1.5,
                amp3: 0.06,
                period3: 0.94,
                noiseAmp: 0.015,
                periodMult: 1.0
            }
        },
        {
            id: "tidal",
            name: "Turbulent Tides",
            tierWeight: 1.8,
            priceMult: 1.8,
            threshold: 2000,
            unlockAt: 5000,
            wave: {
                amp1: 0.28,
                period1: 60,
                amp2: 0.1,
                period2: 18,
                noiseAmp: 0.04,
                periodMult: 2.8
            }
        },
        {
            id: "vortex",
            name: "Volatile Vortex",
            tierWeight: 2.0,
            priceMult: 2.0,
            threshold: 4000,
            unlockAt: 50000,
            wave: {
                amp1: 0.35,
                period1: 110,
                amp2: 0.25,
                period2: 15,
                noiseAmp: 0.12,
                periodMult: 1.8
            }
        },
        {
            id: "chaos",
            name: "Chaos Field",
            tierWeight: 3.0,
            priceMult: 3.0,
            threshold: 8000,
            unlockAt: 500000,
            wave: {
                amp1: 0.4,
                period1: 150,
                amp2: 0.3,
                period2: 9,
                noiseAmp: 0.2,
                periodMult: 0.8
            }
        },
        {
            id: "abyss",
            name: "Abyss",
            tierWeight: 4.0,
            priceMult: 4.0,
            threshold: 12000,
            unlockAt: 5000000,
            wave: {
                amp1: 0.45,
                period1: 200,
                amp2: 0.25,
                period2: 8,
                noiseAmp: 0.28,
                periodMult: 0.6
            }
        },
        {
            id: "void",
            name: "Void",
            tierWeight: 5.0,
            priceMult: 5.0,
            threshold: 16000,
            unlockAt: 50000000,
            wave: {
                amp1: 0.5,
                period1: 260,
                amp2: 0.3,
                period2: 6,
                noiseAmp: 0.35,
                periodMult: 0.4
            }
        }
    ];

    const DEBUG_MARKET = {
        id: "debug",
        name: "DEBUG",
        debug: true,
        tierWeight: 1.0,
        priceMult: 1.0,
        threshold: 100,
        unlockAt: 0,
        wave: {
            amp1: 0.2,
            period1: 40,
            amp2: 0.08,
            period2: 20,
            noiseAmp: 0.02,
            periodMult: 3
        }
    };

    const MARKETS = DEBUG_MODE ? [...BASE_MARKETS, DEBUG_MARKET] : BASE_MARKETS;

    const liveMarkets = () => MARKETS.filter(m => !m.debug);
    const isDebugMarket = id => {
        const m = MARKETS.find(x => x.id === id);
        return !!(m && m.debug);
    };

    return {
        DEBUG_MODE,
        MARKETS,
        liveMarkets,
        isDebugMarket,

        STARTING_Q: 0,
        BASE_PRICE: 100,
        TRADING_FEE: 0.1,
        WAVE_PERIOD_MULT: 1.5,
        WAVE_NOISE_MULT: 1.0,
        STARTING_Q_PER_MARKET: 200,
        STARTING_SHARES: 5,
        SHARE_UPGRADE_BASE: 100,
        SHARE_UPGRADE_MULT: 1.2,

        POOL_MAX_BASE: 350,
        SHARE_POOL_BONUS: 0.15,
        POOL_ROUTE: 0.8,
        INTEREST_COEF: 0.02,
        INTEREST_WINDOW_SEC: 60,
        CASHOUT_FULL_THRESHOLD: 1,
        CASHOUT_COOLDOWN: 5,

        RESET_COOLDOWN: 60,
        RESET_THRESHOLD_Q: 50,

        PORTFOLIO_BOOST_BASE: 1800,
        PORTFOLIO_BOOST_MULT: 2.5,
        PORTFOLIO_BOOST_PER_LEVEL: 0.15,
        INTEREST_BOOSTER_BASE: 3000,
        INTEREST_BOOSTER_MULT: 2.5,
        INTEREST_BOOSTER_PER_LEVEL: 0.15,
        MARKET_LEVERAGE_BASE: 9000,
        MARKET_LEVERAGE_MULT: 3.0,
        MARKET_LEVERAGE_PER_LEVEL: 0.05,
        MARKET_LEVERAGE_MAX_LEVEL: 10,
        POOL_BUFFER_BASE: 6000,
        POOL_BUFFER_MULT: 2.5,
        POOL_BUFFER_PER_LEVEL: 0.05,
        POOL_BUFFER_MAX_LEVEL: 10,

        PASSIVE_YIELD_BASE: 12000,
        PASSIVE_YIELD_MULT: 2.5,
        PASSIVE_YIELD_PER_LEVEL: 0.01,
        PASSIVE_YIELD_LIFETIME_DIV: 10000,

        /* ---- Reaction (wave damping) ---- */
        REACTION_BASE: 1500,
        REACTION_MULT: 2.5,
        REACTION_PER_LEVEL: 0.05,
        REACTION_MAX_LEVEL: 10,

        /* ---- Broker License (trading fee reduction) ---- */
        BROKER_BASE: 2000,
        BROKER_MULT: 2.5,
        BROKER_PER_LEVEL: 0.01,
        BROKER_MAX_LEVEL: 10,

        /* ---- Frequency Coil (wave speed) ---- */
        SPEED_UPGRADE_BASE: 3000,
        SPEED_UPGRADE_MULT: 2.5,
        SPEED_PER_LEVEL: 0.15,
        SPEED_MAX_LEVEL: 10,
        
        /* ---- Prestige (per-market reset for stars) ---- */
        PRESTIGE_LEVEL_MIN: 5,
        PRESTIGE_STAR_PER: 0.03,

        /* ---- Streak (consecutive profitable trades per market) ---- */
        STREAK_WINDOW_MS: 15000,
        STREAK_PER: 0.2,
        STREAK_CAP: 2.0,

        /* ---- level helpers ---- */
        LEVEL_BASE_STEP,
        LEVEL_ADD,
        LEVEL_QUAD,
        LEVEL_BONUS_BASE,
        LEVEL_BONUS_EXP,
        LEVEL_TIP_PCT,
        levelStepAt,
        levelThreshold,
        computeLevel,
        bonusAtLevel,
        totalLevelBonus,
        prestigeStars,

        SAVE_KEY: "quanta_portfolio_v10"
    };
})();

export const State = (() => {
    function blankMarket() {
        return {
            q: Config.STARTING_Q_PER_MARKET,
            shares: Config.STARTING_SHARES,
            holding: 0,
            costBasis: 0,
            lifetimeProfit: 0,
            lifetimeCashOut: 0,
            cashOutCount: 0,
            level: 0,
            lastLevelUpTime: 0,
            pool: 0,
            recentProfit: 0,
            interestExpiresAt: 0,
            lastBuyPrice: 0,
            lastBuyTime: 0,
            lastSellProfit: 0,
            lastSellTotal: 0,
            lastSellTime: 0,
            lastCashOut: 0,
            cashOutCooldown: 0,
            resetCooldown: 0,
            speedLevel: 0,
            streak: 0,
            lastStreakAt: 0,
            stars: 0
        };
    }

    function blankSeenMarkets() {
        const out = {};
        for (const m of Config.MARKETS) out[m.id] = m.unlockAt === 0;
        return out;
    }

    function blank() {
        const markets = {};
        for (const m of Config.MARKETS) markets[m.id] = blankMarket();
        return {
            Q: Config.STARTING_Q,
            total: Config.STARTING_Q,
            lastGrowthPct: 0,
            bestCashOut: 0,
            portfolioBoost: 0,
            interestBooster: 0,
            marketLeverage: 0,
            poolBuffer: 0,
            passiveYield: 0,
            reaction: 0,
            brokerLicense: 0,
            activeMarket: "calm",
            seenMarkets: blankSeenMarkets(),
            start: Date.now(),
            lastSave: Date.now(),
            noisePhase: Math.random() * 1000,
            markets
        };
    }
    let s = blank();
    return {
        get: () => s,
        blank,
        replace(n) {
            s = n;
            return s;
        }
    };
})();

export const Save = (() => {
    const KEY = Config.SAVE_KEY;
    const LEGACY_KEY = "quanta_portfolio_v9";
    const num = v => (Number.isFinite(+v) ? +v : 0);
    let disabled = false;

    function write() {
        if (disabled) return;
        const s = State.get();
        s.lastSave = Date.now();
        try {
            localStorage.setItem(KEY, JSON.stringify(s));
        } catch (e) {}
    }

    function read() {
        let raw;
        try {
            raw = localStorage.getItem(KEY);
        } catch (e) {
            return false;
        }
        if (!raw) {
            // v9 → v10 migration: read legacy key if v10 is absent
            try {
                raw = localStorage.getItem(LEGACY_KEY);
            } catch (e) {
                return false;
            }
            if (raw) {
                console.log("[save] migrating from v9 → v10");
            }
        }
        if (!raw) return false;
        let p;
        try {
            p = JSON.parse(raw);
        } catch (e) {
            return false;
        }
        if (!p || typeof p !== "object") return false;

        const def = State.blank();
        const markets = {};
        for (const m of Config.MARKETS) {
            const saved = p.markets?.[m.id] || {};
            const cashOutCount = Math.max(
                0,
                Math.floor(num(saved.cashOutCount))
            );
            markets[m.id] = {
                q: num(saved.q) || def.markets[m.id].q,
                shares: Math.max(
                    1,
                    Math.floor(num(saved.shares) || def.markets[m.id].shares)
                ),
                holding: Math.max(0, Math.floor(num(saved.holding))),
                costBasis: num(saved.costBasis),
                lifetimeProfit: num(saved.lifetimeProfit),
                lifetimeCashOut: num(saved.lifetimeCashOut),
                cashOutCount,
                /* derive level from cash-out count — migration-safe */
                level: Config.computeLevel(cashOutCount),
                lastLevelUpTime: num(saved.lastLevelUpTime),
                pool: Math.max(0, num(saved.pool)),
                recentProfit: Math.max(0, num(saved.recentProfit)),
                interestExpiresAt: Math.max(0, num(saved.interestExpiresAt)),
                lastBuyPrice: num(saved.lastBuyPrice),
                lastBuyTime: num(saved.lastBuyTime),
                lastSellProfit: num(saved.lastSellProfit),
                lastSellTotal: num(saved.lastSellTotal),
                lastSellTime: num(saved.lastSellTime),
                lastCashOut: num(saved.lastCashOut),
                cashOutCooldown: Math.max(0, num(saved.cashOutCooldown)),
                resetCooldown: Math.max(0, num(saved.resetCooldown)),
                speedLevel: Math.max(
                    0,
                    Math.min(
                        Config.SPEED_MAX_LEVEL,
                        Math.floor(num(saved.speedLevel))
                    )
                ),
                streak: Math.max(0, Math.floor(num(saved.streak))),
                lastStreakAt: Math.max(0, num(saved.lastStreakAt)),
                stars: Math.max(0, Math.floor(num(saved.stars)))
            };
        }

        State.replace({
            Q: num(p.Q) || def.Q,
            total: num(p.total) || def.total,
            lastGrowthPct: num(p.lastGrowthPct),
            bestCashOut: num(p.bestCashOut),
            portfolioBoost: Math.max(0, Math.floor(num(p.portfolioBoost))),
            interestBooster: Math.max(0, Math.floor(num(p.interestBooster))),
            marketLeverage: Math.max(0, Math.floor(num(p.marketLeverage))),
            poolBuffer: Math.max(
                0,
                Math.min(
                    Config.POOL_BUFFER_MAX_LEVEL,
                    Math.floor(num(p.poolBuffer))
                )
            ),
            passiveYield: Math.max(0, Math.floor(num(p.passiveYield))),
            reaction: Math.max(
                0,
                Math.min(Config.REACTION_MAX_LEVEL, Math.floor(num(p.reaction)))
            ),
            brokerLicense: Math.max(
                0,
                Math.min(
                    Config.BROKER_MAX_LEVEL,
                    Math.floor(num(p.brokerLicense))
                )
            ),
            activeMarket: Config.MARKETS.some(m => m.id === p.activeMarket)
                ? p.activeMarket
                : "calm",
            seenMarkets: Object.assign(
                {},
                def.seenMarkets,
                p.seenMarkets || {}
            ),
            start: num(p.start) || Date.now(),
            lastSave: num(p.lastSave) || Date.now(),
            noisePhase: num(p.noisePhase) || def.noisePhase,
            markets
        });

        const s = State.get();
        const activeDef = Config.MARKETS.find(m => m.id === s.activeMarket);
        if (!activeDef || s.total < activeDef.unlockAt) {
            s.activeMarket = "calm";
        }
        return true;
    }

    function wipe() {
        try {
            localStorage.removeItem(KEY);
        } catch (e) {}
    }

    function disable() {
        disabled = true;
    }

    return { write, read, wipe, disable };
})();
