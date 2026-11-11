export const Config = {
    STARTING_Q: 0,

    BASE_PRICE: 100,
    TRADING_FEE: 0.1,
    /* Global defaults. Each market can override with wave.periodMult / wave.noiseMult. */
    WAVE_PERIOD_MULT: 1.5, // peaks/valleys come this much quicker (period ÷ MULT)
    WAVE_NOISE_MULT: 1.0, // noise frequency (1.0 = smooth)

    STARTING_Q_PER_MARKET: 200,
    STARTING_SHARES: 5,
    SHARE_UPGRADE_BASE: 100,
    SHARE_UPGRADE_MULT: 1.2,

/*
Market  Base  period1 periodMult Effective cycle Feel
Calm    40s   1.8     ~22s        fast, forgiving
Tidal   75s   1.3     ~58s        mid
Vortex 110s   1.1     ~100s       deliberate
Chaos  150s   0.8     ~188s       slow, dramatic
*/

    MARKETS: [
        {
            id: "calm",
            name: "Calm Waters",
            tierWeight: 1.0,
            priceMult: 1.0,
            threshold: 1000,
            unlockAt: 0,
            wave: {
                amp1: 0.20, period1: 40,
                amp2: 0.08, period2: 20,
                noiseAmp: 0.02,
                periodMult: 3   // fastest
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
                amp1: 0.30, period1: 70,
                amp2: 0.05, period2: 17,
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
                amp1: 0.35, period1: 110,
                amp2: 0.25, period2: 15,
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
                amp1: 0.40, period1: 150,
                amp2: 0.30, period2: 9,
                noiseAmp: 0.20,
                periodMult: 0.8   // peak every ~188s — deliberate, drawn out
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
