
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
        ]
    });

    console.log('[v5] debug: mobile-dev-console integrated.');
} else {
    console.warn("[v5] debug: mobile-dev-console integration API is unavailable.");
}
