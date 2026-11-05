let el = null;
let timer = null;

export function mountToast(node) {
    el = node;
}

export function toast(msg) {
    if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove("show"), 3200);
}
