export const Config = {
    STARTING_Q: 1000,
    BASE_INCOME: 0.5, // global Q/s floor

    // Global pricing
    BASE_PRICE: 100, // Q per unit at entropy 0
    TRADING_FEE: 0.1, // 10% buy fee
    PRICE_ENTROPY_GROWTH: 0.005, // +0.5% base per entropy

    // Wave shape
    WEATHER_AMP_1: 0.3,
    WEATHER_PERIOD_1: 75,
    WEATHER_AMP_2: 0.12,
    WEATHER_PERIOD_2: 23,
    NOISE_AMP: 0.05,

    // Per-market starting resources
    STARTING_Q_PER_MARKET: 1000,
    STARTING_SHARES: 5,
    SHARE_UPGRADE_BASE: 100,
    SHARE_UPGRADE_MULT: 1.8,

    // Markets
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

    // Multiplier → Big Q bridge
    PASSIVE_RATE: 0.3, // Q/s per contribution unit
    CASHOUT_BASE: 100, // Q per contribution unit
    CASHOUT_COOLDOWN: 60,
    CASHOUT_ENTROPY_DIVISOR: 100, // entropy 100 = ×2 multiplier
    CASHOUT_HOLD_EXP: 0.8,
    CASHOUT_HOLD_CAP_SEC: 4 * 3600,

    // Entropy
    ENTROPY_BASE_RATE: 0.02, // per second
    ENTROPY_PER_TRADE: 0.02, // per profitable trade

    // Portfolio upgrade: Boost (multiplies all contributions)
    PORTFOLIO_BOOST_BASE: 10000,
    PORTFOLIO_BOOST_MULT: 2.5,
    PORTFOLIO_BOOST_PER_LEVEL: 0.15,

    SAVE_KEY: "quanta_portfolio_v1"
};

export const State = (() => {
    function blankMarket() {
        return {
            q: Config.STARTING_Q_PER_MARKET,
            shares: Config.STARTING_SHARES,
            holding: 0,
            costBasis: 0,
            lifetimeProfit: 0,
            lastBuyPrice: 0,
            lastBuyTime: 0,
            lastSellProfit: 0,
            lastSellTotal: 0,
            lastSellTime: 0,
            lastCashOut: 0,
            cashOutCooldown: 0
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

    function write() {
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
                lastBuyPrice: num(saved.lastBuyPrice),
                lastBuyTime: num(saved.lastBuyTime),
                lastSellProfit: num(saved.lastSellProfit),
                lastSellTotal: num(saved.lastSellTotal),
                lastSellTime: num(saved.lastSellTime),
                lastCashOut: num(saved.lastCashOut),
                cashOutCooldown: Math.max(0, num(saved.cashOutCooldown))
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

    return { write, read, wipe };
})();
