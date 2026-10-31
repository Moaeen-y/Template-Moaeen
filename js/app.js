/* ============================================================
 * app.js — منطق التطبيق الرئيسي
 * التنقل بين الرئيسية/المحرر + خط سير إعادة التدفق (قياس →
 * توزيع → رسم المعاينة) + شريط الأدوات + التصدير + التنبيهات
 * ============================================================ */
(function () {
  'use strict';

  const TPL = window.TPL;

  // ---------------- حالة العرض ----------------
  let currentPages = [];      // صفحات الوحدات الحالية
  let pageEls = [];           // عناصر DOM لصفحات القالب
  let previewScales = [];     // عناصر التكبير {outer, inner}
  let lastOversized = {};
  let reflowToken = 0;
  let reflowQueued = false;
  let exporting = null;

  // ============================================================
  // أدوات واجهة عامة (تنبيهات + نافذة تأكيد)
  // ============================================================

  const UI = {
    toast: function (msg, type) {
      const root = document.getElementById('toast-root');
      const t = TPL.h('div', { class: 'toast ' + (type || 'info'), text: msg });
      root.appendChild(t);
      setTimeout(function () {
        t.style.transition = 'opacity .3s';
        t.style.opacity = '0';
        setTimeout(function () { t.remove(); }, 320);
      }, 3500);
    },

    confirm: function (opts) {
      const root = document.getElementById('modal-root');
      root.innerHTML = '';

      const overlay = TPL.h('div', { class: 'modal-overlay' });
      const card = TPL.h('div', { class: 'modal-card' });
      card.appendChild(TPL.h('h4', { text: opts.title }));
      card.appendChild(TPL.h('p', { text: opts.desc }));

      const actions = TPL.h('div', { class: 'modal-actions' });
      actions.appendChild(
        TPL.h('button', {
          class: 'btn btn-outline btn-sm',
          text: 'إلغاء',
          onclick: function () { root.innerHTML = ''; },
        })
      );
      actions.appendChild(
        TPL.h('button', {
          class: 'btn btn-sm ' + (opts.danger ? 'btn-destructive' : 'btn-primary'),
          text: opts.confirmLabel || 'تأكيد',
          onclick: function () {
            root.innerHTML = '';
            if (opts.onConfirm) opts.onConfirm();
          },
        })
      );
      card.appendChild(actions);
      overlay.appendChild(card);
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) root.innerHTML = '';
      });
      root.appendChild(overlay);
    },
  };
  window.UI = UI;

  // ============================================================
  // الرئيسية — الصفحة المصغّرة التجريبية
  // ============================================================

  function buildMiniPage() {
    const slot = document.getElementById('mini-page-slot');
    if (!slot) return;

    const placeholderImg =
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="150">' +
        '<rect x="2" y="2" width="636" height="146" rx="10" fill="#eef1f4" stroke="#c9d2da" stroke-width="2" stroke-dasharray="8 6"/>' +
        '<rect x="150" y="55" width="340" height="40" rx="8" fill="#dde4ea"/></svg>'
      );

    const title = {
      id: 's1', type: 'text', text: 'تجميعة الواجبات — الفصل الأول',
      fontSize: 24, bold: true, color: '#0a4d42', align: 'center', spacing: 1.5,
    };
    const body = {
      id: 's2', type: 'text', text: 'أولاً: حل التمارين من صفحة ١٢ إلى صفحة ١٨ ثم راجع الحلول المرفقة.',
      fontSize: 15, bold: false, color: '#22223b', align: 'right', spacing: 1.8,
    };
    const img = {
      id: 's3', type: 'image', src: placeholderImg, name: 'sample',
      natW: 640, natH: 150, widthPct: 100, align: 'center', caption: '',
    };
    const body2 = Object.assign({}, body, {
      id: 's4', text: 'ثانياً: استعن بالروابط في الأعلى للانضمام للمجموعة ومتابعة القناة.',
    });

    const units = [
      { kind: 'para', item: title, text: title.text },
      { kind: 'para', item: body, text: body.text },
      { kind: 'image', item: img, widthPct: 100 },
      { kind: 'para', item: body2, text: body2.text },
    ];

    slot.innerHTML = '';
    const scaleBox = TPL.h('div', {
      class: 'mini-page-scale',
      style: { transform: 'scale(0.235)' },
    });
    scaleBox.appendChild(window.PAGE.buildPage(units));
    slot.appendChild(scaleBox);
  }

  // ============================================================
  // المعاينة — رسم الصفحات
  // ============================================================

  function updateZoomUI() {
    const el = document.getElementById('zoom-value');
    if (el) el.textContent = Math.round(ED.state.zoom * 100) + '%';
    const z = ED.state.zoom;
    previewScales.forEach(function (ps) {
      ps.outer.style.width = TPL.PAGE_W * z + 'px';
      ps.outer.style.height = TPL.PAGE_H * z + 'px';
      ps.inner.style.transform = 'scale(' + z + ')';
    });
  }

  function renderPreview(pages) {
    const list = document.getElementById('pages-list');
    list.innerHTML = '';
    pageEls = [];
    previewScales = [];

    const st = ED.state;
    const hasContent = st.items.length > 0 && pages.length > 0 &&
      (pages.length > 1 || pages[0].length > 0);
    const totalPages = pages.length;
    const z = st.zoom;

    if (hasContent) {
      // تنبيه الروابط التفاعلية
      const pill = TPL.h('div', { class: 'hint-pill' });
      pill.innerHTML =
        TPL.icon('pointerClick', 14) +
        '<span>أزرار (انضمام · متابعة · تواصل معنا · هنا) روابط تفاعلية — جرّب الضغط عليها</span>' +
        '<span class="sep">· ' + TPL.icon('smartphone', 12) + ' التصدير بنفس جودة الطباعة</span>';
      list.appendChild(pill);
    }

    pages.forEach(function (units, i) {
      const block = TPL.h('div', { class: 'page-block' });

      if (hasContent) {
        const row = TPL.h('div', { class: 'page-row' });
        row.appendChild(
          TPL.h('span', {
            class: 'page-badge',
            text: 'صفحة ' + (i + 1) + (totalPages > 1 ? ' من ' + totalPages : ''),
          })
        );
        row.appendChild(
          TPL.h('button', {
            class: 'btn-page-png',
            title: 'تنزيل هذه الصفحة PNG',
            'aria-label': 'تنزيل هذه الصفحة PNG',
            html: TPL.icon('download', 14),
            onclick: function () {
              if (pageEls[i]) window.EXPORTS.exportPagePng(pageEls[i], i + 1);
            },
          })
        );
        block.appendChild(row);
      }

      const outer = TPL.h('div', {
        class: 'page-scale-outer',
        style: { width: TPL.PAGE_W * z + 'px', height: TPL.PAGE_H * z + 'px' },
      });
      const inner = TPL.h('div', {
        class: 'page-scale-inner',
        style: { transform: 'scale(' + z + ')' },
      });
      const pageEl = window.PAGE.buildPage(units, {
        emptyHint: !hasContent,
        pageIndex: hasContent ? i + 1 : undefined,
        totalPages: hasContent ? totalPages : undefined,
      });
      pageEls.push(pageEl);
      inner.appendChild(pageEl);
      outer.appendChild(inner);
      previewScales.push({ outer: outer, inner: inner });
      block.appendChild(outer);
      list.appendChild(block);
    });

    if (hasContent) {
      list.appendChild(
        TPL.h('div', {
          class: 'pages-footer-note',
          text: 'ينقسم المحتوى تلقائياً على الصفحات — ' + totalPages +
            (totalPages === 1 ? ' صفحة' : ' صفحات'),
        })
      );
    } else {
      // لفّ حالة الفراغ في وسط منطقة المعاينة
      const wrap = TPL.h('div', { class: 'preview-empty-wrap' });
      while (list.firstChild) wrap.appendChild(list.firstChild);
      list.appendChild(wrap);
    }
  }

  // ============================================================
  // خط سير إعادة التدفق: عناصر → قياس → توزيع → رسم
  // ============================================================

  function scheduleReflow() {
    if (reflowQueued) return;
    reflowQueued = true;
    requestAnimationFrame(function () {
      reflowQueued = false;
      doReflow();
    });
  }

  async function doReflow() {
    const token = ++reflowToken;
    const units = window.PAG.itemsToUnits(ED.state.items);
    const heights = await window.PAG.renderMeasure(units);
    if (token !== reflowToken) return; // نتيجة قديمة — تجاهل
    const res = window.PAG.packPages(units, heights);
    currentPages = res.pages;
    lastOversized = res.oversized;
    renderPreview(currentPages);
    window.PANEL.updateOversized(lastOversized);
  }

  // ============================================================
  // التصدير
  // ============================================================

  const EXPORT_BTNS = {
    pdf: document.getElementById('btn-export-pdf'),
    docx: document.getElementById('btn-export-docx'),
    zip: document.getElementById('btn-export-zip'),
  };
  const EXPORT_LABELS = { pdf: 'PDF', docx: 'Word', zip: 'صور' };

  function setExporting(kind) {
    exporting = kind;
    Object.keys(EXPORT_BTNS).forEach(function (k) {
      const btn = EXPORT_BTNS[k];
      if (!btn) return;
      btn.disabled = kind != null;
      const ic = btn.querySelector('.ic');
      if (k === kind && ic) {
        const sp = document.createElement('span');
        sp.className = 'spinner ic';
        ic.replaceWith(sp);
      } else {
        const sp = btn.querySelector('.spinner');
        if (sp) {
          sp.insertAdjacentHTML('beforebegin', btn.dataset.iconHtml || '');
          sp.remove();
        }
      }
    });
  }

  async function runExport(kind) {
    if (exporting) return;
    const st = ED.state;
    const units = window.PAG.itemsToUnits(st.items);
    const hasContent = st.items.length > 0 && units.length > 0;
    if (!hasContent) {
      UI.toast('أضف صوراً أو نصوصاً أولاً', 'error');
      return;
    }
    if (kind !== 'docx' && pageEls.length === 0) {
      UI.toast('لا توجد صفحات للتصدير', 'error');
      return;
    }
    setExporting(kind);
    try {
      if (kind === 'pdf') {
        await window.EXPORTS.exportPdf(pageEls, 'التجميعات-تحضيري.pdf');
        UI.toast('تم تنزيل ملف PDF مع الروابط التفاعلية ✓', 'success');
      } else if (kind === 'zip') {
        await window.EXPORTS.exportZip(pageEls, 'التجميعات-صفحات.zip');
        UI.toast('تم تنزيل الصور (ZIP) ✓', 'success');
      } else {
        await window.EXPORTS.exportDocx(st.items, 'التجميعات-تحضيري.docx');
        UI.toast('تم تنزيل ملف Word ✓', 'success');
      }
    } catch (e) {
      console.error(e);
      UI.toast(e && e.message ? e.message : 'حدث خطأ أثناء التصدير', 'error');
    } finally {
      setExporting(null);
    }
  }

  // ============================================================
  // التنقل والتهيئة
  // ============================================================

  function showView(name) {
    document.getElementById('view-home').hidden = name !== 'home';
    document.getElementById('view-editor').hidden = name !== 'editor';
  }

  function setMobileTab(tab) {
    ED.state.mobileTab = tab;
    document.querySelector('.editor-body').dataset.tab = tab;
    document.querySelectorAll('.mobile-tab').forEach(function (b) {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
  }

  function init() {
    // استرجاع الحالة المحفوظة
    ED.load();

    // الرئيسية
    buildMiniPage();
    document.getElementById('btn-start').addEventListener('click', function () {
      showView('editor');
      PANEL.render(lastOversized);
      scheduleReflow();
    });

    // شريط الأدوات
    document.getElementById('btn-back').addEventListener('click', function () {
      showView('home');
    });
    document.getElementById('zoom-in').addEventListener('click', function () {
      ED.setZoom(ED.state.zoom + 0.1);
    });
    document.getElementById('zoom-out').addEventListener('click', function () {
      ED.setZoom(ED.state.zoom - 0.1);
    });

    // حفظ أيقونات أزرار التصدير (لاستعادتها بعد التحميل)
    Object.keys(EXPORT_BTNS).forEach(function (k) {
      const btn = EXPORT_BTNS[k];
      if (btn) btn.dataset.iconHtml = btn.querySelector('.ic').outerHTML;
    });
    EXPORT_BTNS.pdf.addEventListener('click', function () { runExport('pdf'); });
    EXPORT_BTNS.docx.addEventListener('click', function () { runExport('docx'); });
    EXPORT_BTNS.zip.addEventListener('click', function () { runExport('zip'); });

    // تبويبات الجوال
    document.querySelectorAll('.mobile-tab').forEach(function (b) {
      b.addEventListener('click', function () { setMobileTab(b.dataset.tab); });
    });
    setMobileTab(ED.state.mobileTab || 'preview');

    // لوحة المحتوى
    PANEL.mount(document.getElementById('items-panel'));
    PANEL.render({});

    // الاستماع لتغييرات الحالة
    ED.subscribe(function (state, opts) {
      if (opts.zoomOnly) {
        updateZoomUI();
        return;
      }
      if (opts.structural) PANEL.render(lastOversized);
      scheduleReflow();
    });

    updateZoomUI();

    // أول تدفق بعد جاهزية الخطوط (لضمان دقة قياس النصوص)
    scheduleReflow();
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { scheduleReflow(); });
    }
    // إعادة القياس عند اكتمال تحميل الخطوط المرتبطة لاحقاً
    if (document.fonts && document.fonts.addEventListener) {
      document.fonts.addEventListener('loadingdone', function () { scheduleReflow(); });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
