import { Config } from "./config.js";
import { State } from "./state.js";
import { Calc } from "./calc.js";
import { Format } from "./format.js";
import { toast } from "./toast.js";

export const Save = (() => {
    const num = v => (Number.isFinite(+v) ? +v : 0);
    const clampInt = v => Math.max(0, Math.floor(num(v)));
    let disabled = false;

    function write() {
        if (disabled) return;
        const s = State.get();
        s.lastSave = Date.now();
        try {
            localStorage.setItem(Config.SAVE_KEY, JSON.stringify(s));
        } catch (e) {}
    }

    function read() {
        let raw;
        try {
            raw = localStorage.getItem(Config.SAVE_KEY);
        } catch (e) {
            return false;
        }
        if (!raw) return false;

        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch (e) {
            return false;
        }
        if (!parsed || typeof parsed !== "object") return false;

        const def = State.blank();
        const merged = {
            quanta: num(parsed.quanta),
            total: num(parsed.total),
            taps: num(parsed.taps),
            coherence: num(parsed.coherence),
            collapses: clampInt(parsed.collapses),
            surge: num(parsed.surge),
            entropy: num(parsed.entropy),
            entropyUnlocked: !!parsed.entropyUnlocked,
            entropyMilestoneCount: clampInt(parsed.entropyMilestoneCount),
            start: num(parsed.start) || Date.now(),
            lastSave: num(parsed.lastSave) || Date.now(),
            up: Object.assign({}, def.up, parsed.up || {}),
            mod: Object.assign({}, def.mod, parsed.mod || {}),
            cUp: Object.assign({}, def.cUp, parsed.cUp || {}),
            feat: Object.assign({}, def.feat, parsed.feat || {}),
            portfolio: (() => {
                const p = parsed.portfolio || {};
                const oldBonds =
                    p.holdings?.bonds ?? parsed.market?.credits ?? 0;
                return {
                    holdings: {
                        calm: clampInt(p.holdings?.calm ?? oldBonds),
                        tidal: clampInt(p.holdings?.tidal ?? 0),
                        vortex: clampInt(p.holdings?.vortex ?? 0),
                        chaos: clampInt(p.holdings?.chaos ?? 0)
                    },
                    costBasis: {
                        calm: num(p.costBasis?.calm ?? p.costBasis?.bonds ?? 0),
                        tidal: num(p.costBasis?.tidal ?? 0),
                        vortex: num(p.costBasis?.vortex ?? 0),
                        chaos: num(p.costBasis?.chaos ?? 0)
                    },
                    auto: {
                        calm: !!p.auto?.calm,
                        tidal: !!p.auto?.tidal,
                        vortex: !!p.auto?.vortex,
                        chaos: !!p.auto?.chaos
                    },
                    activeMarket: p.activeMarket || "calm",
                    everVisited: !!(p.everVisited ?? parsed.market?.everVisited)
                };
            })(),
            _autoAcc: num(parsed._autoAcc),
            _tickAcc: num(parsed._tickAcc),
            gdp: num(parsed.gdp),
            _waveLockUntil: num(parsed._waveLockUntil),
            _cashOutCooldownUntil: num(parsed._cashOutCooldownUntil),
            _lastCashOutAt:
                num(parsed._lastCashOutAt) || num(parsed.start) || Date.now()
        };
        for (const k in merged.up) merged.up[k] = clampInt(merged.up[k]);
        for (const k in merged.mod) merged.mod[k] = clampInt(merged.mod[k]);
        for (const k in merged.cUp) merged.cUp[k] = clampInt(merged.cUp[k]);
        for (const k in merged.feat) merged.feat[k] = clampInt(merged.feat[k]);

        /* Migration: auto-unlock if saved total already crosses the bar */
        if (merged.total >= Config.ENTROPY.unlockTotal)
            merged.entropyUnlocked = true;

        /* Derive milestone count from current entropy (defensive) */
        merged.entropyMilestoneCount = Config.ENTROPY.milestones.filter(
            m => merged.entropy >= m.at
        ).length;

        State.replace(merged);

        /* Migration: existing holders get neutral cost basis at current value */
        {
            const s = State.get();
            const p = s.portfolio;
            if (!p.costBasis) p.costBasis = { bonds: 0 };
            const held = p.holdings.bonds || 0;
            const cost = p.costBasis.bonds || 0;
            if (held > 0 && cost === 0) {
                const unit = Config.FEATURES.exchange.effectiveUnitCost();
                p.costBasis.bonds = held * unit; // assume neutral price 1.0
            }
        }

        /* --- Sanitize: any non-finite field becomes its safe default --- */
        {
            const s = State.get();
            if (!Number.isFinite(s.quanta)) s.quanta = 0;
            if (!Number.isFinite(s.total)) s.total = 0;
            if (!Number.isFinite(s.coherence)) s.coherence = 0;
            if (!Number.isFinite(s.surge)) s.surge = 0;
            if (!Number.isFinite(s.entropy)) s.entropy = 0;
            if (!Number.isFinite(s.gdp) || s.gdp < 0)
                s.gdp = Config.FEATURES.exchange.gdp.baselineGdp;
            if (!Number.isFinite(s.portfolio?.holdings?.bonds))
                s.portfolio.holdings.bonds = 0;
        }

        const away = Math.min(
            (Date.now() - merged.lastSave) / 1000,
            Config.OFFLINE_CAP
        );

        if (away > 0.5 && merged.surge > 0) {
            merged.surge *= Math.pow(1 - Config.SURGE.decay, away);
            if (merged.surge < 0.001) merged.surge = 0;
        }

        /* Entropy also accumulates offline (at the rate as of load) */
        if (away > 1 && merged.entropyUnlocked) {
            merged.entropy += Calc.entropyRate() * away;
            merged.entropyMilestoneCount = Config.ENTROPY.milestones.filter(
                m => merged.entropy >= m.at
            ).length;
        }

        if (away > 5) {
            const gain = Calc.income() * away;
            if (gain > 0) {
                const s = State.get();
                s.quanta += gain;
                s.total += gain;
                setTimeout(
                    () =>
                        toast(
                            "Offline " +
                                Format.time(away) +
                                " → +" +
                                Format.num(gain) +
                                " Q"
                        ),
                    400
                );
            }
        }
        /* GDP also grows offline */
        const exchangeFeature = Config.FEATURES.exchange;
        if (away > 1 && exchangeFeature?.gdpCatchUp) {
            exchangeFeature.gdpCatchUp(merged, away);
        }
        return true;
    }

    function wipe() {
        try {
            localStorage.removeItem(Config.SAVE_KEY);
        } catch (e) {}
    }

    function disable() {
        disabled = true;
    }

    return { write, read, wipe, disable };
})();
