import { el, div, span, on } from "./dom.js";
import { Config } from "./config.js";
import { State } from "./state.js";
import { Calc } from "./calc.js";
import { Format } from "./format.js";
import { Wave } from "./wave.js";
import { clock } from "./clock.js";
import { mountToast, toast as toastMsg } from "./toast.js";
import { WaveScope } from "./waveScope.js";
import { Features } from "./features.js";
import { Save } from "./save.js";

export const UI = (() => {
    const $ = sel => document.querySelector(sel);
    const refs = { up: {}, mod: {}, cUp: {}, feat: {}, milestones: [] };
    const featureViews = {}; // id -> mounted view
    let activeViewId = "observe";
    let lastFormulaSig = "";
    const NBSP = "\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0";

    let actions = { buy() {}, consume() {}, collapse() {}, reset() {} };
    function setActions(a) {
        actions = Object.assign({}, actions, a);
    }

    /* ================= Shell ================= */

    function statRow(label, id, initial) {
        return div({ className: "stat-row" }, [
            span({}, label),
            el("b", { id }, initial)
        ]);
    }

    function buildHud() {
        return el("header", { id: "hud" }, [
            div({ className: "qval", id: "quantaVal" }, "0"),
            div({ className: "qlabel" }, "QUANTA"),
            div({ className: "hud-sub" }, [
                div({ className: "pill q" }, [
                    span({ className: "k" }, "ΔQ/TAP"),
                    span({ className: "v", id: "tapVal" }, "+1.00")
                ]),
                div({ className: "pill q" }, [
                    span({ className: "k" }, "Q/S"),
                    span({ className: "v", id: "qpsVal" }, "+0.00")
                ]),
                div({ className: "pill c" }, [
                    span({ className: "k" }, "𝒞"),
                    span({ className: "v", id: "cohVal" }, "0")
                ]),
                div({ className: "pill s" }, [
                    span({ className: "k" }, "SURGE"),
                    span({ className: "v", id: "surgeVal" }, "×1.00")
                ]),
                div({ className: "pill ex", id: "exchangePill" }, [
                    span({ className: "k" }, "Ⓠ"),
                    span({ className: "v", id: "exchangePillVal" }, "1.00")
                ]),
                div({ className: "pill e", id: "entropyPill" }, [
                    span({ className: "k" }, "Ξ"),
                    span({ className: "v", id: "entropyPillVal" }, "0")
                ])
            ])
        ]);
    }

    function buildSurgePanel() {
        return div({ className: "panel surge-panel", id: "surgePanel" }, [
            div({ className: "surge-title-row" }, [
                div(
                    { className: "panel-title", style: { margin: 0 } },
                    "Quantum Surge"
                ),
                span({ className: "surge-mult", id: "surgeMult" }, "×1.00")
            ]),
            el("button", { className: "consume-btn", id: "consumeBtn" }, [
                span({ className: "consume-label" }, [
                    "CONSUME ",
                    el("b", { id: "consumeCost" }, "10"),
                    " Q"
                ]),
                span({ className: "consume-gain", id: "consumeGain" }, "+0.00")
            ]),
            div({ className: "surge-meta" }, [
                span({}, ["pool ", el("b", { id: "surgePool" }, "0.00")]),
                span({}, "decays 10%/s · boosts QPS")
            ])
        ]);
    }

    function buildObserveView() {
        const tapBtn = el("button", { id: "tapBtn", "aria-label": "Observe" }, [
            span({ className: "tap-glyph" }, "Ψ"),
            span({ className: "tap-text" }, "OBSERVE")
        ]);
        const floaters = div({ className: "floatHost", id: "floaters" });
        const tapWrap = div({ className: "tapWrap" }, [tapBtn, floaters]);

        const formulaPanel = div({ className: "panel" }, [
            div({ className: "panel-title" }, "Live Breakdown"),
            div({ className: "formula-table", id: "formulaTable" }),
            div({ className: "formula", id: "formula" })
        ]);

        const telemetry = div({ className: "panel" }, [
            div({ className: "panel-title" }, "Telemetry"),
            statRow("Total Quanta harvested", "statTotal", "0"),
            statRow("Observations performed", "statTaps", "0"),
            statRow("Effective ΔQ/tap", "statTapGain", "1.00"),
            statRow("Global resonance", "statGlobal", "×1.00"),
            statRow("Collapses performed", "statCollapses", "0"),
            statRow("Uptime", "statTime", "0s")
        ]);

        const resetBtn = el(
            "button",
            { className: "ghost", id: "resetBtn" },
            "Reset Save"
        );
        const hint = div(
            { className: "hint" },
            "Surge multiplies your QPS — buy Vacuum Collectors so it has something to multiply."
        );

        return el(
            "section",
            { className: "view active", dataset: { view: "observe" } },
            [
                tapWrap,
                buildSurgePanel(),
                formulaPanel,
                telemetry,
                resetBtn,
                hint
            ]
        );
    }

    function buildUpgradesView() {
        return el(
            "section",
            { className: "view", dataset: { view: "upgrades" } },
            [
                div({ className: "list", id: "upgradeList" }),
                div(
                    { className: "hint" },
                    "Upgrades cost Quanta (cyan) or Coherence (violet). Feature upgrades appear below the core list."
                )
            ]
        );
    }

    function buildCoherenceView() {
        const canvas = el("canvas", { id: "waveCanvas" });
        const cohFloaters = div({ className: "floatHost", id: "cohFloaters" });
        const waveWrap = div({ className: "wave-wrap" }, [canvas, cohFloaters]);

        const waveQuality = span(
            { className: "wq-val", id: "waveQuality" },
            "×1.00"
        );
        const boostChip = span({ className: "wq-boost", id: "waveBoost" }, "");
        const readout = div({ className: "wave-readout" }, [
            span({ className: "wq-label" }, "WAVE QUALITY"),
            div({ className: "wq-right" }, [waveQuality, boostChip])
        ]);

        const collapseBtn = el(
            "button",
            { className: "collapse-btn", id: "collapseBtn" },
            [
                span({ className: "cb-main" }, "COLLAPSE"),
                span({ className: "cb-gain", id: "collapseGain" }, "+0 𝒞"),
                span({ className: "cb-cost" }, [
                    "cost ",
                    span({ id: "collapseCost" }, "25"),
                    " Q"
                ])
            ]
        );
        const wavePanel = div({ className: "panel" }, [
            div({ className: "panel-title" }, "Coherence Wave"),
            waveWrap,
            readout,
            collapseBtn
        ]);
        const phasePanel = div({ className: "panel" }, [
            div({ className: "panel-title" }, "Phase Upgrades"),
            div({ className: "list", id: "phaseList" })
        ]);
        const hint = div(
            { className: "hint" },
            "Coherence yield = base × (0.1 + 0.9 × wave). Time your collapses into the peaks. Stabilizers raise the wave floor, so troughs hurt less."
        );

        return el(
            "section",
            { className: "view", dataset: { view: "coherence" } },
            [wavePanel, phasePanel, hint]
        );
    }

    function buildModifiersView() {
        return el(
            "section",
            { className: "view", dataset: { view: "modifiers" } },
            [
                div({ className: "list", id: "modifierList" }),
                div(
                    { className: "hint" },
                    "Weighted modifiers: each level adds a fixed fraction to its channel. Ψ → observation, Φ → automation, Λ → every channel."
                )
            ]
        );
    }

    function buildEntropyView() {
        const headline = div({ className: "entropy-headline" }, [
            span({ className: "entropy-val", id: "entropyVal" }, "0"),
            span({ className: "entropy-sym" }, "Ξ")
        ]);
        const meta = div({ className: "entropy-meta" }, [
            span({ className: "k" }, "rate"),
            span({ className: "v", id: "entropyRate" }, "+0.00/s"),
            span({ className: "k" }, "multiplier"),
            span({ className: "v", id: "entropyMult" }, "×1.00")
        ]);
        const panel = div({ className: "panel entropy-panel" }, [
            div({ className: "panel-title" }, "System Disorder"),
            headline,
            meta
        ]);
        const milestoneList = div({
            className: "list",
            id: "entropyMilestones"
        });
        const milestonePanel = div({ className: "panel" }, [
            div({ className: "panel-title" }, "Milestones"),
            milestoneList
        ]);
        const hint = div(
            { className: "hint" },
            "Entropy grows from the breadth of your build — every upgrade level and every collapse feeds it. It is never spent; it only gates and amplifies."
        );
        return el(
            "section",
            {
                className: "view",
                dataset: { view: "entropy" },
                id: "entropyView"
            },
            [panel, milestonePanel, hint]
        );
    }

    function buildViews() {
        const base = [
            buildObserveView(),
            buildUpgradesView(),
            buildCoherenceView(),
            buildModifiersView(),
            buildEntropyView()
        ];

        /* feature views */
        const featureEls = [];
        for (const f of Features.all()) {
            for (const v of f.views || []) {
                const mounted = v.mount({ UI: api, Save, Calc });
                featureViews[v.id] = mounted;
                featureEls.push(mounted.element);
            }
        }

        return el("main", { id: "views" }, [...base, ...featureEls]);
    }

    function buildTabs() {
        const base = [
            ["observe", "◉", "OBSERVE"],
            ["upgrades", "⚙", "UPGRADES"],
            ["coherence", "∿", "COHERENCE"],
            ["modifiers", "Ψ", "MODIFIERS"],
            ["entropy", "Ξ", "ENTROPY"]
        ];
        const featureTabs = [];
        for (const f of Features.all()) {
            for (const v of f.views || []) {
                featureTabs.push({
                    key: v.id,
                    icon: v.icon,
                    label: v.label,
                    featureId: f.id
                });
            }
        }

        const tabs = [];
        base.forEach(([key, icon, label], i) => {
            tabs.push(
                el(
                    "button",
                    {
                        className:
                            "tab" +
                            (i === 0 ? " active" : "") +
                            (key === "entropy" ? " entropy-tab" : ""),
                        dataset: { tab: key }
                    },
                    [span({ className: "ic" }, icon), span({}, label)]
                )
            );
        });
        featureTabs.forEach(t => {
            tabs.push(
                el(
                    "button",
                    {
                        className: "tab",
                        dataset: { tab: t.key, feature: t.featureId }
                    },
                    [span({ className: "ic" }, t.icon), span({}, t.label)]
                )
            );
        });

        const inner = el("div", { id: "tabs" }, tabs);
        const fadeL = el("div", {
            className: "nav-fade left",
            id: "tabFadeLeft"
        });
        const fadeR = el("div", {
            className: "nav-fade right",
            id: "tabFadeRight"
        });

        return el("div", { id: "tabs-wrap" }, [fadeL, fadeR, inner]);
    }

    function buildToastNode() {
        return div({ id: "toast" });
    }

    /* ================= Tab scrolling ================= */

    function updateTabScrollState() {
        const tabs = document.getElementById("tabs");
        const fadeL = document.getElementById("tabFadeLeft");
        const fadeR = document.getElementById("tabFadeRight");
        if (!tabs || !fadeL || !fadeR) return;

        const overflowing = tabs.scrollWidth > tabs.clientWidth + 1;
        const atStart = tabs.scrollLeft <= 2;
        const atEnd =
            tabs.scrollLeft + tabs.clientWidth >= tabs.scrollWidth - 2;

        tabs.classList.toggle("fits", !overflowing);
        fadeL.classList.toggle("visible", overflowing && !atStart);
        fadeR.classList.toggle("visible", overflowing && !atEnd);
    }

    function centerTab(tab) {
        const tabs = document.getElementById("tabs");
        if (!tabs || !tab) return;
        const tabsRect = tabs.getBoundingClientRect();
        const tabRect = tab.getBoundingClientRect();
        const target =
            tabs.scrollLeft +
            (tabRect.left - tabsRect.left) -
            (tabsRect.width - tabRect.width) / 2;
        tabs.scrollTo({ left: Math.max(0, target), behavior: "smooth" });
    }

    /* ================= Cards ================= */

    function makeCard(container, entry) {
        const { def, kind, currency, featureId } = entry;
        const lvB = el("b", {}, "0");
        const lvSpan = span({ className: "card-lv" }, ["LV ", lvB]);

        const nameChildren = def.sym
            ? [span({ className: "sym" }, def.sym), " ", def.name]
            : [def.name];
        const nameSpan = span({ className: "card-name" }, nameChildren);

        const top = div({ className: "card-top" }, [nameSpan, lvSpan]);
        const flavor = div({ className: "card-flavor" }, def.flavor);
        const effect = div({ className: "card-effect" });
        const costNum = span({});
        const suffix = currency === "coherence" ? " 𝒞" : " Q";
        const cost = div({ className: "card-cost" }, [costNum, suffix]);

        const cls = "card" + (currency === "coherence" ? " coh" : "");
        const btn = el(
            "button",
            {
                className: cls,
                id: kind + "-" + def.id,
                dataset: featureId ? { feature: featureId } : undefined,
                onClick: () => actions.buy(def.id, kind)
            },
            [top, flavor, effect, cost]
        );

        container.appendChild(btn);
        refs[kind][def.id] = {
            el: btn,
            lv: lvB,
            effect,
            cost: costNum,
            def,
            currency,
            featureId
        };
    }

    function buildEntropyMilestones() {
        const list = $("#entropyMilestones");
        refs.milestones = [];
        for (const ms of Config.ENTROPY.milestones) {
            const dot = span({ className: "dot" });
            const label = span({ className: "label" }, ms.label);
            const at = span({ className: "at" }, "Ξ " + Format.num(ms.at));
            const row = div({ className: "milestone" }, [dot, label, at]);
            list.appendChild(row);
            refs.milestones.push({ el: row, at: ms.at });
        }
    }

    function buildFeatureCards() {
        const list = $("#upgradeList");
        list.querySelectorAll(".card[data-feature]").forEach(n => n.remove());
        refs.feat = {};
        for (const f of Features.all()) {
            for (const def of f.cards || []) {
                makeCard(list, {
                    def,
                    kind: "feat",
                    currency: def.currency || "quanta",
                    featureId: f.id
                });
            }
        }
    }

    function build() {
        const toastNode = buildToastNode();
        document.body.append(buildHud(), buildViews(), buildTabs(), toastNode);
        mountToast(toastNode);

        for (const def of Config.UPGRADES)
            makeCard($("#upgradeList"), {
                def,
                kind: "up",
                currency: "quanta"
            });
        for (const def of Config.MODIFIERS)
            makeCard($("#modifierList"), {
                def,
                kind: "mod",
                currency: "quanta"
            });
        for (const def of Config.PHASE_UPGRADES)
            makeCard($("#phaseList"), {
                def,
                kind: "cUp",
                currency: "coherence"
            });

        buildEntropyMilestones();
        buildFeatureCards();
        refreshEntropyVisibility();

        /* Re-render feature cards on registry change (views need a reload). */
        Features.onChange(() => {
            buildFeatureCards();
            render();
        });

        /* Initial fade/overflow check — after layout, and again after
           fonts settle (which can change tab widths). */
        requestAnimationFrame(updateTabScrollState);
        if (document.fonts?.ready) {
            document.fonts.ready.then(updateTabScrollState);
        }
    }

    /* ================= Feedback ================= */

    function flash(domId) {
        const node = document.getElementById(domId);
        if (!node) return;
        node.classList.remove("flash");
        void node.offsetWidth;
        node.classList.add("flash");
        setTimeout(() => node.classList.remove("flash"), 420);
    }

    function floater(host, text, cls) {
        if (!host) return;
        if (host.childElementCount > 26) host.firstElementChild.remove();
        const node = div(
            {
                className: "floater" + (cls ? " " + cls : ""),
                style: { left: 42 + Math.random() * 16 + "%" }
            },
            text
        );
        node.style.setProperty("--dx", Math.random() * 70 - 35 + "px");
        node.addEventListener("animationend", () => node.remove());
        host.appendChild(node);
    }

    const toast = toastMsg;

    /* ================= Entropy ================= */

    function refreshEntropyVisibility() {
        const unlocked = Calc.entropyUnlocked();
        document
            .querySelector('.tab[data-tab="entropy"]')
            ?.classList.toggle("revealed", unlocked);
        $("#entropyPill")?.classList.toggle("revealed", unlocked);
        /* Entropy tab reveal changes tab count → may change overflow. */
        updateTabScrollState();
    }

    function renderEntropy() {
        const s = State.get();
        if (!Calc.entropyUnlocked()) return;
        const entEl = $("#entropyVal");
        if (!entEl) return;
        entEl.textContent = Format.precise(s.entropy || 0);
        $("#entropyRate").textContent =
            "+" + Format.plain(Calc.entropyRate()) + "/s";
        $("#entropyMult").textContent = "×" + Format.plain(Calc.entropyMult());
        $("#entropyPillVal").textContent = Format.precise(s.entropy || 0);
        for (const m of refs.milestones)
            m.el.classList.toggle("done", (s.entropy || 0) >= m.at);
    }

    /* ================= Renderers ================= */

    function renderCards() {
        const s = State.get();

        for (const def of Config.UPGRADES) {
            const r = refs.up[def.id];
            const lv = s.up[def.id] || 0;
            const cost = def.cost(lv);
            r.lv.textContent = lv;
            r.effect.textContent = def.effect(lv);
            r.cost.textContent = Format.num(cost);
            r.el.classList.toggle("can", s.quanta >= cost);
            r.el.classList.toggle("poor", s.quanta < cost);
        }
        for (const def of Config.MODIFIERS) {
            const r = refs.mod[def.id];
            const lv = s.mod[def.id] || 0;
            const cost = def.cost(lv);
            r.lv.textContent = lv;
            r.effect.textContent =
                def.sym +
                " ×" +
                Format.plain(1 + def.weight * lv) +
                "  →  ×" +
                Format.plain(1 + def.weight * (lv + 1));
            r.cost.textContent = Format.num(cost);
            r.el.classList.toggle("can", s.quanta >= cost);
            r.el.classList.toggle("poor", s.quanta < cost);
        }
        for (const def of Config.PHASE_UPGRADES) {
            const r = refs.cUp[def.id];
            const lv = s.cUp[def.id] || 0;
            const cost = def.cost(lv);
            r.lv.textContent = lv;
            r.effect.textContent = def.effect(lv);
            r.cost.textContent = Format.num(cost);
            r.el.classList.toggle("can", s.coherence >= cost);
            r.el.classList.toggle("poor", s.coherence < cost);
        }
        for (const [id, r] of Object.entries(refs.feat)) {
            const lv = s.feat[id] || 0;
            const cost = r.def.cost(lv);
            const bank = r.currency === "coherence" ? s.coherence : s.quanta;
            r.lv.textContent = lv;
            r.effect.textContent = r.def.effect(lv);
            r.cost.textContent = Format.num(cost);
            r.el.classList.toggle("can", bank >= cost);
            r.el.classList.toggle("poor", bank < cost);
        }
    }

    function renderFormula() {
        const s = State.get();
        const entUnlocked = Calc.entropyUnlocked();
        const entMult = Calc.entropyMult();

        const tapRaw = Calc.rawTap();
        const tapFin = Calc.tapGain();
        const tapSurge = tapFin * Calc.surgeMult();

        const autoRaw = Calc.rawAuto();
        const autoFin = Calc.qps();
        const autoSurge = Calc.effectiveQps();

        const capTap = Calc.softcapThreshold("tap");
        const capAuto = Calc.softcapThreshold("auto");

        const surgeM = Calc.surgeMult();
        const gdpM = Calc.gdpStateMult ? Calc.gdpStateMult() : 1;

        /* --- multiplier rows --- */
        const resM = Math.pow(Config.RESONANCE_BASE, s.up.resonance);
        const phaseM = Math.pow(Config.PHASE_BASE, s.cUp.lock);

        const multRows = [];
        if (s.up.resonance > 0)
            multRows.push(["Resonance", "×" + resM.toFixed(2), "✓", "✓"]);
        if (s.cUp.lock > 0)
            multRows.push(["Phase", "×" + phaseM.toFixed(2), "✓", "✓"]);
        if (entUnlocked && entMult !== 1)
            multRows.push(["Entropy", "×" + entMult.toFixed(2), "✓", "✓"]);
        for (const m of Config.MODIFIERS) {
            const lv = s.mod[m.id] || 0;
            if (lv === 0) continue;
            const mult = 1 + m.weight * lv;
            const targets =
                m.target === "all"
                    ? ["✓", "✓"]
                    : m.target === "tap"
                      ? ["✓", "—"]
                      : ["—", "✓"];
            multRows.push([
                m.sym + " lv " + lv,
                "×" + mult.toFixed(2),
                targets[0],
                targets[1]
            ]);
        }
        if (Math.abs(gdpM - 1) > 0.005)
            multRows.push(["GDP", "×" + gdpM.toFixed(2), "✓", "✓"]);

        /* --- channel rows --- */
        const channelRows = [
            ["Tap (raw → cap)", Format.num(tapRaw), Format.num(tapFin)]
        ];
        if (surgeM > 1.001)
            channelRows.push([
                "  └ Surge ×" + surgeM.toFixed(2),
                "—",
                Format.num(tapSurge)
            ]);

        channelRows.push([
            "Passive (raw → cap)",
            Format.num(autoRaw),
            Format.num(autoFin)
        ]);
        if (surgeM > 1.001)
            channelRows.push([
                "  └ Surge ×" + surgeM.toFixed(2),
                "—",
                Format.num(autoSurge)
            ]);

        /* --- feature lines --- */
        const tapCtx = { tapGain: Calc.tapGain() };
        const featLines = [];
        for (const f of Features.all()) {
            if (!f.formula) continue;
            const line = f.formula(s, tapCtx);
            if (line?.text) featLines.push(line);
        }

        /* --- signature to skip rebuild --- */
        const sig = [
            tapRaw,
            tapFin,
            autoRaw,
            autoFin,
            surgeM,
            gdpM,
            entUnlocked ? 1 : 0,
            multRows.length,
            channelRows.length,
            featLines.map(l => l.text).join("¦")
        ].join("|");
        if (sig === lastFormulaSig) return;
        lastFormulaSig = sig;

        /* --- build table --- */
        const table = el("table", { className: "breakdown-table" });

        /* header row */
        const head = el("tr", { className: "bd-head" }, [
            el("th", {}, "Channel"),
            el("th", {}, "Raw"),
            el("th", {}, "Final")
        ]);
        table.appendChild(head);

        for (const [label, raw, fin] of channelRows) {
            const isSub = label.startsWith("  ");
            const tr = el("tr", { className: isSub ? "bd-sub" : "bd-main" }, [
                el("td", {}, label.trim()),
                el("td", { className: "bd-num" }, raw),
                el("td", { className: "bd-num bd-fin" }, fin)
            ]);
            table.appendChild(tr);
        }

        /* multiplier section */
        if (multRows.length > 0) {
            const sep = el("tr", { className: "bd-sep" }, [
                el("td", { colSpan: 3 }, "")
            ]);
            table.appendChild(sep);

            const mhead = el("tr", { className: "bd-head" }, [
                el("th", {}, "Multiplier"),
                el("th", {}, "Value"),
                el("th", {}, "Tap · Auto")
            ]);
            table.appendChild(mhead);

            for (const [name, val, tap, auto] of multRows) {
                const tr = el("tr", { className: "bd-mult" }, [
                    el("td", {}, name),
                    el("td", { className: "bd-num" }, val),
                    el("td", { className: "bd-num" }, tap + " · " + auto)
                ]);
                table.appendChild(tr);
            }
        }

        $("#formulaTable").replaceChildren(table);

        /* --- caps exceeded callouts --- */
        const caps = [];
        if (tapRaw > capTap)
            caps.push(
                div(
                    { className: "f-cap" },
                    "TAP cap: raw " +
                        Format.num(tapRaw) +
                        " > threshold " +
                        Format.num(capTap) +
                        " → compressed"
                )
            );
        if (autoRaw > capAuto)
            caps.push(
                div(
                    { className: "f-cap" },
                    "AUTO cap: raw " +
                        Format.num(autoRaw) +
                        " > threshold " +
                        Format.num(capAuto) +
                        " → compressed"
                )
            );

        /* --- feature lines --- */
        const featEls = [];
        for (const line of featLines) {
            featEls.push(
                div(
                    {
                        className:
                            "f-feature" +
                            (line.accent ? " " + line.accent : ""),
                        style: { marginTop: "4px" }
                    },
                    line.text
                )
            );
        }

        $("#formula").replaceChildren(...caps, ...featEls);
    }

    function renderSurge() {
        const s = State.get();
        const mult = Calc.surgeMult();
        const pool = s.surge || 0;
        const surgeValEl = $("#surgeVal");
        if (!surgeValEl) return;

        surgeValEl.textContent = "×" + Format.plain(mult);
        $("#surgeMult").textContent = "×" + Format.plain(mult);
        $("#surgePool").textContent = Format.plain(pool);

        const cost = Calc.surgeCost();
        const gain = Calc.surgeGain();
        $("#consumeCost").textContent = Format.num(cost);
        $("#consumeGain").textContent = "+" + Format.plain(gain);

        const btn = $("#consumeBtn");
        btn.classList.toggle("poor", s.quanta < cost);
        $("#surgePanel").classList.toggle("active", pool > 0.01);
    }

    function renderHUD() {
        const s = State.get();
        const t = clock();

        $("#quantaVal").textContent = Format.num(s.quanta);
        $("#tapVal").textContent = "+" + Format.num(Calc.tapGain() * Calc.surgeMult());
        $("#qpsVal").textContent = "+" + Format.num(Calc.effectiveQps());
        $("#cohVal").textContent = Format.num(s.coherence);

        renderSurge();
        renderEntropy();

        /* exchange pill */
        const exFeature = Features.get("exchange");
        if (exFeature && exFeature.price && s.portfolio?.everVisited) {
            const pill = document.getElementById("exchangePill");
            if (pill) {
                pill.classList.add("revealed");
                const v = pill.querySelector(".v");
                if (v)
                    v.textContent = Format.plain(
                        exFeature.price(Date.now() / 1000)
                    );
            }
        }

        const qNorm = Wave.value(t);
        const qVal = Wave.quality(t);
        const wq = $("#waveQuality");
        wq.textContent = "×" + Format.plain(qVal);
        wq.classList.toggle("hot", qNorm > 0.88);

        const gain = Calc.coherenceGain(t);
        const cost = Calc.collapseCost();
        $("#collapseGain").textContent = "+" + Format.num(gain) + " 𝒞";
        $("#collapseCost").textContent = Format.num(cost);

        const btn = $("#collapseBtn");
        btn.classList.toggle("hot", qNorm > 0.88);
        btn.classList.toggle("poor", s.quanta < cost);

        const boost = Wave.entropyBoost();
        const boostEl = $("#waveBoost");
        if (boostEl) {
            boostEl.textContent =
                boost > 0 ? "Ξ +" + (boost * 100).toFixed(0) + "%" : "";
            boostEl.classList.toggle("visible", boost > 0);
        }
    }

    function renderStats() {
        const s = State.get();
        $("#statTotal").textContent = Format.num(s.total);
        $("#statTaps").textContent = Format.num(s.taps);
        $("#statTapGain").textContent = Format.num(Calc.tapGain());
        $("#statGlobal").textContent = "×" + Format.num(Calc.globalMult());
        $("#statCollapses").textContent = Format.num(s.collapses);
        $("#statTime").textContent = Format.time((Date.now() - s.start) / 1000);
    }

    function render() {
        renderHUD();
        renderCards();
        renderFormula();
        renderStats();
        featureViews[activeViewId]?.render?.();
    }

    /* ================= Tab switching ================= */

    function switchToTab(name) {
        if (name === activeViewId) return;

        document
            .querySelectorAll(".tab")
            .forEach(t => t.classList.toggle("active", t.dataset.tab === name));
        document
            .querySelectorAll(".view")
            .forEach(v =>
                v.classList.toggle("active", v.dataset.view === name)
            );
        document.getElementById("views").scrollTop = 0;

        WaveScope.setVisible(name === "coherence");
        featureViews[activeViewId]?.onHide?.();
        activeViewId = name;
        featureViews[activeViewId]?.onShow?.();

        const activeTab = document.querySelector(`.tab[data-tab="${name}"]`);
        if (activeTab) centerTab(activeTab);
        /* Wait a frame so the smooth scroll has started before we measure. */
        requestAnimationFrame(updateTabScrollState);

        render();
    }

    function wireShell() {
        on($("#tabs"), "click", e => {
            const tab = e.target.closest(".tab");
            if (!tab) return;
            switchToTab(tab.dataset.tab);
        });
        on($("#resetBtn"), "click", () => actions.reset());

        const tabsEl = document.getElementById("tabs");
        if (tabsEl) {
            on(tabsEl, "scroll", updateTabScrollState, { passive: true });
        }
        on(window, "resize", updateTabScrollState);
        on(window, "orientationchange", () =>
            setTimeout(updateTabScrollState, 120)
        );
    }

    const api = {
        build,
        wireShell,
        setActions,
        render,
        refreshEntropyVisibility,
        flash,
        floater,
        toast,
        refs
    };
    return api;
})();
