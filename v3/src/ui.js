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

    function build() {
        toastEl = div({ id: "toast" });
        document.body.appendChild(toastEl);

        const hud = el("header", { id: "hud" }, [
            div(
                { className: "qval", id: "quantaVal" },
                Format.num(State.get().quanta)
            ),
            div({ className: "qlabel" }, "QUANTA"),
            div({ className: "hud-sub" }, [
                pill("ENTROPY", "entropyVal", "entropy"),
                pill("INCOME", "incomeVal", "income"),
                pill("SHARES", "sharesVal", "shares"),
                pill("PRICE", "priceVal", "price")
            ])
        ]);

        canvas = el("canvas", { id: "chart" });

        const statBlock = div({ className: "stat-block" }, [
            row("Position", "posVal"),
            row("P/L", "plVal"),
            row("Impact", "impactVal"),
            div({ className: "stat-sep" }),
            row("Avg cost", "costVal"),
            row("Last buy", "lastBuyVal"),
            div({ className: "stat-sep" }),
            row("Current", "currentVal"),
            row("MA (5m)", "maVal"),
            row("Last sell", "lastSellVal")
        ]);

        const buy1 = tradeBtn("buy", "buy1", "BUY 1", "buy1Cost");
        const buyMax = tradeBtn("buy", "buyMax", "BUY MAX", "buyMaxCost");
        const sell1 = tradeBtn("sell", "sell1", "SELL 1", "sell1Gain");
        const sellAll = tradeBtn("sell", "sellAll", "SELL ALL", "sellAllGain");

        const marketPanel = div({ className: "panel market-panel" }, [
            div({ className: "panel-title" }, "Market"),
            div({ className: "chart-wrap" }, [canvas]),
            statBlock,
            div({ className: "trade-grid" }, [buy1, buyMax, sell1, sellAll])
        ]);

        const upgradeBtn = el(
            "button",
            { className: "upgrade-btn", id: "upgradeBtn" },
            [
                div({ className: "upg-title" }, "Expand Position"),
                div({ className: "upg-desc", id: "upgDesc" }, "+5 max shares"),
                div({ className: "upg-cost", id: "upgCost" }, "—")
            ]
        );
        const bulkUpgradeBtn = el(
            "button",
            { className: "upgrade-btn", id: "bulkUpgradeBtn" },
            [
                div({ className: "upg-title" }, "Bulk Trade Size"),
                div({ className: "upg-desc", id: "bulkDesc" }, "—"),
                div({ className: "upg-cost", id: "bulkCost" }, "—")
            ]
        );

        const upgradePanel = div({ className: "panel" }, [
            div({ className: "panel-title" }, "Upgrades"),
            upgradeBtn,
            bulkUpgradeBtn
        ]);

        /* Entropy panel */
        const entropyPanel = div({ className: "panel entropy-panel" }, [
            div({ className: "panel-title-row" }, [
                div(
                    { className: "panel-title", style: { margin: 0 } },
                    "Entropy"
                ),
                span({ className: "entropy-badge" }, [
                    span({ className: "entropy-sym" }, "Ξ "),
                    span({ className: "entropy-val", id: "entropyBig" }, "0")
                ])
            ]),
            div({ className: "stat-block" }, [
                row("Observed rate", "entNet"),
                row("Baseline", "entBaseline"),
                row("Auto-trade", "entAuto")
            ]),
            div(
                { className: "hint", style: { marginTop: "8px" } },
                "Manual trades +" +
                    Config.ENTROPY_PER_TRADE.toFixed(2) +
                    " Ξ / share · " +
                    "Auto-trade costs shown are worst-case."
            )
        ]);

        /* Automation panel */
        const autoPanel = div({ className: "panel", id: "autoPanel" }, [
            div({ className: "panel-title" }, "Automation"),
            el(
                "div",
                { className: "auto-lock", id: "autoLock" },
                "Unlocks at Share LV " + Config.AUTO_UNLOCK_LEVEL
            ),
            div({ className: "auto-body", id: "autoBody" }, [
                /* Auto-buy row */
                div({ className: "auto-row" }, [
                    el(
                        "button",
                        { className: "auto-toggle", id: "autoBuyToggle" },
                        "AUTO-BUY: OFF"
                    ),
                    el("div", { className: "auto-slider-wrap" }, [
                        el("input", {
                            type: "range",
                            id: "autoBuySlider",
                            className: "auto-slider",
                            min: "60",
                            max: "98",
                            step: "1",
                            value: "95"
                        }),
                        el(
                            "span",
                            { className: "auto-value", id: "autoBuyValue" },
                            "95%"
                        )
                    ]),
                    el(
                        "div",
                        { className: "auto-hint", id: "autoBuyHint" },
                        "buys below 95% of MA"
                    )
                ]),
                /* Auto-sell row */
                div({ className: "auto-row" }, [
                    el(
                        "button",
                        { className: "auto-toggle", id: "autoSellToggle" },
                        "AUTO-SELL: OFF"
                    ),
                    el("div", { className: "auto-slider-wrap" }, [
                        el("input", {
                            type: "range",
                            id: "autoSellSlider",
                            className: "auto-slider",
                            min: "102",
                            max: "140",
                            step: "1",
                            value: "105"
                        }),
                        el(
                            "span",
                            { className: "auto-value", id: "autoSellValue" },
                            "105%"
                        )
                    ]),
                    el(
                        "div",
                        { className: "auto-hint", id: "autoSellHint" },
                        "sells above 105% of MA"
                    )
                ]),
                el("div", { className: "auto-bulk", id: "autoBulk" }, "—"),
                el("div", { className: "auto-cost", id: "autoCost" }, "—")
            ])
        ]);

        const cashOutBtn = el(
            "button",
            { className: "cashout-btn", id: "cashOutBtn" },
            [
                span({ className: "co-label" }, "CASH OUT"),
                span({ className: "co-amount", id: "coAmount" }, "—")
            ]
        );
        const cashOutPanel = div({ className: "panel" }, [
            div({ className: "panel-title" }, "Cash Out"),
            cashOutBtn,
            div(
                { className: "hint" },
                "Sells all shares for Q, plus an entropy bonus that grows with hold time. " +
                    "Cooldown: " +
                    Config.CASHOUT_COOLDOWN +
                    "s."
            )
        ]);

        const resetBtn = el(
            "button",
            { className: "ghost", id: "resetBtn" },
            "Reset Save"
        );

        document.body.append(
            hud,
            el("main", { id: "main" }, [
                marketPanel,
                entropyPanel,
                upgradePanel,
                autoPanel,
                cashOutPanel,
                resetBtn
            ])
        );

        initCanvas();
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

    function tradeBtn(kind, id, label, amountId) {
        return el("button", { className: "trade-btn " + kind, id }, [
            span({ className: "btn-label" }, label),
            span({ className: "btn-amount", id: amountId }, "—")
        ]);
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
        const now = Date.now() / 1000;
        const SPAN = 20,
            N = 80,
            pad = 8;
        const ih = H - pad * 2;
        const s = State.get();

        /* sample natural wave */
        const samples = new Array(N + 1);
        let minP = Infinity,
            maxP = -Infinity;
        for (let i = 0; i <= N; i++) {
            const t = now - SPAN + (i / N) * SPAN;
            const p = Market.naturalPrice(t);
            samples[i] = p;
            if (p < minP) minP = p;
            if (p > maxP) maxP = p;
        }

        /* include MA in visible range (it tracks current, always relevant) */
        const ma = Market.movingAverage(now);
        if (ma < minP) minP = ma;
        if (ma > maxP) maxP = ma;

        /* padding for headroom */
        const rawRange = Math.max(1, maxP - minP);
        minP -= rawRange * 0.08;
        maxP += rawRange * 0.08;
        const range = maxP - minP;

        /* reference values */
        const base = Market.basePrice();
        const cur = Market.currentPrice(now);
        const avgCost = s.shares > 0 ? s.costBasis / s.shares : 0;
        const lastBuy = s.shares > 0 ? s.lastBuyPrice : 0;

        /* helper: y coord for a price */
        const yOf = p => H - pad - ((p - minP) / range) * ih;

        ctx.clearRect(0, 0, W, H);

        /* clip to visible area */
        const inRange = p => p >= minP && p <= maxP;

        /* --- base price guide (very faint) --- */
        if (inRange(base)) {
            const y = yOf(base);
            ctx.beginPath();
            ctx.setLineDash([2, 6]);
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.10)";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.setLineDash([]);
        }

        /* --- avg cost line (dashed gold, break-even) --- */
        if (avgCost > 0 && inRange(avgCost)) {
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

        /* --- last buy line (dotted cyan) --- */
        if (
            lastBuy > 0 &&
            inRange(lastBuy) &&
            Math.abs(lastBuy - avgCost) > 0.5
        ) {
            const y = yOf(lastBuy);
            ctx.beginPath();
            ctx.setLineDash([2, 5]);
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.strokeStyle = "rgba(63, 233, 255, 0.45)";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.setLineDash([]);
        }

        /* --- 5-min MA line (solid dim blue) --- */
        if (inRange(ma)) {
            const y = yOf(ma);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.strokeStyle = "rgba(96, 165, 250, 0.55)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        /* --- wave fill --- */
        const pts = samples.map((p, i) => [
            (i / N) * W,
            H - pad - ((p - minP) / range) * ih
        ]);

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

        /* --- wave stroke --- */
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

        /* --- current price head (includes impact) --- */
        const curY = yOf(cur);
        const impact = s.impact;
        const headColor =
            Math.abs(impact) < 0.01
                ? "#4ade80"
                : impact > 0
                  ? "#ffd166"
                  : "#ff3ea5";

        /* impact trace from wave head to cur head */
        const lastPt = pts[pts.length - 1];
        if (Math.abs(impact) > 0.01) {
            ctx.beginPath();
            ctx.moveTo(lastPt[0], lastPt[1]);
            ctx.lineTo(W - 3, curY);
            ctx.strokeStyle = headColor;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 3]);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        /* head dot */
        ctx.beginPath();
        ctx.arc(W - 3, curY, 4, 0, Math.PI * 2);
        ctx.fillStyle = headColor;
        ctx.shadowColor = headColor;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;

        /* out-of-range indicators for avgCost / lastBuy */
        const drawEdgeMarker = (val, color, up) => {
            const x = W - 12;
            const y = up ? pad : H - pad;
            ctx.beginPath();
            ctx.moveTo(x - 4, y + (up ? 6 : -6));
            ctx.lineTo(x + 4, y + (up ? 6 : -6));
            ctx.lineTo(x, y + (up ? 0 : 0));
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
        };
        if (avgCost > 0 && avgCost > maxP)
            drawEdgeMarker(avgCost, "rgba(255, 209, 102, 0.8)", true);
        if (avgCost > 0 && avgCost < minP)
            drawEdgeMarker(avgCost, "rgba(255, 209, 102, 0.8)", false);
    }

    function render() {
        const s = State.get();
        const t = Date.now() / 1000;

        $("#quantaVal").textContent = Format.num(s.quanta);
        $("#entropyVal").textContent = Format.num(s.entropy);
        $("#incomeVal").textContent =
            "+" + Format.num(Config.BASE_INCOME) + "/s";

        const max = Market.maxShares();
        $("#sharesVal").textContent = s.shares + "/" + max;
        const curPrice = Market.currentPrice(t);
        $("#priceVal").textContent = Format.num(curPrice);

        /* ---------- Position stats ---------- */
        const sell1Price = Market.sellPrice(t);
        const ma = Market.movingAverage(t);
        const avgCost = s.shares > 0 ? s.costBasis / s.shares : 0;

        /* Position: total · shares × per-share */
        if (s.shares > 0) {
            $("#posVal").textContent =
                "Ⓠ " +
                Format.num(s.shares * sell1Price) +
                " · " +
                s.shares +
                " × " +
                Format.num(sell1Price);
        } else {
            $("#posVal").textContent = "Ⓠ 0";
        }

        /* P/L: total and percent */
        const pl = Market.unrealizedPL(t);
        const plPct = s.costBasis > 0 ? (pl / s.costBasis) * 100 : 0;
        const plEl = $("#plVal");
        if (s.shares > 0) {
            plEl.textContent =
                (pl >= 0 ? "+" : "−") +
                "Ⓠ " +
                Format.num(Math.abs(pl)) +
                " (" +
                (plPct >= 0 ? "+" : "−") +
                Math.abs(plPct).toFixed(1) +
                "%)";
        } else {
            plEl.textContent = "—";
        }
        plEl.style.color =
            pl > 0.01 ? "var(--good)" : pl < -0.01 ? "var(--surge)" : "";

        /* Impact */
        const impPct = s.impact * 100;
        const impEl = $("#impactVal");
        impEl.textContent = (impPct >= 0 ? "+" : "") + impPct.toFixed(1) + "%";
        impEl.style.color =
            Math.abs(impPct) < 1
                ? ""
                : impPct > 0
                  ? "var(--cost)"
                  : "var(--surge)";

        /* Avg cost: per-share · total */
        if (s.shares > 0) {
            $("#costVal").textContent =
                "Ⓠ " +
                Format.num(avgCost) +
                " /sh · Ⓠ " +
                Format.num(s.costBasis) +
                " tot";
        } else {
            $("#costVal").textContent = "—";
        }

        /* Last buy: per-share · total · age */
        const lastBuyEl = $("#lastBuyVal");
        if (s.lastBuyPrice > 0 && s.lastBuyTotal > 0) {
            const ageSec = (Date.now() - s.lastBuyTime) / 1000;
            const ageStr =
                ageSec < 60
                    ? Math.round(ageSec) + "s"
                    : ageSec < 3600
                      ? Math.round(ageSec / 60) + "m"
                      : Math.round(ageSec / 3600) + "h";
            lastBuyEl.textContent =
                "Ⓠ " +
                Format.num(s.lastBuyPrice) +
                " /sh · " +
                "Ⓠ " +
                Format.num(s.lastBuyTotal) +
                " tot · " +
                ageStr +
                " ago";
        } else {
            lastBuyEl.textContent = "—";
        }

        /* Current: per-share + delta vs MA */
        const vsMa = ma > 0 ? ((curPrice - ma) / ma) * 100 : 0;
        $("#currentVal").textContent =
            "Ⓠ " +
            Format.num(curPrice) +
            " /sh · " +
            (vsMa >= 0 ? "+" : "") +
            vsMa.toFixed(1) +
            "% vs MA";
        $("#currentVal").style.color =
            vsMa < -2 ? "var(--good)" : vsMa > 2 ? "var(--cost)" : "var(--txt)";

        /* MA: per-share only */
        $("#maVal").textContent = "Ⓠ " + Format.num(ma) + " /sh";

        /* Last sell: profit · total · age */
        const lastSellEl = $("#lastSellVal");
        if (s.lastSellTime > 0) {
            const p = s.lastSellProfit;
            const ageSec = (Date.now() - s.lastSellTime) / 1000;
            const ageStr =
                ageSec < 60
                    ? Math.round(ageSec) + "s"
                    : ageSec < 3600
                      ? Math.round(ageSec / 60) + "m"
                      : Math.round(ageSec / 3600) + "h";
            lastSellEl.textContent =
                (p >= 0 ? "+" : "−") +
                "Ⓠ " +
                Format.num(Math.abs(p)) +
                " · " +
                "Ⓠ " +
                Format.num(s.lastSellTotal) +
                " tot · " +
                ageStr +
                " ago";
            lastSellEl.style.color =
                p > 0.01
                    ? "var(--good)"
                    : p < -0.01
                      ? "var(--surge)"
                      : "var(--dim)";
        } else {
            lastSellEl.textContent = "—";
            lastSellEl.style.color = "";
        }

        /* Buy buttons */
        const buy1Price = Market.buyPrice(t);
        const space = max - s.shares;
        const affordMax = Math.floor(s.quanta / buy1Price);
        const maxAmt = Math.min(space, affordMax);
        const canBuy1 = s.shares < max && s.quanta >= buy1Price;

        $("#buy1Cost").textContent = Format.num(buy1Price) + " Q";
        $("#buyMaxCost").textContent =
            maxAmt > 0 ? Format.num(maxAmt * buy1Price) + " Q" : "—";
        $("#buy1").classList.toggle("can", canBuy1);
        $("#buy1").classList.toggle("poor", !canBuy1);
        $("#buyMax").classList.toggle("can", maxAmt > 0);
        $("#buyMax").classList.toggle("poor", maxAmt === 0);

        /* Sell buttons */
        const canSell = s.shares >= 1;
        $("#sell1Gain").textContent = Format.num(sell1Price) + " Q";
        $("#sellAllGain").textContent = canSell
            ? Format.num(s.shares * sell1Price) + " Q"
            : "—";
        $("#sell1").classList.toggle("can", canSell);
        $("#sell1").classList.toggle("poor", !canSell);
        $("#sellAll").classList.toggle("can", canSell);
        $("#sellAll").classList.toggle("poor", !canSell);

        /* Upgrade */
        const upCost = Market.upgradeCost();
        const canUp = s.quanta >= upCost;
        $("#upgCost").textContent = Format.num(upCost) + " Q";
        $("#upgDesc").textContent =
            "+" +
            Config.SHARES_PER_UPGRADE +
            " max shares (LV " +
            s.upgradeLevel +
            ")";
        $("#upgradeBtn").classList.toggle("can", canUp);
        $("#upgradeBtn").classList.toggle("poor", !canUp);

        /* Cash out */
        const check = Market.canCashOut();
        const coBtn = $("#cashOutBtn");
        const coAmt = $("#coAmount");
        if (check.ok) {
            const preview = Market.cashOutPreview(t);
            coAmt.textContent = "+" + Format.num(preview.total) + " Q";
            coBtn.classList.add("can");
            coBtn.classList.remove("poor");
        } else {
            coBtn.classList.remove("can");
            coBtn.classList.add("poor");
            if (check.reason === "cooldown")
                coAmt.textContent = "COOLDOWN " + Math.ceil(check.left) + "s";
            else if (check.reason === "low-entropy")
                coAmt.textContent = "NEED Ξ " + Config.CASHOUT_MIN_ENTROPY;
            else if (check.reason === "no-shares")
                coAmt.textContent = "NO SHARES";
        }

        /* Automation */
        const unlocked = Market.autoUnlocked();
        $("#autoLock").style.display = unlocked ? "none" : "block";
        $("#autoBody").style.display = unlocked ? "block" : "none";

        if (unlocked) {
            const buyMin = Market.autoBuyMin(s.upgradeLevel);
            const sellMax = Market.autoSellMax(s.upgradeLevel);

            const buySlider = $("#autoBuySlider");
            const sellSlider = $("#autoSellSlider");
            buySlider.min = buyMin;
            sellSlider.max = sellMax;

            buySlider.value = Math.max(
                buyMin,
                Math.min(Config.AUTO_BUY_MAX, s.autoBuyThreshold)
            );
            sellSlider.value = Math.min(
                sellMax,
                Math.max(Config.AUTO_SELL_MIN, s.autoSellThreshold)
            );

            const ma = Market.movingAverage(t);
            const buyTrigger = ma * (s.autoBuyThreshold / 100);
            const sellTrigger = ma * (s.autoSellThreshold / 100);

            $("#autoBuyValue").textContent = s.autoBuyThreshold + "%";
            $("#autoSellValue").textContent = s.autoSellThreshold + "%";
            $("#autoBuyHint").textContent =
                "buys below Ⓠ " + Format.num(buyTrigger);
            $("#autoSellHint").textContent =
                "sells above Ⓠ " + Format.num(sellTrigger);

            const buyToggle = $("#autoBuyToggle");
            buyToggle.textContent =
                "AUTO-BUY: " + (s.autoBuyEnabled ? "ON" : "OFF");
            buyToggle.classList.toggle("on", s.autoBuyEnabled);

            const sellToggle = $("#autoSellToggle");
            sellToggle.textContent =
                "AUTO-SELL: " + (s.autoSellEnabled ? "ON" : "OFF");
            sellToggle.classList.toggle("on", s.autoSellEnabled);
        }

        /* ----/* ---------- Entropy panel ---------- */
        const entRates = Market.effectiveEntropyRatePerMin();
        const autoEnabled = s.autoBuyEnabled || s.autoSellEnabled;

        $("#entropyBig").textContent = Format.num(s.entropy);

        $("#entBaseline").textContent =
            "+" + entRates.baseline.toFixed(1) + " /min";

        const entNet = $("#entNet");
        entNet.textContent =
            (entRates.effective >= 0 ? "+" : "−") +
            Math.abs(entRates.effective).toFixed(2) +
            " /min";
        entNet.style.color =
            entRates.effective > 0.01
                ? "var(--good)"
                : entRates.effective < -0.01
                  ? "var(--surge)"
                  : "var(--dim)";

        const entAuto = $("#entAuto");
        if (entRates.auto < -0.005) {
            entAuto.textContent =
                "−" + Math.abs(entRates.auto).toFixed(2) + " /min";
            entAuto.style.color = "var(--surge)";
        } else {
            entAuto.textContent = "off";
            entAuto.style.color = "var(--dim)";
        }

        /* Bulk upgrade card */
        const bulkCost = Market.bulkUpgradeCost();
        const bulkLv = s.bulkLevel || 0;
        const bulkMaxed = Market.bulkMaxed();
        const canBulk = !bulkMaxed && s.quanta >= bulkCost;

        $("#bulkDesc").textContent = bulkMaxed
            ? "MAXED at " + Market.bulkTradeSize() + " shares/fire"
            : "LV " +
              bulkLv +
              " → " +
              Market.bulkTradeSize() +
              " → " +
              Config.AUTO_BULK_TIERS[bulkLv + 1] +
              " shares/fire";
        $("#bulkCost").textContent = bulkMaxed
            ? "—"
            : Format.num(bulkCost) + " Q";
        $("#bulkUpgradeBtn").classList.toggle("can", canBulk);
        $("#bulkUpgradeBtn").classList.toggle("poor", !canBulk);

        /* Auto panel bulk display */
        if (unlocked) {
            const bulkNow = Market.bulkTradeSize();
            const entropyPerShare =
                Config.ENTROPY_PER_TRADE * -Config.AUTO_ENTROPY_MULT;
            const costPerTrade = bulkNow * entropyPerShare;
            const capRemaining = Math.max(
                0,
                Config.AUTO_ENTROPY_CAP_PER_MIN - s.autoEntropyWindow
            );
            const capped = capRemaining < costPerTrade - 0.001;

            $("#autoBulk").textContent =
                "Bulk: ×" +
                bulkNow +
                " shares/fire" +
                (capped ? "  ·  CAPPED" : "");
            $("#autoBulk").style.color = capped ? "var(--surge)" : "var(--dim)";

            $("#autoCost").textContent =
                "−" +
                costPerTrade.toFixed(2) +
                " Ξ/trade" +
                " · cap −" +
                Config.AUTO_ENTROPY_CAP_PER_MIN.toFixed(1) +
                "/min";
        }

        drawChart();
    }

    function toast(msg) {
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2800);
    }

    function pulseAuto(kind) {
        const el = kind === "buy" ? $("#autoBuyToggle") : $("#autoSellToggle");
        if (!el) return;
        el.classList.remove("fired");
        void el.offsetWidth;
        el.classList.add("fired");
        setTimeout(() => el.classList.remove("fired"), 400);
    }

    return { build, render, toast, pulseAuto, $ };
})();
