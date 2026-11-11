export const Config = (() => {
    const DEBUG_MODE = false; // set false to strip debug market entirely

    const BASE_MARKETS = [
        {
            id: "calm",
            name: "Calm Waters",
            tierWeight: 1.0,
            priceMult: 1.0,
            threshold: 1000,
            unlockAt: 0,
            wave: {
                amp1: 0.2,
                period1: 40,
                amp2: 0.08,
                period2: 20,
                noiseAmp: 0.02,
                periodMult: 3
            }
        },
        {
            id: "tidal",
            name: "Turbulent Tides",
            tierWeight: 1.5,
            priceMult: 1.5,
            threshold: 2000,
            unlockAt: 5000,
            wave: {
                amp1: 0.3,
                period1: 70,
                amp2: 0.05,
                period2: 17,
                noiseAmp: 0.05,
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

        POOL_MAX_BASE: 500,
        SHARE_POOL_BONUS: 0.15,
        POOL_ROUTE: 0.5,
        INTEREST_COEF: 0.02,
        INTEREST_WINDOW_SEC: 60,
        CASHOUT_FULL_THRESHOLD: 1,
        CASHOUT_COOLDOWN: 5,

        MILESTONE_EVERY: 10,
        MILESTONE_BONUS_MULT: 3,
        MILESTONE_PERM_BONUS: 0.02,
        MILESTONE_PERM_CAP: 0.5,

        RESET_COOLDOWN: 60,
        RESET_THRESHOLD_Q: 50,

        PORTFOLIO_BOOST_BASE: 3000,
        PORTFOLIO_BOOST_MULT: 2.5,
        PORTFOLIO_BOOST_PER_LEVEL: 0.15,
        INTEREST_BOOSTER_BASE: 5000,
        INTEREST_BOOSTER_MULT: 2.5,
        INTEREST_BOOSTER_PER_LEVEL: 0.15,
        MARKET_LEVERAGE_BASE: 15000,
        MARKET_LEVERAGE_MULT: 3.0,
        MARKET_LEVERAGE_PER_LEVEL: 0.05,
        MARKET_LEVERAGE_MAX_LEVEL: 10,
        POOL_BUFFER_BASE: 10000,
        POOL_BUFFER_MULT: 2.5,
        POOL_BUFFER_PER_LEVEL: 0.1,
        PASSIVE_YIELD_BASE: 20000,
        PASSIVE_YIELD_MULT: 2.5,
        PASSIVE_YIELD_PER_LEVEL: 0.01,
        PASSIVE_YIELD_LIFETIME_DIV: 10000,

        /* ---- IPO system ---- */
        IPO_MIN_LIFETIME: 100000, // threshold for the first IPO
        IPO_PASSIVE_PER_TIER: 1.0, // base Q/s per tierWeight at min threshold
        IPO_LUMP_MULT: 0.5, // lump sum = lifetime cash out × this
        IPO_MAX_STARS: 5,

        /* ---- Star difficulty scaling (applied per star past the first) ---- */
        STAR_NOISE_PER: 0.35, // +35% noise amplitude per star past 1
        STAR_PERIOD_PER: 0.08, // −8% periodMult per star past 1 (slower waves)

        SAVE_KEY: "quanta_portfolio_v7"
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
            milestoneBonus: 0,
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
            resetCooldown: 0
        };
    }

    function blankSeenMarkets() {
        const out = {};
        for (const m of Config.MARKETS) out[m.id] = m.unlockAt === 0;
        return out;
    }

    function blank() {
        const markets = {};
        const stars = {};
        const ipoed = {};
        for (const m of Config.MARKETS) {
            markets[m.id] = blankMarket();
            stars[m.id] = 0;
            ipoed[m.id] = false;
        }
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
            stars,
            ipoed,
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
                cashOutCount: Math.max(0, Math.floor(num(saved.cashOutCount))),
                milestoneBonus: Math.min(
                    Config.MILESTONE_PERM_CAP,
                    Math.max(0, num(saved.milestoneBonus))
                ),
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
                resetCooldown: Math.max(0, num(saved.resetCooldown))
            };
        }

        /* Migrate stars / ipoed from legacy v6 boolean */
        const legacyIpoed = p.ipoed || {};
        const savedStars = p.stars || {};
        const stars = {};
        const ipoed = {};
        for (const m of Config.MARKETS) {
            if (savedStars[m.id] !== undefined) {
                stars[m.id] = Math.max(
                    0,
                    Math.min(
                        Config.IPO_MAX_STARS,
                        Math.floor(num(savedStars[m.id]))
                    )
                );
            } else if (legacyIpoed[m.id] === true) {
                stars[m.id] = 1;
            } else {
                stars[m.id] = 0;
            }
            ipoed[m.id] = legacyIpoed[m.id] === true;
        }

        State.replace({
            Q: num(p.Q) || def.Q,
            total: num(p.total) || def.total,
            lastGrowthPct: num(p.lastGrowthPct),
            bestCashOut: num(p.bestCashOut),
            portfolioBoost: Math.max(0, Math.floor(num(p.portfolioBoost))),
            interestBooster: Math.max(0, Math.floor(num(p.interestBooster))),
            marketLeverage: Math.max(0, Math.floor(num(p.marketLeverage))),
            poolBuffer: Math.max(0, Math.floor(num(p.poolBuffer))),
            passiveYield: Math.max(0, Math.floor(num(p.passiveYield))),
            stars,
            ipoed,
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
