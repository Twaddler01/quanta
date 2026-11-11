const QUANTA = window.QUANTA;
const devTools = window.devTools;

if (!QUANTA) {
    console.warn("[debug] QUANTA missing — skipping debug setup");
} else if (!QUANTA.Config.DEBUG_MODE) {
    console.log("[debug] DEBUG_MODE off — debug market not present");
} else {
    const { Config, State, Market, UI, Save, Format } = QUANTA;
    const DEBUG_ID = "debug";
    const DEFAULT_TARGET = "calm";

    /* ------------------------------------------------------------
       Helpers
       ------------------------------------------------------------ */

    function debugMkt() {
        return Config.MARKETS.find(m => m.id === DEBUG_ID);
    }

    function resetDebugState() {
        const s = State.get();
        const mk = s.markets[DEBUG_ID];
        mk.q = Config.STARTING_Q_PER_MARKET;
        mk.shares = Config.STARTING_SHARES;
        mk.holding = 0;
        mk.costBasis = 0;
        mk.lifetimeProfit = 0;
        mk.lifetimeCashOut = 0;
        mk.cashOutCount = 0;
        mk.milestoneBonus = 0;
        mk.pool = 0;
        mk.recentProfit = 0;
        mk.interestExpiresAt = 0;
        mk.cashOutCooldown = 0;
        mk.resetCooldown = 0;
        s.stars[DEBUG_ID] = 0;
        s.ipoed[DEBUG_ID] = false;
        s.activeMarket = DEBUG_ID;
    }

    /* ------------------------------------------------------------
       QUANTA.debug — public API
       ------------------------------------------------------------ */

    QUANTA.debug = {
        DEFAULT_TARGET,

        /* Copy a real market's characteristics into the debug slot. */
        setMarket(targetId) {
            if (!targetId) targetId = DEFAULT_TARGET;
            const dm = debugMkt();
            if (!dm) return "no debug market";

            const target = Config.MARKETS.find(m => m.id === targetId);
            if (!target) return "unknown market: " + targetId;
            if (target.debug) return "cannot mirror the debug market";

            /* Copy behavior fields — mutating Config.MARKETS[debug] directly.
               Every calculation reads these fresh each frame, so changes
               take effect on the next render. */
            dm.wave = JSON.parse(JSON.stringify(target.wave || {}));
            dm.threshold = target.threshold;
            dm.tierWeight = target.tierWeight;
            dm.priceMult = target.priceMult;
            dm.name =
                targetId === DEFAULT_TARGET
                    ? "DEBUG"
                    : "DEBUG · " + target.name;

            resetDebugState();
            UI.render();
            return "mirror=" + targetId + " @ 0 stars";
        },

        /* Set star count. Auto-fills lifetime so the next IPO is ready. */
        setStar(n) {
            n = Math.max(0, Math.min(Config.IPO_MAX_STARS, Math.floor(n)));
            const dm = debugMkt();
            if (!dm) return "no debug market";

            const s = State.get();
            const mk = s.markets[DEBUG_ID];

            s.stars[DEBUG_ID] = n;
            s.ipoed[DEBUG_ID] = false;

            /* Fill lifetime just past the current IPO threshold so the
               re-IPO button is immediately available at every star level. */
            if (n === 0) {
                mk.lifetimeCashOut = 0;
                mk.lifetimeProfit = 0;
            } else if (n < Config.IPO_MAX_STARS) {
                mk.lifetimeCashOut = Config.IPO_MIN_LIFETIME * Math.pow(3, n);
            } else {
                mk.lifetimeCashOut =
                    Config.IPO_MIN_LIFETIME * Math.pow(3, n - 1);
            }

            /* Clear transient state so we don't carry over pool/cooldowns. */
            mk.q = Config.STARTING_Q_PER_MARKET;
            mk.holding = 0;
            mk.costBasis = 0;
            mk.pool = 0;
            mk.recentProfit = 0;
            mk.interestExpiresAt = 0;
            mk.cashOutCooldown = 0;
            mk.resetCooldown = 0;
            s.activeMarket = DEBUG_ID;

            UI.render();
            return (
                "mirror=" + dm.name + " @ " + n + " star" + (n === 1 ? "" : "s")
            );
        },

        /* Convenience: do both. */
        setup(targetId, stars) {
            const a = QUANTA.debug.setMarket(targetId);
            if (a.startsWith("mirror=")) QUANTA.debug.setStar(stars);
            return QUANTA.debug.info();
        },

        /* Set stars AND mark as IPO'd, so you can see the passive rate
           in the UI without clicking through IPO. */
        setStarIPOed(n) {
            QUANTA.debug.setStar(n);
            const s = State.get();
            s.ipoed[DEBUG_ID] = n > 0;
            UI.render();
            return (
                "mirror=" +
                debugMkt().name +
                " @ ⭐" +
                n +
                " (passive +" +
                Format.num(Market.ipoPassiveRate(DEBUG_ID)) +
                " Q/s)"
            );
        },

        /* Manually IPO the debug market through the real path. */
        ipo() {
            const r = Market.ipoMarket(DEBUG_ID);
            if (r.ok) {
                UI.toast(
                    "Debug IPO ⭐" +
                        r.newStars +
                        " · +" +
                        Format.num(r.lump) +
                        " Q · +" +
                        Format.num(r.passive) +
                        " Q/s"
                );
            } else {
                UI.toast("IPO rejected: " + r.reason);
            }
            UI.render();
            return r;
        },

        /* Reopen the debug market. */
        reopen() {
            const r = Market.reopenMarket(DEBUG_ID);
            if (r.ok) UI.toast("Debug reopen · passive paused");
            else UI.toast("Reopen rejected: " + r.reason);
            UI.render();
            return r;
        },

        /* Fill pool to cap. Ensures trading mode first. */
        fillPool() {
            if (Market.isIPO(DEBUG_ID)) Market.reopenMarket(DEBUG_ID);
            const s = State.get();
            s.markets[DEBUG_ID].pool = Market.poolMax(DEBUG_ID);
            s.activeMarket = DEBUG_ID;
            UI.render();
            return "pool filled to " + Format.num(Market.poolMax(DEBUG_ID));
        },

        /* Bump lifetime just to next IPO threshold. */
        fillLifetime() {
            const s = State.get();
            const dm = debugMkt();
            if (!dm) return "no debug market";
            s.markets[DEBUG_ID].lifetimeCashOut =
                Market.nextIpoThreshold(DEBUG_ID);
            UI.render();
            return (
                "lifetime set to " +
                Format.num(s.markets[DEBUG_ID].lifetimeCashOut) +
                " · IPO ready for ⭐" +
                Math.min(Config.IPO_MAX_STARS, Market.starsOf(DEBUG_ID) + 1)
            );
        },

        /* Full reset to default mirror (Calm, 0 stars). */
        reset() {
            QUANTA.debug.setMarket(DEFAULT_TARGET);
            return "debug reset to " + DEFAULT_TARGET + " @ 0 stars";
        },

        /* Navigate to debug market. */
        open() {
            const s = State.get();
            if (!Market.isUnlocked(DEBUG_ID)) {
                /* Debug market has unlockAt:0, so should always be unlocked.
                   Guard in case someone changes that in config. */
                s.total = Math.max(s.total, 1);
            }
            s.activeMarket = DEBUG_ID;
            UI.render();
            return "debug market opened";
        },

        /* What am I looking at? */
        info() {
            const s = State.get();
            const dm = debugMkt();
            if (!dm) return { error: "no debug market" };
            const mk = s.markets[DEBUG_ID];
            const stars = Market.starsOf(DEBUG_ID);
            const diff = Market.waveDiffOf(DEBUG_ID);
            const w = dm.wave || {};

            const basePeriodMult = w.periodMult ?? Config.WAVE_PERIOD_MULT;
            const effPeriod1 = w.period1
                ? w.period1 / (basePeriodMult * diff.periodMult)
                : null;
            const effNoiseAmp =
                w.noiseAmp != null ? w.noiseAmp * diff.noiseMult : null;

            return {
                mirroredFrom: dm.name,
                stars,
                isIPO: Market.isIPO(DEBUG_ID),
                wave: {
                    amp1: w.amp1,
                    period1: w.period1,
                    amp2: w.amp2,
                    period2: w.period2,
                    noiseAmp: w.noiseAmp,
                    periodMult: w.periodMult
                },
                effectiveWave: {
                    period1: effPeriod1,
                    noiseAmp: effNoiseAmp,
                    cycleSeconds: effPeriod1
                },
                waveDiff: diff,
                starCurve: {
                    STAR_NOISE_PER: Config.STAR_NOISE_PER,
                    STAR_PERIOD_PER: Config.STAR_PERIOD_PER
                },
                pool: mk.pool,
                poolMax: Market.poolMax(DEBUG_ID),
                lifetimeCashOut: mk.lifetimeCashOut,
                nextIpoThreshold: Market.nextIpoThreshold(DEBUG_ID),
                passiveRate: Market.ipoPassiveRate(DEBUG_ID),
                canIPO: Market.canIPO(DEBUG_ID).ok,
                canReopen: Market.canReopen(DEBUG_ID).ok
            };
        }
    };

    console.log("[debug] QUANTA.debug ready · debug market id=" + DEBUG_ID);
    console.log('[debug] try: QUANTA.debug.setup("vortex", 3)');

    /* ------------------------------------------------------------
       DevTools integration
       ------------------------------------------------------------ */

    if (devTools?.tests) {
        const D = QUANTA.debug;
        const mkts = Config.liveMarkets().map(m => m.id);

        const mirrorActions = mkts.map(id => ({
            id: "mirror-" + id,
            label: "⟶ Mirror " + id,
            description: "Copy " + id + " wave into debug slot",
            run: () => D.setMarket(id)
        }));

        const starActions = [0, 1, 2, 3, 4, 5].map(n => ({
            id: "star-" + n,
            label:
                "⭐".repeat(n) +
                (n === 0 ? " 0 stars" : " " + n + " stars (trading)"),
            description: "Set debug to " + n + " stars",
            run: () => D.setStar(n)
        }));

        const ipoActions = [1, 3, 5].map(n => ({
            id: "ipo-" + n,
            label: "💰 IPO ⭐" + n + " (passive)",
            description: "Set " + n + " stars AND mark IPO'd",
            run: () => D.setStarIPOed(n)
        }));

        const utilityActions = [
            { id: 'open',     label: '▶ Open debug market',       run: () => D.open() },
            { id: 'reset',    label: '⟲ Reset debug',             run: () => D.reset() },
            { id: 'pool',     label: '💧 Fill pool',              run: () => D.fillPool() },
            { id: 'life',     label: '💧 Fill lifetime',          run: () => D.fillLifetime() },
            { id: 'doIpo',    label: '🚀 IPO now',                run: () => D.ipo() },
            { id: 'reopen',   label: '↩ Reopen',                  run: () => D.reopen() },
            { id: 'rollback', label: '↺ Rollback (cancel reopen)', run: () => D.rollback() },
            { id: 'info',     label: 'ℹ Info',                    run: () => D.info() }
        ];

        devTools.tests.registerSuite({
            id: "QUANTA-debug",
            name: "QUANTA Debug (v7)",
            description: "Debug market — mirror any market at any star level",
            actions: [
                ...utilityActions,
                ...mirrorActions,
                ...starActions,
                ...ipoActions
            ]
        });
        console.log("[debug] DevTools suite registered");
    } else {
        console.log(
            "[debug] DevTools unavailable — use QUANTA.debug.* in console"
        );
    }
}
