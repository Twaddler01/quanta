import { Config, State, Save } from "./config.js";
import { Market } from "./market.js";
import { UI } from "./ui.js";
import { on, Format } from "./util.js";

export const Game = (() => {
    let lastFrame = 0;
    let renderAcc = 0;
    let lastWall = Date.now();

    function buy(n) {
        const r = Market.buy(n, Date.now() / 1000);
        if (r.bought > 0) {
            Save.write();
            UI.render();
        }
    }

    function sell(n) {
        const r = Market.sell(n, Date.now() / 1000);
        if (r.sold > 0) {
            Save.write();
            UI.render();
        }
    }

    const buyMax = () => buy(Market.maxShares() - State.get().shares);
    const sellAll = () => sell(State.get().shares);

    function upgrade() {
        if (Market.upgrade()) {
            UI.toast("Upgrade: +" + Config.SHARES_PER_UPGRADE + " max shares");
            Save.write();
            UI.render();
        }
    }

    function cashOut() {
        const r = Market.cashOut(Date.now() / 1000);
        if (r.ok) {
            UI.toast("Cashed out +" + Format.num(r.total) + " Q");
            Save.write();
            UI.render();
        } else {
            if (r.reason === "cooldown") UI.toast("Cash out on cooldown");
            else if (r.reason === "low-entropy") UI.toast("Entropy too low");
            else if (r.reason === "no-shares") UI.toast("Buy shares first");
        }
    }

    function reset() {
        if (!confirm("Erase save and restart?")) return;
        Save.wipe();
        location.reload();
    }

    function wireInputs() {
        on(UI.$("#buy1"), "click", () => buy(1));
        on(UI.$("#buyMax"), "click", buyMax);
        on(UI.$("#sell1"), "click", () => sell(1));
        on(UI.$("#sellAll"), "click", sellAll);
        on(UI.$("#upgradeBtn"), "click", upgrade);
        on(UI.$('#bulkUpgradeBtn'), 'click', () => {
            if (Market.upgradeBulk()) {
                const size = Market.bulkTradeSize();
                UI.toast('Bulk trade size: ×' + size + ' shares');
                Save.write();
                UI.render();
            }
        });
        on(UI.$("#cashOutBtn"), "click", cashOut);
        /* Automation toggles */
        on(UI.$("#autoBuyToggle"), "click", () => {
            const s = State.get();
            if (!Market.autoUnlocked()) return;
            s.autoBuyEnabled = !s.autoBuyEnabled;
            Save.write();
            UI.render();
        });
        on(UI.$("#autoSellToggle"), "click", () => {
            const s = State.get();
            if (!Market.autoUnlocked()) return;
            s.autoSellEnabled = !s.autoSellEnabled;
            Save.write();
            UI.render();
        });

        /* Automation sliders */
        on(UI.$("#autoBuySlider"), "input", e => {
            State.get().autoBuyThreshold = parseInt(e.target.value, 10);
            UI.render();
        });
        on(UI.$("#autoBuySlider"), "change", () => Save.write());
        on(UI.$("#autoSellSlider"), "input", e => {
            State.get().autoSellThreshold = parseInt(e.target.value, 10);
            UI.render();
        });
        on(UI.$("#autoSellSlider"), "change", () => Save.write());

        on(UI.$("#resetBtn"), "click", reset);

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

        const autoEvents = Market.tick(dt);

        if (autoEvents && autoEvents.length > 0) {
            for (const ev of autoEvents) {
                UI.pulseAuto(ev.type);
            }
        }
        
        renderAcc += dt;
        if (renderAcc >= 0.066) {
            renderAcc = 0;
            UI.render();
        }

        requestAnimationFrame(frame);
    }

    function boot() {
        wireInputs();
        UI.render();
        setInterval(Save.write, 15000);
        lastFrame = performance.now();
        requestAnimationFrame(frame);
    }

    return { boot };
})();
