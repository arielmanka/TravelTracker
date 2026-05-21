"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const pdfService_1 = require("../services/pdfService");
const router = (0, express_1.Router)();
// GET download compiled PDF report
router.get('/export', async (req, res) => {
    try {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=travel_report.pdf');
        await (0, pdfService_1.generateReportPDF)(res);
    }
    catch (error) {
        console.error('Error generating PDF report download:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to compile and export travel report PDF' });
        }
    }
});
// GET analytics aggregates for frontend visualizations (days per country & monthly trends)
router.get('/analytics', async (req, res) => {
    try {
        const db = await (0, db_1.getDb)();
        // Fetch all journey entries
        const entries = await db.all('SELECT * FROM journey_entries ORDER BY entry_time ASC');
        const today = new Date();
        // Use UTC for consistent date math
        const todayStr = today.toISOString().split('T')[0];
        const pastYear = new Date(today);
        pastYear.setDate(pastYear.getDate() - 365);
        const pastYearStr = pastYear.toISOString().split('T')[0];
        const countryDatesMap = {};
        const monthlyCountryStaysMap = {}; // YYYY-MM -> Country -> Dates
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const country = entry.country.trim();
            if (!countryDatesMap[country]) {
                countryDatesMap[country] = new Set();
            }
            const startStr = entry.entry_time.substring(0, 10);
            let endStr = startStr;
            const hasNext = i < entries.length - 1;
            if (hasNext) {
                endStr = entries[i + 1].entry_time.substring(0, 10);
            }
            const start = new Date(startStr + 'T00:00:00Z');
            const end = new Date(endStr + 'T00:00:00Z');
            const current = new Date(start);
            if (hasNext) {
                while (current < end) {
                    const dateStr = current.toISOString().split('T')[0];
                    if (dateStr >= pastYearStr && dateStr <= todayStr) {
                        countryDatesMap[country].add(dateStr);
                        const monthKey = dateStr.substring(0, 7); // YYYY-MM
                        if (!monthlyCountryStaysMap[monthKey]) {
                            monthlyCountryStaysMap[monthKey] = {};
                        }
                        if (!monthlyCountryStaysMap[monthKey][country]) {
                            monthlyCountryStaysMap[monthKey][country] = new Set();
                        }
                        monthlyCountryStaysMap[monthKey][country].add(dateStr);
                    }
                    current.setDate(current.getDate() + 1);
                }
            }
            else {
                while (current <= end) {
                    const dateStr = current.toISOString().split('T')[0];
                    if (dateStr >= pastYearStr && dateStr <= todayStr) {
                        countryDatesMap[country].add(dateStr);
                        const monthKey = dateStr.substring(0, 7);
                        if (!monthlyCountryStaysMap[monthKey]) {
                            monthlyCountryStaysMap[monthKey] = {};
                        }
                        if (!monthlyCountryStaysMap[monthKey][country]) {
                            monthlyCountryStaysMap[monthKey][country] = new Set();
                        }
                        monthlyCountryStaysMap[monthKey][country].add(dateStr);
                    }
                    current.setDate(current.getDate() + 1);
                }
            }
        }
        // Format country stays data
        const countryStays = Object.entries(countryDatesMap)
            .map(([country, dates]) => ({
            country,
            days: dates.size
        }))
            .filter(c => c.days > 0)
            .sort((a, b) => b.days - a.days); // Sort descending
        // Format monthly trends data
        const trends = Object.entries(monthlyCountryStaysMap).map(([month, countryStaysObj]) => {
            const trendItem = { month };
            for (const [country, dates] of Object.entries(countryStaysObj)) {
                trendItem[country] = dates.size;
            }
            return trendItem;
        }).sort((a, b) => a.month.localeCompare(b.month)); // Sort chronological
        res.json({
            countryStays,
            trends
        });
    }
    catch (error) {
        console.error('Error compiling analytics aggregates:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
