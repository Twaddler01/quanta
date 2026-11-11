import { Config, State, Save } from "./config.js";
import { Market } from "./market.js";
import { UI } from "./ui.js";
import { Format } from "./util.js";

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
                UI.toast("+" + Format.num(r.profit) + " q profit · pool fed");
        }
    }

    function upgradeShares(id) {
        if (Market.upgradeShares(id)) {
            UI.toast("Share purchased · pool cap increased");
            Save.write();
            UI.render();
        }
    }

    function cashOut(id) {
        const r = Market.cashOut(id);
        if (r.ok) {
            if (r.milestoneHit) {
                UI.toast(
                    "MILESTONE! +" +
                        Format.num(r.value) +
                        " Q cash out + " +
                        Format.num(r.milestoneBonusQ) +
                        " Q bonus · dividend now +" +
                        Math.round(r.newMilestoneBonus * 100) +
                        "%"
                );
            } else {
                UI.toast("Cashed out +" + Format.num(r.value) + " Q");
            }
            Save.write();
            UI.render();
        } else {
            if (r.reason === "not-full")
                UI.toast("Pool not full · trade more to fill it");
            else if (r.reason === "cooldown") UI.toast("Cash out on cooldown");
            else if (r.reason === "ipoed")
                UI.toast("Market is IPO'd — no cash out");
        }
    }

    function upgradePortfolio() {
        if (Market.upgradePortfolio()) {
            UI.toast("Portfolio Boost leveled up");
            Save.write();
            UI.render();
        }
    }

    function upgradeInterestBooster() {
        if (Market.upgradeInterestBooster()) {
            UI.toast("Interest Booster leveled up");
            Save.write();
            UI.render();
        }
    }

    function upgradeMarketLeverage() {
        const wasMax =
            (State.get().marketLeverage || 0) >=
            Config.MARKET_LEVERAGE_MAX_LEVEL;
        if (wasMax) {
            UI.toast("Leverage maxed");
            return;
        }
        if (Market.upgradeMarketLeverage()) {
            UI.toast("Market Leverage leveled up · +5% wave amplitude");
            Save.write();
            UI.render();
        }
    }

    function upgradePoolBuffer() {
        if (Market.upgradePoolBuffer()) {
            UI.toast("Pool Buffer leveled up · +10% pool max");
            Save.write();
            UI.render();
        }
    }

    function upgradePassiveYield() {
        if (Market.upgradePassiveYield()) {
            UI.toast("Passive Yield leveled up");
            Save.write();
            UI.render();
        }
    }

    function resetMarket(id) {
        const r = Market.resetMarket(id);
        if (r.ok) {
            UI.toast("Market reset · q restored to " + Format.num(r.amount));
            Save.write();
            UI.render();
        }
    }

    function ipoMarket(id) {
        const name = Market.def(id).name;
        if (
            !confirm(
                "Take " +
                    name +
                    " public? Market becomes untradeable and contributes passive Q/s forever."
            )
        )
            return;
        const r = Market.ipoMarket(id);
        if (r.ok) {
            UI.toast(
                "IPO! +" +
                    Format.num(r.lump) +
                    " Q · +" +
                    Format.num(r.passive) +
                    " Q/s forever"
            );
            Save.write();
            UI.render();
        } else {
            if (r.reason === "has-holding")
                UI.toast("Sell all units before IPO");
            else if (r.reason === "low-lifetime")
                UI.toast("Not enough lifetime cash out");
            else if (r.reason === "already-ipoed") UI.toast("Already IPO'd");
        }
    }

    function selectMarket(id) {
        if (!Market.isUnlocked(id)) return;
        const s = State.get();
        s.activeMarket = id;
        s.seenMarkets[id] = true;
        Save.write();
        UI.render();
    }

    function reset() {
        if (!confirm("Erase save and restart?")) return;
        Save.disable();
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
            upgradeInterestBooster,
            upgradeMarketLeverage,
            upgradePoolBuffer,
            upgradePassiveYield,
            resetMarket,
            ipoMarket,
            selectMarket,
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
