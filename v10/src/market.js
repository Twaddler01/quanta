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
        const base = Math.max(0.1, override ?? Config.WAVE_PERIOD_MULT);
        return base * marketSpeedMult(id);
    }
    function noiseMultOf(id) {
        const override = def(id)?.wave?.noiseMult;
        return Math.max(0.1, override ?? Config.WAVE_NOISE_MULT);
    }

    function waveAmpMult() {
        const lv = State.get().marketLeverage || 0;
        return 1 + lv * Config.MARKET_LEVERAGE_PER_LEVEL;
    }

    /* Reaction: damps the fast components (noise + amp3). */
    function signalMult() {
        const lv = State.get().reaction || 0;
        return Math.max(0.3, 1 - lv * Config.REACTION_PER_LEVEL);
    }

    /* Streak: consecutive profitable trades within a time window. */
    function streakBonus(id) {
        const mk = State.get().markets[id];
        const s = mk?.streak || 0;
        return Math.min(Config.STREAK_CAP, s * Config.STREAK_PER);
    }
    function resetStreak(id) {
        const mk = State.get().markets[id];
        if (mk) mk.streak = 0;
    }

    /* ---- prestige ---- */

    function starsOf(id) {
        const mk = State.get().markets[id];
        return mk?.stars || 0;
    }
    function starMult(id) {
        const stars = starsOf(id);
        return 1 + stars * Config.PRESTIGE_STAR_PER;
    }
    function prestigeStarsAt(level) {
        return Config.prestigeStars(level);
    }
    function canPrestige(id) {
        return levelOf(id) >= Config.PRESTIGE_LEVEL_MIN;
    }
    function prestigePreview(id) {
        const level = levelOf(id);
        const stars = starsOf(id);
        const can = canPrestige(id);
        const gainNow = can ? prestigeStarsAt(level) : 0;
        const totalNow = stars + gainNow;
        const multNow = 1 + totalNow * Config.PRESTIGE_STAR_PER;

        const targets = [5, 8, 10, 12, 15, 20, 30, 50];
        const previews = targets
            .filter(t => t > level)
            .slice(0, 2)
            .map(t => {
                const gain = prestigeStarsAt(t);
                const total = stars + gain;
                return {
                    level: t,
                    gain,
                    totalStars: total,
                    mult: 1 + total * Config.PRESTIGE_STAR_PER
                };
            });

        return {
            level,
            stars,
            canPrestige: can,
            starsIfNow: gainNow,
            totalStarsIfNow: totalNow,
            currentMult: 1 + stars * Config.PRESTIGE_STAR_PER,
            newMultIfNow: multNow,
            previews
        };
    }

    function prestige(id) {
        const mk = State.get().markets[id];
        if (!mk) return { ok: false, reason: "no-market" };
        if (!canPrestige(id)) return { ok: false, reason: "too-low" };
        const gained = prestigeStarsAt(mk.level || 0);
        const beforeStars = mk.stars || 0;
        mk.stars = beforeStars + gained;

        mk.q = Config.STARTING_Q_PER_MARKET;
        mk.shares = Config.STARTING_SHARES;
        mk.holding = 0;
        mk.costBasis = 0;
        mk.lifetimeProfit = 0;
        /* lifetimeCashOut preserved — feeds Passive Yield portfolio upgrade */
        mk.cashOutCount = 0;
        mk.level = 0;
        mk.lastLevelUpTime = 0;
        mk.pool = 0;
        mk.recentProfit = 0;
        mk.interestExpiresAt = 0;
        mk.cashOutCooldown = 0;
        mk.resetCooldown = 0;
        mk.speedLevel = 0;
        mk.streak = 0;
        mk.lastStreakAt = 0;
        mk.lastBuyPrice = 0;
        mk.lastBuyTime = 0;
        mk.lastSellProfit = 0;
        mk.lastSellTotal = 0;
        mk.lastSellTime = 0;
        mk.lastCashOut = 0;

        return {
            ok: true,
            gained,
            totalStars: mk.stars,
            mult: starMult(id)
        };
    }

    function streakTimeLeftMs(id) {
        const mk = State.get().markets[id];
        if (!mk || !(mk.streak > 0) || !mk.lastStreakAt) return 0;
        const elapsed = Date.now() - mk.lastStreakAt;
        return Math.max(0, Config.STREAK_WINDOW_MS - elapsed);
    }

    /* Broker License: reduces the trading fee globally. */
    function brokerFee() {
        const lv = State.get().brokerLicense || 0;
        return Math.max(0, Config.TRADING_FEE - lv * Config.BROKER_PER_LEVEL);
    }

    /* Frequency Coil: scales the wave tempo for one market. */
    function marketSpeedMult(id) {
        const lv = State.get().markets[id]?.speedLevel || 0;
        return 1 + lv * Config.SPEED_PER_LEVEL;
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
        const damp = signalMult();

        const tp = t * periodMultOf(id);
        let weather =
            Math.sin((tp / w.period1) * Math.PI * 2) * w.amp1 * ampBoost +
            Math.sin((tp / w.period2) * Math.PI * 2 + 0.7) * w.amp2 * ampBoost;
        if (w.amp3 != null && w.period3) {
            weather +=
                Math.sin((tp / w.period3) * Math.PI * 2 + 2.1) *
                w.amp3 *
                ampBoost *
                damp;
        }

        const tn = t * noiseMultOf(id);
        const nAmp = w.noiseAmp * damp;
        const noise =
            Math.sin(tn * 3.7 + phase) * nAmp * 0.6 +
            Math.sin(tn * 8.3 + phase * 1.7) * nAmp * 0.4;

        return Math.max(base * 0.1, base * (1 + weather + noise));
    }

    const buyPrice = (id, t) => naturalPrice(id, t) * (1 + brokerFee());
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
        return Math.max(0.5, 1 - lv * Config.POOL_BUFFER_PER_LEVEL);
    }

    /* ---- pool ---- */

    function poolMax(id) {
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
        const tLeft =
            (mk.interestExpiresAt - now) / 1000 / Config.INTEREST_WINDOW_SEC;
        if (tLeft <= 0) return 0;
        return (
            mk.recentProfit *
            Config.INTEREST_COEF *
            interestBoostMult() *
            Math.sqrt(tLeft)
        );
    }

    /* ---- unlock ---- */

    function isUnlocked(id) {
        return State.get().total >= def(id).unlockAt;
    }

    /* ---- level system ---- */

    function levelOf(id) {
        const mk = State.get().markets[id];
        return mk.level || 0;
    }

    function levelProgress(id) {
        const mk = State.get().markets[id];
        const level = mk.level || 0;
        const cashes = mk.cashOutCount || 0;
        const atCurrent = Config.levelThreshold(level);
        const atNext = Config.levelThreshold(level + 1);
        const stepSize = atNext - atCurrent;
        const within = cashes - atCurrent;

        const sm = starMult(id);
        return {
            level,
            cashOuts: cashes,
            atCurrent,
            atNext,
            stepSize,
            within,
            pct: stepSize > 0 ? Math.min(100, (within / stepSize) * 100) : 0,
            nextBonus: Config.bonusAtLevel(level + 1) * sm,
            currentPassive: levelPassiveRate(id),
            nextPassive: levelPassiveRate(id) + Config.bonusAtLevel(level + 1) * sm
        };
    }

    function levelPassiveRate(id) {
        return Config.totalLevelBonus(levelOf(id)) * starMult(id);
    }

    function levelPassiveTotal() {
        let sum = 0;
        for (const m of Config.liveMarkets()) sum += levelPassiveRate(m.id);
        return sum;
    }

    function totalLevels() {
        let n = 0;
        for (const m of Config.liveMarkets()) n += levelOf(m.id);
        return n;
    }

    function passiveYieldRate() {
        const lv = State.get().passiveYield || 0;
        if (lv === 0) return 0;
        let totalLifetime = 0;
        for (const m of Config.liveMarkets())
            totalLifetime += State.get().markets[m.id].lifetimeCashOut;
        return (
            (totalLifetime / Config.PASSIVE_YIELD_LIFETIME_DIV) *
            Config.PASSIVE_YIELD_PER_LEVEL *
            lv
        );
    }

    /* ---- shares ---- */

    function shareUpgradeCost(id) {
        return (
            Config.SHARE_UPGRADE_BASE *
            Math.pow(Config.SHARE_UPGRADE_MULT, State.get().markets[id].shares)
        );
    }
    function shareUpgradeRequirement(id) {
        return shareUpgradeCost(id) + Config.STARTING_Q_PER_MARKET;
    }
    function upgradeShares(id) {
        const s = State.get();
        const mk = s.markets[id];
        const cost = shareUpgradeCost(id);
        if (mk.q < cost + Config.STARTING_Q_PER_MARKET) return false;
        mk.q -= cost;
        mk.shares += 1;
        return true;
    }

    /* ---- frequency coil ---- */

    function speedUpgradeCost(id) {
        const lv = State.get().markets[id]?.speedLevel || 0;
        return (
            Config.SPEED_UPGRADE_BASE * Math.pow(Config.SPEED_UPGRADE_MULT, lv)
        );
    }
    function canUpgradeSpeed(id) {
        const s = State.get();
        const mk = s.markets[id];
        if (!mk) return false;
        if ((mk.speedLevel || 0) >= Config.SPEED_MAX_LEVEL) return false;
        return s.Q >= speedUpgradeCost(id);
    }
    function upgradeSpeed(id) {
        const s = State.get();
        const mk = s.markets[id];
        if (!mk) return false;
        if ((mk.speedLevel || 0) >= Config.SPEED_MAX_LEVEL) return false;
        const cost = speedUpgradeCost(id);
        if (s.Q < cost) return false;
        s.Q -= cost;
        mk.speedLevel = (mk.speedLevel || 0) + 1;
        return true;
    }

    /* ---- trading ---- */

    function buyUnits(id, n, t, priceOverride = null) {
        const s = State.get();
        const mk = s.markets[id];
        n = Math.min(n, mk.shares - mk.holding);
        if (n <= 0) return { bought: 0, cost: 0 };
        const price = priceOverride ?? buyPrice(id, t);
        n = Math.min(n, Math.floor(mk.q / price));
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
            mk.pool = Math.min(
                poolMax(id),
                mk.pool + profit * Config.POOL_ROUTE
            );
            mk.recentProfit = profit;
            mk.interestExpiresAt =
                Date.now() + Config.INTEREST_WINDOW_SEC * 1000;

            /* streak update */
            const nowMs = Date.now();
            const withinWindow =
                (mk.streak || 0) > 0 &&
                nowMs - (mk.lastStreakAt || 0) < Config.STREAK_WINDOW_MS;
            mk.streak = withinWindow ? (mk.streak || 0) + 1 : 1;
            mk.lastStreakAt = nowMs;
        } else if (profit < 0) {
            mk.streak = 0;
        }
        mk.lastSellProfit = profit;
        mk.lastSellTotal = gain;
        mk.lastSellTime = Date.now();
        return { sold: n, gain, profit, price };
    }

    /* ---- cash out ---- */

    function cashOutValue(id) {
        const mk = State.get().markets[id];
        return (
            mk.pool *
            portfolioBoostMult() *
            (1 + streakBonus(id)) *
            starMult(id)
        );
    }

    function canCashOut(id) {
        const mk = State.get().markets[id];
        if (mk.cashOutCooldown > 0) {
            const cap = poolMax(id);
            return {
                ok: false,
                reason: "cooldown",
                left: mk.cashOutCooldown,
                pct: cap > 0 ? (mk.pool / cap) * 100 : 0
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

    function cashOut(id) {
        const check = canCashOut(id);
        if (!check.ok) return { ok: false, reason: check.reason };
        const s = State.get();
        const mk = s.markets[id];
        const value = cashOutValue(id);
        const tip = value * Config.LEVEL_TIP_PCT;
        const qBefore = s.Q;

        s.Q += value + tip;
        s.total += value + tip;
        mk.lastCashOut = Date.now();
        mk.cashOutCooldown = Config.CASHOUT_COOLDOWN;
        mk.lifetimeCashOut += value;
        mk.cashOutCount += 1;
        mk.pool = 0;
        mk.recentProfit = 0;
        mk.interestExpiresAt = 0;

        if (!Config.isDebugMarket(id) && value > (s.bestCashOut || 0)) {
            s.bestCashOut = value;
        }

        /* Level-up check */
        const prevLevel = mk.level || 0;
        const newLevel = Config.computeLevel(mk.cashOutCount);
        let levelUp = false;
        let bonusGained = 0;
        if (newLevel > prevLevel) {
            mk.level = newLevel;
            mk.lastLevelUpTime = Date.now();
            levelUp = true;
            for (let n = prevLevel + 1; n <= newLevel; n++) {
                bonusGained += Config.bonusAtLevel(n);
            }
        }

        if (qBefore > 1) {
            s.lastGrowthPct = ((value + tip) / qBefore) * 100;
        }
        return {
            ok: true,
            value,
            tip,
            cashOutCount: mk.cashOutCount,
            levelUp,
            newLevel: mk.level || 0,
            bonusGained
        };
    }

    /* ---- reset ---- */

    function resetAmount() {
        return Config.STARTING_Q_PER_MARKET;
    }

    function canReset(id) {
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
        if (s.poolBuffer >= Config.POOL_BUFFER_MAX_LEVEL) return false;
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

    function reactionCost() {
        const lv = State.get().reaction || 0;
        return Config.REACTION_BASE * Math.pow(Config.REACTION_MULT, lv);
    }
    function upgradeReaction() {
        const s = State.get();
        if (s.reaction >= Config.REACTION_MAX_LEVEL) return false;
        const cost = reactionCost();
        if (s.Q < cost) return false;
        s.Q -= cost;
        s.reaction += 1;
        return true;
    }

    /* ---- broker license ---- */

    function brokerCost() {
        const lv = State.get().brokerLicense || 0;
        return Config.BROKER_BASE * Math.pow(Config.BROKER_MULT, lv);
    }
    function canUpgradeBroker() {
        const s = State.get();
        if ((s.brokerLicense || 0) >= Config.BROKER_MAX_LEVEL) return false;
        return s.Q >= brokerCost();
    }
    function upgradeBroker() {
        const s = State.get();
        if ((s.brokerLicense || 0) >= Config.BROKER_MAX_LEVEL) return false;
        const cost = brokerCost();
        if (s.Q < cost) return false;
        s.Q -= cost;
        s.brokerLicense = (s.brokerLicense || 0) + 1;
        return true;
    }

    /* ---- aggregates ---- */
    function totalLifetimeCashOut() {
        let sum = 0;
        for (const m of Config.liveMarkets())
            sum += State.get().markets[m.id].lifetimeCashOut;
        return sum;
    }
    function totalLifetimeProfit() {
        let sum = 0;
        for (const m of Config.liveMarkets())
            sum += State.get().markets[m.id].lifetimeProfit;
        return sum;
    }
    function totalCashOuts() {
        let sum = 0;
        for (const m of Config.liveMarkets())
            sum += State.get().markets[m.id].cashOutCount;
        return sum;
    }

    /* ---- tick ---- */

    function tick(dt, nowOverride = null) {
        const s = State.get();
        const now = nowOverride ?? Date.now();

        const passiveIn = levelPassiveTotal() + passiveYieldRate();
        if (passiveIn > 0) {
            s.Q += passiveIn * dt;
            s.total += passiveIn * dt;
        }

        for (const m of Config.MARKETS) {
            const mk = s.markets[m.id];
            if (mk.cashOutCooldown > 0)
                mk.cashOutCooldown = Math.max(0, mk.cashOutCooldown - dt);
            if (mk.resetCooldown > 0)
                mk.resetCooldown = Math.max(0, mk.resetCooldown - dt);
            if (
                (mk.streak || 0) > 0 &&
                now - (mk.lastStreakAt || 0) > Config.STREAK_WINDOW_MS
            ) {
                mk.streak = 0;
            }
            if (mk.interestExpiresAt > now && mk.recentProfit > 0) {
                const tLeft =
                    (mk.interestExpiresAt - now) /
                    1000 /
                    Config.INTEREST_WINDOW_SEC;
                if (tLeft > 0) {
                    const rate =
                        mk.recentProfit *
                        Config.INTEREST_COEF *
                        interestBoostMult() *
                        Math.sqrt(tLeft);
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
        buyPrice,
        sellPrice,
        periodMultOf,
        noiseMultOf,
        waveAmpMult,
        signalMult,
        marketSpeedMult,
        brokerFee,
        streakBonus,
        resetStreak,
        streakTimeLeftMs,
        /* prestige */
        starsOf,
        starMult,
        prestigeStarsAt,
        canPrestige,
        prestigePreview,
        prestige,
        isUnlocked,

        marketMultiplier,
        shareMult,
        portfolioBoostMult,
        interestBoostMult,
        poolBufferMult,
        poolMax,
        currentInterestRate,
        /* level */
        levelOf,
        levelProgress,
        levelPassiveRate,
        levelPassiveTotal,
        totalLevels,
        passiveYieldRate,
        /* shares */
        shareUpgradeCost,
        shareUpgradeRequirement,
        upgradeShares,
        /* speed */
        speedUpgradeCost,
        canUpgradeSpeed,
        upgradeSpeed,
        /* trading */
        buyUnits,
        sellUnits,
        /* cash out */
        cashOutValue,
        canCashOut,
        cashOut,
        /* reset */
        resetAmount,
        canReset,
        resetMarket,
        /* upgrades */
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
        reactionCost,
        upgradeReaction,
        brokerCost,
        canUpgradeBroker,
        upgradeBroker,
        /* aggregates */
        totalLifetimeCashOut,
        totalLifetimeProfit,
        totalCashOuts,
        tick
    };
})();
