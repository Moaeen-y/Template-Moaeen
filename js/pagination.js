/* ============================================================
 * pagination.js — محرك التوزيع التلقائي على صفحات A4
 * (منفذ من use-pagination.ts)
 * 1) تحويل العناصر إلى وحدات ذرّية (صورة / فقرة)
 * 2) قياس كل وحدة داخل حاوية مخفية بنفس عرض منطقة المحتوى
 * 3) حشد الوحدات جشعاً في صفحات بحسب الارتفاع المتاح
 * ============================================================ */
(function () {
  'use strict';

  const TPL = window.TPL;

  /**
   * حساب عرض عرض الصورة كنسبة حتى لا تتجاوز صفحة واحدة كاملة.
   * نحجز ~34 بكسل لسطر تسمية توضيحية محتمل.
   */
  function imageFitPct(item) {
    const fullW = TPL.CONTENT_W;
    const limit = TPL.CONTENT_INNER_H - 34;
    const hAtFull = (item.natH / item.natW) * fullW;
    if (hAtFull <= limit) return 100;
    const fit = ((limit * item.natW) / (item.natH * fullW)) * 100;
    return Math.max(12, fit);
  }

  /** العناصر → وحدات ذرّية */
  function itemsToUnits(items) {
    const units = [];
    items.forEach(function (it) {
      if (it.type === 'image') {
        units.push({ kind: 'image', item: it, widthPct: Math.min(it.widthPct, imageFitPct(it)) });
      } else {
        TPL.splitParas(it.text).forEach(function (p) {
          units.push({ kind: 'para', item: it, text: p });
        });
      }
    });
    return units;
  }

  /**
   * تعبئة حاوية القياس المخفية بالوحدات، ثم انتظار اكتمال تحميل
   * كل الصور وإرجاع مصفوفة الارتفاعات (بكسل).
   */
  function renderMeasure(units) {
    const mc = document.getElementById('measure-container');
    mc.innerHTML = '';
    mc.style.width = TPL.CONTENT_W + 'px';
    mc.style.fontFamily = "'Cairo', 'Segoe UI', Tahoma, sans-serif";

    units.forEach(function (u) {
      if (u.kind === 'image') {
        const wrap = TPL.h('div', {
          style: {
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems:
              u.item.align === 'center' ? 'center' : u.item.align === 'end' ? 'flex-end' : 'flex-start',
          },
        });
        wrap.appendChild(
          TPL.h('img', {
            src: u.item.src,
            alt: '',
            style: {
              width: ((u.widthPct / 100) * TPL.CONTENT_W) + 'px',
              display: 'block',
              borderRadius: '6px',
            },
          })
        );
        if (u.item.caption) {
          wrap.appendChild(
            TPL.h('div', {
              text: u.item.caption,
              style: {
                marginTop: '6px',
                fontSize: '14px',
                color: '#5b5f6e',
                textAlign: 'center',
                width: '100%',
                fontWeight: 600,
              },
            })
          );
        }
        mc.appendChild(wrap);
      } else {
        mc.appendChild(
          TPL.h('p', {
            text: u.text,
            style: {
              fontSize: u.item.fontSize + 'px',
              fontWeight: u.item.bold ? 800 : 400,
              color: u.item.color,
              lineHeight: String(u.item.spacing),
              textAlign: u.item.align,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              margin: '0',
            },
          })
        );
      }
    });

    return new Promise(function (resolve) {
      function check() {
        const imgs = Array.prototype.slice.call(mc.querySelectorAll('img'));
        if (imgs.every(function (im) { return im.complete; })) {
          const heights = Array.prototype.slice.call(mc.children).map(function (c) {
            return c.getBoundingClientRect().height;
          });
          resolve(heights);
        } else {
          requestAnimationFrame(check);
        }
      }
      requestAnimationFrame(check);
    });
  }

  /** الحشد الجشع للوحدات في صفحات */
  function packPages(units, heights) {
    const pages = [[]];
    const oversized = {};
    let remaining = TPL.CONTENT_INNER_H;

    units.forEach(function (u, i) {
      const hh = heights[i] != null ? heights[i] : 0;
      if (u.kind === 'para' && hh > TPL.CONTENT_INNER_H) oversized[u.item.id] = true;
      const cur = pages[pages.length - 1];
      const gap = cur.length > 0 ? TPL.ITEM_GAP : 0;
      if (cur.length === 0 || hh + gap <= remaining) {
        cur.push(u);
        remaining -= hh + gap;
      } else {
        pages.push([u]);
        remaining = TPL.CONTENT_INNER_H - hh;
      }
    });

    return { pages: pages, oversized: oversized };
  }

  window.PAG = { itemsToUnits, renderMeasure, packPages, imageFitPct };
})();
