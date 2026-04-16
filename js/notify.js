const STYLE_ID = "lumina-popup-style";
const HOST_ID = "lumina-popup-host";
const CONFIRM_ID = "lumina-confirm-overlay";

function ensurePopupStyle() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${HOST_ID} {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    }

    .lumina-popup {
      pointer-events: auto;
      min-width: 280px;
      max-width: min(92vw, 420px);
      border-radius: 14px;
      border: 1px solid rgba(255, 255, 255, 0.6);
      background: rgba(255, 255, 255, 0.92);
      backdrop-filter: blur(8px);
      box-shadow: 0 16px 40px rgba(15, 23, 42, 0.2);
      color: #0f172a;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 14px;
      transform: translateY(-12px);
      opacity: 0;
      transition: transform 180ms ease, opacity 180ms ease;
      overflow: hidden;
      font-family: "Poppins", sans-serif;
    }

    .lumina-popup.show {
      transform: translateY(0);
      opacity: 1;
    }

    .lumina-popup__icon {
      width: 24px;
      height: 24px;
      border-radius: 999px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .lumina-popup__content {
      flex: 1;
      font-size: 13px;
      line-height: 1.45;
      font-weight: 500;
      word-break: break-word;
    }

    .lumina-popup__close {
      border: 0;
      background: transparent;
      color: #64748b;
      cursor: pointer;
      font-size: 16px;
      line-height: 1;
      padding: 0;
    }

    .lumina-popup__progress {
      position: absolute;
      left: 0;
      bottom: 0;
      height: 3px;
      width: 100%;
      transform-origin: left;
      animation: lumina-popup-progress var(--popup-duration, 3200ms) linear forwards;
    }

    .lumina-popup.success .lumina-popup__icon,
    .lumina-popup.success .lumina-popup__progress { background: #10b981; }

    .lumina-popup.error .lumina-popup__icon,
    .lumina-popup.error .lumina-popup__progress { background: #ef4444; }

    .lumina-popup.warning .lumina-popup__icon,
    .lumina-popup.warning .lumina-popup__progress { background: #f59e0b; }

    .lumina-popup.info .lumina-popup__icon,
    .lumina-popup.info .lumina-popup__progress { background: #3b82f6; }

    @keyframes lumina-popup-progress {
      from { transform: scaleX(1); }
      to { transform: scaleX(0); }
    }

    .lumina-confirm-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      background: rgba(2, 12, 27, 0.5);
      backdrop-filter: blur(3px);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      opacity: 0;
      transition: opacity 180ms ease;
    }

    .lumina-confirm-overlay.show {
      opacity: 1;
    }

    .lumina-confirm-card {
      width: min(92vw, 430px);
      border-radius: 18px;
      border: 1px solid rgba(212, 175, 55, 0.22);
      background: linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      box-shadow: 0 28px 70px rgba(15, 23, 42, 0.3);
      padding: 20px;
      color: #0f172a;
      font-family: "Poppins", sans-serif;
      transform: translateY(6px) scale(0.98);
      transition: transform 180ms ease;
    }

    .lumina-confirm-overlay.show .lumina-confirm-card {
      transform: translateY(0) scale(1);
    }

    .lumina-confirm-head {
      display: flex;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 14px;
    }

    .lumina-confirm-icon {
      width: 34px;
      height: 34px;
      border-radius: 999px;
      background: #1a2a40;
      color: #d4af37;
      display: grid;
      place-items: center;
      font-size: 15px;
      font-weight: 700;
      flex-shrink: 0;
    }

    .lumina-confirm-title {
      margin: 0 0 3px 0;
      font-size: 16px;
      font-weight: 700;
      color: #1a2a40;
      letter-spacing: 0.2px;
    }

    .lumina-confirm-message {
      margin: 0;
      font-size: 13px;
      line-height: 1.5;
      color: #475569;
    }

    .lumina-confirm-actions {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 18px;
    }

    .lumina-confirm-btn {
      border-radius: 10px;
      height: 40px;
      padding: 0 16px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      color: #475569;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 140ms ease;
    }

    .lumina-confirm-btn:hover {
      background: #f8fafc;
      border-color: #cbd5e1;
    }

    .lumina-confirm-btn.primary {
      background: #1a2a40;
      color: #d4af37;
      border-color: #1a2a40;
    }

    .lumina-confirm-btn.primary:hover {
      background: #24374f;
      border-color: #24374f;
    }
  `;
  document.head.appendChild(style);
}

function ensureHost() {
  let host = document.getElementById(HOST_ID);
  if (host) return host;

  host = document.createElement("div");
  host.id = HOST_ID;
  document.body.appendChild(host);
  return host;
}

function iconMark(type) {
  if (type === "success") return "OK";
  if (type === "error") return "!";
  if (type === "warning") return "!";
  return "i";
}

export function showPopup(message, type = "info", options = {}) {
  if (!message) return;

  ensurePopupStyle();
  const host = ensureHost();

  const duration = Number(options.duration ?? 3200);
  const popup = document.createElement("div");
  popup.className = `lumina-popup ${type}`;
  popup.style.setProperty("--popup-duration", `${duration}ms`);

  popup.innerHTML = `
    <div class="lumina-popup__icon">&nbsp;</div>
    <div class="lumina-popup__content"></div>
    <button class="lumina-popup__close" aria-label="Tutup">&times;</button>
    <div class="lumina-popup__progress"></div>
  `;

  const iconEl = popup.querySelector(".lumina-popup__icon");
  if (iconEl) {
    iconEl.textContent = iconMark(type);
    iconEl.style.display = "grid";
    iconEl.style.placeItems = "center";
    iconEl.style.color = "#fff";
    iconEl.style.fontWeight = "700";
    iconEl.style.fontSize = "12px";
  }

  const contentEl = popup.querySelector(".lumina-popup__content");
  if (contentEl) {
    contentEl.textContent = String(message);
  }

  const removePopup = () => {
    popup.classList.remove("show");
    setTimeout(() => popup.remove(), 180);
  };

  popup.querySelector(".lumina-popup__close")?.addEventListener("click", removePopup);

  host.appendChild(popup);
  requestAnimationFrame(() => popup.classList.add("show"));

  if (duration > 0) {
    setTimeout(removePopup, duration);
  }
}

export function showConfirmModal(options = {}) {
  ensurePopupStyle();

  const {
    title = "Konfirmasi Logout",
    message = "Apakah Anda yakin ingin keluar dari Lumina?",
    confirmText = "Logout",
    cancelText = "Batal",
  } = options;

  const existing = document.getElementById(CONFIRM_ID);
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = CONFIRM_ID;
  overlay.className = "lumina-confirm-overlay";

  const card = document.createElement("div");
  card.className = "lumina-confirm-card";
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");

  card.innerHTML = `
    <div class="lumina-confirm-head">
      <div class="lumina-confirm-icon">!</div>
      <div>
        <h3 class="lumina-confirm-title"></h3>
        <p class="lumina-confirm-message"></p>
      </div>
    </div>
    <div class="lumina-confirm-actions">
      <button type="button" class="lumina-confirm-btn" data-action="cancel"></button>
      <button type="button" class="lumina-confirm-btn primary" data-action="confirm"></button>
    </div>
  `;

  card.querySelector(".lumina-confirm-title").textContent = title;
  card.querySelector(".lumina-confirm-message").textContent = message;
  card.querySelector('[data-action="cancel"]').textContent = cancelText;
  card.querySelector('[data-action="confirm"]').textContent = confirmText;

  overlay.appendChild(card);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add("show"));

  return new Promise((resolve) => {
    const cleanup = () => {
      document.removeEventListener("keydown", onKeydown);
      overlay.classList.remove("show");
      setTimeout(() => overlay.remove(), 160);
    };

    const finish = (result) => {
      cleanup();
      resolve(result);
    };

    const onKeydown = (event) => {
      if (event.key === "Escape") finish(false);
    };

    document.addEventListener("keydown", onKeydown);

    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) finish(false);
    });

    card.querySelector('[data-action="cancel"]').addEventListener("click", () => finish(false));
    card.querySelector('[data-action="confirm"]').addEventListener("click", () => finish(true));
  });
}
