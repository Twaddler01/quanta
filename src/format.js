export const Format = (() => {
    const SUFFIX = [
        "",
        "K",
        "M",
        "B",
        "T",
        "Qa",
        "Qi",
        "Sx",
        "Sp",
        "Oc",
        "No",
        "Dc",
        "UDc",
        "DDc",
        "TDc",
        "QaDc",
        "QiDc",
        "SxDc",
        "SpDc",
        "OcDc",
        "NoDc",
        "Vg",
        "UVg",
        "DVg",
        "TVg",
        "QaVg",
        "QiVg",
        "SxVg",
        "SpVg",
        "OcVg",
        "NoVg"
    ];

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

    /** Extended-precision formatter — entropy display only.
     *  Below 1M: standard. At 1M+: up to 6 decimals (fewer as scaled value grows),
     *  trailing zeros trimmed, suffix preserved. */
    function precise(n) {
        if (!isFinite(n)) return n > 0 ? "∞" : "−∞";
        if (n < 0) return "−" + precise(-n);
        if (n < 1e6) return num(n);

        const tier = Math.floor(Math.log10(n) / 3);
        if (tier >= SUFFIX.length) {
            const e = Math.floor(Math.log10(n));
            return (n / Math.pow(10, e)).toFixed(4) + "e" + e;
        }

        const scaled = n / Math.pow(1000, tier);
        const digitsBefore = Math.floor(Math.log10(scaled)) + 1;
        const dec = Math.min(6, Math.max(2, 8 - digitsBefore));

        let s = scaled.toFixed(dec);
        if (s.includes(".")) s = s.replace(/\.?0+$/, "");
        return s + SUFFIX[tier];
    }

    return { num, time, plain, precise };
})();
