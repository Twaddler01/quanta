import { Format, el, div, span } from "./util.js";
import { Config, State } from "./config.js";
import { Market } from "./market.js";

export const UI = (() => {
    const $ = sel => document.querySelector(sel);
    let canvas,
        ctx,
        W = 0,
        H = 0;
    let toastEl, toastTimer;
    const marketChipEls = {};

    function build() {
        toastEl = div({ id: "toast" });
        document.body.appendChild(toastEl);

        const hud = el("header", { id: "hud" }, [
            div({ className: "qlabel-top" }, "PORTFOLIO"),
            div({ className: "qval" }, [
                span({ id: "bigQ" }, "0"),
                span({ className: "qval-unit" }, " Q")
            ]),
            div({ className: "hud-sub" }, [
                pill("GROWTH", "growthPill", "income"),
                pill("PASSIVE", "passivePill", "good"),
                pill("MARKETS", "marketsPill", "shares")
            ])
        ]);

        const chips = el("div", {
            className: "market-chips",
            id: "marketChips"
        });
        for (const m of Config.MARKETS) {
            const nameEl = el("b", {}, m.name);
            const subEl = el("small", {}, "—");
            const btn = el(
                "button",
                {
                    className: "market-chip",
                    onClick: () => {
                        actions.selectMarket(m.id);
                    }
                },
                [nameEl, subEl]
            );
            chips.appendChild(btn);
            marketChipEls[m.id] = { btn, nameEl, subEl };
        }

        canvas = el("canvas", { id: "chart" });

        const marketStatus = el(
            "div",
            { className: "market-status", id: "marketStatus" },
            [
                span({ className: "ms-item" }, [
                    span({ className: "ms-k" }, "SHARES "),
                    span({ className: "ms-v", id: "statusShares" }, "—")
                ]),
                span({ className: "ms-sep" }, "·"),
                span({ className: "ms-item" }, [
                    span({ className: "ms-k" }, "POOL "),
                    span({ className: "ms-v", id: "statusPool" }, "—")
                ]),
                span({ className: "ms-sep" }, "·"),
                span({ className: "ms-item" }, [
                    span({ className: "ms-k" }, "INTEREST "),
                    span({ className: "ms-v", id: "statusInterest" }, "—")
                ])
            ]
        );

        const tradeBlock = el("div", { className: "trade-grid" }, [
            btn("BUY 1", "buy1", "buy"),
            btn("BUY MAX", "buyMax", "buy"),
            btn("SELL 1", "sell1", "sell"),
            btn("SELL ALL", "sellAll", "sell")
        ]);

        const statRows = el(
            "div",
            { className: "stat-block", id: "marketStats" },
            [
                row("Holding", "holdingRow"),
                row("Cost", "costRow"),
                row("P/L", "plRow"),
                div({ className: "stat-sep" }),
                row("Wallet", "walletRow"),
                row("Current", "currentRow"),
                row("MA (5m)", "maRow"),
                div({ className: "stat-sep" }),
                row("Last sell", "lastSellRow"),
                row("Lifetime", "lifetimeRow")
            ]
        );

        const activeTitle = el("div", { className: "panel-title" }, "Market");
        const activeSubtitle = el(
            "div",
            { className: "market-name", id: "activeMarketName" },
            "—"
        );

        const cashOutFill = el("div", {
            className: "co-fill",
            id: "cashOutFill"
        });
        const cashOutLabel = span(
            { className: "co-label", id: "cashOutLabel" },
            "CASH POOL 0%"
        );
        const cashOutAmount = span(
            { className: "co-amount", id: "cashOutAmount" },
            "—"
        );
        const cashOutBtn = el(
            "button",
            {
                className: "cashout-btn",
                id: "cashOutBtn",
                onClick: () => {
                    actions.cashOut(State.get().activeMarket);
                }
            },
            [cashOutFill, cashOutLabel, cashOutAmount]
        );

        const resetMarketBtn = el(
            "button",
            {
                className: "reset-market-btn hidden",
                id: "resetMarketBtn",
                onClick: () => {
                    const id = State.get().activeMarket;
                    const name = Market.def(id).name;
                    if (
                        !confirm(
                            "Reset " +
                                name +
                                "? Shares, lifetime and level are preserved, q will be refilled."
                        )
                    )
                        return;
                    actions.resetMarket(id);
                }
            },
            [
                span({ className: "rm-label" }, "RESET MARKET"),
                span({ className: "rm-amount", id: "resetMarketAmount" }, "—")
            ]
        );

        /* ---- level panel (replaces IPO panel) ---- */
        const levelPanel = el(
            "div",
            { className: "level-panel", id: "levelPanel" },
            [
                div({ className: "level-panel-header" }, [
                    span({ className: "level-panel-title" }, "MARKET LEVEL"),
                    span(
                        { className: "level-panel-lv", id: "levelPanelLv" },
                        "LV 0"
                    )
                ]),
                div({ className: "level-bar" }, [
                    div({ className: "level-bar-fill", id: "levelBarFill" })
                ]),
                div({ className: "level-panel-meta" }, [
                    span(
                        { className: "level-panel-pct", id: "levelPanelPct" },
                        "0%"
                    ),
                    span(
                        {
                            className: "level-panel-amount",
                            id: "levelPanelAmount"
                        },
                        "0 / 10 cash outs"
                    )
                ]),
                div(
                    { className: "level-panel-reward", id: "levelPanelReward" },
                    "Passive: +0 Q/s"
                )
            ]
        );

        const upgradeBtn = el(
            "button",
            {
                className: "upgrade-btn",
                id: "upgradeShareBtn",
                onClick: () => {
                    actions.upgradeShares(State.get().activeMarket);
                }
            },
            [
                div({ className: "upg-title" }, "Buy Share"),
                div({ className: "upg-desc", id: "upgShareDesc" }, "—"),
                div({ className: "upg-cost", id: "upgShareCost" }, "—")
            ]
        );

        const speedBtn = el(
            "button",
            {
                className: "upgrade-btn",
                id: "upgradeSpeedBtn",
                onClick: () => {
                    actions.upgradeSpeed(State.get().activeMarket);
                }
            },
            [
                div({ className: "upg-title" }, "Frequency Coil"),
                div({ className: "upg-desc", id: "upgSpeedDesc" }, "—"),
                div({ className: "upg-cost", id: "upgSpeedCost" }, "—")
            ]
        );

        const activePanel = el("div", { className: "panel market-panel" }, [
            activeTitle,
            activeSubtitle,
            marketStatus,
            el("div", { className: "chart-wrap" }, [canvas]),
            statRows,
            tradeBlock,
            cashOutBtn,
            resetMarketBtn,
            levelPanel,
            upgradeBtn,
            speedBtn
        ]);

        const contributionRows = el("div", {
            className: "portfolio-rows",
            id: "portfolioRows"
        });
        const portfolioTotal = el(
            "div",
            { className: "portfolio-total", id: "portfolioTotal" },
            "—"
        );
        const portfolioHint = el(
            "div",
            { className: "hint" },
            "Trades feed each market's pool. Interest accrues for 60s after a trade. Cash out when pool is full."
        );

        const boostBtn = el(
            "button",
            {
                className: "upgrade-btn",
                id: "portfolioBoostBtn",
                onClick: () => {
                    actions.upgradePortfolio();
                }
            },
            [
                div({ className: "upg-title" }, "Portfolio Boost"),
                div({ className: "upg-desc", id: "boostDesc" }, "—"),
                div({ className: "upg-cost", id: "boostCost" }, "—")
            ]
        );

        const interestBtn = el(
            "button",
            {
                className: "upgrade-btn",
                id: "interestBoosterBtn",
                onClick: () => {
                    actions.upgradeInterestBooster();
                }
            },
            [
                div({ className: "upg-title" }, "Interest Booster"),
                div({ className: "upg-desc", id: "interestDesc" }, "—"),
                div({ className: "upg-cost", id: "interestCost" }, "—")
            ]
        );

        const leverageBtn = el(
            "button",
            {
                className: "upgrade-btn",
                id: "marketLeverageBtn",
                onClick: () => {
                    actions.upgradeMarketLeverage();
                }
            },
            [
                div({ className: "upg-title" }, "Market Leverage"),
                div({ className: "upg-desc", id: "leverageDesc" }, "—"),
                div({ className: "upg-cost", id: "leverageCost" }, "—")
            ]
        );

        const bufferBtn = el(
            "button",
            {
                className: "upgrade-btn",
                id: "poolBufferBtn",
                onClick: () => {
                    actions.upgradePoolBuffer();
                }
            },
            [
                div({ className: "upg-title" }, "Overflow Valve"),
                div({ className: "upg-desc", id: "bufferDesc" }, "—"),
                div({ className: "upg-cost", id: "bufferCost" }, "—")
            ]
        );

        const yieldBtn = el(
            "button",
            {
                className: "upgrade-btn",
                id: "passiveYieldBtn",
                onClick: () => {
                    actions.upgradePassiveYield();
                }
            },
            [
                div({ className: "upg-title" }, "Passive Yield"),
                div({ className: "upg-desc", id: "yieldDesc" }, "—"),
                div({ className: "upg-cost", id: "yieldCost" }, "—")
            ]
        );

        const reactionBtn = el(
            "button",
            {
                className: "upgrade-btn",
                id: "reactionBtn",
                onClick: () => {
                    actions.upgradeReaction();
                }
            },
            [
                div({ className: "upg-title" }, "Reaction"),
                div({ className: "upg-desc", id: "reactionDesc" }, "—"),
                div({ className: "upg-cost", id: "reactionCost" }, "—")
            ]
        );

        const portfolioPanel = el("div", { className: "panel" }, [
            el("div", { className: "panel-title" }, "Portfolio"),
            contributionRows,
            portfolioTotal,
            portfolioHint,
            boostBtn,
            interestBtn,
            leverageBtn,
            bufferBtn,
            yieldBtn,
            reactionBtn
        ]);

        const profileRows = el("div", { className: "stat-block" }, [
            row("Total Q earned", "profileEarned"),
            row("Total lifetime cash out", "profileLifetimeCO"),
            row("Total lifetime profit", "profileLifetimeProfit"),
            row("Total cash outs", "profileCashOuts"),
            row("Best single cash out", "profileBestCO"),
            row("Total market levels", "profileLevels"),
            row("Level passive", "profileLevelPassive"),
            row("Playtime", "profilePlaytime")
        ]);
        const profilePanel = el("div", { className: "panel" }, [
            el("div", { className: "panel-title" }, "Profile"),
            profileRows
        ]);

        const resetBtn = el(
            "button",
            {
                className: "ghost",
                id: "resetBtn",
                onClick: () => {
                    actions.reset();
                }
            },
            "Reset Save"
        );

        document.body.append(
            hud,
            el("main", { id: "main" }, [
                el("div", { className: "panel chips-panel" }, [chips]),
                activePanel,
                portfolioPanel,
                profilePanel,
                resetBtn
            ])
        );
        initCanvas();
        wireTradeButtons();
    }

    let actions = {
        buy: () => {},
        sell: () => {},
        upgradeShares: () => {},
        upgradeSpeed: () => {},
        cashOut: () => {},
        upgradePortfolio: () => {},
        upgradeInterestBooster: () => {},
        upgradeMarketLeverage: () => {},
        upgradePoolBuffer: () => {},
        upgradePassiveYield: () => {},
        upgradeReaction: () => {},
        resetMarket: () => {},
        selectMarket: () => {},
        reset: () => {}
    };
    function setActions(a) {
        actions = Object.assign({}, actions, a);
    }

    function pill(label, id, cls) {
        return div({ className: "pill " + cls }, [
            span({ className: "k" }, label),
            span({ className: "v", id }, "—")
        ]);
    }
    function row(label, id) {
        return div({ className: "row" }, [
            span({ className: "label" }, label),
            span({ className: "value", id }, "—")
        ]);
    }
    function btn(label, id, kind) {
        return el("button", { className: "trade-btn " + kind, id }, [
            span({ className: "btn-label" }, label),
            span({ className: "btn-amount", id: id + "Amount" }, "—")
        ]);
    }

    function wireTradeButtons() {
        $("#buy1").addEventListener("click", () =>
            actions.buy(State.get().activeMarket, 1)
        );
        $("#buyMax").addEventListener("click", () =>
            actions.buy(State.get().activeMarket, Infinity)
        );
        $("#sell1").addEventListener("click", () =>
            actions.sell(State.get().activeMarket, 1)
        );
        $("#sellAll").addEventListener("click", () =>
            actions.sell(State.get().activeMarket, Infinity)
        );
    }

    function initCanvas() {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) {
            requestAnimationFrame(initCanvas);
            return;
        }
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        W = rect.width;
        H = rect.height;
    }

    function drawChart() {
        if (!ctx) {
            initCanvas();
            return;
        }
        const s = State.get();
        const id = s.activeMarket;
        const mk = s.markets[id];
        const mDef = Market.def(id);
        const now = Date.now() / 1000;
    
        const SPAN = (mDef.chartSpan ?? 20) / Market.marketSpeedMult(id);
        const N = 80;
        const pad = 8;
        const ih = H - pad * 2;

        const samples = new Array(N + 1);
        let minP = Infinity,
            maxP = -Infinity;
        for (let i = 0; i <= N; i++) {
            const t = now - SPAN + (i / N) * SPAN;
            const p = Market.naturalPrice(id, t);
            samples[i] = p;
            if (p < minP) minP = p;
            if (p > maxP) maxP = p;
        }
        const ma = Market.movingAverage(id, now);
        if (ma < minP) minP = ma;
        if (ma > maxP) maxP = ma;
        const cur = Market.naturalPrice(id, now);
        if (cur < minP) minP = cur;
        if (cur > maxP) maxP = cur;

        if (mDef.chartYRange != null) {
            const base = Market.marketBasePrice(id);
            minP = base * (1 - mDef.chartYRange);
            maxP = base * (1 + mDef.chartYRange);
        } else {
            const rawRange = Math.max(1, maxP - minP);
            minP -= rawRange * 0.08;
            maxP += rawRange * 0.08;
        }
        const range = maxP - minP;
        const yOf = p => H - pad - ((p - minP) / range) * ih;
        ctx.clearRect(0, 0, W, H);

        const avgCost = mk.holding > 0 ? mk.costBasis / mk.holding : 0;
        if (avgCost > 0 && avgCost >= minP && avgCost <= maxP) {
            const y = yOf(avgCost);
            ctx.beginPath();
            ctx.setLineDash([5, 4]);
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.strokeStyle = "rgba(255, 209, 102, 0.65)";
            ctx.lineWidth = 1.2;
            ctx.stroke();
            ctx.setLineDash([]);
        }
        if (ma >= minP && ma <= maxP) {
            const y = yOf(ma);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.strokeStyle = "rgba(96, 165, 250, 0.55)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        const pts = samples.map((p, i) => [(i / N) * W, yOf(p)]);
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (const [x, y] of pts) ctx.lineTo(x, y);
        ctx.lineTo(W, H);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "rgba(74, 222, 128, 0.25)");
        grad.addColorStop(1, "rgba(74, 222, 128, 0.02)");
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.strokeStyle = "#4ade80";
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.shadowColor = "#4ade80";
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;

        const curY = yOf(cur);
        ctx.beginPath();
        ctx.arc(W - 3, curY, 4, 0, Math.PI * 2);
        ctx.fillStyle = "#4ade80";
        ctx.shadowColor = "#4ade80";
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    function render() {
        const s = State.get();
        const id = s.activeMarket;
        const mk = s.markets[id];
        const t = Date.now() / 1000;

        /* ============ HUD ============ */
        $("#bigQ").textContent = Format.num(s.Q);

        const growthEl = $("#growthPill");
        const growthPct = s.lastGrowthPct || 0;
        if (s.total <= 1 || Math.abs(growthPct) < 0.01) {
            growthEl.textContent = "—";
            growthEl.style.color = "var(--dim2)";
        } else {
            growthEl.textContent =
                (growthPct >= 0 ? "+" : "") + growthPct.toFixed(1) + "%";
            growthEl.style.color =
                growthPct > 0 ? "var(--quanta)" : "var(--surge)";
        }

        const passiveEl = $("#passivePill");
        const passiveRate =
            Market.levelPassiveTotal() + Market.passiveYieldRate();
        passiveEl.textContent = "+" + Format.num(passiveRate) + "/s";
        passiveEl.style.color =
            passiveRate > 0.01 ? "var(--good)" : "var(--dim2)";

        const liveMkts = Config.liveMarkets();
        const unlockedCount = liveMkts.filter(m =>
            Market.isUnlocked(m.id)
        ).length;
        $("#marketsPill").textContent = unlockedCount + "/" + liveMkts.length;

        /* ============ Chips ============ */
        for (const m of Config.MARKETS) {
            const unlocked = Market.isUnlocked(m.id);
            const seen = s.seenMarkets[m.id] !== false;
            const isDebug = Config.isDebugMarket(m.id);
            const level = Market.levelOf(m.id);
            const ref = marketChipEls[m.id];

            ref.btn.classList.toggle("active", m.id === id);
            ref.btn.classList.toggle("locked", !unlocked);
            ref.btn.classList.toggle("unread", unlocked && !seen);
            ref.btn.classList.toggle("debug", isDebug);

            const lvPrefix = level > 0 ? "LV" + level + " " : "";

            if (!unlocked) {
                ref.nameEl.textContent = "🔒 " + m.name;
                ref.subEl.textContent =
                    "unlock " + Format.num(m.unlockAt) + " Q";
            } else {
                ref.nameEl.textContent = lvPrefix + m.name;
                const mk2 = s.markets[m.id];
                const cap2 = Market.poolMax(m.id);
                const stats =
                    "×" +
                    Format.plain(Market.marketMultiplier(m.id)) +
                    " · " +
                    Format.num(mk2.pool) +
                    "/" +
                    Format.num(cap2) +
                    "q";
                ref.subEl.textContent = seen ? stats : "NEW — tap to view";
            }
        }

        /* ============ Market header ============ */
        const mDef = Market.def(id);
        const level = Market.levelOf(id);
        const lvPrefix = level > 0 ? "LV" + level + " · " : "";
        $("#activeMarketName").textContent =
            lvPrefix +
            mDef.name +
            " · ×" +
            Format.plain(Market.marketMultiplier(id)) +
            " mult";

        /* ============ Market status ============ */
        $("#statusShares").textContent = mk.shares;

        const cap = Market.poolMax(id);
        const poolPct = cap > 0 ? (mk.pool / cap) * 100 : 0;
        const fullPct = Config.CASHOUT_FULL_THRESHOLD * 100;
        const statusPoolEl = $("#statusPool");
        statusPoolEl.textContent =
            Format.num(mk.pool) +
            "/" +
            Format.num(cap) +
            " (" +
            poolPct.toFixed(0) +
            "%)";
        statusPoolEl.style.color =
            poolPct >= 99.5
                ? "var(--cost)"
                : poolPct >= fullPct
                  ? "var(--good)"
                  : poolPct >= 50
                    ? "var(--txt)"
                    : "";

        const rate = Market.currentInterestRate(id);
        const statusIntEl = $("#statusInterest");
        if (rate > 0.01) {
            const secs = Math.ceil(
                Math.max(0, (mk.interestExpiresAt - Date.now()) / 1000)
            );
            statusIntEl.textContent =
                "+" + Format.num(rate) + "/s (" + secs + "s)";
            statusIntEl.style.color = "var(--good)";
        } else {
            statusIntEl.textContent = "inactive";
            statusIntEl.style.color = "var(--dim2)";
        }

        /* ============ Market stats ============ */
        const buyP = Market.buyPrice(id, t);
        const sellP = Market.sellPrice(id)(t);
        const ma = Market.movingAverage(id, t);
        const curP = Market.naturalPrice(id, t);

        $("#holdingRow").textContent = mk.holding + "/" + mk.shares + " units";
        if (mk.holding > 0) {
            const avg = mk.costBasis / mk.holding;
            $("#costRow").textContent =
                "Ⓠ " +
                Format.num(avg) +
                " /unit · Ⓠ " +
                Format.num(mk.costBasis) +
                " total";
            const pl = mk.holding * sellP - mk.costBasis;
            const plPct = mk.costBasis > 0 ? (pl / mk.costBasis) * 100 : 0;
            const plEl = $("#plRow");
            plEl.textContent =
                (pl >= 0 ? "+" : "−") +
                "Ⓠ " +
                Format.num(Math.abs(pl)) +
                " (" +
                (plPct >= 0 ? "+" : "−") +
                Math.abs(plPct).toFixed(1) +
                "%)";
            plEl.style.color =
                pl > 0.01 ? "var(--good)" : pl < -0.01 ? "var(--surge)" : "";
        } else {
            $("#costRow").textContent = "—";
            $("#plRow").textContent = "—";
            $("#plRow").style.color = "";
        }

        $("#walletRow").textContent = Format.num(mk.q) + " q";
        $("#currentRow").textContent = "Ⓠ " + Format.num(curP);
        const vsMa = ma > 0 ? ((curP - ma) / ma) * 100 : 0;
        $("#maRow").textContent =
            "Ⓠ " +
            Format.num(ma) +
            " · " +
            (vsMa >= 0 ? "+" : "") +
            vsMa.toFixed(1) +
            "% " +
            (vsMa >= 0 ? "over" : "under");
        $("#maRow").style.color =
            vsMa < -2 ? "var(--good)" : vsMa > 2 ? "var(--cost)" : "var(--txt)";

        if (mk.lastSellTime > 0) {
            const p = mk.lastSellProfit;
            const ageSec = (Date.now() - mk.lastSellTime) / 1000;
            const ageStr =
                ageSec < 60
                    ? Math.round(ageSec) + "s"
                    : ageSec < 3600
                      ? Math.round(ageSec / 60) + "m"
                      : Math.round(ageSec / 3600) + "h";
            $("#lastSellRow").textContent =
                (p >= 0 ? "+" : "−") +
                "Ⓠ " +
                Format.num(Math.abs(p)) +
                " · " +
                ageStr +
                " ago";
            $("#lastSellRow").style.color =
                p > 0.01 ? "var(--good)" : p < -0.01 ? "var(--surge)" : "";
        } else {
            $("#lastSellRow").textContent = "—";
            $("#lastSellRow").style.color = "";
        }

        $("#lifetimeRow").textContent =
            Format.num(mk.lifetimeCashOut) +
            " Q · " +
            mk.cashOutCount +
            " cash outs";

        /* trade buttons */
        const canBuy = mk.holding < mk.shares && mk.q >= buyP;
        const canSell = mk.holding > 0;
        const maxAfford = Math.min(
            mk.shares - mk.holding,
            Math.floor(mk.q / buyP)
        );

        $("#buy1Amount").textContent = "Ⓠ " + Format.num(buyP);
        $("#buyMaxAmount").textContent =
            maxAfford > 0 ? "Ⓠ " + Format.num(maxAfford * buyP) : "—";
        $("#sell1Amount").textContent = "Ⓠ " + Format.num(sellP);
        $("#sellAllAmount").textContent = canSell
            ? "Ⓠ " + Format.num(mk.holding * sellP)
            : "—";

        $("#buy1").classList.toggle("can", canBuy);
        $("#buy1").classList.toggle("poor", !canBuy);
        $("#buyMax").classList.toggle("can", maxAfford > 0);
        $("#buyMax").classList.toggle("poor", maxAfford === 0);
        $("#sell1").classList.toggle("can", canSell);
        $("#sell1").classList.toggle("poor", !canSell);
        $("#sellAll").classList.toggle("can", canSell);
        $("#sellAll").classList.toggle("poor", !canSell);

        /* cash out */
        const cCheck = Market.canCashOut(id);
        const coBtn = $("#cashOutBtn");
        const coFill = $("#cashOutFill");
        const coLabel = $("#cashOutLabel");
        const coAmt = $("#cashOutAmount");
        const val = Market.cashOutValue(id);
        const tip = val * Config.LEVEL_TIP_PCT;

        const pct = Math.min(100, cCheck.pct || 0);
        coFill.style.width = pct + "%";

        if (cCheck.ok) {
            coLabel.textContent = "CASH OUT";
            coAmt.textContent =
                "+" + Format.num(val) + " Q (+" + Format.num(tip) + ")";
            coBtn.classList.add("can", "full");
            coBtn.classList.remove("poor");
        } else if (cCheck.reason === "cooldown") {
            coLabel.textContent = "COOLDOWN " + Math.ceil(cCheck.left) + "s";
            coAmt.textContent = "—";
            coBtn.classList.remove("can", "full");
            coBtn.classList.add("poor");
        } else {
            coLabel.textContent = "CASH POOL " + Math.round(pct) + "%";
            coAmt.textContent = "+" + Format.num(val) + " Q";
            coBtn.classList.remove("can", "full");
            coBtn.classList.add("poor");
        }

        /* reset */
        const rCheck = Market.canReset(id);
        const rBtn = $("#resetMarketBtn");
        if (rCheck.ok) {
            rBtn.classList.remove("hidden");
            $("#resetMarketAmount").textContent =
                "+" + Format.num(Market.resetAmount()) + " q";
        } else {
            rBtn.classList.add("hidden");
        }

        /* level panel */
        const lp = Market.levelProgress(id);
        $("#levelPanelLv").textContent = "LV " + lp.level;
        $("#levelBarFill").style.width = lp.pct.toFixed(1) + "%";
        $("#levelPanelPct").textContent = Math.round(lp.pct) + "%";
        $("#levelPanelAmount").textContent =
            lp.within + " / " + lp.stepSize + " cash outs";

        const currentPassive = lp.currentPassive;
        if (lp.level === 0) {
            $("#levelPanelReward").textContent =
                "Next level: +" + Format.num(lp.nextBonus) + " Q/s";
        } else {
            $("#levelPanelReward").textContent =
                "Passive: +" +
                Format.num(currentPassive) +
                " Q/s · Next level: +" +
                Format.num(lp.nextBonus);
        }

        const lvlPanelEl = $("#levelPanel");
        const flashLeveled =
            mk.lastLevelUpTime && Date.now() - mk.lastLevelUpTime < 1400;
        lvlPanelEl.classList.toggle("leveled", !!flashLeveled);

        /* share upgrade */
        const upCost = Market.shareUpgradeCost(id);
        const upReq = Market.shareUpgradeRequirement(id);
        const canUpgrade = mk.q >= upReq;
        const newCap = mk.shares + 1;
        const shareBonusPct = Math.round(
            (1 + newCap * Config.SHARE_POOL_BONUS) * 100 - 100
        );
        $("#upgShareDesc").textContent =
            mk.shares +
            " → " +
            newCap +
            " shares · +" +
            shareBonusPct +
            "% pool cap";
        $("#upgShareCost").textContent =
            Format.num(upReq) +
            " q (" +
            Format.num(upCost) +
            " + " +
            Format.num(Config.STARTING_Q_PER_MARKET) +
            " reserve)";
        $("#upgradeShareBtn").classList.toggle("can", canUpgrade);
        $("#upgradeShareBtn").classList.toggle("poor", !canUpgrade);

        /* frequency coil */
        const spCost = Market.speedUpgradeCost(id);
        const spLevel = mk.speedLevel || 0;
        const spMaxed = spLevel >= Config.SPEED_MAX_LEVEL;
        const spNow = Market.marketSpeedMult(id);
        const spNext = 1 + (spLevel + 1) * Config.SPEED_PER_LEVEL;
        $("#upgSpeedDesc").textContent = spMaxed
            ? "LV " + spLevel + " · MAXED (wave ×" + spNow.toFixed(2) + ")"
            : "LV " +
              spLevel +
              " · wave speed ×" +
              spNow.toFixed(2) +
              " → ×" +
              spNext.toFixed(2);
        $("#upgSpeedCost").textContent = spMaxed
            ? "MAX"
            : Format.num(spCost) + " Q";
        const canSpeed = !spMaxed && s.Q >= spCost;
        $("#upgradeSpeedBtn").classList.toggle("can", canSpeed);
        $("#upgradeSpeedBtn").classList.toggle("poor", !canSpeed);
        
        drawChart();
        renderPortfolioAndProfile();
    }

    function renderPortfolioAndProfile() {
        const s = State.get();

        const rows = [];
        for (const m of Config.MARKETS) {
            const unlocked = Market.isUnlocked(m.id);
            const isDebug = Config.isDebugMarket(m.id);
            const debugTag = isDebug ? " [DEBUG]" : "";
            if (!unlocked) {
                rows.push(
                    div(
                        {
                            className:
                                "portfolio-row locked" +
                                (isDebug ? " debug" : "")
                        },
                        [
                            span({ className: "pr-name" }, m.name + debugTag),
                            span(
                                { className: "pr-info" },
                                "unlock " + Format.num(m.unlockAt) + " Q"
                            )
                        ]
                    )
                );
                continue;
            }
            const level = Market.levelOf(m.id);
            const lvPrefix = level > 0 ? "LV" + level + " " : "";
            const mk2 = s.markets[m.id];
            const cap2 = Market.poolMax(m.id);
            const rate2 = Market.currentInterestRate(m.id);
            const lpRate = Market.levelPassiveRate(m.id);
            let info = Format.num(mk2.pool) + "/" + Format.num(cap2) + "q";
            if (rate2 > 0.01) info += " · +" + Format.num(rate2) + "/s";
            if (lpRate > 0.01) info += " · +" + Format.num(lpRate) + "/s";
            rows.push(
                div(
                    { className: "portfolio-row" + (isDebug ? " debug" : "") },
                    [
                        span(
                            { className: "pr-name" },
                            lvPrefix + m.name + debugTag
                        ),
                        span({ className: "pr-info" }, info)
                    ]
                )
            );
        }
        $("#portfolioRows").replaceChildren(...rows);

        const totalPool = Config.liveMarkets().reduce(
            (sum, m) => sum + s.markets[m.id].pool,
            0
        );
        const lp = Market.levelPassiveTotal();
        const py = Market.passiveYieldRate();
        let totalLine = "Total pool: " + Format.num(totalPool) + " q";
        if (lp > 0) totalLine += " · Levels +" + Format.num(lp) + "/s";
        if (py > 0) totalLine += " · Yield +" + Format.num(py) + "/s";
        $("#portfolioTotal").textContent = totalLine;

        const bCost = Market.portfolioBoostCost();
        $("#boostDesc").textContent =
            "LV " +
            s.portfolioBoost +
            " · cash out ×" +
            Format.plain(Market.portfolioBoostMult());
        $("#boostCost").textContent = Format.num(bCost) + " Q";
        $("#portfolioBoostBtn").classList.toggle("can", s.Q >= bCost);
        $("#portfolioBoostBtn").classList.toggle("poor", s.Q < bCost);

        const iCost = Market.interestBoosterCost();
        $("#interestDesc").textContent =
            "LV " +
            s.interestBooster +
            " · interest ×" +
            Format.plain(Market.interestBoostMult());
        $("#interestCost").textContent = Format.num(iCost) + " Q";
        $("#interestBoosterBtn").classList.toggle("can", s.Q >= iCost);
        $("#interestBoosterBtn").classList.toggle("poor", s.Q < iCost);

        const lCost = Market.marketLeverageCost();
        const lMaxed = s.marketLeverage >= Config.MARKET_LEVERAGE_MAX_LEVEL;
        $("#leverageDesc").textContent = lMaxed
            ? "LV " +
              s.marketLeverage +
              " · MAXED (+" +
              Math.round(
                  s.marketLeverage * Config.MARKET_LEVERAGE_PER_LEVEL * 100
              ) +
              "% amplitude)"
            : "LV " +
              s.marketLeverage +
              " · +" +
              Math.round(
                  (s.marketLeverage + 1) *
                      Config.MARKET_LEVERAGE_PER_LEVEL *
                      100
              ) +
              "% wave amplitude";
        $("#leverageCost").textContent = lMaxed
            ? "MAX"
            : Format.num(lCost) + " Q";
        $("#marketLeverageBtn").classList.toggle(
            "can",
            !lMaxed && s.Q >= lCost
        );
        $("#marketLeverageBtn").classList.toggle("poor", lMaxed || s.Q < lCost);

        const pbCost = Market.poolBufferCost();
        const pbMaxed = s.poolBuffer >= Config.POOL_BUFFER_MAX_LEVEL;
        const pbNow = Market.poolBufferMult();
        const pbNext = Math.max(
            0.5,
            1 - (s.poolBuffer + 1) * Config.POOL_BUFFER_PER_LEVEL
        );
        $("#bufferDesc").textContent = pbMaxed
            ? "LV " + s.poolBuffer + " · MAXED (pool cap ×" + pbNow.toFixed(2) + ")"
            : "LV " +
              s.poolBuffer +
              " · pool cap ×" +
              pbNow.toFixed(2) +
              " → ×" +
              pbNext.toFixed(2);
        $("#bufferCost").textContent = pbMaxed
            ? "MAX"
            : Format.num(pbCost) + " Q";
        $("#poolBufferBtn").classList.toggle("can", !pbMaxed && s.Q >= pbCost);
        $("#poolBufferBtn").classList.toggle("poor", pbMaxed || s.Q < pbCost);

        const pyCost = Market.passiveYieldCost();
        const pyRate = Market.passiveYieldRate();
        $("#yieldDesc").textContent =
            "LV " + s.passiveYield + " · +" + Format.num(pyRate) + " Q/s";
        $("#yieldCost").textContent = Format.num(pyCost) + " Q";
        $("#passiveYieldBtn").classList.toggle("can", s.Q >= pyCost);
        $("#passiveYieldBtn").classList.toggle("poor", s.Q < pyCost);

        const rCost = Market.reactionCost();
        const rMaxed = s.reaction >= Config.REACTION_MAX_LEVEL;
        const sigNow = Market.signalMult();
        const sigNext = Math.max(
            0.3,
            1 - (s.reaction + 1) * Config.REACTION_PER_LEVEL
        );
        $("#reactionDesc").textContent = rMaxed
            ? "LV " +
              s.reaction +
              " · MAXED (wave damping ×" +
              sigNow.toFixed(2) +
              ")"
            : "LV " +
              s.reaction +
              " · wave damping ×" +
              sigNow.toFixed(2) +
              " → ×" +
              sigNext.toFixed(2);
        $("#reactionCost").textContent = rMaxed
            ? "MAX"
            : Format.num(rCost) + " Q";
        $("#reactionBtn").classList.toggle("can", !rMaxed && s.Q >= rCost);
        $("#reactionBtn").classList.toggle("poor", rMaxed || s.Q < rCost);

        /* Profile */
        $("#profileEarned").textContent = Format.num(s.total) + " Q";
        $("#profileLifetimeCO").textContent =
            Format.num(Market.totalLifetimeCashOut()) + " Q";
        $("#profileLifetimeProfit").textContent =
            Format.num(Market.totalLifetimeProfit()) + " Q";
        $("#profileCashOuts").textContent = Market.totalCashOuts().toString();
        $("#profileBestCO").textContent = Format.num(s.bestCashOut || 0) + " Q";
        $("#profileLevels").textContent =
            Market.totalLevels() + " across " + Config.liveMarkets().length;
        $("#profileLevelPassive").textContent =
            Format.num(Market.levelPassiveTotal()) + " Q/s";
        $("#profilePlaytime").textContent = Format.time(
            (Date.now() - s.start) / 1000
        );
    }

    function toast(msg) {
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove("show"), 3200);
    }

    return { build, setActions, render, toast, $ };
})();
