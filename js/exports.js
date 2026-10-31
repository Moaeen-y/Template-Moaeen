/* ============================================================
 * exports.js — التصدير: PDF (روابط تفاعلية) · صور PNG · ZIP · Word
 * (منفذ من lib/export.ts + api/export-docx/route.ts — التصدير
 * الآن بالكامل داخل المتصفح، لا حاجة لأي خادم)
 * ============================================================ */
(function () {
  'use strict';

  const TPL = window.TPL;

  /** A4 بالنقاط */
  const A4_W_PT = 595.28;
  const A4_H_PT = 841.89;
  /** بكسل CSS → نقطة */
  const S = A4_W_PT / TPL.PAGE_W; // 0.75

  /** مضاعف دقة الالتقاط (≈300DPI) */
  const EXPORT_RATIO = 2480 / TPL.PAGE_W;

  function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function triggerBlobDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    triggerDownload(url, filename);
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  async function capturePage(el, type) {
    // التأكد من جاهزية الخطوط قبل التضمين
    try { await document.fonts.ready; } catch (e) { /* تجاهل */ }
    const opts = {
      pixelRatio: EXPORT_RATIO,
      backgroundColor: '#ffffff',
      cacheBust: true,
    };
    const lib = window.htmlToImage;
    // النداء الأول قد يفوّت الخطوط المضمّنة — ننادي مرتين (حل معروف)
    if (type === 'jpeg') {
      await lib.toJpeg(el, Object.assign({}, opts, { quality: 0.95 }));
      return lib.toJpeg(el, Object.assign({}, opts, { quality: 0.95 }));
    }
    await lib.toPng(el, opts);
    return lib.toPng(el, opts);
  }

  /** إضافة روابط تفاعلية لصفحة واحدة (تُستدعى بعد setPage) */
  function addPageLinks(pdf) {
    TPL.LINKS_BAR_HOTSPOTS.forEach(function (hs) {
      pdf.link(
        (hs.left / 100) * TPL.PAGE_W * S,
        TPL.HEADER_H * S,
        (hs.width / 100) * TPL.PAGE_W * S,
        TPL.BAR_H * S,
        { url: hs.url }
      );
    });
    TPL.FOOTER_HOTSPOTS.forEach(function (hs) {
      pdf.link(
        (hs.left / 100) * TPL.PAGE_W * S,
        (TPL.PAGE_H - TPL.FOOTER_H) * S,
        (hs.width / 100) * TPL.PAGE_W * S,
        TPL.FOOTER_H * S,
        { url: hs.url }
      );
    });
  }

  /** تصدير كل الصفحات إلى PDF متعدد الصفحات بروابط تفاعلية */
  async function exportPdf(pageEls, filename) {
    if (!pageEls || pageEls.length === 0) throw new Error('لا توجد صفحات للتصدير');
    const jsPDF = window.jspdf.jsPDF;
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4', compress: true });

    for (let i = 0; i < pageEls.length; i++) {
      const dataUrl = await capturePage(pageEls[i], 'jpeg');
      if (i > 0) pdf.addPage('a4', 'portrait');
      pdf.setPage(i + 1);
      pdf.addImage(dataUrl, 'JPEG', 0, 0, A4_W_PT, A4_H_PT, undefined, 'FAST');
      addPageLinks(pdf);
    }
    pdf.save(filename || 'التجميعات.pdf');
  }

  /** تصدير صفحة واحدة PNG */
  async function exportPagePng(el, pageIndex, base) {
    const dataUrl = await capturePage(el, 'png');
    triggerDownload(dataUrl, (base || 'صفحة') + '-' + pageIndex + '.png');
  }

  /** تصدير كل الصفحات PNG داخل ZIP */
  async function exportZip(pageEls, filename) {
    if (!pageEls || pageEls.length === 0) throw new Error('لا توجد صفحات للتصدير');
    const zip = new window.JSZip();
    for (let i = 0; i < pageEls.length; i++) {
      const dataUrl = await capturePage(pageEls[i], 'png');
      zip.file('صفحة-' + (i + 1) + '.png', dataUrl.split(',')[1], { base64: true });
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    triggerBlobDownload(blob, filename || 'التجميعات-صفحات.zip');
  }

  // ------------------------------------------------------------
  // تصدير Word (docx يُبنى بالكامل في المتصفح)
  // ------------------------------------------------------------

  function dataUrlToParts(src) {
    const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/.exec(String(src || ''));
    if (!m) return null;
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { bytes: bytes, type: m[1] };
  }

  async function fetchTemplateBytes(name) {
    const res = await fetch('template/' + name);
    if (!res.ok) throw new Error('تعذّر تحميل صور القالب: ' + name);
    return new Uint8Array(await res.arrayBuffer());
  }

  async function exportDocx(items, filename) {
    const D = window.docx;
    if (!D) throw new Error('مكتبة Word غير محمّلة');

    const [
      headerBuf, barBuf, footerBuf,
    ] = await Promise.all([
      fetchTemplateBytes('header.jpg'),
      fetchTemplateBytes('links-bar.png'),
      fetchTemplateBytes('footer.png'),
    ]);

    const HEADER_IMG = { width: Math.round(TPL.PAGE_W), height: Math.round(TPL.HEADER_H) };
    const BAR_IMG = { width: Math.round(TPL.PAGE_W), height: Math.round(TPL.BAR_H) };
    const FOOTER_IMG = { width: Math.round(TPL.PAGE_W), height: Math.round(TPL.FOOTER_H) };

    const ALIGN_MAP = {
      right: D.AlignmentType.RIGHT,
      center: D.AlignmentType.CENTER,
      left: D.AlignmentType.LEFT,
      justify: D.AlignmentType.JUSTIFIED,
      start: D.AlignmentType.RIGHT,
      end: D.AlignmentType.LEFT,
    };

    function linkRun(text, url, opts) {
      opts = opts || {};
      return new D.ExternalHyperlink({
        link: url,
        children: [
          new D.TextRun({
            text: text,
            style: 'Hyperlink',
            size: opts.size != null ? opts.size : 22,
            bold: opts.bold != null ? opts.bold : true,
            color: opts.color || '0A4D42',
            font: 'Arial',
            rightToLeft: true,
          }),
        ],
      });
    }

    function sepRun(size) {
      return new D.TextRun({ text: '   •   ', size: size || 26, font: 'Arial', rightToLeft: true });
    }

    const children = [];

    // الهيدر + شريط الروابط
    children.push(
      new D.Paragraph({
        alignment: D.AlignmentType.CENTER,
        spacing: { after: 0 },
        children: [new D.ImageRun({ data: headerBuf, transformation: HEADER_IMG, type: 'jpg' })],
      }),
      new D.Paragraph({
        alignment: D.AlignmentType.CENTER,
        spacing: { before: 0, after: 120 },
        children: [new D.ImageRun({ data: barBuf, transformation: BAR_IMG, type: 'png' })],
      })
    );

    // صف الروابط
    children.push(
      new D.Paragraph({
        alignment: D.AlignmentType.CENTER,
        bidirectional: true,
        spacing: { after: 240 },
        children: [
          linkRun('انضمام', TPL.LINKS.join, { size: 26, color: 'B45309' }),
          sepRun(),
          linkRun('متابعة', TPL.LINKS.follow, { size: 26, color: 'B45309' }),
          sepRun(),
          linkRun('تواصل معنا', TPL.LINKS.contact, { size: 26, color: 'B45309' }),
          sepRun(),
          linkRun('هنا', TPL.LINKS.contact, { size: 26, color: 'B45309' }),
        ],
      })
    );

    // عناصر المحتوى
    (items || []).forEach(function (it) {
      if (it.type === 'text') {
        TPL.splitParas(it.text).forEach(function (p) {
          children.push(
            new D.Paragraph({
              bidirectional: true,
              alignment: ALIGN_MAP[it.align] || D.AlignmentType.RIGHT,
              spacing: { after: 140, line: Math.round((it.spacing != null ? it.spacing : 1.7) * 240) },
              children: [
                new D.TextRun({
                  text: p,
                  size: Math.round((it.fontSize != null ? it.fontSize : 17) * 1.5),
                  bold: !!it.bold,
                  color: String(it.color || '22223B').replace('#', '').toUpperCase(),
                  font: 'Arial',
                  rightToLeft: true,
                }),
              ],
            })
          );
        });
      } else if (it.type === 'image') {
        const decoded = dataUrlToParts(it.src);
        if (decoded) {
          const widthPct = Math.min(Number(it.widthPct != null ? it.widthPct : 100), 100);
          const w = Math.round((widthPct / 100) * TPL.CONTENT_W);
          const natW = Number(it.natW || 1) || 1;
          const natH = Number(it.natH || 1) || 1;
          const h = Math.round((natH / natW) * w);
          const type = decoded.type.indexOf('png') >= 0 ? 'png'
            : decoded.type.indexOf('webp') >= 0 ? 'gif' : 'jpg';
          children.push(
            new D.Paragraph({
              alignment: ALIGN_MAP[it.align] || D.AlignmentType.CENTER,
              spacing: { after: it.caption ? 40 : 160 },
              children: [
                new D.ImageRun({ data: decoded.bytes, transformation: { width: w, height: h }, type: type }),
              ],
            })
          );
          if (it.caption) {
            children.push(
              new D.Paragraph({
                bidirectional: true,
                alignment: D.AlignmentType.CENTER,
                spacing: { after: 160 },
                children: [
                  new D.TextRun({
                    text: String(it.caption),
                    size: 21,
                    color: '5B5F6E',
                    font: 'Arial',
                    rightToLeft: true,
                  }),
                ],
              })
            );
          }
        }
      }
    });

    // روابط الفوتر + صورة الفوتر
    children.push(
      new D.Paragraph({
        alignment: D.AlignmentType.CENTER,
        bidirectional: true,
        spacing: { before: 240, after: 120 },
        children: [
          linkRun('تواصل معنا عبر الواتساب', TPL.LINKS.contact, { size: 24 }),
          new D.TextRun({ text: '  —  ', size: 24, font: 'Arial', rightToLeft: true }),
          linkRun('+966 53 600 4199', TPL.LINKS.contact, { size: 24 }),
        ],
      }),
      new D.Paragraph({
        alignment: D.AlignmentType.CENTER,
        spacing: { after: 0 },
        children: [new D.ImageRun({ data: footerBuf, transformation: FOOTER_IMG, type: 'png' })],
      })
    );

    const doc = new D.Document({
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 }, // A4 twips
              margin: { top: 360, bottom: 360, left: 360, right: 360 },
            },
          },
          children: children,
        },
      ],
    });

    const blob = await D.Packer.toBlob(doc);
    triggerBlobDownload(blob, filename || 'التجميعات.docx');
  }

  window.EXPORTS = { exportPdf, exportPagePng, exportZip, exportDocx };
})();
