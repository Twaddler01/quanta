export const Format = (() => {
    const SUFFIX = ["", "K", "M", "B", "T", "Qa", "Qi", "Sx", "Sp", "Oc", "No"];
    function num(n) {
        if (!isFinite(n)) return n > 0 ? "∞" : "−∞";
        if (n < 0) return "−" + num(-n);
        if (n === 0) return "0";
        if (n < 0.01) return n.toExponential(2);
        if (n < 10) return n.toFixed(2);
        if (n < 100) return n.toFixed(1);
        if (n < 1000) return Math.floor(n).toString();
        const tier = Math.floor(Math.log10(n) / 3);
        if (tier < SUFFIX.length) {
            const s = n / Math.pow(1000, tier);
            const d = s < 10 ? 2 : s < 100 ? 1 : 0;
            return s.toFixed(d) + SUFFIX[tier];
        }
        const e = Math.floor(Math.log10(n));
        return (n / Math.pow(10, e)).toFixed(2) + "e" + e;
    }
    function time(sec) {
        sec = Math.max(0, Math.floor(sec));
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        if (h > 0) return h + "h " + m + "m";
        if (m > 0) return m + "m " + s + "s";
        return s + "s";
    }
    function plain(v) {
        const r = Math.round(v * 100) / 100;
        return Number.isInteger(r) ? String(r) : r.toFixed(2);
    }
    return { num, time, plain };
})();

export function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (v == null || v === false) continue;
        if (k === "className") node.className = v;
        else if (k === "text") node.textContent = v;
        else if (k === "style" && typeof v === "object")
            Object.assign(node.style, v);
        else if (k.startsWith("on") && typeof v === "function")
            node.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k in node) node[k] = v;
        else node.setAttribute(k, v === true ? "" : String(v));
    }
    append(node, children);
    return node;
}

export function append(parent, children) {
    const items = Array.isArray(children) ? children : [children];
    for (const c of items) {
        if (c == null || c === false) continue;
        if (Array.isArray(c)) append(parent, c);
        else if (c instanceof Node) parent.append(c);
        else parent.append(document.createTextNode(String(c)));
    }
    return parent;
}

export const div = (p, c) => el("div", p, c);
export const span = (p, c) => el("span", p, c);
export const on = (node, ev, fn, opts) => {
    node.addEventListener(ev, fn, opts);
    return () => node.removeEventListener(ev, fn, opts);
};
