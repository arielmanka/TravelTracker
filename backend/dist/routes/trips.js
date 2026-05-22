"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const router = (0, express_1.Router)();
// GET all trips with nested destinations and receipts
router.get('/', async (req, res) => {
    try {
        const db = await (0, db_1.getDb)();
        // Get all trips ordered by starting date (most recent first)
        const trips = await db.all('SELECT * FROM trips ORDER BY start_date DESC');
        const result = [];
        for (const trip of trips) {
            const destinations = await db.all('SELECT * FROM destinations WHERE trip_id = ? ORDER BY entry_date ASC', [trip.id]);
            const destWithReceipts = [];
            for (const dest of destinations) {
                const receipts = await db.all('SELECT * FROM receipts WHERE destination_id = ? ORDER BY timestamp ASC', [dest.id]);
                destWithReceipts.push({ ...dest, receipts });
            }
            result.push({ ...trip, destinations: destWithReceipts });
        }
        res.json(result);
    }
    catch (error) {
        console.error('Error fetching trips:', error);
        res.status(500).json({ error: error.message });
    }
});
// GET single trip by ID with destinations and receipts
router.get('/:id', async (req, res) => {
    try {
        const db = await (0, db_1.getDb)();
        const trip = await db.get('SELECT * FROM trips WHERE id = ?', [req.params.id]);
        if (!trip) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        const destinations = await db.all('SELECT * FROM destinations WHERE trip_id = ? ORDER BY entry_date ASC', [trip.id]);
        const destWithReceipts = [];
        for (const dest of destinations) {
            const receipts = await db.all('SELECT * FROM receipts WHERE destination_id = ? ORDER BY timestamp ASC', [dest.id]);
            destWithReceipts.push({ ...dest, receipts });
        }
        res.json({ ...trip, destinations: destWithReceipts });
    }
    catch (error) {
        console.error('Error fetching trip details:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST create new trip with optional nested destination segments
router.post('/', async (req, res) => {
    try {
        const { title, description, start_date, end_date, destinations } = req.body;
        if (!title || !start_date || !end_date) {
            return res.status(400).json({ error: 'Title, start date, and end date are required' });
        }
        const db = await (0, db_1.getDb)();
        await db.run('BEGIN TRANSACTION');
        try {
            const result = await db.run('INSERT INTO trips (title, description, start_date, end_date) VALUES (?, ?, ?, ?)', [title, description || '', start_date, end_date]);
            const tripId = result.lastID;
            if (destinations && Array.isArray(destinations)) {
                for (const dest of destinations) {
                    const { country, city, entry_date, exit_date } = dest;
                    if (!country || !city || !entry_date || !exit_date) {
                        throw new Error('Destination country, city, entry_date, and exit_date are required');
                    }
                    await db.run('INSERT INTO destinations (trip_id, country, city, entry_date, exit_date) VALUES (?, ?, ?, ?, ?)', [tripId, country, city, entry_date, exit_date]);
                }
            }
            await db.run('COMMIT');
            // Fetch and return the fully initialized trip structure
            const createdTrip = await db.get('SELECT * FROM trips WHERE id = ?', [tripId]);
            const createdDestinations = await db.all('SELECT * FROM destinations WHERE trip_id = ? ORDER BY entry_date ASC', [tripId]);
            res.status(201).json({
                ...createdTrip,
                destinations: createdDestinations.map(d => ({ ...d, receipts: [] }))
            });
        }
        catch (txError) {
            await db.run('ROLLBACK');
            res.status(400).json({ error: txError.message });
        }
    }
    catch (error) {
        console.error('Error creating trip:', error);
        res.status(500).json({ error: error.message });
    }
});
// PUT update existing trip details and synchronize nested destinations
router.put('/:id', async (req, res) => {
    try {
        const { title, description, start_date, end_date, destinations } = req.body;
        const tripId = req.params.id;
        if (!title || !start_date || !end_date) {
            return res.status(400).json({ error: 'Title, start date, and end date are required' });
        }
        const db = await (0, db_1.getDb)();
        const trip = await db.get('SELECT * FROM trips WHERE id = ?', [tripId]);
        if (!trip) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        await db.run('BEGIN TRANSACTION');
        try {
            await db.run('UPDATE trips SET title = ?, description = ?, start_date = ?, end_date = ? WHERE id = ?', [title, description || '', start_date, end_date, tripId]);
            if (destinations && Array.isArray(destinations)) {
                // Sync destinations
                const currentDestinations = await db.all('SELECT id FROM destinations WHERE trip_id = ?', [tripId]);
                const currentIds = currentDestinations.map(d => d.id);
                const incomingIds = destinations
                    .map(d => d.id)
                    .filter(id => id !== undefined && id !== null);
                // Cascade delete on destinations no longer included
                const toDeleteIds = currentIds.filter(id => !incomingIds.includes(id));
                if (toDeleteIds.length > 0) {
                    // Delete associated receipt files from the filesystem before cascade DB deletion
                    const receiptsToDelete = await db.all(`SELECT file_path FROM receipts WHERE destination_id IN (${toDeleteIds.join(',')})`);
                    const uploadsDir = process.env.UPLOADS_DIR || './data/receipts';
                    for (const receipt of receiptsToDelete) {
                        const filePath = path_1.default.join(uploadsDir, receipt.file_path);
                        if (fs_1.default.existsSync(filePath)) {
                            fs_1.default.unlinkSync(filePath);
                        }
                    }
                    await db.run(`DELETE FROM destinations WHERE id IN (${toDeleteIds.join(',')})`);
                }
                // Add new and update existing destination segments
                for (const dest of destinations) {
                    const { id, country, city, entry_date, exit_date } = dest;
                    if (!country || !city || !entry_date || !exit_date) {
                        throw new Error('Destination details must be complete');
                    }
                    if (id) {
                        await db.run('UPDATE destinations SET country = ?, city = ?, entry_date = ?, exit_date = ? WHERE id = ? AND trip_id = ?', [country, city, entry_date, exit_date, id, tripId]);
                    }
                    else {
                        await db.run('INSERT INTO destinations (trip_id, country, city, entry_date, exit_date) VALUES (?, ?, ?, ?, ?)', [tripId, country, city, entry_date, exit_date]);
                    }
                }
            }
            else {
                // Delete all destinations if array is empty/not provided
                const receiptsToDelete = await db.all('SELECT file_path FROM receipts WHERE destination_id IN (SELECT id FROM destinations WHERE trip_id = ?)', [tripId]);
                const uploadsDir = process.env.UPLOADS_DIR || './data/receipts';
                for (const r of receiptsToDelete) {
                    const fp = path_1.default.join(uploadsDir, r.file_path);
                    if (fs_1.default.existsSync(fp))
                        fs_1.default.unlinkSync(fp);
                }
                await db.run('DELETE FROM destinations WHERE trip_id = ?', [tripId]);
            }
            await db.run('COMMIT');
            // Return fully synced trip data
            const updatedTrip = await db.get('SELECT * FROM trips WHERE id = ?', [tripId]);
            const updatedDestinations = await db.all('SELECT * FROM destinations WHERE trip_id = ? ORDER BY entry_date ASC', [tripId]);
            const destWithReceipts = [];
            for (const dest of updatedDestinations) {
                const receipts = await db.all('SELECT * FROM receipts WHERE destination_id = ? ORDER BY timestamp ASC', [dest.id]);
                destWithReceipts.push({ ...dest, receipts });
            }
            res.json({ ...updatedTrip, destinations: destWithReceipts });
        }
        catch (txError) {
            await db.run('ROLLBACK');
            res.status(400).json({ error: txError.message });
        }
    }
    catch (error) {
        console.error('Error updating trip:', error);
        res.status(500).json({ error: error.message });
    }
});
// DELETE trip and associated records/files
router.delete('/:id', async (req, res) => {
    try {
        const tripId = req.params.id;
        const db = await (0, db_1.getDb)();
        const trip = await db.get('SELECT * FROM trips WHERE id = ?', [tripId]);
        if (!trip) {
            return res.status(404).json({ error: 'Trip not found' });
        }
        // Select and delete files for all nested receipts
        const receipts = await db.all('SELECT file_path FROM receipts WHERE destination_id IN (SELECT id FROM destinations WHERE trip_id = ?)', [tripId]);
        const uploadsDir = process.env.UPLOADS_DIR || './data/receipts';
        for (const receipt of receipts) {
            const filePath = path_1.default.join(uploadsDir, receipt.file_path);
            if (fs_1.default.existsSync(filePath)) {
                fs_1.default.unlinkSync(filePath);
            }
        }
        // Delete trip (DB schema foreign key constraint cascades to delete destinations and receipts records)
        await db.run('DELETE FROM trips WHERE id = ?', [tripId]);
        res.json({ message: 'Trip deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting trip:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
