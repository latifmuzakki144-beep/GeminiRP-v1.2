/**
 * SillyTavern-compatible popup shim.
 * Real modal: builds a DOM overlay and returns a Promise that resolves on
 * confirmation / cancellation.
 *
 * Import: `import { Popup, POPUP_TYPE, POPUP_RESULT, callGenericPopup } from "../../../popup.js"`
 */

export const POPUP_TYPE = {
  TEXT: 1,
  CONFIRM: 2,
  INPUT: 3,
  DISPLAY: 4,
};

export const POPUP_RESULT = {
  AFFIRMATIVE: 1,
  NEGATIVE: 0,
  CANCELLED: null,
};

function _ensureStyle() {
  if (document.getElementById('gemrp-popup-style')) return;
  const s = document.createElement('style');
  s.id = 'gemrp-popup-style';
  s.textContent = `
    .gemrp-popup-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.75); backdrop-filter: blur(6px);
      z-index: 9999; display: flex; align-items: center; justify-content: center;
      animation: gemrp-pop-fade 0.15s ease;
    }
    @keyframes gemrp-pop-fade { from { opacity: 0; } to { opacity: 1; } }
    .gemrp-popup-box {
      background: #111827; color: #e5e7eb;
      border: 1px solid #374151; border-radius: 16px;
      min-width: 320px; max-width: 90vw; max-height: 85vh;
      padding: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8);
      display: flex; flex-direction: column; gap: 16px;
      font-family: ui-sans-serif, system-ui, sans-serif;
    }
    .gemrp-popup-content { font-size: 14px; line-height: 1.5; overflow-y: auto; }
    .gemrp-popup-input {
      width: 100%; background: #0b1220; color: #e5e7eb;
      border: 1px solid #374151; border-radius: 8px; padding: 10px;
      font-size: 14px; outline: none;
    }
    .gemrp-popup-input:focus { border-color: #8b5cf6; }
    .gemrp-popup-buttons { display: flex; justify-content: flex-end; gap: 8px; }
    .gemrp-popup-btn {
      padding: 8px 16px; border-radius: 8px; cursor: pointer; font-weight: 600;
      font-size: 13px; border: none; transition: background 0.15s;
    }
    .gemrp-popup-btn.affirm { background: #8b5cf6; color: white; }
    .gemrp-popup-btn.affirm:hover { background: #7c3aed; }
    .gemrp-popup-btn.neg { background: #374151; color: #e5e7eb; }
    .gemrp-popup-btn.neg:hover { background: #4b5563; }
  `;
  document.head.appendChild(s);
}

export class Popup {
  /**
   * @param {string|HTMLElement} content
   * @param {number} type   POPUP_TYPE.*
   * @param {string} [inputValue]
   * @param {object} [options]  { okButton, cancelButton, rows, wide, large, allowVerticalScrolling }
   */
  constructor(content, type = POPUP_TYPE.TEXT, inputValue = '', options = {}) {
    this.content = content;
    this.type = type;
    this.inputValue = inputValue;
    this.options = options;
    this.result = null;
    this.value = inputValue;
  }

  show() {
    _ensureStyle();
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'gemrp-popup-overlay';

      const box = document.createElement('div');
      box.className = 'gemrp-popup-box';

      // content
      const body = document.createElement('div');
      body.className = 'gemrp-popup-content';
      if (typeof this.content === 'string') {
        body.innerHTML = this.content;
      } else if (this.content instanceof HTMLElement) {
        body.appendChild(this.content);
      } else {
        body.textContent = String(this.content ?? '');
      }
      box.appendChild(body);

      // input field (if INPUT type)
      let input = null;
      if (this.type === POPUP_TYPE.INPUT) {
        if ((this.options.rows ?? 1) > 1) {
          input = document.createElement('textarea');
          input.rows = this.options.rows;
        } else {
          input = document.createElement('input');
          input.type = 'text';
        }
        input.className = 'gemrp-popup-input';
        input.value = this.inputValue ?? '';
        box.appendChild(input);
      }

      // buttons
      const btnRow = document.createElement('div');
      btnRow.className = 'gemrp-popup-buttons';

      const cleanup = (result, val) => {
        this.result = result;
        this.value = val;
        overlay.remove();
        resolve(this.type === POPUP_TYPE.INPUT && result === POPUP_RESULT.AFFIRMATIVE
          ? val
          : result);
      };

      // Cancel
      if (this.type === POPUP_TYPE.CONFIRM || this.type === POPUP_TYPE.INPUT) {
        const cancelBtn = document.createElement('button');
        cancelBtn.className = 'gemrp-popup-btn neg';
        cancelBtn.textContent = this.options.cancelButton ?? 'Batal';
        cancelBtn.onclick = () => cleanup(POPUP_RESULT.NEGATIVE, null);
        btnRow.appendChild(cancelBtn);
      }

      // OK
      const okBtn = document.createElement('button');
      okBtn.className = 'gemrp-popup-btn affirm';
      okBtn.textContent = this.options.okButton ?? 'OK';
      okBtn.onclick = () => cleanup(POPUP_RESULT.AFFIRMATIVE, input ? input.value : null);
      btnRow.appendChild(okBtn);

      box.appendChild(btnRow);
      overlay.appendChild(box);
      document.body.appendChild(overlay);

      // Esc / outside click → cancel
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) cleanup(POPUP_RESULT.CANCELLED, null);
      });
      document.addEventListener('keydown', function onEsc(e) {
        if (e.key === 'Escape') {
          document.removeEventListener('keydown', onEsc);
          cleanup(POPUP_RESULT.CANCELLED, null);
        }
      });

      if (input) setTimeout(() => input.focus(), 50);
    });
  }

  hide() {
    document.querySelectorAll('.gemrp-popup-overlay').forEach((el) => el.remove());
  }

  static show = {
    text:    (msg) => new Popup(msg, POPUP_TYPE.TEXT).show(),
    confirm: (msg) => new Popup(msg, POPUP_TYPE.CONFIRM).show(),
    input:   (msg, val) => new Popup(msg, POPUP_TYPE.INPUT, val).show(),
  };
}

/** ST helper used by some extensions. */
export async function callGenericPopup(content, type = POPUP_TYPE.TEXT, inputValue = '', options = {}) {
  return await new Popup(content, type, inputValue, options).show();
}

export default { Popup, POPUP_TYPE, POPUP_RESULT, callGenericPopup };
