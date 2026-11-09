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

        /* HUD: PORTFOLIO label on top, big Q number below with suffix */
        const hud = el("header", { id: "hud" }, [
            div({ className: "qlabel-top" }, "PORTFOLIO"),
            div({ className: "qval" }, [
                span({ id: "bigQ" }, "0"),
                span({ className: "qval-unit" }, " Q")
            ]),
            div({ className: "hud-sub" }, [
                pill("ENTROPY", "entropyPill", "entropy"),
                pill("INCOME", "incomePill", "income"),
                pill("SHARES", "sharesPill", "shares")
            ])
        ]);

        /* Market chips */
        const chips = el("div", {
            className: "market-chips",
            id: "marketChips"
        });
        for (const m of Config.MARKETS) {
            const btn = el(
                "button",
                {
                    className: "market-chip",
                    onClick: () => {
                        State.get().activeMarket = m.id;
                        render();
                    }
                },
                [el("b", {}, m.name), el("small", { id: "chip-" + m.id }, "—")]
            );
            chips.appendChild(btn);
            marketChipEls[m.id] = btn;
        }

        canvas = el("canvas", { id: "chart" });

        const tradeBlock = el("div", { className: "trade-grid" }, [
            btn("BUY 1", "buy1", "buy"),
            btn("BUY MAX", "buyMax", "buy"),
            btn("SELL 1", "sell1", "sell"),
            btn("SELL ALL", "sellAll", "sell")
        ]);

        const statRows = el("div", { className: "stat-block" }, [
            row("Wallet", "walletRow"),
            row("Position", "positionRow"),
            row("Avg cost", "avgCostRow"),
            row("Last sell", "lastSellRow"),
            div({ className: "stat-sep" }),
            row("Current", "currentRow"),
            row("MA (5m)", "maRow"),
            div({ className: "stat-sep" }),
            row("Lifetime cash outs", "lifetimeRow")
        ]);

        const activeTitle = el("div", { className: "panel-title" }, "Market");
        const activeSubtitle = el(
            "div",
            { className: "market-name", id: "activeMarketName" },
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
            [
                span({ className: "co-label" }, "CASH OUT"),
                span({ className: "co-amount", id: "cashOutAmount" }, "—")
            ]
        );
        const cashOutMeta = el(
            "div",
            { className: "cashout-meta", id: "cashOutMeta" },
            "—"
        );
        const milestoneRow = el(
            "div",
            { className: "milestone-row", id: "milestoneRow" },
            "—"
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
                                "? Shares and lifetime progress are preserved, q will be refilled."
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

        const activePanel = el("div", { className: "panel market-panel" }, [
            activeTitle,
            activeSubtitle,
            el("div", { className: "chart-wrap" }, [canvas]),
            statRows,
            tradeBlock,
            cashOutBtn,
            cashOutMeta,
            milestoneRow,
            resetMarketBtn,
            upgradeBtn
        ]);

        /* Portfolio panel */
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
            "Passive income grows with lifetime cash outs. Each market's multiplier grows with profitable trades."
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
        const portfolioPanel = el("div", { className: "panel" }, [
            el("div", { className: "panel-title" }, "Portfolio"),
            contributionRows,
            portfolioTotal,
            portfolioHint,
            boostBtn
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
        cashOut: () => {},
        upgradePortfolio: () => {},
        resetMarket: () => {},
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

        const rawRange = Math.max(1, maxP - minP);
        minP -= rawRange * 0.08;
        maxP += rawRange * 0.08;
        const range = maxP - minP;

        const yOf = p => H - pad - ((p - minP) / range) * ih;
        ctx.clearRect(0, 0, W, H);

        /* avg cost line */
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

        /* MA line */
        if (ma >= minP && ma <= maxP) {
            const y = yOf(ma);
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(W, y);
            ctx.strokeStyle = "rgba(96, 165, 250, 0.55)";
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        /* wave fill + stroke */
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

        /* head */
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

        /* header */
        $("#bigQ").textContent = Format.num(s.Q);
        $("#entropyPill").textContent = Format.num(s.entropy);
        $("#incomePill").textContent = "+" + Format.num(Market.totalPassive()) + "/s";
        $("#sharesPill").textContent = Market.totalShares().toString();

        /* chips */
        for (const m of Config.MARKETS) {
            const unlocked = Market.isUnlocked(m.id);
            const chip = marketChipEls[m.id];
            chip.classList.toggle("active", m.id === id);
            chip.classList.toggle("locked", !unlocked);
            const sub = $("#chip-" + m.id);
            if (unlocked) {
                sub.textContent =
                    "×" +
                    Format.plain(Market.marketMultiplier(m.id)) +
                    " · " +
                    Format.num(Market.marketPassive(m.id)) +
                    " Q/s";
            } else {
                sub.textContent = "unlock " + Format.num(m.unlockAt) + " Q";
            }
        }

        /* active market header */
        const mDef = Market.def(id);
        $("#activeMarketName").textContent =
            mDef.name +
            " · ×" +
            Format.plain(Market.marketMultiplier(id)) +
            " multiplier · " +
            Format.num(Market.marketPassive(id)) +
            " Q/s passive";

        /* stats */
        $("#walletRow").textContent = Format.num(mk.q) + " q";
        $("#positionRow").textContent =
            mk.holding +
            "/" +
            mk.shares +
            " held" +
            (mk.holding > 0
                ? " · Ⓠ " + Format.num(mk.costBasis) + " cost"
                : "");
        const avg = mk.holding > 0 ? mk.costBasis / mk.holding : 0;
        $("#avgCostRow").textContent =
            avg > 0 ? Format.num(avg) + " Q/unit" : "—";

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

        /* Current price + MA */
        const buyP = Market.buyPrice(id, t);
        const sellP = Market.sellPrice(id)(t);
        const ma = Market.movingAverage(id, t);
        const curP = Market.naturalPrice(id, t);

        $("#currentRow").textContent = "Ⓠ " + Format.num(curP);
        const vsMa = ma > 0 ? ((curP - ma) / ma) * 100 : 0;
        const maText =
            "Ⓠ " +
            Format.num(ma) +
            " · " +
            (vsMa >= 0 ? "+" : "") +
            vsMa.toFixed(1) +
            "% " +
            (vsMa >= 0 ? "over" : "under");
        $("#maRow").textContent = maText;
        $("#maRow").style.color =
            vsMa < -2 ? "var(--good)" : vsMa > 2 ? "var(--cost)" : "var(--txt)";

        /* Lifetime cash outs */
        $("#lifetimeRow").textContent =
            Format.num(mk.lifetimeCashOut) +
            " Q · " +
            mk.cashOutCount +
            " cash outs";

        /* trade buttons */
        const canBuy = mk.holding < mk.shares && mk.q >= buyP;
        const canSell = mk.holding > 0;

        $("#buy1Amount").textContent = "Ⓠ " + Format.num(buyP);
        const maxAfford = Math.min(
            mk.shares - mk.holding,
            Math.floor(mk.q / buyP)
        );
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
        const coAmt = $("#cashOutAmount");
        if (cCheck.ok) {
            const val = Market.cashOutValue(id);
            coAmt.textContent = "+" + Format.num(val) + " Q";
            coBtn.classList.add("can");
            coBtn.classList.remove("poor");
        } else {
            coBtn.classList.remove("can");
            coBtn.classList.add("poor");
            coAmt.textContent = "COOLDOWN " + Math.ceil(cCheck.left) + "s";
        }

        /* cash out meta — lifetime + milestone progress */
        const prog = Market.nextMilestoneProgress(id);
        $("#cashOutMeta").textContent =
            "Lifetime: " +
            Format.num(mk.lifetimeCashOut) +
            " Q · " +
            prog.current +
            "/" +
            prog.required +
            " to milestone";
        $("#cashOutMeta").style.color = "";
        if (prog.toNext === 1) $("#cashOutMeta").style.color = "var(--cost)";

        /* milestone row — permanent bonus + next bonus info */
        const mileBonusPct = Math.round(mk.milestoneBonus * 100);
        const nextBonusMult = Config.MILESTONE_BONUS_MULT + 1;
        $("#milestoneRow").textContent =
            mk.cashOutCount === 0
                ? "Next milestone in " +
                  prog.toNext +
                  " · pays ×" +
                  nextBonusMult +
                  " cash out + permanent +2%"
                : "Permanent bonus: +" +
                  mileBonusPct +
                  "% · next in " +
                  prog.toNext +
                  " cash out" +
                  (prog.toNext === 1 ? "" : "s");

        /* market reset — show only when stuck */
        const rCheck = Market.canReset(id);
        const rBtn = $("#resetMarketBtn");
        if (rCheck.ok) {
            rBtn.classList.remove("hidden");
            $("#resetMarketAmount").textContent =
                "+" + Format.num(Market.resetAmount()) + " q";
        } else {
            rBtn.classList.add("hidden");
        }

        /* upgrade shares */
        const upCost = Market.shareUpgradeCost(id);
        $("#upgShareDesc").textContent =
            mk.shares +
            " → " +
            (mk.shares + 1) +
            " shares · ×" +
            Format.plain(1 + (mk.shares + 1) * Config.SHARE_MULT_BONUS) +
            " cash out mult";
        $("#upgShareCost").textContent = Format.num(upCost) + " q";
        $("#upgradeShareBtn").classList.toggle("can", mk.q >= upCost);
        $("#upgradeShareBtn").classList.toggle("poor", mk.q < upCost);

        /* portfolio rows */
        const rows = [];
        for (const m of Config.MARKETS) {
            const unlocked = Market.isUnlocked(m.id);
            if (!unlocked) {
                rows.push(
                    div({ className: "portfolio-row locked" }, [
                        span({ className: "pr-name" }, m.name),
                        span(
                            { className: "pr-info" },
                            "unlock " + Format.num(m.unlockAt) + " Q"
                        )
                    ])
                );
                continue;
            }
            const mk2 = s.markets[m.id];
            const mult = Market.marketMultiplier(m.id);
            const passive = Market.marketPassive(m.id);
            const p2 = Market.nextMilestoneProgress(m.id);
            rows.push(
                div({ className: "portfolio-row" }, [
                    span({ className: "pr-name" }, m.name),
                    span({ className: "pr-info" }, [
                        "×" +
                            Format.plain(mult) +
                            " · " +
                            Format.num(passive) +
                            " Q/s · " +
                            p2.current +
                            "/" +
                            p2.required
                    ])
                ])
            );
        }
        $("#portfolioRows").replaceChildren(...rows);

        /* portfolio total */
        $("#portfolioTotal").textContent =
            "Total passive: " + Format.num(Market.totalPassive()) + " Q/s";

        /* portfolio boost */
        const bCost = Market.portfolioBoostCost();
        const bLv = s.portfolioBoost;
        $("#boostDesc").textContent =
            "LV " +
            bLv +
            " · cash outs and passive ×" +
            Format.plain(Market.portfolioBoostMult());
        $("#boostCost").textContent = Format.num(bCost) + " Q";
        $("#portfolioBoostBtn").classList.toggle("can", s.Q >= bCost);
        $("#portfolioBoostBtn").classList.toggle("poor", s.Q < bCost);

        drawChart();
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
