const T0 = performance.now();
export const clock = () => (performance.now() - T0) / 1000;
