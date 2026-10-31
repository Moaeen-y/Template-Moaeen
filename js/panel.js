/* ============================================================
 * panel.js — لوحة المحتوى الجانبية
 * (منفذ من items-panel.tsx + item-editors.tsx)
 * رفع الصور (اختيار/سحب/لصق) + إضافة نصوص + ترتيب وتحرير
 * ============================================================ */
(function () {
  'use strict';

  const TPL = window.TPL;
  const MAX_IMG_BYTES = 8 * 1024 * 1024;

  let panelEl = null;

  // ------------------------------------------------------------
  // قراءة ملف صورة → حمولة عنصر صورة
  // ------------------------------------------------------------

  function fileToImagePayload(file) {
    return new Promise(function (resolve) {
      const r = new FileReader();
      r.onload = function () {
        const dataUrl = String(r.result);
        const im = new Image();
        im.onload = function () { resolve({ src: dataUrl, name: file.name || 'صورة', natW: im.naturalWidth, natH: im.naturalHeight }); };
        im.onerror = function () { resolve({ src: dataUrl, name: file.name || 'صورة', natW: 1, natH: 1 }); };
        im.src = dataUrl;
      };
      r.onerror = function () { resolve(null); };
      r.readAsDataURL(file);
    });
  }

  function handleFiles(files) {
    if (!files) return;
    const arr = Array.prototype.slice.call(files);
    const imgs = arr.filter(function (f) {
      return f.type && f.type.indexOf('image/') === 0 && f.size <= MAX_IMG_BYTES;
    });
    if (imgs.length === 0) {
      const hasBig = arr.some(function (f) { return f.size > MAX_IMG_BYTES; });
      if (hasBig) UI.toast('حجم الصورة يتجاوز 8MB', 'error');
      return;
    }
    Promise.all(imgs.map(fileToImagePayload)).then(function (payloads) {
      const ok = payloads.filter(Boolean);
      if (ok.length) {
        ED.addImageItems(ok);
        UI.toast('تمت إضافة ' + ok.length + (ok.length === 1 ? ' صورة' : ' صور'), 'success');
      }
    });
  }

  // ------------------------------------------------------------
  // بطاقة عنصر
  // ------------------------------------------------------------

  function buildItemCard(item, index, total, oversized) {
    const selected = ED.state.selectedId === item.id;
    const card = TPL.h('div', { class: 'item-card' + (selected ? ' selected' : ''), dataset: { id: item.id } });

    // ----- رأس البطاقة -----
    const head = TPL.h('div', { class: 'item-head', role: 'button', tabindex: '0' });

    head.appendChild(TPL.h('span', { class: 'grip', html: TPL.icon('grip', 16) }));

    const thumb = TPL.h('div', { class: 'item-thumb' });
    if (item.type === 'image') {
      thumb.appendChild(TPL.h('img', { src: item.src, alt: '' }));
    } else {
      thumb.innerHTML = TPL.icon('fileText', 16);
    }
    head.appendChild(thumb);

    const meta =
      item.type === 'image'
        ? item.natW + '×' + item.natH + (item.caption ? ' · ' + item.caption : '')
        : (String(item.text || '').split('\n')[0] || '').slice(0, 60) || 'نص فارغ';

    const info = TPL.h('div', { class: 'item-info' });
    info.appendChild(
      TPL.h('p', {
        class: 'item-name',
        html: TPL.esc(item.type === 'image' ? item.name : 'نص') +
          '<span class="idx">#' + (index + 1) + '</span>',
      })
    );
    info.appendChild(TPL.h('p', { class: 'item-meta', dir: 'auto', text: meta }));
    head.appendChild(info);

    if (oversized && item.type === 'text') {
      head.appendChild(TPL.h('span', { class: 'badge-long', text: 'طويل' }));
    }

    // ----- أزرار الإجراءات -----
    const actions = TPL.h('div', { class: 'item-actions' });
    actions.addEventListener('click', function (e) { e.stopPropagation(); });

    const btnUp = TPL.h('button', {
      class: 'btn btn-ghost btn-icon', 'aria-label': 'تحريك لأعلى',
      title: 'تحريك لأعلى', disabled: index === 0,
      html: TPL.icon('chevronUp', 15),
      onclick: function () { ED.moveItem(item.id, -1); },
    });
    const btnDown = TPL.h('button', {
      class: 'btn btn-ghost btn-icon', 'aria-label': 'تحريك لأسفل',
      title: 'تحريك لأسفل', disabled: index === total - 1,
      html: TPL.icon('chevronDown', 15),
      onclick: function () { ED.moveItem(item.id, 1); },
    });
    const btnCopy = TPL.h('button', {
      class: 'btn btn-ghost btn-icon', 'aria-label': 'تكرار', title: 'تكرار',
      html: TPL.icon('copy', 14),
      onclick: function () { ED.duplicateItem(item.id); },
    });
    const btnDel = TPL.h('button', {
      class: 'btn btn-ghost btn-icon', 'aria-label': 'حذف', title: 'حذف',
      html: TPL.icon('trash', 14),
      onclick: function () {
        UI.confirm({
          title: 'حذف العنصر؟',
          desc: 'سيتم حذف هذا العنصر من الصفحات. لا يمكن التراجع.',
          confirmLabel: 'حذف',
          danger: true,
          onConfirm: function () { ED.removeItem(item.id); },
        });
      },
    });
    [btnUp, btnDown, btnCopy, btnDel].forEach(function (b) { actions.appendChild(b); });
    head.appendChild(actions);

    head.addEventListener('click', function () {
      ED.setSelected(selected ? null : item.id);
    });
    head.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        ED.setSelected(selected ? null : item.id);
      }
    });

    card.appendChild(head);

    // ----- المحرر الموسّع -----
    if (selected) {
      const editor = TPL.h('div', { class: 'item-editor' });
      if (item.type === 'text') editor.appendChild(buildTextEditor(item, oversized));
      else editor.appendChild(buildImageEditor(item));
      card.appendChild(editor);
    }

    return card;
  }

  // ------------------------------------------------------------
  // محرر النص
  // ------------------------------------------------------------

  function buildTextEditor(item, oversized) {
    const wrap = TPL.h('div');

    const ta = TPL.h('textarea', {
      class: 'txt-textarea',
      dir: 'rtl',
      placeholder: 'اكتب أو الصق النص هنا… (كل سطر جديد = فقرة جديدة)',
    });
    ta.value = item.text || '';
    ta.addEventListener('input', function () {
      ED.updateItem(item.id, { text: ta.value }); // بدون إعادة رسم اللوحة (للحفاظ على التركيز)
    });
    wrap.appendChild(ta);

    const warn = TPL.h('p', {
      class: 'oversized-warn' + (oversized ? ' show' : ''),
      dataset: { warnFor: item.id },
      text: '⚠ إحدى فقرات هذا النص أطول من صفحة كاملة — قسّمها إلى أسطر/فقرات جديدة حتى لا يُقتطع الجزء الزائد.',
    });
    wrap.appendChild(warn);

    // صف الأدوات: عريض + محاذاة + حجم الخط
    const controls = TPL.h('div', { class: 'editor-controls' });

    const segBold = TPL.h('div', { class: 'seg-group' });
    segBold.appendChild(
      TPL.h('button', {
        class: 'seg-btn' + (item.bold ? ' on' : ''),
        'aria-label': 'عريض', title: 'عريض',
        html: TPL.icon('bold', 15),
        onclick: function () { ED.updateItem(item.id, { bold: !item.bold }); PANEL.render(); },
      })
    );
    controls.appendChild(segBold);

    const segAlign = TPL.h('div', { class: 'seg-group' });
    const alignIcons = { right: 'alignRight', center: 'alignCenter', left: 'alignLeft', justify: 'alignJustify' };
    TPL.TEXT_ALIGNS.forEach(function (a) {
      segAlign.appendChild(
        TPL.h('button', {
          class: 'seg-btn' + (item.align === a.value ? ' on' : ''),
          'aria-label': a.label, title: a.label,
          html: TPL.icon(alignIcons[a.value], 15),
          onclick: function () { ED.updateItem(item.id, { align: a.value }); PANEL.render(); },
        })
      );
    });
    controls.appendChild(segAlign);

    const sizeWrap = TPL.h('div', { class: 'size-select-wrap' });
    sizeWrap.innerHTML = TPL.icon('ruler', 15);
    const sel = TPL.h('select', { class: 'size-select', 'aria-label': 'حجم الخط' });
    TPL.FONT_SIZES.forEach(function (f) {
      const opt = TPL.h('option', { value: String(f), text: f + ' px' });
      if (item.fontSize === f) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener('change', function () {
      ED.updateItem(item.id, { fontSize: Number(sel.value) }); // القياس يتغير → سيعاد التدفق
    });
    sizeWrap.appendChild(sel);
    controls.appendChild(sizeWrap);
    wrap.appendChild(controls);

    // الألوان
    const colorRow = TPL.h('div', { class: 'color-row' });
    colorRow.innerHTML = TPL.icon('palette', 15);
    const swatches = TPL.h('div', { class: 'swatches' });
    TPL.TEXT_COLORS.forEach(function (c) {
      swatches.appendChild(
        TPL.h('button', {
          class: 'swatch' + (item.color === c.value ? ' on' : ''),
          type: 'button',
          title: 'لون ' + c.label,
          'aria-label': 'لون ' + c.label,
          style: { backgroundColor: c.value },
          onclick: function () { ED.updateItem(item.id, { color: c.value }); PANEL.render(); },
        })
      );
    });
    colorRow.appendChild(swatches);
    wrap.appendChild(colorRow);

    return wrap;
  }

  // ------------------------------------------------------------
  // محرر الصورة
  // ------------------------------------------------------------

  function buildImageEditor(item) {
    const wrap = TPL.h('div');

    const box = TPL.h('div', { class: 'img-preview-box' });
    box.appendChild(TPL.h('img', { src: item.src, alt: item.name }));
    const boxInfo = TPL.h('div', { style: { minWidth: 0, flex: '1' } });
    boxInfo.appendChild(TPL.h('p', { class: 'n', dir: 'auto', text: item.name }));
    boxInfo.appendChild(
      TPL.h('p', { class: 'd', text: item.natW + '×' + item.natH + ' · نسبة ' + (item.natH / item.natW).toFixed(2) })
    );
    box.appendChild(boxInfo);
    wrap.appendChild(box);

    // حجم العرض
    wrap.appendChild(TPL.h('span', { class: 'opt-label', text: 'حجم العرض' }));
    const wGrid = TPL.h('div', { class: 'opt-grid' });
    TPL.WIDTH_OPTIONS.forEach(function (o) {
      wGrid.appendChild(
        TPL.h('button', {
          class: 'btn ' + (item.widthPct === o.value ? 'btn-primary' : 'btn-outline'),
          text: o.label,
          onclick: function () { ED.updateItem(item.id, { widthPct: o.value }); PANEL.render(); },
        })
      );
    });
    wrap.appendChild(wGrid);

    // المحاذاة
    wrap.appendChild(TPL.h('span', { class: 'opt-label', text: 'المحاذاة' }));
    const aGrid = TPL.h('div', { class: 'opt-grid' });
    [
      { value: 'start', label: 'يمين' },
      { value: 'center', label: 'وسط' },
      { value: 'end', label: 'يسار' },
    ].forEach(function (o) {
      aGrid.appendChild(
        TPL.h('button', {
          class: 'btn ' + (item.align === o.value ? 'btn-primary' : 'btn-outline'),
          text: o.label,
          onclick: function () { ED.updateItem(item.id, { align: o.value }); PANEL.render(); },
        })
      );
    });
    wrap.appendChild(aGrid);

    // التسمية التوضيحية
    wrap.appendChild(TPL.h('span', { class: 'opt-label', text: 'تسمية توضيحية (اختياري)' }));
    const cap = TPL.h('input', {
      class: 'caption-input', dir: 'rtl', type: 'text',
      placeholder: 'مثال: السؤال الأول',
    });
    cap.value = item.caption || '';
    cap.addEventListener('input', function () {
      ED.updateItem(item.id, { caption: cap.value }); // بدون إعادة رسم (الحفاظ على التركيز)
    });
    wrap.appendChild(cap);

    return wrap;
  }

  // ------------------------------------------------------------
  // رسم اللوحة كاملة
  // ------------------------------------------------------------

  function render(oversizedIds) {
    if (!panelEl) return;
    const st = ED.state;
    const scroll = panelEl.querySelector('.items-scroll');
    const prevScroll = scroll ? scroll.scrollTop : 0;

    panelEl.innerHTML = '';

    // أزرار الإضافة
    const addGrid = TPL.h('div', { class: 'add-grid' });
    const fileInput = TPL.h('input', {
      type: 'file', accept: 'image/*', multiple: true, hidden: true,
    });
    fileInput.addEventListener('change', function () {
      handleFiles(fileInput.files);
      fileInput.value = '';
    });
    addGrid.appendChild(
      TPL.h('button', {
        class: 'btn btn-primary',
        html: TPL.icon('upload', 16) + 'رفع صور',
        onclick: function () { fileInput.click(); },
      })
    );
    addGrid.appendChild(
      TPL.h('button', {
        class: 'btn btn-secondary',
        html: TPL.icon('plus', 16) + 'إضافة نص',
        onclick: function () { ED.addTextItem({ text: '' }); },
      })
    );
    addGrid.appendChild(fileInput);
    panelEl.appendChild(addGrid);

    // منطقة السحب والإفلات
    const dzWrap = TPL.h('div', { class: 'dropzone-wrap' });
    const dz = TPL.h('div', {
      class: 'dropzone',
      html: TPL.icon('imagePlus', 24) +
        '<p class="dz-main">اسحب الصور إلى هنا</p>' +
        '<p class="dz-sub">أو الصق صورة من الحافظة (Ctrl+V)</p>',
    });
    dz.addEventListener('dragover', function (e) {
      e.preventDefault();
      dz.classList.add('drag-over');
    });
    dz.addEventListener('dragleave', function () { dz.classList.remove('drag-over'); });
    dz.addEventListener('drop', function (e) {
      e.preventDefault();
      dz.classList.remove('drag-over');
      handleFiles(e.dataTransfer.files);
    });
    dzWrap.appendChild(dz);
    panelEl.appendChild(dzWrap);

    // رأس القائمة
    const listHeader = TPL.h('div', { class: 'panel-list-header' });
    const h3 = TPL.h('h3');
    h3.innerHTML = TPL.icon('images', 16) + 'المحتوى<span class="count-pill">' + st.items.length + '</span>';
    listHeader.appendChild(h3);
    if (st.items.length > 0) {
      listHeader.appendChild(
        TPL.h('button', {
          class: 'btn btn-ghost btn-sm btn-clear-all',
          html: TPL.icon('trash', 13) + 'مسح الكل',
          onclick: function () {
            UI.confirm({
              title: 'مسح كل المحتوى؟',
              desc: 'سيتم حذف جميع الصور والنصوص من المحرر.',
              confirmLabel: 'مسح الكل',
              danger: true,
              onConfirm: function () { ED.clearAll(); },
            });
          },
        })
      );
    }
    panelEl.appendChild(listHeader);

    // قائمة العناصر
    const scrollEl = TPL.h('div', { class: 'items-scroll' });
    if (st.items.length === 0) {
      const empty = TPL.h('div', { class: 'empty-items' });
      empty.innerHTML =
        '<p class="t">لا يوجد محتوى بعد</p>' +
        '<p class="s">ارفع صور الأسئلة/التمارين أو أضف نصوصاً وستظهر مباشرة داخل قالب الصفحة</p>';
      scrollEl.appendChild(empty);
    } else {
      st.items.forEach(function (it, i) {
        scrollEl.appendChild(
          buildItemCard(it, i, st.items.length, !!(oversizedIds && oversizedIds[it.id]))
        );
      });
    }
    panelEl.appendChild(scrollEl);
    scrollEl.scrollTop = prevScroll;

    // شارة العدد في تبويب الجوال
    const tabCount = document.getElementById('tab-count');
    if (tabCount) {
      tabCount.textContent = String(st.items.length);
      tabCount.hidden = st.items.length === 0;
    }
  }

  /** تحديث شارات "طويل" وتحذيرات النصوص الطويلة دون إعادة رسم كاملة */
  function updateOversized(oversizedIds) {
    if (!panelEl) return;
    panelEl.querySelectorAll('.badge-long').forEach(function (b) {
      const card = b.closest('.item-card');
      if (!card) return;
      const id = card.dataset.id;
      b.style.display = oversizedIds[id] ? '' : 'none';
    });
    panelEl.querySelectorAll('.oversized-warn').forEach(function (w) {
      w.classList.toggle('show', !!oversizedIds[w.dataset.warnFor]);
    });
  }

  /** تفعيل اللصق من الحافظة في كامل التطبيق */
  function initPaste() {
    document.addEventListener('paste', function (e) {
      const target = e.target;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return;
      const files = e.clipboardData && e.clipboardData.files;
      if (files && files.length > 0) {
        e.preventDefault();
        handleFiles(files);
      }
    });
  }

  window.PANEL = {
    mount: function (el) {
      panelEl = el;
      initPaste();
    },
    render, updateOversized, handleFiles,
  };
})();
