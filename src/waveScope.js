import { Config } from "./config.js";
import { Wave } from "./wave.js";
import { clock } from "./clock.js";

export const WaveScope = (() => {
    let canvas,
        ctx,
        W = 0,
        H = 0,
        ready = false,
        visible = false;

    function resize() {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        if (rect.width < 2 || rect.height < 2) {
            ready = false;
            return;
        }

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        W = rect.width;
        H = rect.height;
        ready = true;
    }

    function init() {
        canvas = document.getElementById("waveCanvas");
        if (!canvas) return;
        ctx = canvas.getContext("2d");
        window.addEventListener("resize", resize);
        window.addEventListener("orientationchange", () =>
            setTimeout(resize, 120)
        );
    }

    function setVisible(v) {
        visible = v;
        if (v) requestAnimationFrame(resize);
    }

    function draw() {
        if (!visible || !ready || !ctx) return;

        const t = clock();
        const span = Config.WAVE.span;
        const N = 96;
        const pad = 6;
        const ih = H - pad * 2;

        ctx.clearRect(0, 0, W, H);

        /* floor guide (dashed violet) */
        const f = Wave.floor();
        if (f > 0.001) {
            const fy = H - pad - f * ih;
            ctx.beginPath();
            ctx.setLineDash([3, 5]);
            ctx.moveTo(0, fy);
            ctx.lineTo(W, fy);
            ctx.strokeStyle = "rgba(167, 139, 250, 0.4)";
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.setLineDash([]);
        }

        /* sample */
        const pts = new Array(N + 1);
        for (let i = 0; i <= N; i++) {
            const tt = t - span + (i / N) * span;
            const v = Wave.value(tt);
            pts[i] = [(i / N) * W, H - pad - v * ih];
        }

        /* fill */
        ctx.beginPath();
        ctx.moveTo(0, H);
        for (let i = 0; i <= N; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.lineTo(W, H);
        ctx.closePath();
        const grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "rgba(167, 139, 250, 0.32)");
        grad.addColorStop(1, "rgba(167, 139, 250, 0.02)");
        ctx.fillStyle = grad;
        ctx.fill();

        /* trace — violet normally, green when hot */
        const cur = Wave.value(t);
        const hot = cur > 0.88;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i <= N; i++) ctx.lineTo(pts[i][0], pts[i][1]);
        ctx.strokeStyle = hot ? "#4dffa6" : "#a78bfa";
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.shadowColor = ctx.strokeStyle;
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.shadowBlur = 0;

        /* head marker */
        const hy = H - pad - cur * ih;
        ctx.beginPath();
        ctx.arc(W - 2, hy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = hot ? "#4dffa6" : "#a78bfa";
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = 16;
        ctx.fill();
        ctx.shadowBlur = 0;
    }

    return { init, resize, setVisible, draw };
})();
