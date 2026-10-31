/* ============================================================
 * page.js — بناء صفحة القالب A4 (منفذ من page-canvas.tsx)
 * كل صفحة: هيدر + شريط روابط (روابط تفاعلية) + منطقة محتوى
 * بخلفية القالب + فوتر (روابط تفاعلية)
 * ============================================================ */
(function () {
  'use strict';

  const TPL = window.TPL;
  const esc = TPL.esc;

  /** صور القالب (نفس الأصل — ضروري لتصدير نظيف بدون CORS) */
  const HEADER_SRC = 'template/header.jpg';
  const BAR_SRC = 'template/links-bar.png';
  const BG_SRC = 'template/page-bg.jpg';
  const FOOTER_SRC = 'template/footer.png';

  function buildImg(src, w, h, alt) {
    return TPL.h('img', {
      class: 'tp-img',
      src, alt: alt || '',
      width: w, height: h,
      style: { width: w + 'px', height: h + 'px', objectFit: 'fill' },
    });
  }

  /** روابط تفاعلية فوق صورة الشريط/الفوتر */
  function buildHotspots(hotspots) {
    return hotspots.map(function (hs) {
      return TPL.h('a', {
        class: 'hotspot',
        href: hs.url,
        target: '_blank',
        rel: 'noopener noreferrer',
        title: hs.title,
        'aria-label': hs.title,
        style: { left: hs.left + '%', width: hs.width + '%' },
        onclick: function (e) { e.stopPropagation(); },
      }, TPL.h('span', { class: 'ring' }));
    });
  }

  /** فقرة نص */
  function buildTextPara(text, item) {
    return TPL.h('p', {
      text,
      style: {
        fontSize: item.fontSize + 'px',
        fontWeight: item.bold ? 800 : 400,
        color: item.color,
        lineHeight: String(item.spacing),
        textAlign: item.align,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        margin: '0',
      },
    });
  }

  /** كتلة صورة */
  function buildImageBlock(unit) {
    const item = unit.item;
    const w = (unit.widthPct / 100) * TPL.CONTENT_W;
    const justify =
      item.align === 'center' ? 'center' : item.align === 'end' ? 'flex-end' : 'flex-start';
    const fig = TPL.h('figure', {
      class: 'tp-fig',
      style: { alignItems: justify },
    });
    fig.appendChild(
      TPL.h('img', {
        src: item.src,
        alt: item.caption || item.name,
        style: { width: w + 'px', display: 'block', borderRadius: '6px' },
      })
    );
    if (item.caption) {
      fig.appendChild(TPL.h('figcaption', { text: item.caption }));
    }
    return fig;
  }

  /**
   * بناء صفحة كاملة بحجمها الطبيعي (794×1123)
   * opts: { emptyHint, pageIndex, totalPages }
   */
  function buildPage(units, opts) {
    opts = opts || {};
    units = units || [];
    const gap = units.length > 1 ? TPL.ITEM_GAP : 0;

    const page = TPL.h('div', {
      class: 'tp-page',
      'data-page-canvas': 'true',
    });

    // الهيدر
    page.appendChild(buildImg(HEADER_SRC, TPL.PAGE_W, TPL.HEADER_H));

    // شريط الروابط + الروابط التفاعلية
    const barWrap = TPL.h('div', {
      style: { position: 'relative', width: TPL.PAGE_W + 'px', height: TPL.BAR_H + 'px' },
    });
    barWrap.appendChild(buildImg(BAR_SRC, TPL.PAGE_W, TPL.BAR_H, 'شريط الروابط'));
    buildHotspots(TPL.LINKS_BAR_HOTSPOTS).forEach(function (a) { barWrap.appendChild(a); });
    page.appendChild(barWrap);

    // منطقة المحتوى بخلفية القالب
    const content = TPL.h('div', {
      class: 'tp-content',
      style: {
        width: TPL.PAGE_W + 'px',
        height: TPL.CONTENT_H + 'px',
        backgroundImage: 'url(' + BG_SRC + ')',
        backgroundSize: '100% 100%',
      },
    });

    if (typeof opts.pageIndex === 'number' && opts.totalPages && opts.totalPages > 1) {
      content.appendChild(
        TPL.h('div', {
          class: 'tp-pagenum',
          text: 'صفحة ' + opts.pageIndex + ' من ' + opts.totalPages,
        })
      );
    }

    const flow = TPL.h('div', {
      class: 'tp-flow',
      style: {
        padding: TPL.CONTENT_PAD_Y + 'px ' + TPL.CONTENT_PAD_X + 'px',
        gap: gap + 'px',
      },
    });

    if (units.length === 0 && opts.emptyHint) {
      const hint = TPL.h('div', { class: 'tp-empty-hint' });
      hint.innerHTML =
        '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#a8aebc" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
        '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.6"/><path d="m21 15-5-5L5 21"/></svg>' +
        '<div class="t1">أضف صوراً أو نصوصاً لتظهر هنا</div>' +
        '<div class="t2">استخدم لوحة المحتوى الجانبية للرفع واللصق</div>';
      flow.appendChild(hint);
    }

    units.forEach(function (u) {
      flow.appendChild(u.kind === 'image' ? buildImageBlock(u) : buildTextPara(u.text, u.item));
    });

    content.appendChild(flow);
    page.appendChild(content);

    // الفوتر + الروابط التفاعلية
    const footerWrap = TPL.h('div', {
      style: { position: 'relative', width: TPL.PAGE_W + 'px', height: TPL.FOOTER_H + 'px' },
    });
    footerWrap.appendChild(buildImg(FOOTER_SRC, TPL.PAGE_W, TPL.FOOTER_H, 'الفوتر'));
    buildHotspots(TPL.FOOTER_HOTSPOTS).forEach(function (a) { footerWrap.appendChild(a); });
    page.appendChild(footerWrap);

    return page;
  }

  window.PAGE = { buildPage, buildImageBlock, buildTextPara, HEADER_SRC, BAR_SRC, BG_SRC, FOOTER_SRC };
})();
