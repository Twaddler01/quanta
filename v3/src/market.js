import { Config, State } from "./config.js";

export const Market = (() => {
    function basePrice() {
        const s = State.get();
        return (
            Config.BASE_PRICE * (1 + s.entropy * Config.PRICE_ENTROPY_GROWTH)
        );
    }

    function autoBuyMin(level) {
        return Math.max(
            Config.AUTO_BUY_MIN_BASE -
                (level - Config.AUTO_UNLOCK_LEVEL) * Config.AUTO_STEP_PER_LEVEL,
            60
        );
    }
    function autoSellMax(level) {
        return Math.min(
            Config.AUTO_SELL_MAX_BASE +
                (level - Config.AUTO_UNLOCK_LEVEL) * Config.AUTO_STEP_PER_LEVEL,
            140
        );
    }
    function autoUnlocked() {
        return State.get().upgradeLevel >= Config.AUTO_UNLOCK_LEVEL;
    }

    function bulkTradeSize() {
        const lv = State.get().bulkLevel || 0;
        return Config.AUTO_BULK_TIERS[
            Math.min(lv, Config.AUTO_BULK_TIERS.length - 1)
        ];
    }

    function bulkUpgradeCost() {
        const s = State.get();
        const lv = s.bulkLevel || 0;
        if (lv >= Config.AUTO_BULK_TIERS.length - 1) return Infinity;
        return (
            Config.AUTO_BULK_BASE_COST *
            Math.pow(Config.AUTO_BULK_COST_MULT, lv)
        );
    }

    function bulkMaxed() {
        return (
            (State.get().bulkLevel || 0) >= Config.AUTO_BULK_TIERS.length - 1
        );
    }

    function upgradeBulk() {
        const s = State.get();
        const cost = bulkUpgradeCost();
        if (!isFinite(cost) || s.quanta < cost) return false;
        s.quanta -= cost;
        s.bulkLevel += 1;
        return true;
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

    function movingAverage(t) {
        const N = 60;
        const SPAN = 300; // 5 minutes
        const s = State.get();
        const base =
            Config.BASE_PRICE * (1 + s.entropy * Config.PRICE_ENTROPY_GROWTH);
        const phase = s.noisePhase;
        let sum = 0;
        for (let i = 0; i < N; i++) {
            const tt = t - SPAN + (i / N) * SPAN;
            const weather =
                Math.sin((tt / Config.WEATHER_PERIOD) * Math.PI * 2) *
                    Config.WEATHER_AMP +
                Math.sin((tt / Config.WEATHER_PERIOD_2) * Math.PI * 2 + 0.7) *
                    Config.WEATHER_AMP_2;
            const noise =
                Math.sin(tt * 3.7 + phase) * Config.NOISE_AMP * 0.6 +
                Math.sin(tt * 8.3 + phase * 1.7) * Config.NOISE_AMP * 0.4;
            sum += base * (1 + weather + noise);
        }
        return sum / N;
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

    function buy(n, t, isAuto = false, entropyCost = null) {
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

        if (isAuto) {
            const entropyLoss =
                entropyCost ??
                n * Config.ENTROPY_PER_TRADE * -Config.AUTO_ENTROPY_MULT;
            s.entropy = Math.max(0, s.entropy - entropyLoss);
        } else {
            s.entropy += n * Config.ENTROPY_PER_TRADE;
            s.lastBuyPrice = price;
            s.lastBuyTotal = cost;
            s.lastBuyTime = Date.now();
        }
        return { bought: n, cost, price, isAuto };
    }

    function sell(n, t, isAuto = false, entropyCost = null) {
        const s = State.get();
        n = Math.min(n, s.shares);
        if (n <= 0) return { sold: 0, gain: 0 };

        const price = sellPrice(t);
        const gain = n * price;
        const fraction = n / s.shares;
        const avgCostBefore = s.shares > 0 ? s.costBasis / s.shares : 0;
        const realizedProfit = n * (price - avgCostBefore);

        s.quanta += gain;
        s.total += gain;
        s.costBasis *= 1 - fraction;
        s.shares -= n;
        s.impact = Math.max(
            -Config.IMPACT_MAX,
            s.impact - n * Config.IMPACT_PER_SHARE
        );

        if (isAuto) {
            const entropyLoss =
                entropyCost ??
                n * Config.ENTROPY_PER_TRADE * -Config.AUTO_ENTROPY_MULT;
            s.entropy = Math.max(0, s.entropy - entropyLoss);
        } else {
            s.entropy += n * Config.ENTROPY_PER_TRADE;
            s.lastSellProfit = realizedProfit;
            s.lastSellTotal = gain;
            s.lastSellTime = Date.now();
        }
        return { sold: n, gain, profit: realizedProfit, price, isAuto };
    }
    function tick(dt) {
        const s = State.get();
        s.entropy += Config.ENTROPY_BASE_RATE * dt;
        s.impact *= Math.pow(1 - Config.IMPACT_DECAY, dt);
        s.quanta += Config.BASE_INCOME * dt;
        s.total += Config.BASE_INCOME * dt;
        if (s.cashOutCooldown > 0)
            s.cashOutCooldown = Math.max(0, s.cashOutCooldown - dt);

        /* entropy window decays at the cap rate so it refills over 60s */
        const capPerSec = Config.AUTO_ENTROPY_CAP_PER_MIN / 60;
        s.autoEntropyWindow = Math.max(0, s.autoEntropyWindow - capPerSec * dt);
        
        return checkAutoTrades(Date.now() / 1000);
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

    function checkAutoTrades(t) {
        const s = State.get();
        if (!autoUnlocked()) return [];

        const events = [];
        const ma = movingAverage(t);
        const natural = naturalPrice(t);
        const now = Date.now();
        const cooldownMs = Config.AUTO_TRADE_COOLDOWN * 1000;
        const bulkSize = bulkTradeSize();
        const entropyPerShare =
            Config.ENTROPY_PER_TRADE * -Config.AUTO_ENTROPY_MULT;
        const rawEntropyCost = bulkSize * entropyPerShare;

        /* cap check: how much entropy drain budget is available? */
        const capPerSec = Config.AUTO_ENTROPY_CAP_PER_MIN / 60;
        const budget = Math.max(
            0,
            Config.AUTO_ENTROPY_CAP_PER_MIN - s.autoEntropyWindow
        );

        function applyEntropyCost() {
            const actual = Math.min(rawEntropyCost, budget);
            if (actual > 0) {
                s.entropy = Math.max(0, s.entropy - actual);
                s.autoEntropyWindow += actual;
            }
            return actual;
        }

        if (s.autoBuyEnabled && s.shares < maxShares()) {
            const threshold = ma * (s.autoBuyThreshold / 100);
            const cooldownOk = now - s.lastAutoBuyTime >= cooldownMs;
            if (natural < threshold && cooldownOk) {
                const r = buy(bulkSize, t, true, 0);
                if (r.bought > 0) {
                    applyEntropyCost();
                    s.lastAutoBuyTime = now;
                    events.push({ type: "buy", ...r });
                }
            }
        }

        if (s.autoSellEnabled && s.shares > 0) {
            const threshold = ma * (s.autoSellThreshold / 100);
            const cooldownOk = now - s.lastAutoSellTime >= cooldownMs;
            if (natural > threshold && cooldownOk) {
                const r = sell(bulkSize, t, true, 0);
                if (r.sold > 0) {
                    applyEntropyCost();
                    s.lastAutoSellTime = now;
                    events.push({ type: "sell", ...r });
                }
            }
        }

        return events;
    }

    function effectiveEntropyRatePerMin() {
        const s = State.get();
        const baseline = Config.ENTROPY_BASE_RATE * 60;
        const autoOn = s.autoBuyEnabled || s.autoSellEnabled;
        if (!autoOn) return { baseline, auto: 0, effective: baseline };
    
        const bulk = bulkTradeSize();
        const perShare = Config.ENTROPY_PER_TRADE * -Config.AUTO_ENTROPY_MULT;
        const firesPerMin = 60 / Config.AUTO_TRADE_COOLDOWN;
        const rawAuto = bulk * perShare * firesPerMin;
        const auto = Math.min(Config.AUTO_ENTROPY_CAP_PER_MIN, rawAuto);
        return { baseline, auto: -auto, effective: baseline - auto };
    }

    return {
        basePrice,
        naturalPrice,
        currentPrice,
        buyPrice,
        sellPrice,
        movingAverage,
        maxShares,
        upgradeCost,
        buy,
        sell,
        tick,
        canCashOut,
        cashOutPreview,
        cashOut,
        upgrade,
        unrealizedPL,
        autoBuyMin,
        autoSellMax,
        autoUnlocked,
        bulkTradeSize,
        bulkUpgradeCost,
        bulkMaxed,
        upgradeBulk,
        effectiveEntropyRatePerMin
    };
})();
