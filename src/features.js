/**
 * Feature registry.
 *
 * A feature is a plain object:
 *   { id, enabled, cards, hooks, formula, onRegister?, onUnregister? }
 *
 * Add a feature  : Features.register(Config.FEATURES.someFeature)
 * Remove a feature: Features.unregister('someFeature')
 *
 * Toggle at build time: set Config.FEATURES.someFeature.enabled = false
 *   (main.js only registers entries with enabled === true)
 *
 * Hooks fired by Game/UI:
 *   onTick(state, dt, ctx)        — every frame, ctx has { tapGain, qps }
 *   onCollapse(state, ctx)        — after a successful collapse, ctx has { gain, quality, floater }
 *
 * formula(state, ctx) returns { text, accent } | null — rendered in the
 *   Live Formula panel (accent: 'quanta' | 'coh' | 'surge' | 'entropy').
 */
export const Features = (() => {
    const features = new Map();
    const listeners = new Set();

    function onChange(fn) {
        listeners.add(fn);
        return () => listeners.delete(fn);
    }
    function notify() {
        for (const fn of listeners) fn();
    }

    function register(feature) {
        if (!feature?.id || features.has(feature.id)) return false;
        features.set(feature.id, feature);
        feature.onRegister?.();
        notify();
        return true;
    }

    function unregister(id) {
        const f = features.get(id);
        if (!f) return false;
        f.onUnregister?.();
        features.delete(id);
        notify();
        return true;
    }

    function hook(name, ...args) {
        for (const f of features.values()) f.hooks?.[name]?.(...args);
    }

    function all() {
        return [...features.values()];
    }
    function get(id) {
        return features.get(id);
    }
    function has(id) {
        return features.has(id);
    }

    return { register, unregister, hook, all, get, has, onChange };
})();
