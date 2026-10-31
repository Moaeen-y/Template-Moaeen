/* ============================================================
 * template.js — ثوابت القالب والأدوات المشتركة
 * (مطابق لـ src/lib/template.ts في نسخة Next.js)
 * هندسة الصفحة مبنية على A4 بدقة 96dpi = 794×1123 بكسل
 * وارتفاعات العناصر مشتقة من نسب صور القالب الفعلية:
 *   header 2475×389 · links-bar 2478×144 · footer 2473×289
 * ============================================================ */
(function () {
  'use strict';

  const PAGE_W = 794;
  const PAGE_H = 1123;

  const HEADER_H = (PAGE_W * 389) / 2475;   // ≈ 124.79
  const BAR_H = (PAGE_W * 144) / 2478;      // ≈ 46.17
  const FOOTER_H = (PAGE_W * 289) / 2473;   // ≈ 92.79

  const CONTENT_H = PAGE_H - HEADER_H - BAR_H - FOOTER_H; // ≈ 859.2

  /** حشوة داخلية لمنطقة المحتوى (بعيدة عن الإطار الأخضر في الخلفية) */
  const CONTENT_PAD_X = 46;
  const CONTENT_PAD_Y = 26;

  const CONTENT_W = PAGE_W - CONTENT_PAD_X * 2;              // ≈ 702
  const CONTENT_INNER_H = CONTENT_H - CONTENT_PAD_Y * 2;     // ≈ 807.2

  /** المسافة الرأسية بين عناصر المحتوى المتتالية */
  const ITEM_GAP = 14;

  // ------------------------------------------------------------
  // الروابط (روابط واتساب الثابتة)
  // ------------------------------------------------------------
  const LINKS = {
    join: 'https://chat.whatsapp.com/Bk14vC3it6LFd1uPOHG374?s=cl&p=a&mlu=4&ilr=4',
    follow: 'https://whatsapp.com/channel/0029VakYpEgJf05cOelgFv3t',
    contact: 'https://wa.me/+966536004199',
  };

  /**
   * نقاط النقر فوق صور القالب — نسب مئوية من العرض (من اليسار)
   * تم التحقق منها بتحليل بكسلات الصور الفعلية.
   */
  const LINKS_BAR_HOTSPOTS = [
    { left: 0.5, width: 8, url: LINKS.contact, title: 'هنا — تواصل عبر واتساب' },
    { left: 12.5, width: 9.5, url: LINKS.contact, title: 'تواصل معنا' },
    { left: 40.5, width: 15.5, url: LINKS.follow, title: 'متابعة — قناة الواتساب' },
    { left: 56, width: 28, url: LINKS.join, title: 'قروب التجميعات' },
    { left: 84, width: 15, url: LINKS.join, title: 'انضمام — قروب الواتساب' },
  ];

  const FOOTER_HOTSPOTS = [
    { left: 1.5, width: 26, url: LINKS.contact, title: 'واتساب الدعم' },
    { left: 31.5, width: 13.5, url: LINKS.contact, title: 'تواصل معنا' },
  ];

  // ------------------------------------------------------------
  // خيارات التنسيق
  // ------------------------------------------------------------
  const TEXT_COLORS = [
    { value: '#22223b', label: 'كحلي' },
    { value: '#0a4d42', label: 'أخضر' },
    { value: '#a4161a', label: 'أحمر' },
    { value: '#a16207', label: 'ذهبي' },
    { value: '#1e3a8a', label: 'أزرق' },
    { value: '#374151', label: 'رمادي' },
  ];

  const FONT_SIZES = [13, 15, 17, 20, 24, 30, 38];

  const TEXT_ALIGNS = [
    { value: 'right', label: 'يمين' },
    { value: 'center', label: 'وسط' },
    { value: 'left', label: 'يسار' },
    { value: 'justify', label: 'ضبط' },
  ];

  const WIDTH_OPTIONS = [
    { value: 100, label: 'كامل العرض' },
    { value: 75, label: '75%' },
    { value: 50, label: '50%' },
  ];

  // ------------------------------------------------------------
  // أدوات مساعدة
  // ------------------------------------------------------------

  function uid() {
    return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  /** تقسيم النص إلى فقرات (الأسطر غير الفارغة) */
  function splitParas(text) {
    return String(text || '')
      .split(/\r?\n/)
      .filter(function (t) { return t.trim().length > 0; });
  }

  /** تهريب نص لإدراجه بأمان داخل HTML */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /** إنشاء عنصر DOM بسرعة */
  function h(tag, attrs, children) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const k in attrs) {
        const v = attrs[k];
        if (v == null || v === false) continue;
        if (k === 'style' && typeof v === 'object') {
          Object.assign(el.style, v);
        } else if (k === 'dataset') {
          Object.assign(el.dataset, v);
        } else if (k === 'text') {
          el.textContent = String(v);
        } else if (k.slice(0, 2) === 'on') {
          el.addEventListener(k.slice(2), v);
        } else if (k === 'html') {
          el.innerHTML = v;
        } else if (v === true) {
          el.setAttribute(k, '');
        } else {
          el.setAttribute(k, v);
        }
      }
    }
    if (children != null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c == null) return;
        el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
      });
    }
    return el;
  }

  // ------------------------------------------------------------
  // أيقونات SVG (lucide-style)
  // ------------------------------------------------------------

  const P = {
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    chevronUp: '<path d="m18 15-6-6-6 6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    grip: '<circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>',
    fileText: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
    images: '<path d="M21 17v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M3 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z"/><circle cx="9" cy="9" r="2"/><path d="m3 17 5-5 4 4 3-3 3 3"/>',
    imagePlus: '<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7"/><path d="m16 5 2 2 4-4"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    bold: '<path d="M7 4h6a3.5 3.5 0 1 1 0 7H7Z"/><path d="M7 11h7a3.5 3.5 0 1 1 0 7H7Z"/>',
    alignRight: '<path d="M21 6H3"/><path d="M21 12H9"/><path d="M21 18H13"/>',
    alignCenter: '<path d="M21 6H3"/><path d="M17 12H7"/><path d="M21 18H3"/>',
    alignLeft: '<path d="M3 6h18"/><path d="M3 12h10"/><path d="M3 18h14"/>',
    alignJustify: '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
    palette: '<path d="M12 22a10 10 0 1 1 10-10c0 1.7-1.3 3-3 3h-2a2 2 0 0 0-2 2c0 .6.2 1 .5 1.5.3.4.5.9.5 1.5a2 2 0 0 1-2 2Z"/><circle cx="8.5" cy="10.5" r="1"/><circle cx="12" cy="7" r="1"/><circle cx="15.5" cy="10.5" r="1"/>',
    ruler: '<path d="M21.3 8.7 8.7 21.3a1 1 0 0 1-1.4 0l-4.6-4.6a1 1 0 0 1 0-1.4L15.3 2.7a1 1 0 0 1 1.4 0l4.6 4.6a1 1 0 0 1 0 1.4Z"/><path d="m7.5 10.5 2 2"/><path d="m10.5 7.5 2 2"/><path d="m13.5 4.5 2 2"/><path d="m4.5 13.5 2 2"/>',
    pointerClick: '<path d="m9 9 5 12 1.8-5.2L21 14 9 9Z"/><path d="M7.2 2.2 8 5.1"/><path d="m5.1 8-2.9-.8"/><path d="M14 4.1 12 6"/><path d="m6 12-1.9 2"/>',
    smartphone: '<rect width="14" height="20" x="5" y="2" rx="2"/><path d="M12 18h.01"/>',
  };

  function icon(name, size, cls) {
    const s = size || 16;
    const body = P[name] || '';
    return (
      '<svg' + (cls ? ' class="' + cls + '"' : '') + ' width="' + s + '" height="' + s +
      '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
      body + '</svg>'
    );
  }

  // تصدير الواجهة العامة
  window.TPL = {
    PAGE_W, PAGE_H, HEADER_H, BAR_H, FOOTER_H, CONTENT_H,
    CONTENT_PAD_X, CONTENT_PAD_Y, CONTENT_W, CONTENT_INNER_H, ITEM_GAP,
    LINKS, LINKS_BAR_HOTSPOTS, FOOTER_HOTSPOTS,
    TEXT_COLORS, FONT_SIZES, TEXT_ALIGNS, WIDTH_OPTIONS,
    uid, splitParas, esc, h, icon,
  };
})();
