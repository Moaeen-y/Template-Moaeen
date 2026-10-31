/* ============================================================
 * state.js — حالة المحرر + الحفظ في localStorage
 * متوافق مع صيغة zustand-persist التي تستخدمها نسخة Next.js
 * (المفتاح نفسه: tajmiyat-editor-v1)
 * ============================================================ */
(function () {
  'use strict';

  const TPL = window.TPL;
  const STORAGE_KEY = 'tajmiyat-editor-v1';

  const state = {
    items: [],          // عناصر المحتوى (صور/نصوص)
    selectedId: null,
    zoom: 0.72,
    mobileTab: 'preview',
  };

  const listeners = [];

  function subscribe(fn) {
    listeners.push(fn);
    return function () {
      const i = listeners.indexOf(fn);
      if (i >= 0) listeners.splice(i, 1);
    };
  }

  function emit(opts) {
    save();
    listeners.forEach(function (fn) { fn(state, opts || {}); });
  }

  // ---------------- الحفظ والاسترجاع ----------------

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ state: { items: state.items, zoom: state.zoom }, version: 0 })
      );
    } catch (e) {
      /* قد تكون المساحة ممتلئة — نتجاهل بصمت */
    }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      // دعم الصيغتين: صيغة zustand {state:{...}} أو الصيغة المباشرة {items,...}
      const src = parsed && parsed.state ? parsed.state : parsed;
      if (src && Array.isArray(src.items)) state.items = src.items;
      if (src && typeof src.zoom === 'number' && isFinite(src.zoom)) {
        state.zoom = Math.min(1, Math.max(0.35, src.zoom));
      }
    } catch (e) {
      /* بيانات تالفة — نبدأ من جديد */
    }
  }

  // ---------------- العمليات ----------------

  function addTextItem(partial) {
    const p = partial || {};
    const item = {
      id: TPL.uid(),
      type: 'text',
      text: p.text != null ? p.text : '',
      fontSize: p.fontSize != null ? p.fontSize : 17,
      bold: !!p.bold,
      color: p.color || '#22223b',
      align: p.align || 'right',
      spacing: p.spacing != null ? p.spacing : 1.7,
    };
    state.items.push(item);
    state.selectedId = item.id;
    emit({ structural: true });
  }

  function addImageItems(imgs) {
    const added = imgs.map(function (g) {
      return {
        id: TPL.uid(),
        type: 'image',
        src: g.src,
        name: g.name,
        natW: g.natW,
        natH: g.natH,
        widthPct: 100,
        align: 'center',
        caption: '',
      };
    });
    state.items.push.apply(state.items, added);
    if (added.length) state.selectedId = added[added.length - 1].id;
    emit({ structural: true });
  }

  function updateItem(id, patch) {
    state.items = state.items.map(function (it) {
      return it.id === id ? Object.assign({}, it, patch) : it;
    });
    emit({ structural: false });
  }

  function removeItem(id) {
    state.items = state.items.filter(function (it) { return it.id !== id; });
    if (state.selectedId === id) state.selectedId = null;
    emit({ structural: true });
  }

  function duplicateItem(id) {
    const idx = state.items.findIndex(function (it) { return it.id === id; });
    if (idx < 0) return;
    const copy = Object.assign({}, state.items[idx], { id: TPL.uid() });
    state.items.splice(idx + 1, 0, copy);
    state.selectedId = copy.id;
    emit({ structural: true });
  }

  function moveItem(id, dir) {
    const idx = state.items.findIndex(function (it) { return it.id === id; });
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= state.items.length) return;
    const moved = state.items.splice(idx, 1)[0];
    state.items.splice(to, 0, moved);
    emit({ structural: true });
  }

  function setSelected(id) {
    state.selectedId = id;
    emit({ structural: true });
  }

  function setZoom(z) {
    state.zoom = Math.min(1, Math.max(0.35, z));
    emit({ structural: false, zoomOnly: true });
  }

  function clearAll() {
    state.items = [];
    state.selectedId = null;
    emit({ structural: true });
  }

  window.ED = {
    state, subscribe, emit,
    addTextItem, addImageItems, updateItem, removeItem, duplicateItem,
    moveItem, setSelected, setZoom, clearAll, load, save,
  };
})();
