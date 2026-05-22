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
            // Non-last entry: stay spans [startStr, nextEntryStartStr) exclusive.
            // Last entry: endStr === startStr, so the loop runs exactly once (entry day only).
            const hasNext = i < entries.length - 1;
            const endStr = hasNext
                ? entries[i + 1].entry_time.substring(0, 10)
                : startStr;
            const current = new Date(startStr + 'T00:00:00Z');
            const end = new Date(endStr + 'T00:00:00Z');
            while (current <= end) {
                const dStr = current.toISOString().split('T')[0];
                countryDatesMap[countryKey].add(dStr);
                current.setDate(current.getDate() + 1);
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
/**
 * GET /api/settings/forecast?country=X&departureDate=YYYY-MM-DD
 *
 * Projects how many rolling-window days the user will have consumed on a given departure
 * date, assuming they remain continuously in their last-logged country until that date.
 * Returns remaining days available after that hypothetical departure.
 */
router.get('/forecast', async (req, res) => {
    try {
        const country = (req.query.country || '').trim();
        const departureDate = (req.query.departureDate || '').trim();
        if (!country || !departureDate || !/^\d{4}-\d{2}-\d{2}$/.test(departureDate)) {
            return res.status(400).json({ error: 'country and departureDate (YYYY-MM-DD) are required.' });
        }
        const db = await (0, db_1.getDb)();
        const limit = await db.get('SELECT * FROM limit_settings WHERE LOWER(country) = LOWER(?)', [country]);
        if (!limit) {
            return res.status(404).json({ error: `No limit configured for country: ${country}` });
        }
        const entries = await db.all('SELECT * FROM journey_entries ORDER BY entry_time ASC');
        // Build dates map, extending the last stay to the departure date
        const datesMap = buildCountryDatesMap(entries, departureDate);
        const countryKey = country.toLowerCase();
        const datesSet = datesMap[countryKey] || new Set();
        // Rolling window that ends on departureDate
        const dEnd = new Date(departureDate + 'T00:00:00Z');
        const dStart = new Date(dEnd);
        dStart.setDate(dEnd.getDate() - limit.rolling_period_days + 1);
        const windowStartStr = dStart.toISOString().split('T')[0];
        let daysSpent = 0;
        for (const d of datesSet) {
            if (d >= windowStartStr && d <= departureDate)
                daysSpent++;
        }
        const daysRemaining = Math.max(0, limit.max_days - daysSpent);
        res.json({
            country: limit.country,
            departureDate,
            rollingPeriod: limit.rolling_period_days,
            maxDays: limit.max_days,
            daysSpentOnDate: daysSpent,
            daysRemaining,
            windowStart: windowStartStr,
            status: daysSpent > limit.max_days ? 'exceeded'
                : daysRemaining <= 10 ? 'critical'
                    : daysRemaining <= 30 ? 'warning'
                        : 'safe'
        });
    }
    catch (error) {
        console.error('Error computing forecast:', error);
        res.status(500).json({ error: error.message });
    }
});
/**
 * GET /api/settings/safe-return?country=X&stayDays=N
 *
 * Finds the earliest date on which the user could return to a country and remain
 * for stayDays consecutive days without breaching their rolling-window limit.
 * Scans forward from tomorrow, day by day, until enough old dates fall off the window.
 */
router.get('/safe-return', async (req, res) => {
    try {
        const country = (req.query.country || '').trim();
        const stayDays = Math.max(1, parseInt(req.query.stayDays || '1', 10));
        if (!country) {
            return res.status(400).json({ error: 'country is required.' });
        }
        const db = await (0, db_1.getDb)();
        const limit = await db.get('SELECT * FROM limit_settings WHERE LOWER(country) = LOWER(?)', [country]);
        if (!limit) {
            return res.status(404).json({ error: `No limit configured for country: ${country}` });
        }
        const entries = await db.all('SELECT * FROM journey_entries ORDER BY entry_time ASC');
        const datesMap = buildCountryDatesMap(entries);
        const countryKey = country.toLowerCase();
        const datesArr = Array.from(datesMap[countryKey] || new Set()).sort();
        // Scan forward from tomorrow, checking if stayDays slots fit within the limit
        const MAX_SCAN_DAYS = 400; // never scan more than ~13 months
        const today = new Date();
        today.setUTCHours(0, 0, 0, 0);
        for (let offset = 1; offset <= MAX_SCAN_DAYS; offset++) {
            const candidate = new Date(today);
            candidate.setDate(today.getDate() + offset);
            const candidateStr = candidate.toISOString().split('T')[0];
            // The stay would occupy [candidate, candidate + stayDays - 1]
            const stayEndDate = new Date(candidate);
            stayEndDate.setDate(candidate.getDate() + stayDays - 1);
            const stayEndStr = stayEndDate.toISOString().split('T')[0];
            // Rolling window that ends on the last day of the proposed stay
            const winEnd = new Date(stayEndDate);
            const winStart = new Date(winEnd);
            winStart.setDate(winEnd.getDate() - limit.rolling_period_days + 1);
            const winStartStr = winStart.toISOString().split('T')[0];
            // Count existing logged dates that fall in this future window
            let existingInWindow = 0;
            for (const d of datesArr) {
                if (d >= winStartStr && d <= stayEndStr)
                    existingInWindow++;
            }
            const daysAvailable = limit.max_days - existingInWindow;
            if (daysAvailable >= stayDays) {
                res.json({
                    country: limit.country,
                    stayDays,
                    earliestReturnDate: candidateStr,
                    daysAvailableOnReturn: daysAvailable,
                    rollingPeriod: limit.rolling_period_days,
                    maxDays: limit.max_days
                });
                return;
            }
        }
        // Could not find a viable date within scan range
        res.json({
            country: limit.country,
            stayDays,
            earliestReturnDate: null,
            daysAvailableOnReturn: 0,
            message: `No available slot found within the next ${MAX_SCAN_DAYS} days for a ${stayDays}-day stay.`
        });
    }
    catch (error) {
        console.error('Error computing safe return date:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
/**
 * Shared helper: build the complete set of dates (YYYY-MM-DD strings) spent in each
 * country from the journey_entries chain, optionally extending the last stay to a
 * future date if the user is still present there.
 */
function buildCountryDatesMap(entries, extendLastStayToDate // YYYY-MM-DD; only extends if last entry country matches
) {
    const map = {};
    const todayStr = new Date().toISOString().split('T')[0];
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const countryKey = entry.country.trim().toLowerCase();
        if (!map[countryKey])
            map[countryKey] = new Set();
        const startStr = entry.entry_time.substring(0, 10);
        const isLast = i === entries.length - 1;
        const hasNext = !isLast;
        let endStr;
        if (hasNext) {
            endStr = entries[i + 1].entry_time.substring(0, 10);
        }
        else if (extendLastStayToDate && extendLastStayToDate > startStr) {
            // Extend the last stay to the hypothetical departure date
            endStr = extendLastStayToDate;
        }
        else {
            endStr = startStr; // 1-day presence
        }
        const current = new Date(startStr + 'T00:00:00Z');
        const end = new Date(endStr + 'T00:00:00Z');
        while (current <= end) {
            const dStr = current.toISOString().split('T')[0];
            if (dStr <= todayStr || extendLastStayToDate)
                map[countryKey].add(dStr);
            current.setDate(current.getDate() + 1);
        }
    }
    return map;
}
