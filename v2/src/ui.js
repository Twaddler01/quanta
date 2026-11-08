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
            row("Avg cost", "costVal"),
            row("Impact", "impactVal")
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
        const upgradePanel = div({ className: "panel" }, [
            div({ className: "panel-title" }, "Upgrades"),
            upgradeBtn
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
                upgradePanel,
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
        const cur = Market.currentPrice(now);
        if (cur < minP) minP = cur;
        if (cur > maxP) maxP = cur;
        const range = Math.max(1, maxP - minP);
        minP -= range * 0.05;
        maxP += range * 0.05;

        ctx.clearRect(0, 0, W, H);

        // Baseline guide (base price)
        const baseY =
            H - pad - ((Market.basePrice() - minP) / (maxP - minP)) * ih;
        ctx.beginPath();
        ctx.setLineDash([2, 4]);
        ctx.moveTo(0, baseY);
        ctx.lineTo(W, baseY);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.10)";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);

        const pts = samples.map((p, i) => [
            (i / N) * W,
            H - pad - ((p - minP) / (maxP - minP)) * ih
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

        // Head marker (current price = includes impact)
        const curY = H - pad - ((cur - minP) / (maxP - minP)) * ih;
        const impact = State.get().impact;
        const headColor =
            Math.abs(impact) < 0.01
                ? "#4ade80"
                : impact > 0
                  ? "#ffd166"
                  : "#ff3ea5";
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
        ctx.beginPath();
        ctx.arc(W - 3, curY, 4, 0, Math.PI * 2);
        ctx.fillStyle = headColor;
        ctx.shadowColor = headColor;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;
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
        $("#priceVal").textContent = Format.num(Market.currentPrice(t));

        $("#posVal").textContent =
            Format.num(s.shares * Market.sellPrice(t)) + " Q";

        const pl = Market.unrealizedPL(t);
        const plEl = $("#plVal");
        plEl.textContent = (pl >= 0 ? "+" : "") + Format.num(pl) + " Q";
        plEl.style.color =
            pl > 0.01 ? "var(--good)" : pl < -0.01 ? "var(--surge)" : "";

        const avgCost = s.shares > 0 ? s.costBasis / s.shares : 0;
        $("#costVal").textContent =
            s.shares > 0 ? Format.num(avgCost) + " Q" : "—";

        const impPct = s.impact * 100;
        const impEl = $("#impactVal");
        impEl.textContent = (impPct >= 0 ? "+" : "") + impPct.toFixed(1) + "%";
        impEl.style.color =
            Math.abs(impPct) < 1
                ? ""
                : impPct > 0
                  ? "var(--cost)"
                  : "var(--surge)";

        // Buy
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

        // Sell
        const sell1Price = Market.sellPrice(t);
        const canSell = s.shares >= 1;
        $("#sell1Gain").textContent = Format.num(sell1Price) + " Q";
        $("#sellAllGain").textContent = canSell
            ? Format.num(s.shares * sell1Price) + " Q"
            : "—";
        $("#sell1").classList.toggle("can", canSell);
        $("#sell1").classList.toggle("poor", !canSell);
        $("#sellAll").classList.toggle("can", canSell);
        $("#sellAll").classList.toggle("poor", !canSell);

        // Upgrade
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

        // Cash out
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

        drawChart();
    }

    function toast(msg) {
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2800);
    }

    return { build, render, toast, $ };
})();
