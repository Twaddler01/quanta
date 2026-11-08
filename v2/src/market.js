import { Config, State } from "./config.js";

export const Market = (() => {
    function basePrice() {
        const s = State.get();
        return (
            Config.BASE_PRICE * (1 + s.entropy * Config.PRICE_ENTROPY_GROWTH)
        );
    }

    /** Natural market price (weather + noise, no player impact) at time t. */
    function naturalPrice(t) {
        const base = basePrice();
        const weather =
            Math.sin((t / Config.WEATHER_PERIOD) * Math.PI * 2) *
                Config.WEATHER_AMP +
            Math.sin((t / Config.WEATHER_PERIOD_2) * Math.PI * 2 + 0.7) *
                Config.WEATHER_AMP_2;
        const phase = State.get().noisePhase;
        const noise =
            Math.sin(t * 3.7 + phase) * Config.NOISE_AMP * 0.6 +
            Math.sin(t * 8.3 + phase * 1.7) * Config.NOISE_AMP * 0.4;
        return Math.max(base * 0.1, base * (1 + weather + noise));
    }

    /** Current price including your trade impact. */
    function currentPrice(t) {
        return naturalPrice(t) * (1 + State.get().impact);
    }

    const buyPrice = t => currentPrice(t) * (1 + Config.TRADING_FEE);
    const sellPrice = t => currentPrice(t);

    const maxShares = () => {
        const s = State.get();
        return (
            Config.BASE_MAX_SHARES + s.upgradeLevel * Config.SHARES_PER_UPGRADE
        );
    };

    const upgradeCost = () => {
        const s = State.get();
        return (
            Config.UPGRADE_COST_BASE *
            Math.pow(Config.UPGRADE_COST_MULT, s.upgradeLevel)
        );
    };

    function buy(n, t) {
        const s = State.get();
        n = Math.min(n, maxShares() - s.shares);
        if (n <= 0) return { bought: 0, cost: 0 };

        const price = buyPrice(t);
        if (n * price > s.quanta) n = Math.floor(s.quanta / price);
        if (n <= 0) return { bought: 0, cost: 0 };

        const cost = n * price;
        s.quanta -= cost;
        s.shares += n;
        s.costBasis += cost;
        s.impact = Math.min(
            Config.IMPACT_MAX,
            s.impact + n * Config.IMPACT_PER_SHARE
        );
        s.entropy += n * Config.ENTROPY_PER_TRADE;
        return { bought: n, cost };
    }

    function sell(n, t) {
        const s = State.get();
        n = Math.min(n, s.shares);
        if (n <= 0) return { sold: 0, gain: 0 };

        const price = sellPrice(t);
        const gain = n * price;
        const fraction = n / s.shares;

        s.quanta += gain;
        s.total += gain;
        s.costBasis *= 1 - fraction;
        s.shares -= n;
        s.impact = Math.max(
            -Config.IMPACT_MAX,
            s.impact - n * Config.IMPACT_PER_SHARE
        );
        s.entropy += n * Config.ENTROPY_PER_TRADE;
        return { sold: n, gain };
    }

    function tick(dt) {
        const s = State.get();
        s.entropy += Config.ENTROPY_BASE_RATE * dt;
        s.impact *= Math.pow(1 - Config.IMPACT_DECAY, dt);
        s.quanta += Config.BASE_INCOME * dt;
        s.total += Config.BASE_INCOME * dt;
        if (s.cashOutCooldown > 0)
            s.cashOutCooldown = Math.max(0, s.cashOutCooldown - dt);
    }

    function canCashOut() {
        const s = State.get();
        if (s.cashOutCooldown > 0)
            return { ok: false, reason: "cooldown", left: s.cashOutCooldown };
        if (s.entropy < Config.CASHOUT_MIN_ENTROPY)
            return { ok: false, reason: "low-entropy" };
        if (s.shares < 1) return { ok: false, reason: "no-shares" };
        return { ok: true };
    }

    function holdBonus(sec) {
        const capped = Math.min(sec, Config.CASHOUT_HOLD_CAP_SEC);
        return Math.max(0.1, Math.pow(capped / 60, Config.CASHOUT_HOLD_EXP));
    }

    function cashOutPreview(t) {
        const s = State.get();
        const holdSec = (Date.now() - (s.lastCashOut || s.start)) / 1000;
        const shareValue = s.shares * sellPrice(t);
        const entropyBonus =
            s.entropy * Config.CASHOUT_ENTROPY_RATE * holdBonus(holdSec);
        return {
            shareValue,
            entropyBonus,
            total: shareValue + entropyBonus,
            holdSec
        };
    }

    function cashOut(t) {
        const check = canCashOut();
        if (!check.ok) return { ok: false, reason: check.reason };

        const preview = cashOutPreview(t);
        const s = State.get();

        s.quanta += preview.total;
        s.total += preview.total;
        s.shares = 0;
        s.costBasis = 0;
        s.impact = 0;
        s.lastCashOut = Date.now();
        s.cashOutCooldown = Config.CASHOUT_COOLDOWN;

        return { ok: true, ...preview };
    }

    function upgrade() {
        const s = State.get();
        const cost = upgradeCost();
        if (s.quanta < cost) return false;
        s.quanta -= cost;
        s.upgradeLevel += 1;
        return true;
    }

    function unrealizedPL(t) {
        const s = State.get();
        if (s.shares === 0) return 0;
        return s.shares * sellPrice(t) - s.costBasis;
    }

    return {
        basePrice,
        naturalPrice,
        currentPrice,
        buyPrice,
        sellPrice,
        maxShares,
        upgradeCost,
        buy,
        sell,
        tick,
        canCashOut,
        cashOutPreview,
        cashOut,
        upgrade,
        unrealizedPL
    };
})();
