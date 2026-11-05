/**
 * Minimal DOM builder.
 *
 * Improvements over the original:
 *   • `ref` prop — a callback invoked with the created node after children are appended.
 *   • `frag(...children)` — build a DocumentFragment.
 *   • `clear(node)` — empty a node.
 *   • `on(node, event, handler, opts)` — add a listener, returns an unsubscribe fn.
 *   • `style` as a string falls back to setAttribute (previously a silent no-op).
 */

export function el(tag, props = {}, children = []) {
    const node = document.createElement(tag);
    let refFn = null;

    for (const [key, value] of Object.entries(props)) {
        if (key === "ref") {
            if (typeof value === "function") refFn = value;
            continue;
        }
        if (value == null || value === false) continue;

        if (key === "className") {
            node.className = value;
        } else if (key === "text") {
            node.textContent = value;
        } else if (key === "html") {
            node.innerHTML = value;
        } else if (key === "dataset") {
            Object.assign(node.dataset, value);
        } else if (key === "style") {
            if (typeof value === "object") Object.assign(node.style, value);
            else node.setAttribute("style", String(value));
        } else if (key.startsWith("on") && typeof value === "function") {
            node.addEventListener(key.slice(2).toLowerCase(), value);
        } else if (
            key.startsWith("on") &&
            Array.isArray(value) &&
            typeof value[0] === "function"
        ) {
            // Example: onError: [handler, { once: true }]
            node.addEventListener(
                key.slice(2).toLowerCase(),
                value[0],
                value[1]
            );
        } else if (key in node && !key.startsWith("aria-") && key !== "role") {
            node[key] = value;
        } else {
            node.setAttribute(key, value === true ? "" : String(value));
        }
    }

    append(node, children);
    if (refFn) refFn(node);
    return node;
}

export function append(parent, children) {
    const items = Array.isArray(children) ? children : [children];

    for (const child of items) {
        if (child == null || child === false) continue;

        if (Array.isArray(child)) {
            append(parent, child);
        } else if (child instanceof Node) {
            parent.append(child);
        } else {
            parent.append(document.createTextNode(String(child)));
        }
    }

    return parent;
}

export function frag(...children) {
    const f = document.createDocumentFragment();
    append(f, children);
    return f;
}

export function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
    return node;
}

export function on(node, event, handler, opts) {
    node.addEventListener(event, handler, opts);
    return () => node.removeEventListener(event, handler, opts);
}

export const div = (props, children) => el("div", props, children);
export const span = (props, children) => el("span", props, children);
export const heading = (level, text) => el(`h${level}`, { text });
