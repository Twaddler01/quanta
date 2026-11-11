
const QUANTA = window.QUANTA;
const devTools = window.devTools;

if (devTools?.tests) {
    devTools.tests.registerSuite({
        id: "QUANTA-project",
        name: "QUANTA Project",
        description: "QUANTA debugging.",
        actions: [
            {
                id: "custom",
                label: "Run QUANTA.stuck()",
                description: "QUANTA debugging.",
                run: () => QUANTA.stuck()
            },
            {
                id: "custom2",
                label: "set q 49",
                description: "...",
                run: () => {
                    QUANTA.setMarketQ('calm', 49)
                    //QUANTA.stuck()  // ensures holding=0
                }
            },
            {
                id: "custom3",
                label: "QUANTA full cycle (profit)",
                description: "...",
                run: () => {
                    // Fresh market, verify every step
                    QUANTA.tradeCycle()
                    // 1. Real buy: q -= buyPrice, holding += 1, costBasis += buyPrice
                    // 2. Real sell: q += sellPrice, holding -= 1, profit computed
                    // 3. Pool route: pool += profit × 0.5
                    // 4. Interest window: recentProfit set, expiresAt = now + 60s
                    // 5. Toast, save, render
                    
                    QUANTA.advance(60)
                    // 6. Interest accrues over 60s via tick(), using proper √(1 - t/60) decay
                    // 7. Pool caps at poolMax if necessary
                    // 8. Cooldowns decay
                    
                    QUANTA.cashOut()
                    // 9. Pool → Big Q, milestone check, reset
                    
                    // Full cycle hit, no shortcuts.
                }
            },
        ]
    });

    console.log('[v5] debug: mobile-dev-console integrated.');
} else {
    console.warn("[v5] debug: mobile-dev-console integration API is unavailable.");
}
