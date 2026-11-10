export const Config = {
    STARTING_Q: 0,

    BASE_PRICE: 100,
    TRADING_FEE: 0.1,
    WAVE_PERIOD_MULT: 1.5, // peaks/valleys come this much quicker (period ÷ MULT). Try 1.0–2.0.
    WAVE_NOISE_MULT: 1.0, // noise frequency. Keep at 1.0 for smooth curves; raise if too tame.

    STARTING_Q_PER_MARKET: 100,
    STARTING_SHARES: 5,
    SHARE_UPGRADE_BASE: 100,
    SHARE_UPGRADE_MULT: 1.8,

    MARKETS: [
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
                period2: 12,
                noiseAmp: 0.02
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
                period1: 75,
                amp2: 0.12,
                period2: 23,
                noiseAmp: 0.05
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
                noiseAmp: 0.12
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
                noiseAmp: 0.2
            }
        }
    ],

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

    RESET_BASE_Q: 100,
    RESET_COOLDOWN: 60,
    RESET_THRESHOLD_Q: 50,

    PORTFOLIO_BOOST_BASE: 3000,
    PORTFOLIO_BOOST_MULT: 2.5,
    PORTFOLIO_BOOST_PER_LEVEL: 0.15,
    INTEREST_BOOSTER_BASE: 5000,
    INTEREST_BOOSTER_MULT: 2.5,
    INTEREST_BOOSTER_PER_LEVEL: 0.15,

    SAVE_KEY: "quanta_portfolio_v5"
};

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
        for (const m of Config.MARKETS) markets[m.id] = blankMarket();
        return {
            Q: Config.STARTING_Q,
            total: Config.STARTING_Q,
            lastGrowthPct: 0,
            portfolioBoost: 0,
            interestBooster: 0,
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

        State.replace({
            Q: num(p.Q) || def.Q,
            total: num(p.total) || def.total,
            lastGrowthPct: num(p.lastGrowthPct),
            portfolioBoost: Math.max(0, Math.floor(num(p.portfolioBoost))),
            interestBooster: Math.max(0, Math.floor(num(p.interestBooster))),
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

        /* Fallback: if activeMarket is locked, revert to calm */
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
