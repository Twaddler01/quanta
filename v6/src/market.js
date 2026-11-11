import { Config, State } from "./config.js";

const DEFAULT_WAVE = {
    amp1: 0.3,
    period1: 75,
    amp2: 0.12,
    period2: 23,
    noiseAmp: 0.05
};

export const Market = (() => {
    const def = id => Config.MARKETS.find(m => m.id === id);
    const waveOf = id => def(id)?.wave || DEFAULT_WAVE;

    function periodMultOf(id) {
        const override = def(id)?.wave?.periodMult;
        return Math.max(0.1, override ?? Config.WAVE_PERIOD_MULT);
    }
    function noiseMultOf(id) {
        const override = def(id)?.wave?.noiseMult;
        return Math.max(0.1, override ?? Config.WAVE_NOISE_MULT);
    }

    /* NEW: leverage amplifies wave amplitude for all markets */
    function waveAmpMult() {
        const lv = State.get().marketLeverage || 0;
        return 1 + lv * Config.MARKET_LEVERAGE_PER_LEVEL;
    }

    function basePrice() {
        return Config.BASE_PRICE;
    }

    function marketBasePrice(id) {
        return basePrice() * def(id).priceMult;
    }

    function naturalPrice(id, t) {
        const w = waveOf(id);
        const base = marketBasePrice(id);
        const phase = State.get().noisePhase;
        const ampBoost = waveAmpMult();

        const tp = t * periodMultOf(id);
        const weather =
            Math.sin((tp / w.period1) * Math.PI * 2) * w.amp1 * ampBoost +
            Math.sin((tp / w.period2) * Math.PI * 2 + 0.7) * w.amp2 * ampBoost;

        const tn = t * noiseMultOf(id);
        const noise =
            Math.sin(tn * 3.7 + phase) * w.noiseAmp * 0.6 +
            Math.sin(tn * 8.3 + phase * 1.7) * w.noiseAmp * 0.4;

        return Math.max(base * 0.1, base * (1 + weather + noise));
    }

    function movingAverage(id, t) {
        const N = 60,
            SPAN = 300;
        const w = waveOf(id);
        const base = marketBasePrice(id);
        const phase = State.get().noisePhase;
        const pm = periodMultOf(id);
        const nm = noiseMultOf(id);
        const ampBoost = waveAmpMult();
        let sum = 0;
        for (let i = 0; i < N; i++) {
            const tt = t - SPAN + (i / N) * SPAN;
            const tp = tt * pm;
            const weather =
                Math.sin((tp / w.period1) * Math.PI * 2) * w.amp1 * ampBoost +
                Math.sin((tp / w.period2) * Math.PI * 2 + 0.7) *
                    w.amp2 *
                    ampBoost;
            const tn = tt * nm;
            const noise =
                Math.sin(tn * 3.7 + phase) * w.noiseAmp * 0.6 +
                Math.sin(tn * 8.3 + phase * 1.7) * w.noiseAmp * 0.4;
            sum += base * (1 + weather + noise);
        }
        return sum / N;
    }

    const buyPrice = (id, t) => naturalPrice(id, t) * (1 + Config.TRADING_FEE);
    const sellPrice = id => t => naturalPrice(id, t);

    /* ---- multipliers ---- */

    function marketMultiplier(id) {
        const m = def(id);
        const mk = State.get().markets[id];
        return 1 + Math.sqrt(Math.max(0, mk.lifetimeProfit) / m.threshold);
    }

    function shareMult(id) {
        const mk = State.get().markets[id];
        return 1 + mk.shares * Config.SHARE_POOL_BONUS;
    }

    function portfolioBoostMult() {
        const lv = State.get().portfolioBoost || 0;
        return 1 + lv * Config.PORTFOLIO_BOOST_PER_LEVEL;
    }

    function interestBoostMult() {
        const lv = State.get().interestBooster || 0;
        return 1 + lv * Config.INTEREST_BOOSTER_PER_LEVEL;
    }

    function poolBufferMult() {
        const lv = State.get().poolBuffer || 0;
        return 1 + lv * Config.POOL_BUFFER_PER_LEVEL;
    }

    /* ---- pool mechanics ---- */

    function poolMax(id) {
        if (isIPO(id)) return 0;
        const m = def(id);
        return (
            Config.POOL_MAX_BASE *
            marketMultiplier(id) *
            shareMult(id) *
            m.tierWeight *
            poolBufferMult()
        );
    }

    function currentInterestRate(id) {
        const mk = State.get().markets[id];
        const now = Date.now();
        if (mk.interestExpiresAt <= now || mk.recentProfit <= 0) return 0;
        const timeLeftFrac =
            (mk.interestExpiresAt - now) / 1000 / Config.INTEREST_WINDOW_SEC;
        if (timeLeftFrac <= 0) return 0;
        return (
            mk.recentProfit *
            Config.INTEREST_COEF *
            interestBoostMult() *
            Math.sqrt(timeLeftFrac)
        );
    }

    function totalInterestRate() {
        let sum = 0;
        for (const m of Config.MARKETS) sum += currentInterestRate(m.id);
        return sum;
    }

    /* ---- unlocks / IPO ---- */

    function isUnlocked(id) {
        return State.get().total >= def(id).unlockAt;
    }

    function isIPO(id) {
        return !!State.get().ipoed[id];
    }

    function isTradable(id) {
        return isUnlocked(id) && !isIPO(id);
    }

    function canIPO(id) {
        const s = State.get();
        const mk = s.markets[id];
        if (isIPO(id)) return { ok: false, reason: "already-ipoed" };
        if (!isUnlocked(id)) return { ok: false, reason: "locked" };
        if (mk.holding > 0) return { ok: false, reason: "has-holding" };
        if (mk.lifetimeCashOut < Config.IPO_MIN_LIFETIME) {
            return {
                ok: false,
                reason: "low-lifetime",
                current: mk.lifetimeCashOut,
                required: Config.IPO_MIN_LIFETIME
            };
        }
        return { ok: true };
    }

    function ipoPassiveRate(id) {
        const m = def(id);
        const mk = State.get().markets[id];
        if (!mk.lifetimeCashOut || mk.lifetimeCashOut < Config.IPO_MIN_LIFETIME)
            return 0;
        return (
            m.tierWeight *
            Config.IPO_PASSIVE_PER_TIER *
            Math.sqrt(mk.lifetimeCashOut / Config.IPO_MIN_LIFETIME)
        );
    }

    function ipoLumpSum(id) {
        const mk = State.get().markets[id];
        return mk.lifetimeCashOut * Config.IPO_LUMP_MULT;
    }

    function ipoMarket(id) {
        const check = canIPO(id);
        if (!check.ok) return { ok: false, reason: check.reason };
        const s = State.get();
        const lump = ipoLumpSum(id);
        const passive = ipoPassiveRate(id);
        s.ipoed[id] = true;
        s.Q += lump;
        s.total += lump;
        return { ok: true, lump, passive };
    }

    function ipoPassiveTotal() {
        let sum = 0;
        for (const m of Config.MARKETS) {
            if (isIPO(m.id)) sum += ipoPassiveRate(m.id);
        }
        return sum;
    }

    function passiveYieldRate() {
        const lv = State.get().passiveYield || 0;
        if (lv === 0) return 0;
        let totalLifetime = 0;
        for (const m of Config.MARKETS)
            totalLifetime += State.get().markets[m.id].lifetimeCashOut;
        return (
            (totalLifetime / Config.PASSIVE_YIELD_LIFETIME_DIV) *
            Config.PASSIVE_YIELD_PER_LEVEL *
            lv
        );
    }

    /* ---- shares ---- */

    function shareUpgradeCost(id) {
        const shares = State.get().markets[id].shares;
        return (
            Config.SHARE_UPGRADE_BASE *
            Math.pow(Config.SHARE_UPGRADE_MULT, shares)
        );
    }

    function shareUpgradeRequirement(id) {
        return shareUpgradeCost(id) + Config.STARTING_Q_PER_MARKET;
    }

    function upgradeShares(id) {
        if (isIPO(id)) return false;
        const s = State.get();
        const mk = s.markets[id];
        const cost = shareUpgradeCost(id);
        const required = cost + Config.STARTING_Q_PER_MARKET;
        if (mk.q < required) return false;
        mk.q -= cost;
        mk.shares += 1;
        return true;
    }

    /* ---- trading ---- */

    function buyUnits(id, n, t, priceOverride = null) {
        if (isIPO(id)) return { bought: 0, cost: 0, reason: "ipoed" };
        const s = State.get();
        const mk = s.markets[id];
        n = Math.min(n, mk.shares - mk.holding);
        if (n <= 0) return { bought: 0, cost: 0 };
        const price = priceOverride ?? buyPrice(id, t);
        const maxAfford = Math.floor(mk.q / price);
        n = Math.min(n, maxAfford);
        if (n <= 0) return { bought: 0, cost: 0 };
        const cost = n * price;
        mk.q -= cost;
        mk.holding += n;
        mk.costBasis += cost;
        mk.lastBuyPrice = price;
        mk.lastBuyTime = Date.now();
        return { bought: n, cost, price };
    }

    function sellUnits(id, n, t, priceOverride = null) {
        if (isIPO(id)) return { sold: 0, gain: 0, profit: 0, reason: "ipoed" };
        const s = State.get();
        const mk = s.markets[id];
        n = Math.min(n, mk.holding);
        if (n <= 0) return { sold: 0, gain: 0, profit: 0 };
        const price = priceOverride ?? sellPrice(id)(t);
        const gain = n * price;
        const avgCost = mk.holding > 0 ? mk.costBasis / mk.holding : 0;
        const profit = n * (price - avgCost);
        mk.q += gain;
        mk.holding -= n;
        mk.costBasis -= avgCost * n;
        if (mk.holding === 0) mk.costBasis = 0;
        if (profit > 0) {
            mk.lifetimeProfit += profit;
            const route = profit * Config.POOL_ROUTE;
            mk.pool = Math.min(poolMax(id), mk.pool + route);
            mk.recentProfit = profit;
            mk.interestExpiresAt =
                Date.now() + Config.INTEREST_WINDOW_SEC * 1000;
        }
        mk.lastSellProfit = profit;
        mk.lastSellTotal = gain;
        mk.lastSellTime = Date.now();
        return { sold: n, gain, profit, price };
    }

    /* ---- cash out ---- */

    function cashOutValue(id) {
        const mk = State.get().markets[id];
        return mk.pool * portfolioBoostMult() * (1 + mk.milestoneBonus);
    }

    function canCashOut(id) {
        if (isIPO(id)) return { ok: false, reason: "ipoed" };
        const mk = State.get().markets[id];
        if (mk.cashOutCooldown > 0) {
            const cap0 = poolMax(id);
            return {
                ok: false,
                reason: "cooldown",
                left: mk.cashOutCooldown,
                pct: cap0 > 0 ? (mk.pool / cap0) * 100 : 0
            };
        }
        const cap = poolMax(id);
        const threshold = cap * Config.CASHOUT_FULL_THRESHOLD;
        if (mk.pool < threshold) {
            return {
                ok: false,
                reason: "not-full",
                current: mk.pool,
                required: threshold,
                cap,
                pct: cap > 0 ? (mk.pool / cap) * 100 : 0
            };
        }
        return { ok: true, pct: cap > 0 ? (mk.pool / cap) * 100 : 100 };
    }

    function nextMilestoneProgress(id) {
        const mk = State.get().markets[id];
        const inCycle = mk.cashOutCount % Config.MILESTONE_EVERY;
        return {
            current: inCycle,
            required: Config.MILESTONE_EVERY,
            toNext: Config.MILESTONE_EVERY - inCycle
        };
    }

    function cashOut(id) {
        const check = canCashOut(id);
        if (!check.ok) return { ok: false, reason: check.reason };
        const s = State.get();
        const mk = s.markets[id];
        const value = cashOutValue(id);
        const qBefore = s.Q;
        s.Q += value;
        s.total += value;
        mk.lastCashOut = Date.now();
        mk.cashOutCooldown = Config.CASHOUT_COOLDOWN;
        mk.lifetimeCashOut += value;
        mk.cashOutCount += 1;
        mk.pool = 0;
        mk.recentProfit = 0;
        mk.interestExpiresAt = 0;
        if (value > (s.bestCashOut || 0)) s.bestCashOut = value;

        let milestoneBonusQ = 0;
        let milestoneHit = false;
        if (mk.cashOutCount % Config.MILESTONE_EVERY === 0) {
            milestoneBonusQ = value * Config.MILESTONE_BONUS_MULT;
            s.Q += milestoneBonusQ;
            s.total += milestoneBonusQ;
            mk.milestoneBonus = Math.min(
                Config.MILESTONE_PERM_CAP,
                mk.milestoneBonus + Config.MILESTONE_PERM_BONUS
            );
            milestoneHit = true;
        }
        if (qBefore > 1) {
            s.lastGrowthPct = ((value + milestoneBonusQ) / qBefore) * 100;
        }
        return {
            ok: true,
            value,
            milestoneHit,
            milestoneBonusQ,
            newMilestoneBonus: mk.milestoneBonus,
            cashOutCount: mk.cashOutCount
        };
    }

    /* ---- market reset ---- */

    function resetAmount() {
        return Config.STARTING_Q_PER_MARKET;
    }

    function canReset(id) {
        if (isIPO(id)) return { ok: false, reason: "ipoed" };
        const mk = State.get().markets[id];
        if (mk.resetCooldown > 0)
            return { ok: false, reason: "cooldown", left: mk.resetCooldown };
        if (mk.holding > 0) return { ok: false, reason: "has-holding" };
        if (mk.q >= Config.RESET_THRESHOLD_Q)
            return { ok: false, reason: "has-q" };
        return { ok: true };
    }

    function resetMarket(id) {
        const check = canReset(id);
        if (!check.ok) return { ok: false, reason: check.reason };
        const mk = State.get().markets[id];
        const amount = resetAmount();
        mk.q = amount;
        mk.shares = Math.max(1, mk.shares);
        mk.resetCooldown = Config.RESET_COOLDOWN;
        return { ok: true, amount };
    }

    /* ---- portfolio upgrades ---- */

    function portfolioBoostCost() {
        const lv = State.get().portfolioBoost || 0;
        return (
            Config.PORTFOLIO_BOOST_BASE *
            Math.pow(Config.PORTFOLIO_BOOST_MULT, lv)
        );
    }
    function upgradePortfolio() {
        const s = State.get();
        const cost = portfolioBoostCost();
        if (s.Q < cost) return false;
        s.Q -= cost;
        s.portfolioBoost += 1;
        return true;
    }

    function interestBoosterCost() {
        const lv = State.get().interestBooster || 0;
        return (
            Config.INTEREST_BOOSTER_BASE *
            Math.pow(Config.INTEREST_BOOSTER_MULT, lv)
        );
    }
    function upgradeInterestBooster() {
        const s = State.get();
        const cost = interestBoosterCost();
        if (s.Q < cost) return false;
        s.Q -= cost;
        s.interestBooster += 1;
        return true;
    }

    function marketLeverageCost() {
        const lv = State.get().marketLeverage || 0;
        return (
            Config.MARKET_LEVERAGE_BASE *
            Math.pow(Config.MARKET_LEVERAGE_MULT, lv)
        );
    }
    function upgradeMarketLeverage() {
        const s = State.get();
        if (s.marketLeverage >= Config.MARKET_LEVERAGE_MAX_LEVEL) return false;
        const cost = marketLeverageCost();
        if (s.Q < cost) return false;
        s.Q -= cost;
        s.marketLeverage += 1;
        return true;
    }

    function poolBufferCost() {
        const lv = State.get().poolBuffer || 0;
        return Config.POOL_BUFFER_BASE * Math.pow(Config.POOL_BUFFER_MULT, lv);
    }
    function upgradePoolBuffer() {
        const s = State.get();
        const cost = poolBufferCost();
        if (s.Q < cost) return false;
        s.Q -= cost;
        s.poolBuffer += 1;
        return true;
    }

    function passiveYieldCost() {
        const lv = State.get().passiveYield || 0;
        return (
            Config.PASSIVE_YIELD_BASE * Math.pow(Config.PASSIVE_YIELD_MULT, lv)
        );
    }
    function upgradePassiveYield() {
        const s = State.get();
        const cost = passiveYieldCost();
        if (s.Q < cost) return false;
        s.Q -= cost;
        s.passiveYield += 1;
        return true;
    }

    function totalShares() {
        let sum = 0;
        for (const m of Config.MARKETS) sum += State.get().markets[m.id].shares;
        return sum;
    }

    /* ---- profile helpers ---- */

    function totalLifetimeCashOut() {
        let sum = 0;
        for (const m of Config.MARKETS)
            sum += State.get().markets[m.id].lifetimeCashOut;
        return sum;
    }
    function totalLifetimeProfit() {
        let sum = 0;
        for (const m of Config.MARKETS)
            sum += State.get().markets[m.id].lifetimeProfit;
        return sum;
    }
    function totalCashOuts() {
        let sum = 0;
        for (const m of Config.MARKETS)
            sum += State.get().markets[m.id].cashOutCount;
        return sum;
    }
    function ipoedCount() {
        let n = 0;
        for (const m of Config.MARKETS) if (isIPO(m.id)) n += 1;
        return n;
    }

    /* ---- tick ---- */

    function tick(dt, nowOverride = null) {
        const s = State.get();
        const now = nowOverride ?? Date.now();

        /* Passive incomes (IPO + passive yield) */
        const passiveIn = ipoPassiveTotal() + passiveYieldRate();
        if (passiveIn > 0) {
            s.Q += passiveIn * dt;
            s.total += passiveIn * dt;
        }

        for (const m of Config.MARKETS) {
            if (isIPO(m.id)) continue;
            const mk = s.markets[m.id];
            if (mk.cashOutCooldown > 0)
                mk.cashOutCooldown = Math.max(0, mk.cashOutCooldown - dt);
            if (mk.resetCooldown > 0)
                mk.resetCooldown = Math.max(0, mk.resetCooldown - dt);
            if (mk.interestExpiresAt > now && mk.recentProfit > 0) {
                const timeLeftFrac =
                    (mk.interestExpiresAt - now) /
                    1000 /
                    Config.INTEREST_WINDOW_SEC;
                if (timeLeftFrac > 0) {
                    const rate =
                        mk.recentProfit *
                        Config.INTEREST_COEF *
                        interestBoostMult() *
                        Math.sqrt(timeLeftFrac);
                    const cap = poolMax(m.id);
                    mk.pool = Math.min(cap, mk.pool + rate * dt);
                }
            }
        }
    }

    return {
        def,
        basePrice,
        marketBasePrice,
        naturalPrice,
        movingAverage,
        periodMultOf,
        noiseMultOf,
        waveAmpMult,
        buyPrice,
        sellPrice,
        marketMultiplier,
        shareMult,
        portfolioBoostMult,
        interestBoostMult,
        poolBufferMult,
        poolMax,
        currentInterestRate,
        totalInterestRate,
        isUnlocked,
        isIPO,
        isTradable,
        canIPO,
        ipoPassiveRate,
        ipoLumpSum,
        ipoMarket,
        ipoPassiveTotal,
        passiveYieldRate,
        shareUpgradeCost,
        shareUpgradeRequirement,
        upgradeShares,
        buyUnits,
        sellUnits,
        cashOutValue,
        canCashOut,
        nextMilestoneProgress,
        cashOut,
        resetAmount,
        canReset,
        resetMarket,
        portfolioBoostCost,
        upgradePortfolio,
        interestBoosterCost,
        upgradeInterestBooster,
        marketLeverageCost,
        upgradeMarketLeverage,
        poolBufferCost,
        upgradePoolBuffer,
        passiveYieldCost,
        upgradePassiveYield,
        totalShares,
        totalLifetimeCashOut,
        totalLifetimeProfit,
        totalCashOuts,
        ipoedCount,
        tick
    };
})();
