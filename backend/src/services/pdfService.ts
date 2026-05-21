import PDFDocument from 'pdfkit';
import { getDb } from '../db';
import path from 'path';
import fs from 'fs';

// Stable colour per country — deterministic hash → hue
const countryColor = (country: string): string => {
  let hash = 0;
  for (let j = 0; j < country.length; j++) {
    hash = country.charCodeAt(j) + ((hash << 5) - hash);
  }
  return `hsl(${Math.abs(hash % 360)}, 65%, 50%)`;
};

// Convert hsl(h, s%, l%) string → [r, g, b] for PDFKit
const hslToRgb = (hsl: string): [number, number, number] => {
  const m = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!m) return [100, 150, 200];
  const h = parseInt(m[1]) / 360;
  const s = parseInt(m[2]) / 100;
  const l = parseInt(m[3]) / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
};

/**
 * Generates a styled, multi-page PDF report with stats, bar chart, timelines, and receipt images.
 * Writes the output to the provided writable stream.
 */
export async function generateReportPDF(stream: NodeJS.WritableStream): Promise<void> {
  const db = await getDb();

  // Fetch entries chronologically
  const entries = await db.all('SELECT * FROM journey_entries ORDER BY entry_time ASC');

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const pastYear = new Date(today);
  pastYear.setDate(today.getDate() - 365);
  const pastYearStr = pastYear.toISOString().split('T')[0];

  const countryDatesMap: Record<string, Set<string>> = {};
  const formattedSegments: any[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const country = entry.country.trim();

    if (!countryDatesMap[country]) {
      countryDatesMap[country] = new Set<string>();
    }

    const startStr = entry.entry_time.substring(0, 10);
    const hasNext = i < entries.length - 1;
    const endStr = hasNext
      ? entries[i + 1].entry_time.substring(0, 10)
      : startStr;

    const current = new Date(startStr + 'T00:00:00Z');
    const end     = new Date(endStr   + 'T00:00:00Z');

    let segmentDays = 0;
    while (current <= end) {
      const dateStr = current.toISOString().split('T')[0];
      if (dateStr >= pastYearStr && dateStr <= todayStr) {
        countryDatesMap[country].add(dateStr);
        segmentDays++;
      }
      current.setDate(current.getDate() + 1);
      if (hasNext && current >= end) break;
    }

    if (segmentDays > 0) {
      formattedSegments.push({
        ...entry,
        startDate: startStr,
        endDate: endStr,
        durationDays: segmentDays
      });
    }
  }

  const countryDays: Record<string, number> = {};
  for (const [country, dates] of Object.entries(countryDatesMap)) {
    if (dates.size > 0) {
      countryDays[country] = dates.size;
    }
  }

  const totalDays    = Object.values(countryDays).reduce((s, d) => s + d, 0);
  const countryCount = Object.keys(countryDays).length;

  // ── Document setup ────────────────────────────────────────────────────────
  const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
  doc.pipe(stream);

  const LEFT  = 50;
  const RIGHT = 545;
  const WIDTH = RIGHT - LEFT;

  // ── Title ─────────────────────────────────────────────────────────────────
  doc.fillColor('#0f172a').fontSize(24).font('Helvetica-Bold')
     .text('TravelTracker Report', { align: 'center' });
  doc.moveDown(0.2);
  doc.fontSize(10).font('Helvetica').fillColor('#64748b')
     .text(`Period Covered: ${pastYearStr} to ${todayStr}`, { align: 'center' });
  doc.fontSize(8.5).font('Helvetica').fillColor('#94a3b8')
     .text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
  doc.moveDown(1.0);

  doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).stroke();
  doc.moveDown(1.2);

  // ── Summary cards ─────────────────────────────────────────────────────────
  doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text('Summary');
  doc.moveDown(0.5);

  const cardY     = doc.y;
  const cardW     = 150;
  const cardH     = 60;
  const cardGap   = 15;

  const drawCard = (x: number, label: string, value: string) => {
    doc.rect(x, cardY, cardW, cardH).fill('#f1f5f9');
    doc.fillColor('#64748b').fontSize(8).font('Helvetica').text(label, x + 10, cardY + 10, { width: cardW - 20 });
    doc.fillColor('#0f172a').fontSize(22).font('Helvetica-Bold').text(value, x + 10, cardY + 26, { width: cardW - 20 });
  };

  drawCard(LEFT,                        'TOTAL ENTRIES',      `${entries.length}`);
  drawCard(LEFT + cardW + cardGap,      'COUNTRIES VISITED',  `${countryCount}`);
  drawCard(LEFT + (cardW + cardGap) * 2,'TOTAL DAYS',         `${totalDays}`);

  doc.y = cardY + cardH + 28;

  // ── Bar chart: Days per country ───────────────────────────────────────────
  if (countryCount > 0) {
    doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text('Days per Country');
    doc.moveDown(0.5);

    const chartLeft   = LEFT + 100;          // leave room for country labels
    const chartRight  = RIGHT - 40;          // leave room for day count labels on the right
    const chartWidth  = chartRight - chartLeft;
    const barHeight   = 16;
    const barGap      = 6;
    const maxDays     = Math.max(...Object.values(countryDays));

    const sortedCountries = Object.entries(countryDays).sort((a, b) => b[1] - a[1]);

    for (const [country, days] of sortedCountries) {
      if (doc.y > 700) { doc.addPage(); }
      const rowY    = doc.y;
      const barW    = Math.max(2, (days / maxDays) * chartWidth);

      // Country label (left-aligned, truncated)
      doc.fillColor('#1e293b').fontSize(8).font('Helvetica')
         .text(country, LEFT, rowY + 4, { width: 95, ellipsis: true });

      // Coloured bar
      const rgb      = hslToRgb(countryColor(country));
      const hexColor = '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('');
      doc.fillColor(hexColor).rect(chartLeft, rowY, barW, barHeight).fill();

      // Day count label to the right of bar
      doc.fillColor('#475569').fontSize(8).font('Helvetica')
         .text(`${days}d`, chartLeft + barW + 4, rowY + 4);

      doc.y = rowY + barHeight + barGap;
    }

    doc.moveDown(1.2);
  }

  // ── Divider ───────────────────────────────────────────────────────────────
  doc.strokeColor('#e2e8f0').lineWidth(1).moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).stroke();
  doc.moveDown(1);

  // ── Detailed Travel Timeline ──────────────────────────────────────────────
  doc.fillColor('#1e293b').fontSize(14).font('Helvetica-Bold').text('Detailed Travel Timeline');
  doc.moveDown(0.8);

  const uploadsDir = process.env.UPLOADS_DIR || './data/receipts';

  for (const segment of formattedSegments) {
    if (doc.y > 650) doc.addPage();

    doc.strokeColor('#cbd5e1').lineWidth(0.5)
       .moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).stroke();
    doc.moveDown(0.5);

    // Heading: "France (Paris)" — no "Stay in"
    doc.fillColor('#0f172a').fontSize(12).font('Helvetica-Bold')
       .text(`${segment.country} (${segment.city})`, LEFT, doc.y, { width: WIDTH });

    // Date / duration line — always left-aligned, explicit x position
    doc.fillColor('#475569').fontSize(9).font('Helvetica')
       .text(
         `Date: ${segment.startDate}  |  Duration: ${segment.durationDays} day(s) (${segment.startDate} → ${segment.endDate})`,
         LEFT, doc.y, { width: WIDTH }
       );

    if (segment.notes) {
      doc.fillColor('#64748b').fontSize(9)
         .text(`Notes: ${segment.notes}`, LEFT, doc.y, { width: WIDTH });
    }

    doc.moveDown(0.5);

    // Receipt image
    if (segment.file_path && segment.file_path.trim() !== '') {
      const fullPath = path.join(uploadsDir, segment.file_path);
      if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isFile()) {
        try {
          if (doc.y > 520) doc.addPage();
          const img = (doc as any).openImage(fullPath);
          const scale = Math.min(350 / img.width, 200 / img.height);
          const renderedHeight = img.height * scale;
          doc.image(img, LEFT, doc.y, { fit: [350, 200] });
          doc.y += renderedHeight + 10;
        } catch {
          doc.fillColor('#ef4444').fontSize(8.5).font('Helvetica-Bold')
             .text(`[Cannot render image: ${segment.file_name || 'receipt'}]`, LEFT, doc.y, { width: WIDTH });
          doc.moveDown(0.5);
        }
      }
    }
  }

  // ── Footer on every page ──────────────────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.strokeColor('#f1f5f9').lineWidth(1).moveTo(50, 785).lineTo(545, 785).stroke();
    doc.fillColor('#94a3b8').fontSize(8).font('Helvetica')
       .text(`TravelTracker Report  |  Page ${i + 1} of ${range.count}`, 50, 792, { align: 'center', lineBreak: false });
  }

  doc.end();
}
