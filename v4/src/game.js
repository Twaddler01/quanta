import { Config, State, Save } from "./config.js";
import { Market } from "./market.js";
import { UI } from "./ui.js";
import { on, Format } from "./util.js";

export const Game = (() => {
    let lastFrame = 0;
    let renderAcc = 0;
    let lastWall = Date.now();

    function buy(id, n) {
        const r = Market.buyUnits(id, n, Date.now() / 1000);
        if (r.bought > 0) {
            Save.write();
            UI.render();
        }
    }

    function sell(id, n) {
        const r = Market.sellUnits(id, n, Date.now() / 1000);
        if (r.sold > 0) {
            Save.write();
            UI.render();
            if (r.profit > 0)
                UI.toast("+" + Format.num(r.profit) + " q profit");
        }
    }

    function upgradeShares(id) {
        if (Market.upgradeShares(id)) {
            UI.toast("Share purchased");
            Save.write();
            UI.render();
        }
    }

    function cashOut(id) {
        const r = Market.cashOut(id);
        if (r.ok) {
            UI.toast("Cashed out +" + Format.num(r.value) + " Q");
            Save.write();
            UI.render();
        } else {
            if (r.reason === "cooldown") UI.toast("Cash out on cooldown");
            else if (r.reason === "low-contribution")
                UI.toast("Trade profitably first");
        }
    }

    function upgradePortfolio() {
        if (Market.upgradePortfolio()) {
            UI.toast("Portfolio Boost leveled up");
            Save.write();
            UI.render();
        }
    }

    function reset() {
        if (!confirm("Erase save and restart?")) return;
        Save.wipe();
        location.reload();
    }

    function wireInputs() {
        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                Save.write();
                return;
            }
            const away = (Date.now() - lastWall) / 1000;
            if (away > 1) Market.tick(Math.min(away, 8 * 3600));
            lastWall = Date.now();
            lastFrame = performance.now();
            UI.render();
        });
        window.addEventListener("pagehide", Save.write);
        window.addEventListener("beforeunload", Save.write);
        window.addEventListener("resize", () =>
            setTimeout(() => UI.render(), 100)
        );
        window.addEventListener("orientationchange", () =>
            setTimeout(() => UI.render(), 150)
        );
    }

    function frame(now) {
        const dt = Math.min(0.1, (now - lastFrame) / 1000);
        lastFrame = now;
        lastWall = Date.now();

        Market.tick(dt);

        renderAcc += dt;
        if (renderAcc >= 0.066) {
            renderAcc = 0;
            UI.render();
        }

        requestAnimationFrame(frame);
    }

    function boot() {
        UI.setActions({
            buy,
            sell,
            upgradeShares,
            cashOut,
            upgradePortfolio,
            reset
        });
        wireInputs();
        UI.render();
        setInterval(Save.write, 15000);
        lastFrame = performance.now();
        requestAnimationFrame(frame);
    }

    return { boot };
})();
