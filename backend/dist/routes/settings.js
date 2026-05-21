"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const router = (0, express_1.Router)();
// GET all limit settings
router.get('/limits', async (req, res) => {
    try {
        const db = await (0, db_1.getDb)();
        const settings = await db.all('SELECT * FROM limit_settings ORDER BY country ASC');
        res.json(settings);
    }
    catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST create or update limit for a country
router.post('/limits', async (req, res) => {
    try {
        const { country, max_days, rolling_period_days } = req.body;
        if (!country || max_days === undefined || max_days === null || !rolling_period_days) {
            return res.status(400).json({ error: 'Country, max_days, and rolling_period_days are required' });
        }
        const db = await (0, db_1.getDb)();
        // SQLite upsert syntax (ON CONFLICT)
        await db.run(`INSERT INTO limit_settings (country, max_days, rolling_period_days)
       VALUES (?, ?, ?)
       ON CONFLICT(country) 
       DO UPDATE SET max_days = excluded.max_days, rolling_period_days = excluded.rolling_period_days`, [country.trim(), parseInt(max_days), parseInt(rolling_period_days)]);
        const updatedSetting = await db.get('SELECT * FROM limit_settings WHERE country = ?', [country.trim()]);
        res.status(201).json(updatedSetting);
    }
    catch (error) {
        console.error('Error saving setting:', error);
        res.status(500).json({ error: error.message });
    }
});
// DELETE a limit setting
router.delete('/limits/:id', async (req, res) => {
    try {
        const db = await (0, db_1.getDb)();
        const result = await db.run('DELETE FROM limit_settings WHERE id = ?', [req.params.id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Setting not found' });
        }
        res.json({ message: 'Setting deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting setting:', error);
        res.status(500).json({ error: error.message });
    }
});
// GET all countries
router.get('/countries', async (req, res) => {
    try {
        const db = await (0, db_1.getDb)();
        const countries = await db.all('SELECT * FROM countries ORDER BY name ASC');
        res.json(countries);
    }
    catch (error) {
        console.error('Error fetching countries:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST add a new country
router.post('/countries', async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Country name is required' });
        }
        const db = await (0, db_1.getDb)();
        const result = await db.run('INSERT INTO countries (name) VALUES (?)', [name.trim()]);
        const created = await db.get('SELECT * FROM countries WHERE id = ?', [result.lastID]);
        res.status(201).json(created);
    }
    catch (error) {
        console.error('Error adding country:', error);
        res.status(500).json({ error: error.message });
    }
});
// DELETE a country
router.delete('/countries/:id', async (req, res) => {
    try {
        const db = await (0, db_1.getDb)();
        const result = await db.run('DELETE FROM countries WHERE id = ?', [req.params.id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Country not found' });
        }
        res.json({ message: 'Country deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting country:', error);
        res.status(500).json({ error: error.message });
    }
});
// GET cities for a country
router.get('/countries/:countryId/cities', async (req, res) => {
    try {
        const db = await (0, db_1.getDb)();
        const cities = await db.all('SELECT * FROM cities WHERE country_id = ? ORDER BY name ASC', [req.params.countryId]);
        res.json(cities);
    }
    catch (error) {
        console.error('Error fetching cities:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST add a city to a country
router.post('/countries/:countryId/cities', async (req, res) => {
    try {
        const { name } = req.body;
        const countryId = req.params.countryId;
        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'City name is required' });
        }
        const db = await (0, db_1.getDb)();
        const result = await db.run('INSERT INTO cities (country_id, name) VALUES (?, ?)', [countryId, name.trim()]);
        const created = await db.get('SELECT * FROM cities WHERE id = ?', [result.lastID]);
        res.status(201).json(created);
    }
    catch (error) {
        console.error('Error adding city:', error);
        res.status(500).json({ error: error.message });
    }
});
// DELETE a city
router.delete('/cities/:id', async (req, res) => {
    try {
        const db = await (0, db_1.getDb)();
        const result = await db.run('DELETE FROM cities WHERE id = ?', [req.params.id]);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'City not found' });
        }
        res.json({ message: 'City deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting city:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * GET current travel alerts and warnings.
 * Calculates rolling stays for each country with limits based on journey_entries chain.
 */
router.get('/status', async (req, res) => {
    try {
        const db = await (0, db_1.getDb)();
        // 1. Get all limits configured
        const limits = await db.all('SELECT * FROM limit_settings');
        if (limits.length === 0) {
            return res.json([]);
        }
        // 2. Get all journey entries chronologically
        const entries = await db.all('SELECT * FROM journey_entries ORDER BY entry_time ASC');
        // Compile unique dates spent in each country
        const countryDatesMap = {};
        const todayStr = new Date().toISOString().split('T')[0];
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];
            const countryKey = entry.country.trim().toLowerCase();
            if (!countryDatesMap[countryKey]) {
                countryDatesMap[countryKey] = new Set();
            }
            const startStr = entry.entry_time.substring(0, 10); // YYYY-MM-DD
            // If there is a next entry, the stay ends on the next entry's start date (exclusive).
            // Otherwise, the stay ends on today (inclusive).
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
                    const dStr = current.toISOString().split('T')[0];
                    countryDatesMap[countryKey].add(dStr);
                    current.setDate(current.getDate() + 1);
                }
            }
            else {
                while (current <= end) {
                    const dStr = current.toISOString().split('T')[0];
                    countryDatesMap[countryKey].add(dStr);
                    current.setDate(current.getDate() + 1);
                }
            }
        }
        const parseDateStr = (dStr) => new Date(dStr + 'T00:00:00Z');
        const today = parseDateStr(todayStr);
        const alerts = [];
        for (const limit of limits) {
            const countryKey = limit.country.trim().toLowerCase();
            const datesVisited = countryDatesMap[countryKey] || new Set();
            const datesArray = Array.from(datesVisited).sort();
            if (datesArray.length === 0) {
                alerts.push({
                    id: limit.id,
                    country: limit.country,
                    maxDays: limit.max_days,
                    rollingPeriod: limit.rolling_period_days,
                    daysSpentCurrentWindow: 0,
                    maxDaysSpentAnyWindow: 0,
                    peakWindowEnd: '',
                    peakExceeded: false,
                    status: 'safe',
                    message: 'No stays logged.'
                });
                continue;
            }
            // Calculate current rolling stay (ending today)
            const currentWindowStart = new Date(today);
            currentWindowStart.setDate(today.getDate() - limit.rolling_period_days + 1);
            const currentWindowStartStr = currentWindowStart.toISOString().split('T')[0];
            let daysSpentCurrentWindow = 0;
            for (const dStr of datesArray) {
                if (dStr >= currentWindowStartStr && dStr <= todayStr) {
                    daysSpentCurrentWindow++;
                }
            }
            // Calculate historical peak rolling stay in any rolling window
            const checkEndDates = [...datesArray];
            if (!checkEndDates.includes(todayStr)) {
                checkEndDates.push(todayStr);
            }
            let maxDaysSpentAnyWindow = 0;
            let peakWindowEnd = '';
            for (const endDateStr of checkEndDates) {
                const endD = parseDateStr(endDateStr);
                const startD = new Date(endD);
                startD.setDate(endD.getDate() - limit.rolling_period_days + 1);
                const startDStr = startD.toISOString().split('T')[0];
                let count = 0;
                for (const dStr of datesArray) {
                    if (dStr >= startDStr && dStr <= endDateStr) {
                        count++;
                    }
                }
                if (count > maxDaysSpentAnyWindow) {
                    maxDaysSpentAnyWindow = count;
                    peakWindowEnd = endDateStr;
                }
            }
            // Determine warning status: safe, warning (at 30, 20, 10 days remaining), exceeded
            let status = 'safe';
            let message = `You have spent ${daysSpentCurrentWindow} days in the current ${limit.rolling_period_days}-day window. Limit is ${limit.max_days} days.`;
            const daysRemaining = limit.max_days - daysSpentCurrentWindow;
            if (daysSpentCurrentWindow > limit.max_days) {
                status = 'exceeded';
                message = `ALERT: You exceeded the limit of ${limit.max_days} days (spent ${daysSpentCurrentWindow} days) in the rolling window ending today.`;
            }
            else if (daysRemaining <= 10 && limit.max_days > 10) {
                status = 'warning';
                message = `WARNING: Critical! Only ${daysRemaining} days left (${daysSpentCurrentWindow}/${limit.max_days} days used) in the rolling window.`;
            }
            else if (daysRemaining <= 20 && limit.max_days > 20) {
                status = 'warning';
                message = `WARNING: Approaching limit! Only ${daysRemaining} days left (${daysSpentCurrentWindow}/${limit.max_days} days used) in the rolling window.`;
            }
            else if (daysRemaining <= 30 && limit.max_days > 30) {
                status = 'warning';
                message = `WARNING: Notice! Only ${daysRemaining} days left (${daysSpentCurrentWindow}/${limit.max_days} days used) in the rolling window.`;
            }
            let peakExceeded = maxDaysSpentAnyWindow > limit.max_days;
            alerts.push({
                id: limit.id,
                country: limit.country,
                maxDays: limit.max_days,
                rollingPeriod: limit.rolling_period_days,
                daysSpentCurrentWindow,
                maxDaysSpentAnyWindow,
                peakWindowEnd,
                peakExceeded,
                status,
                message
            });
        }
        res.json(alerts);
    }
    catch (error) {
        console.error('Error calculating limits status:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
