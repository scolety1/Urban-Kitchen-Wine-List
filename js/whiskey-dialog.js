// One-at-a-time accessible modal dialog: focus moves in, Tab is trapped, Escape /
// backdrop / Close button dismiss, focus returns to the opener, body scroll is locked.

let active = null;

const FOCUSABLE = "a[href], button, input, select, textarea, [tabindex]";

function focusablesIn(root) {
  // querySelectorAll returns a NodeList in a browser, which has no filter()
  return [...root.querySelectorAll(FOCUSABLE)].filter(
    (el) => !el.disabled && el.getAttribute("tabindex") !== "-1" && !el.closest("[hidden]"),
  );
}

export function activeModal() {
  return active;
}

export function closeActiveModal(options) {
  active?.close(options);
}

/**
 * @param doc            document (injectable for tests)
 * @param innerHtml      dialog contents; must contain the heading with id `titleId`
 * @param titleId        id of the heading that labels the dialog
 * @param opener         element that receives focus again on close
 * @param onClose        optional callback after teardown: ({restoreFocus}) => void
 */
export function openModal(doc, { innerHtml, titleId, opener, className = "", onClose } = {}) {
  active?.close({ restoreFocus: false, silent: true });

  const backdrop = doc.createElement("div");
  backdrop.className = "wh-modal-backdrop";
  backdrop.setAttribute("data-modal-backdrop", "");
  backdrop.innerHTML = `
    <div class="wh-modal ${className}" role="dialog" aria-modal="true" aria-labelledby="${titleId}" tabindex="-1">
      <button type="button" class="wh-modal-close" data-modal-close>Close</button>
      <div class="wh-modal-body" data-modal-body>${innerHtml}</div>
    </div>`;
  const dialog = backdrop.querySelector('[role="dialog"]');

  const previousOverflow = doc.body.style.overflow ?? "";
  doc.body.appendChild(backdrop);
  doc.body.style.overflow = "hidden";

  let closed = false;
  const handle = {
    element: dialog,
    backdrop,
    close({ restoreFocus = true, silent = false } = {}) {
      if (closed) return;
      closed = true;
      doc.removeEventListener("keydown", onKeydown);
      backdrop.remove();
      doc.body.style.overflow = previousOverflow;
      if (active === handle) active = null;
      if (restoreFocus && opener && !onClose) opener.focus();
      if (!silent && onClose) onClose({ restoreFocus });
    },
  };

  function onKeydown(event) {
    if (event.key === "Escape") {
      event.preventDefault();
      handle.close();
      return;
    }
    if (event.key !== "Tab") return;
    const items = focusablesIn(dialog);
    if (!items.length) {
      event.preventDefault();
      dialog.focus();
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const current = doc.activeElement;
    if (items.length === 1 || !dialog.contains(current)) {
      event.preventDefault();
      first.focus();
    } else if (event.shiftKey && (current === first || current === dialog)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && current === last) {
      event.preventDefault();
      first.focus();
    }
  }

  doc.addEventListener("keydown", onKeydown);
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) handle.close();
  });
  dialog.querySelector("[data-modal-close]").addEventListener("click", () => handle.close());

  active = handle;
  dialog.focus();
  return handle;
}
