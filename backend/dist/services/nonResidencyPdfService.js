"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNonResidencyPDF = generateNonResidencyPDF;
const pdfkit_1 = __importDefault(require("pdfkit"));
const db_1 = require("../db");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
/**
 * Generates a formal Proof of Non-Residency PDF for a given target country.
 * The document shows the travel history for the rolling 365-day period,
 * highlighting time spent OUTSIDE the target country as evidence of non-residency.
 */
async function generateNonResidencyPDF(targetCountry, ownerName, stream, year) {
    const db = await (0, db_1.getDb)();
    const entries = await db.all('SELECT * FROM journey_entries ORDER BY entry_time ASC');
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    let windowStartStr = '';
    let windowEndStr = '';
    let totalPeriodDays = 365;
    if (year && /^\d{4}$/.test(year.trim())) {
        const y = parseInt(year.trim(), 10);
        windowStartStr = `${y}-01-01`;
        windowEndStr = `${y}-12-31`;
        const dStart = new Date(windowStartStr + 'T00:00:00Z');
        const dEnd = new Date(windowEndStr + 'T00:00:00Z');
        totalPeriodDays = Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    }
    else {
        windowEndStr = todayStr;
        const pastYear = new Date(today);
        pastYear.setDate(today.getDate() - 365);
        windowStartStr = pastYear.toISOString().split('T')[0];
        totalPeriodDays = 365;
    }
    // Build stay segments (same chained logic as the main report).
    // Store hasNext on the segment so display logic can use it.
    const segments = [];
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const startStr = entry.entry_time.substring(0, 10);
        const hasNext = i < entries.length - 1;
        const endStr = hasNext ? entries[i + 1].entry_time.substring(0, 10) : startStr;
        const dStart = new Date(startStr + 'T00:00:00Z');
        const dEnd = new Date(endStr + 'T00:00:00Z');
        let durationDays = Math.round((dEnd.getTime() - dStart.getTime()) / (1000 * 60 * 60 * 24));
        if (durationDays < 1)
            durationDays = 1;
        // hasNext is stored so that display and counting loops can use the right boundary
        segments.push({ ...entry, startDate: startStr, endDate: endStr, durationDays, hasNext });
    }
    // Partition into inside / outside the target country (filter to window for display only)
    const targetKey = targetCountry.trim().toLowerCase();
    const outsideSegments = segments.filter(s => s.country.trim().toLowerCase() !== targetKey &&
        (s.endDate >= windowStartStr && s.startDate <= windowEndStr));
    const insideSegments = segments.filter(s => s.country.trim().toLowerCase() === targetKey &&
        (s.endDate >= windowStartStr && s.startDate <= windowEndStr));
    // Count unique dates inside and outside the target country within the window.
    // Use the same loop pattern as settings.ts: exclusive end for non-last entries,
    // single day for the last entry. This matches the dashboard calculation exactly.
    const insideDatesSet = new Set();
    const outsideDatesSet = new Set();
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const isInside = entry.country.trim().toLowerCase() === targetKey;
        const startStr = entry.entry_time.substring(0, 10);
        const hasNext = i < entries.length - 1;
        const endStr = hasNext ? entries[i + 1].entry_time.substring(0, 10) : startStr;
        const current = new Date(startStr + 'T00:00:00Z');
        const end = new Date(endStr + 'T00:00:00Z');
        while (current <= end) {
            const d = current.toISOString().split('T')[0];
            if (d >= windowStartStr && d <= windowEndStr) {
                if (isInside)
                    insideDatesSet.add(d);
                else
                    outsideDatesSet.add(d);
            }
            current.setDate(current.getDate() + 1);
            // Non-last entries: stop before the end date (it belongs to the next entry's country)
            if (hasNext && current >= end)
                break;
        }
    }
    const daysOutside = outsideDatesSet.size;
    const daysInTarget = insideDatesSet.size;
    const uploadsDir = process.env.UPLOADS_DIR || './data/receipts';
    // ── Document ────────────────────────────────────────────────────────────────
    const doc = new pdfkit_1.default({ margin: 60, size: 'A4', bufferPages: true });
    doc.pipe(stream);
    const LEFT = 60;
    const RIGHT = 535;
    const WIDTH = RIGHT - LEFT;
    const divider = () => {
        doc.strokeColor('#cbd5e1').lineWidth(0.5).moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).stroke();
        doc.moveDown(0.6);
    };
    // ── Cover / Header ──────────────────────────────────────────────────────────
    doc.fillColor('#0f172a').fontSize(22).font('Helvetica-Bold')
        .text('PROOF OF NON-RESIDENCY', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica').fillColor('#475569')
        .text(`Statutory Tax Residency Compliance Document`, { align: 'center' });
    doc.moveDown(0.8);
    // Reference block
    const refY = doc.y;
    doc.rect(LEFT, refY, WIDTH, 58).fill('#f8fafc');
    doc.fillColor('#64748b').fontSize(8).font('Helvetica')
        .text('PREPARED FOR', LEFT + 12, refY + 8);
    doc.fillColor('#0f172a').fontSize(13).font('Helvetica-Bold')
        .text(ownerName || 'N/A', LEFT + 12, refY + 20);
    doc.fillColor('#64748b').fontSize(8).font('Helvetica')
        .text('REPORT DATE', LEFT + 12, refY + 38);
    doc.fillColor('#334155').fontSize(9).font('Helvetica')
        .text(new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' }), LEFT + 12, refY + 48);
    doc.fillColor('#64748b').fontSize(8).font('Helvetica')
        .text('PERIOD COVERED', LEFT + 240, refY + 8);
    doc.fillColor('#334155').fontSize(9).font('Helvetica')
        .text(`${windowStartStr}  →  ${windowEndStr}`, LEFT + 240, refY + 20);
    doc.fillColor('#64748b').fontSize(8).font('Helvetica')
        .text('COUNTRY OF CLAIMED NON-RESIDENCY', LEFT + 240, refY + 38);
    doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
        .text(targetCountry.trim(), LEFT + 240, refY + 48);
    doc.y = refY + 70;
    doc.moveDown(1);
    divider();
    // ── Summary Statistics ──────────────────────────────────────────────────────
    doc.fillColor('#1e293b').fontSize(13).font('Helvetica-Bold').text('Compliance Summary');
    doc.moveDown(0.5);
    const statY = doc.y;
    const statW = 110;
    const statGap = 12;
    const statH = 58;
    const drawStat = (x, label, value, highlight = false) => {
        doc.rect(x, statY, statW, statH).fill(highlight ? '#fef3c7' : '#f1f5f9');
        doc.fillColor('#64748b').fontSize(7).font('Helvetica').text(label, x + 8, statY + 8, { width: statW - 16 });
        doc.fillColor(highlight ? '#92400e' : '#0f172a').fontSize(20).font('Helvetica-Bold')
            .text(value, x + 8, statY + 22, { width: statW - 16 });
    };
    drawStat(LEFT, 'DAYS OUTSIDE TARGET', `${daysOutside}`);
    drawStat(LEFT + statW + statGap, 'DAYS IN TARGET', `${daysInTarget}`, daysInTarget > 183);
    drawStat(LEFT + (statW + statGap) * 2, 'TOTAL ENTRIES', `${entries.length}`);
    drawStat(LEFT + (statW + statGap) * 3, 'PERIOD (DAYS)', `${totalPeriodDays}`);
    doc.y = statY + statH + 20;
    // Compliance statement
    const compliant = daysInTarget < 183;
    const stmtColor = compliant ? '#064e3b' : '#7f1d1d';
    const stmtBg = compliant ? '#d1fae5' : '#fee2e2';
    const stmtBorder = compliant ? '#10b981' : '#ef4444';
    const stmtY = doc.y;
    doc.rect(LEFT, stmtY, WIDTH, 36).fill(stmtBg);
    doc.rect(LEFT, stmtY, 4, 36).fill(stmtBorder);
    doc.fillColor(stmtColor).fontSize(10).font('Helvetica-Bold')
        .text(compliant
        ? `COMPLIANT: ${ownerName || 'The subject'} spent ${daysInTarget} day(s) in ${targetCountry} in the ${totalPeriodDays}-day period — below the 183-day threshold.`
        : `ATTENTION: ${ownerName || 'The subject'} spent ${daysInTarget} day(s) in ${targetCountry} in the ${totalPeriodDays}-day period — at or above the 183-day threshold.`, LEFT + 12, stmtY + 10, { width: WIDTH - 16, lineBreak: false });
    doc.y = stmtY + 44;
    doc.moveDown(1);
    divider();
    // ── Absence Timeline ────────────────────────────────────────────────────────
    doc.fillColor('#1e293b').fontSize(13).font('Helvetica-Bold')
        .text(`Documented Absence from ${targetCountry}`);
    doc.moveDown(0.4);
    doc.fillColor('#64748b').fontSize(9).font('Helvetica')
        .text(`The following ${outsideSegments.length} stay(s) occurred OUTSIDE ${targetCountry} during the review period.`);
    doc.moveDown(0.8);
    for (const seg of outsideSegments) {
        if (doc.y > 680)
            doc.addPage();
        doc.strokeColor('#e2e8f0').lineWidth(0.4).moveTo(LEFT, doc.y).lineTo(RIGHT, doc.y).stroke();
        doc.moveDown(0.4);
        const rowY = doc.y;
        // Colour indicator bar
        doc.rect(LEFT, rowY, 4, 38).fill('#10b981');
        doc.fillColor('#0f172a').fontSize(11).font('Helvetica-Bold')
            .text(`${seg.country} — ${seg.city}`, LEFT + 12, rowY, { width: WIDTH - 12 });
        doc.fillColor('#475569').fontSize(9).font('Helvetica')
            .text(`Date: ${seg.startDate}`, LEFT + 12, rowY + 15, { width: 200 });
        doc.fillColor('#475569').fontSize(9).font('Helvetica')
            .text(`Duration: ${seg.durationDays} day(s)   (${seg.startDate} → ${seg.endDate})`, LEFT + 12, rowY + 26, { width: WIDTH - 12 });
        doc.y = rowY + 44;
        // Receipt image (compact)
        if (seg.file_path && seg.file_path.trim() !== '') {
            const fullPath = path_1.default.join(uploadsDir, seg.file_path);
            if (fs_1.default.existsSync(fullPath) && fs_1.default.lstatSync(fullPath).isFile()) {
                try {
                    if (doc.y > 600)
                        doc.addPage();
                    const img = doc.openImage(fullPath);
                    const scale = Math.min(280 / img.width, 140 / img.height);
                    const renderedHeight = img.height * scale;
                    doc.image(img, LEFT + 12, doc.y, { fit: [280, 140] });
                    doc.y += renderedHeight + 10;
                }
                catch {
                    doc.fillColor('#ef4444').fontSize(8).font('Helvetica-Bold')
                        .text(`[Cannot render proof image: ${seg.file_name || 'receipt'}]`, LEFT + 12, doc.y, { width: WIDTH });
                    doc.moveDown(0.4);
                }
            }
        }
        doc.moveDown(0.6);
    }
    // ── Inside target country section ────────────────────────────────────────────
    if (insideSegments.length > 0) {
        if (doc.y > 650)
            doc.addPage();
        doc.moveDown(0.5);
        divider();
        doc.fillColor('#1e293b').fontSize(13).font('Helvetica-Bold')
            .text(`Stays Inside ${targetCountry} (${insideSegments.length} entry/entries)`);
        doc.moveDown(0.4);
        for (const seg of insideSegments) {
            if (doc.y > 700)
                doc.addPage();
            const rowY = doc.y;
            doc.rect(LEFT, rowY, 4, 28).fill('#ef4444');
            doc.fillColor('#334155').fontSize(10).font('Helvetica-Bold')
                .text(`${seg.city}`, LEFT + 12, rowY, { width: WIDTH - 12 });
            doc.fillColor('#64748b').fontSize(8.5).font('Helvetica')
                .text(`${seg.startDate}  |  ${seg.durationDays} day(s)  (${seg.startDate} → ${seg.endDate})`, LEFT + 12, rowY + 14, { width: WIDTH - 12 });
            doc.y = rowY + 34;
        }
    }
    // ── Declaration ─────────────────────────────────────────────────────────────
    if (doc.y > 680)
        doc.addPage();
    doc.moveDown(1);
    divider();
    doc.fillColor('#1e293b').fontSize(11).font('Helvetica-Bold').text('Declaration');
    doc.moveDown(0.4);
    doc.fillColor('#334155').fontSize(8.5).font('Helvetica')
        .text(`This document has been automatically generated by TravelTracker and is based on the travel records entered by the subject. ` +
        `The data presented herein, including travel dates, stay durations, and supporting receipt images, represents the subject's ` +
        `recorded presence in various countries during the period from ${windowStartStr} to ${windowEndStr}. ` +
        `This report is intended to assist in demonstrating compliance with international tax residency rules and should be reviewed ` +
        `by a qualified tax professional before submission to any authority.`, LEFT, doc.y, { width: WIDTH });
    doc.moveDown(1.5);
    doc.strokeColor('#94a3b8').lineWidth(0.5)
        .moveTo(LEFT, doc.y).lineTo(LEFT + 200, doc.y).stroke();
    doc.moveDown(0.3);
    doc.fillColor('#64748b').fontSize(8).font('Helvetica')
        .text(`Signature / Date`, LEFT, doc.y);
    // ── Footer on every page ─────────────────────────────────────────────────────
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(60, 820).lineTo(535, 820).stroke();
        doc.fillColor('#94a3b8').fontSize(7.5).font('Helvetica')
            .text(`Proof of Non-Residency — ${targetCountry}  |  ${ownerName || ''}  |  Page ${i + 1} of ${range.count}`, 60, 826, { align: 'center', lineBreak: false });
    }
    doc.end();
}
