import { el, div, span, on } from "./dom.js";
import { Format } from "./format.js";
import { State } from "./state.js";

export const WaveFloor = {
    at(lv) {
        return Math.min(Config.WAVE.floorMax, Config.WAVE.floorStep * lv);
    }
};

export const Config = (() => {
    const SAVE_KEY = "quanta_save_v5";
    const RESONANCE_BASE = 1.25;
    const PHASE_BASE = 1.15;
    const COHERENCE_BASE = 1.8;
    const OFFLINE_CAP = 8 * 3600;

    const UPGRADES = [
        {
            id: "observer",
            name: "Observer Precision",
            flavor: "Sharper measurement collapses the wavefunction into more quanta.",
            cost: lv => 10 * Math.pow(1.55, lv),
            effect: lv => "+" + lv + " base observation yield"
        },
        {
            id: "collector",
            name: "Vacuum Collector",
            flavor: "Drone lattices siphon zero-point fluctuations automatically.",
            cost: lv => 25 * Math.pow(1.62, lv),
            effect: lv => "+" + Format.num(1.0 * lv) + " Q/s"
        },
        {
            id: "resonance",
            name: "Resonance Cascade",
            flavor: "Constructive interference amplifies every measurement channel.",
            cost: lv => 400 * Math.pow(4.2, lv),
            effect: lv =>
                "×" + Format.num(Math.pow(RESONANCE_BASE, lv)) + " to ALL gains"
        },
        {
            id: "buffer",
            name: "Saturation Buffer",
            flavor: "Widens the flux ceiling. Past the cap, output compresses as a power law.",
            cost: lv => 2000 * Math.pow(8, lv),
            effect: lv => "softcap threshold ×" + Format.num(Math.pow(2.5, lv))
        }
    ];

    const MODIFIERS = [
        {
            id: "psi",
            sym: "Ψ",
            name: "Wavefunction Weight",
            weight: 0.1,
            target: "tap",
            flavor: "Adds 10% of base per level to observation yield.",
            cost: lv => 40 * Math.pow(2.35, lv)
        },
        {
            id: "phi",
            sym: "Φ",
            name: "Entanglement Weight",
            weight: 0.12,
            target: "auto",
            flavor: "Adds 12% of base per level to automatic yield.",
            cost: lv => 70 * Math.pow(2.35, lv)
        },
        {
            id: "lam",
            sym: "Λ",
            name: "Cosmological Weight",
            weight: 0.06,
            target: "all",
            flavor: "Adds 6% of base per level to every channel.",
            cost: lv => 300 * Math.pow(3.1, lv)
        }
    ];

    const PHASE_UPGRADES = [
        {
            id: "stab",
            name: "Stabilizer",
            flavor: "Pins the coherence wave upward. Raises the trough of the oscillation.",
            cost: lv => 4 * Math.pow(1.9, lv),
            effect: lv =>
                "wave floor " +
                Format.plain(WaveFloor.at(lv)) +
                " → " +
                Format.plain(WaveFloor.at(lv + 1))
        },
        {
            id: "harm",
            name: "Harmonic Amplifier",
            flavor: "Resonant cavities stack the collapsed amplitude.",
            cost: lv => 12 * Math.pow(2.1, lv),
            effect: lv =>
                "×" +
                Format.num(Math.pow(COHERENCE_BASE, lv)) +
                " coherence per collapse"
        },
        {
            id: "lock",
            name: "Phase Lock",
            flavor: "Locked coherence bleeds back into ordinary quanta production.",
            cost: lv => 30 * Math.pow(2.4, lv),
            effect: lv =>
                "×" +
                Format.num(Math.pow(PHASE_BASE, lv)) +
                " to ALL quanta gains"
        }
    ];

    const SOFTCAP = {
        tap: { base: 250, pow: 0.72 },
        auto: { base: 150, pow: 0.7 }
    };
    const BUFFER_MULT = 2.5;

    const WAVE = {
        speed: 1.55,
        a1: 0.3,
        a2: 0.11,
        a3: 0.06,
        span: 3.2,
        floorStep: 0.08,
        floorMax: 0.8
    };

    const SURGE = {
        costPct: 0.2,
        minCost: 10,
        referenceFactor: 0.02,
        minReference: 10,
        decay: 0.1,
        coefficient: 2.5
    };

    /* NEW — Entropy */
    const ENTROPY = {
        unlockTotal: 20000,
        baseRate: 0.05,
        collapseWeight: 0.05,
        multPerEntropy: 0.003,
        milestones: [
            { at: 100, kind: "rateMult", amount: 2, label: "entropy rate ×2" },
            {
                at: 500,
                kind: "multBonus",
                amount: 1.5,
                label: "entropy effect ×1.5"
            },
            { at: 2000, kind: "rateMult", amount: 2, label: "entropy rate ×2" },
            {
                at: 10000,
                kind: "multBonus",
                amount: 2,
                label: "entropy effect ×2"
            }
        ]
    };

    /* ============================================================
   Feature definitions
   ------------------------------------------------------------
   Each entry is consumed by features.js. Set `enabled: false`
   to disable without editing any other file.

   To add a new feature: append an entry here.
   To remove one:        delete its entry (or set enabled false).
   Runtime on/off:       Features.unregister('id') / register(...)
   ============================================================ */
    const FEATURES = {
        /* --- 1. Tick Rate ----------------------------------------
     Speeds up a discrete "fluctuation clock". Each tick has a
     chance to grant a tapGain-scaled bonus to Quanta.
     Level 0 = off, so adding this feature doesn't change the
     existing game until the player buys it. */
        tickRate: {
            enabled: true,
            id: "tickRate",

            /* tuning — everything below is live-editable */
            baseInterval: 0.1, // seconds per tick at level 1
            intervalPerLevel: 0.92, // multiply the interval per level
            minInterval: 0.015, // hard floor (≈67 ticks/s)
            fluctuationChance: 0.02, // per tick
            fluctuationGainMult: 0.5, // fluctGain = tapGain × mult × (1 + levelBonus × lv)
            levelBonus: 0.03,

            cards: [
                {
                    id: "tickRate",
                    name: "Tick Rate",
                    currency: "quanta",
                    flavor: "Speeds the internal fluctuation clock. Each tick has a chance to grant bonus quanta.",
                    cost: lv => 200 * Math.pow(2.2, lv),
                    effect: lv => {
                        const c = FEATURES.tickRate;
                        const iv = Math.max(
                            c.minInterval,
                            c.baseInterval * Math.pow(c.intervalPerLevel, lv)
                        );
                        const hz = 1 / iv;
                        return `${(iv * 1000).toFixed(0)}ms · ${hz.toFixed(0)} ticks/s`;
                    }
                }
            ],

            hooks: {
                onTick(s, dt, ctx) {
                    const c = FEATURES.tickRate;
                    const lv = s.feat?.tickRate || 0;
                    if (lv === 0) return;

                    const iv = Math.max(
                        c.minInterval,
                        c.baseInterval * Math.pow(c.intervalPerLevel, lv)
                    );
                    s._tickAcc = (s._tickAcc || 0) + dt;

                    /* guard against pathological frame spikes */
                    let guard = 0;
                    while (s._tickAcc >= iv && guard < 2000) {
                        s._tickAcc -= iv;
                        guard++;
                        if (Math.random() < c.fluctuationChance) {
                            const gain =
                                ctx.tapGain *
                                c.fluctuationGainMult *
                                (1 + c.levelBonus * lv);
                            s.quanta += gain;
                            s.total += gain;
                        }
                    }
                }
            },

            formula(s, ctx) {
                const c = FEATURES.tickRate;
                const lv = s.feat?.tickRate || 0;
                if (lv === 0) return null;

                const iv = Math.max(
                    c.minInterval,
                    c.baseInterval * Math.pow(c.intervalPerLevel, lv)
                );
                const hz = 1 / iv;
                const fps = hz * c.fluctuationChance;
                const gain =
                    ctx.tapGain *
                    c.fluctuationGainMult *
                    (1 + c.levelBonus * lv);
                const rate = fps * gain;

                return {
                    text: `TICK ${(iv * 1000).toFixed(0)}ms (${hz.toFixed(0)}/s) · fluct ≈ +${Format.num(rate)}/s`,
                    accent: "quanta"
                };
            }
        },

        /* --- 2. Collapse Echo ------------------------------------
     Each collapse has a chance to fire again for free at the
     same snapshot. Chance caps at 60%, echoes cap at lv/4. */
        collapseEcho: {
            enabled: true,
            id: "collapseEcho",

            chancePerLevel: 0.03,
            maxChance: 0.6,
            echoesPerBonus: 4, // +1 max echo every N levels

            cards: [
                {
                    id: "collapseEcho",
                    name: "Collapse Echo",
                    currency: "coherence", // priced in coherence, not quanta
                    flavor: "Sometimes a collapse ripples back through spacetime.",
                    cost: lv => 5 * Math.pow(2.0, lv),
                    effect: lv => {
                        const c = FEATURES.collapseEcho;
                        const p = Math.min(c.maxChance, lv * c.chancePerLevel);
                        const m = Math.floor(lv / c.echoesPerBonus);
                        return `${(p * 100).toFixed(0)}% · max ${m} echo${m === 1 ? "" : "es"}`;
                    }
                }
            ],

            hooks: {
                onCollapse(s, ctx) {
                    const c = FEATURES.collapseEcho;
                    const lv = s.feat?.collapseEcho || 0;
                    if (lv === 0) return;

                    const chance = Math.min(c.maxChance, lv * c.chancePerLevel);
                    const maxE = Math.floor(lv / c.echoesPerBonus);
                    let bonus = 0;

                    for (let i = 0; i < maxE; i++) {
                        if (Math.random() >= chance) break;
                        bonus += ctx.gain;
                    }
                    if (bonus > 0) {
                        s.coherence += bonus;
                        ctx.floater(`+${Format.num(bonus)} ECHO`, "coh");
                    }
                }
            },

            formula(s) {
                const c = FEATURES.collapseEcho;
                const lv = s.feat?.collapseEcho || 0;
                if (lv === 0) return null;

                const p = Math.min(c.maxChance, lv * c.chancePerLevel);
                const m = Math.floor(lv / c.echoesPerBonus);

                /* EV = 1 + p + p² + ... + p^m (geometric, p < 1) */
                let ev = 1;
                if (m > 0 && p > 0) {
                    ev =
                        p >= 1
                            ? 1 + m
                            : 1 + (p * (1 - Math.pow(p, m))) / (1 - p);
                }

                return {
                    text: `ECHO ${(p * 100).toFixed(0)}% · max ${m} · EV ×${ev.toFixed(2)}`,
                    accent: "coh"
                };
            }
        },
        /* --- 3. Quantum Exchange --------------------------------
   Buy Q-Credits low, sell them high. Prices cycle on
   wall-clock time; entropy amplifies volatility. */
        exchange: {
            enabled: true,
            id: "exchange",

            /* price curve */
            basePrice: 1.0,
            priceAmp1: 0.35,
            priceAmp2: 0.15,
            period1: 0.35, // rad/s
            period2: 0.91, // rad/s
            phase2: 1.7,
            minPrice: 0.15,
            maxPrice: 3.0,

            /* volatility scaled by entropy */
            volatilityPerEntropy: 0.001,
            maxVolatility: 2.5,

            /* unit economics */
            unitCost: 100, // cost of 1 credit at P = 1.0
            spread: 0.05, // sell price = P × unitCost × (1 − spread)

            /* capacity */
            maxCreditsBase: 10,
            maxCreditsPerLevel: 10,

            /* license card */
            levelCost: 2000,
            levelCostMult: 5,

            /* ----- API ----- */

            price(t) {
                const c = FEATURES.exchange;
                const ent = State.get().entropy || 0;
                const vol = Math.min(
                    c.maxVolatility,
                    1 + ent * c.volatilityPerEntropy
                );
                const raw =
                    c.basePrice +
                    (c.priceAmp1 * Math.sin(t * c.period1) +
                        c.priceAmp2 * Math.sin(t * c.period2 + c.phase2)) *
                        vol;
                return Math.max(c.minPrice, Math.min(c.maxPrice, raw));
            },

            capacity() {
                const c = FEATURES.exchange;
                return (
                    c.maxCreditsBase +
                    c.maxCreditsPerLevel * (State.get().feat.exchange || 0)
                );
            },

            ensureMarket() {
                const s = State.get();
                if (!s.market) s.market = { credits: 0, everVisited: false };
                return s.market;
            },

            buy(n) {
                const c = FEATURES.exchange;
                const s = State.get();
                const m = FEATURES.exchange.ensureMarket();

                const space = Math.max(0, c.capacity() - m.credits);
                if (space <= 0) return { amount: 0, cost: 0 };

                const unit = c.price(Date.now() / 1000) * c.unitCost;
                const canAfford = Math.floor(s.quanta / unit);
                const amount = Math.min(n, space, canAfford);
                if (amount <= 0) return { amount: 0, cost: 0 };

                const cost = unit * amount;
                s.quanta -= cost;
                m.credits += amount;
                return { amount, cost };
            },

            sell(n) {
                const c = FEATURES.exchange;
                const s = State.get();
                const m = FEATURES.exchange.ensureMarket();

                const amount = Math.min(n, m.credits);
                if (amount <= 0) return { amount: 0, gain: 0 };

                const unit =
                    c.price(Date.now() / 1000) * c.unitCost * (1 - c.spread);
                const gain = unit * amount;
                s.quanta += gain;
                s.total += gain;
                m.credits -= amount;
                return { amount, gain };
            },

            /* ----- card (shows in Upgrades tab) ----- */
            cards: [
                {
                    id: "exchange",
                    name: "Exchange License",
                    currency: "quanta",
                    flavor: "Raises the maximum Q-Credits you can hold at once.",
                    cost: lv =>
                        FEATURES.exchange.levelCost *
                        Math.pow(FEATURES.exchange.levelCostMult, lv),
                    effect: lv => {
                        const c = FEATURES.exchange;
                        const now =
                            c.maxCreditsBase + c.maxCreditsPerLevel * lv;
                        const nxt =
                            c.maxCreditsBase + c.maxCreditsPerLevel * (lv + 1);
                        return `${now} → ${nxt} credits`;
                    }
                }
            ],

            /* ----- view (auto-tabbed by UI) ----- */
            views: [
                {
                    id: "exchange",
                    icon: "Ⓠ",
                    label: "MARKET",
                    mount({ UI, Save }) {
                        const c = FEATURES.exchange;

                        /* ---- element refs ---- */
                        const elPrice = span(
                            { className: "exchange-price" },
                            "1.00"
                        );
                        const elHeld = span(
                            { className: "exchange-holdings" },
                            "0 / 10"
                        );
                        const elBuy1Cost = span(
                            { className: "amount" },
                            "100 Q"
                        );
                        const elBuyMaxCost = span({ className: "amount" }, "—");
                        const elSell1Cost = span(
                            { className: "amount" },
                            "95 Q"
                        );
                        const elSellAllCost = span(
                            { className: "amount" },
                            "—"
                        );
                        const elCap = el("b", {}, "10");
                        const elVol = el("b", {}, "×1.00");

                        const btnBuy1 = el(
                            "button",
                            { className: "exchange-btn buy" },
                            ["BUY +1", elBuy1Cost]
                        );
                        const btnBuyMax = el(
                            "button",
                            { className: "exchange-btn buy" },
                            ["BUY MAX", elBuyMaxCost]
                        );
                        const btnSell1 = el(
                            "button",
                            { className: "exchange-btn sell" },
                            ["SELL −1", elSell1Cost]
                        );
                        const btnSellAll = el(
                            "button",
                            { className: "exchange-btn sell" },
                            ["SELL ALL", elSellAllCost]
                        );

                        const canvas = el("canvas", { id: "marketCanvas" });
                        const floaters = div({
                            className: "floatHost",
                            id: "marketFloaters"
                        });

                        /* ---- layout ---- */
                        const section = el(
                            "section",
                            {
                                className: "view",
                                dataset: {
                                    view: "exchange",
                                    feature: "exchange"
                                }
                            },
                            [
                                div({ className: "panel exchange-panel" }, [
                                    div(
                                        { className: "panel-title" },
                                        "Quantum Exchange"
                                    ),
                                    div({ className: "exchange-chart-wrap" }, [
                                        canvas,
                                        floaters
                                    ]),
                                    div({ className: "exchange-readout" }, [
                                        elPrice,
                                        elHeld
                                    ]),
                                    div({ className: "exchange-buttons" }, [
                                        div({ className: "exchange-row" }, [
                                            btnBuy1,
                                            btnBuyMax
                                        ]),
                                        div({ className: "exchange-row" }, [
                                            btnSell1,
                                            btnSellAll
                                        ])
                                    ])
                                ]),
                                div({ className: "panel" }, [
                                    div(
                                        { className: "panel-title" },
                                        "Market Telemetry"
                                    ),
                                    div({ className: "stat-row" }, [
                                        span({}, "Max credits"),
                                        elCap
                                    ]),
                                    div({ className: "stat-row" }, [
                                        span({}, "Volatility"),
                                        elVol
                                    ])
                                ]),
                                div(
                                    { className: "hint" },
                                    "Buy credits when the price is low (green). Sell when it's high (gold). " +
                                        "Prices cycle roughly every 18 seconds. Entropy amplifies volatility — " +
                                        "bigger swings, bigger opportunity, bigger risk."
                                )
                            ]
                        );

                        /* ---- canvas ---- */
                        let ctx = null,
                            W = 0,
                            H = 0;
                        function resize() {
                            if (!canvas) return;
                            const rect = canvas.getBoundingClientRect();
                            if (rect.width < 2 || rect.height < 2) {
                                ctx = null;
                                return;
                            }
                            const dpr = Math.min(
                                window.devicePixelRatio || 1,
                                2
                            );
                            canvas.width = Math.round(rect.width * dpr);
                            canvas.height = Math.round(rect.height * dpr);
                            ctx = canvas.getContext("2d");
                            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                            W = rect.width;
                            H = rect.height;
                        }

                        function drawChart() {
                            if (!ctx) {
                                resize();
                                if (!ctx) return;
                            }
                            const now = Date.now() / 1000;
                            const SPAN = 20;
                            const N = 80;
                            const pad = 6;
                            const ih = H - pad * 2;
                            const range = c.maxPrice - c.minPrice;

                            ctx.clearRect(0, 0, W, H);

                            /* baseline at P = 1 */
                            const midY =
                                H - pad - ((1.0 - c.minPrice) / range) * ih;
                            ctx.beginPath();
                            ctx.setLineDash([3, 5]);
                            ctx.moveTo(0, midY);
                            ctx.lineTo(W, midY);
                            ctx.strokeStyle = "rgba(74, 222, 128, 0.22)";
                            ctx.lineWidth = 1;
                            ctx.stroke();
                            ctx.setLineDash([]);

                            const pts = new Array(N + 1);
                            for (let i = 0; i <= N; i++) {
                                const t = now - SPAN + (i / N) * SPAN;
                                const p = c.price(t);
                                pts[i] = [
                                    (i / N) * W,
                                    H - pad - ((p - c.minPrice) / range) * ih
                                ];
                            }

                            /* fill */
                            ctx.beginPath();
                            ctx.moveTo(0, H);
                            for (let i = 0; i <= N; i++)
                                ctx.lineTo(pts[i][0], pts[i][1]);
                            ctx.lineTo(W, H);
                            ctx.closePath();
                            const grad = ctx.createLinearGradient(0, 0, 0, H);
                            grad.addColorStop(0, "rgba(74, 222, 128, 0.30)");
                            grad.addColorStop(1, "rgba(74, 222, 128, 0.02)");
                            ctx.fillStyle = grad;
                            ctx.fill();

                            /* trace */
                            const cur = c.price(now);
                            const isHigh = cur > 1.15;
                            const color = isHigh ? "#ffd166" : "#4ade80";
                            ctx.beginPath();
                            ctx.moveTo(pts[0][0], pts[0][1]);
                            for (let i = 1; i <= N; i++)
                                ctx.lineTo(pts[i][0], pts[i][1]);
                            ctx.strokeStyle = color;
                            ctx.lineWidth = 2;
                            ctx.lineJoin = "round";
                            ctx.shadowColor = color;
                            ctx.shadowBlur = 12;
                            ctx.stroke();
                            ctx.shadowBlur = 0;

                            /* head marker */
                            const cy =
                                H - pad - ((cur - c.minPrice) / range) * ih;
                            ctx.beginPath();
                            ctx.arc(W - 2, cy, 3.5, 0, Math.PI * 2);
                            ctx.fillStyle = color;
                            ctx.shadowColor = color;
                            ctx.shadowBlur = 16;
                            ctx.fill();
                            ctx.shadowBlur = 0;
                        }

                        /* ---- render ---- */
                        function render() {
                            const s = State.get();
                            const m = FEATURES.exchange.ensureMarket();

                            const max = c.capacity();
                            const held = m.credits || 0;
                            const now = Date.now() / 1000;
                            const price = c.price(now);
                            const buyUnit = price * c.unitCost;
                            const sellUnit =
                                price * c.unitCost * (1 - c.spread);

                            const space = Math.max(0, max - held);
                            const canAfford = Math.floor(s.quanta / buyUnit);
                            const buyMaxAmt = Math.min(space, canAfford);
                            const buy1Amt = Math.min(1, buyMaxAmt);

                            elPrice.textContent = "Ⓠ " + Format.plain(price);
                            elHeld.textContent = held + " / " + max;

                            elBuy1Cost.textContent = Format.num(buyUnit) + " Q";
                            elBuyMaxCost.textContent =
                                buyMaxAmt > 0
                                    ? Format.num(buyUnit * buyMaxAmt) + " Q"
                                    : "—";
                            elSell1Cost.textContent =
                                Format.num(sellUnit) + " Q";
                            elSellAllCost.textContent =
                                held > 0
                                    ? Format.num(sellUnit * held) + " Q"
                                    : "—";

                            btnBuy1.classList.toggle("can", buy1Amt >= 1);
                            btnBuy1.classList.toggle("poor", buy1Amt < 1);
                            btnBuyMax.classList.toggle("can", buyMaxAmt >= 1);
                            btnBuyMax.classList.toggle("poor", buyMaxAmt < 1);
                            btnSell1.classList.toggle("can", held >= 1);
                            btnSell1.classList.toggle("poor", held < 1);
                            btnSellAll.classList.toggle("can", held >= 1);
                            btnSellAll.classList.toggle("poor", held < 1);

                            elCap.textContent = String(max);
                            const vol = Math.min(
                                c.maxVolatility,
                                1 + (s.entropy || 0) * c.volatilityPerEntropy
                            );
                            elVol.textContent = "×" + vol.toFixed(2);

                            drawChart();
                        }

                        /* ---- actions ---- */
                        function doBuy(n) {
                            const r = FEATURES.exchange.buy(n);
                            if (r.amount <= 0) return;
                            UI.floater(
                                floaters,
                                "+" + r.amount + " Ⓠ",
                                "market"
                            );
                            if (navigator.vibrate) {
                                try {
                                    navigator.vibrate(8);
                                } catch (e) {}
                            }
                            render();
                            Save.write();
                        }
                        function doSell(n) {
                            const r = FEATURES.exchange.sell(n);
                            if (r.amount <= 0) return;
                            UI.floater(
                                floaters,
                                "+" + Format.num(r.gain) + " Q",
                                "gold"
                            );
                            if (navigator.vibrate) {
                                try {
                                    navigator.vibrate(8);
                                } catch (e) {}
                            }
                            render();
                            Save.write();
                        }

                        on(btnBuy1, "click", () => doBuy(1));
                        on(btnBuyMax, "click", () => doBuy(9999));
                        on(btnSell1, "click", () => doSell(1));
                        on(btnSellAll, "click", () => doSell(9999));

                        return {
                            element: section,
                            render,
                            onShow() {
                                const m = FEATURES.exchange.ensureMarket();
                                m.everVisited = true;
                                document
                                    .getElementById("exchangePill")
                                    ?.classList.add("revealed");
                                requestAnimationFrame(() => {
                                    resize();
                                    drawChart();
                                });
                            },
                            onHide() {}
                        };
                    }
                }
            ]
        }
    };

    return {
        SAVE_KEY,
        RESONANCE_BASE,
        PHASE_BASE,
        COHERENCE_BASE,
        OFFLINE_CAP,
        UPGRADES,
        MODIFIERS,
        PHASE_UPGRADES,
        SOFTCAP,
        BUFFER_MULT,
        WAVE,
        SURGE,
        ENTROPY,
        FEATURES
    };
})();
