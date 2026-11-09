export const Config = {
    STARTING_Q: 0,

    BASE_PRICE: 100,
    TRADING_FEE: 0.1,
    PRICE_ENTROPY_GROWTH: 0.005,

    WEATHER_AMP_1: 0.3,
    WEATHER_PERIOD_1: 75,
    WEATHER_AMP_2: 0.12,
    WEATHER_PERIOD_2: 23,
    NOISE_AMP: 0.05,

    STARTING_Q_PER_MARKET: 100,
    STARTING_SHARES: 5,
    SHARE_UPGRADE_BASE: 100,
    SHARE_UPGRADE_MULT: 1.8,
    SHARE_MULT_BONUS: 0.15,

    MARKETS: [
        {
            id: "calm",
            name: "Calm Waters",
            tierWeight: 1.0,
            volatility: 1.0,
            priceMult: 1.0,
            threshold: 1000,
            unlockAt: 0
        },
        {
            id: "tidal",
            name: "Turbulent Tides",
            tierWeight: 1.5,
            volatility: 1.5,
            priceMult: 1.5,
            threshold: 2000,
            unlockAt: 5000
        },
        {
            id: "vortex",
            name: "Volatile Vortex",
            tierWeight: 2.0,
            volatility: 2.0,
            priceMult: 2.0,
            threshold: 4000,
            unlockAt: 50000
        },
        {
            id: "chaos",
            name: "Chaos Field",
            tierWeight: 3.0,
            volatility: 3.0,
            priceMult: 3.0,
            threshold: 8000,
            unlockAt: 500000
        }
    ],

    // Passive income comes from lifetime cash outs per market
    PASSIVE_RATE: 4,
    CASHOUT_BASE: 100,
    CASHOUT_COOLDOWN: 30,
    CASHOUT_ENTROPY_DIVISOR: 100,
    CASHOUT_HOLD_EXP: 1.2,
    CASHOUT_HOLD_CAP_SEC: 4 * 3600,

    // Milestones
    MILESTONE_EVERY: 10,
    MILESTONE_BONUS_MULT: 3,
    MILESTONE_PERM_BONUS: 0.02,
    MILESTONE_PERM_CAP: 0.5,
    
    // Market reset (emergency recovery when stuck)
    RESET_BASE_Q: 100,        // reset q amount at entropy 0 (scales with entropy)
    RESET_COOLDOWN: 60,       // seconds per market
    RESET_THRESHOLD_Q: 50,    // trigger: q < this
    RESET_THRESHOLD_BIG_Q: 100, // trigger: bigQ < this
    
    ENTROPY_BASE_RATE: 0.02,
    ENTROPY_PER_TRADE: 0.02,

    PORTFOLIO_BOOST_BASE: 3000,
    PORTFOLIO_BOOST_MULT: 2.5,
    PORTFOLIO_BOOST_PER_LEVEL: 0.15,

    SAVE_KEY: "quanta_portfolio_v2"
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

    function blank() {
        const markets = {};
        for (const m of Config.MARKETS) markets[m.id] = blankMarket();
        return {
            Q: Config.STARTING_Q,
            total: Config.STARTING_Q,
            entropy: 0,
            portfolioBoost: 0,
            activeMarket: "calm",
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
            entropy: num(p.entropy),
            portfolioBoost: Math.max(0, Math.floor(num(p.portfolioBoost))),
            activeMarket: Config.MARKETS.some(m => m.id === p.activeMarket)
                ? p.activeMarket
                : "calm",
            start: num(p.start) || Date.now(),
            lastSave: num(p.lastSave) || Date.now(),
            noisePhase: num(p.noisePhase) || def.noisePhase,
            markets
        });
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
