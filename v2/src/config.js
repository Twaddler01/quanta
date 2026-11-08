export const Config = {
    // Starting resources
    STARTING_QUANTA: 1000,
    BASE_INCOME: 0.5, // Q/s passive baseline

    // Market pricing
    BASE_PRICE: 100, // Q per share at entropy 0
    TRADING_FEE: 0.1, // 10% buy fee
    PRICE_ENTROPY_GROWTH: 0.01, // +1% base price per entropy

    // Wave shape
    WEATHER_AMP: 0.3,
    WEATHER_PERIOD: 75, // seconds (slow)
    WEATHER_AMP_2: 0.12,
    WEATHER_PERIOD_2: 23, // seconds (fast)
    NOISE_AMP: 0.05,

    // Trade impact (buy bumps up, sell bumps down)
    IMPACT_PER_SHARE: 0.002, // 0.2% per share traded
    IMPACT_MAX: 0.5, // cap at ±50%
    IMPACT_DECAY: 0.15, // 15% per second decay

    // Entropy (THE multiplier)
    ENTROPY_BASE_RATE: 0.02, // per second
    ENTROPY_PER_TRADE: 0.1, // per share traded

    // Shares / upgrades
    BASE_MAX_SHARES: 10,
    SHARES_PER_UPGRADE: 5,
    UPGRADE_COST_BASE: 500,
    UPGRADE_COST_MULT: 1.8,

    // Cash out
    CASHOUT_COOLDOWN: 30,
    CASHOUT_MIN_ENTROPY: 10,
    CASHOUT_ENTROPY_RATE: 0.1,
    CASHOUT_HOLD_EXP: 0.8,
    CASHOUT_HOLD_CAP_SEC: 4 * 3600,

    SAVE_KEY: "quanta_market_v1"
};

export const State = (() => {
    function blank() {
        return {
            quanta: Config.STARTING_QUANTA,
            total: Config.STARTING_QUANTA,
            shares: 0,
            costBasis: 0,
            entropy: 0,
            impact: 0,
            upgradeLevel: 0,
            lastCashOut: 0,
            cashOutCooldown: 0,
            start: Date.now(),
            lastSave: Date.now(),
            noisePhase: Math.random() * 1000
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
        State.replace({
            quanta: num(p.quanta) || def.quanta,
            total: num(p.total) || def.total,
            shares: Math.max(0, Math.floor(num(p.shares))),
            costBasis: num(p.costBasis),
            entropy: num(p.entropy),
            impact: num(p.impact),
            upgradeLevel: Math.max(0, Math.floor(num(p.upgradeLevel))),
            lastCashOut: num(p.lastCashOut),
            cashOutCooldown: Math.max(0, num(p.cashOutCooldown)),
            start: num(p.start) || Date.now(),
            lastSave: num(p.lastSave) || Date.now(),
            noisePhase: num(p.noisePhase) || def.noisePhase
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
