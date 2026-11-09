
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
                id: "registry-summary",
                label: "Inspect Registered Suites",
                description: "Returns the currently registered suite names and actions.",
                run: ({ console }) => console.tests.getSuites()
            },
            {
                id: "async-demo",
                label: "Run Async Example",
                description: "Demonstrates an action that returns a promise.",
                run: async () => ({
                    result: "Async action completed",
                    completedAt: new Date().toISOString()
                })
            },
        ]
    });

    console.log('debug: mobile-dev-console integrated.');
} else {
    console.warn("debug: mobile-dev-console integration API is unavailable.");
}
