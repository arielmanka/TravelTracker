"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const db_1 = require("../db");
const router = (0, express_1.Router)();
const uploadsDir = process.env.UPLOADS_DIR || './data/receipts';
// Ensure uploads directory exists
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
// Multer storage configurations
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB max file size limit
});
// GET all journey entries chronologically
router.get('/', async (req, res) => {
    try {
        const db = await (0, db_1.getDb)();
        const entries = await db.all('SELECT * FROM journey_entries ORDER BY entry_time ASC');
        res.json(entries);
    }
    catch (error) {
        console.error('Error fetching journey entries:', error);
        res.status(500).json({ error: error.message });
    }
});
// POST upload file and save journey entry details
router.post('/', upload.single('file'), async (req, res) => {
    try {
        const { country, city, entry_time, notes } = req.body;
        if (!country || !city || !entry_time) {
            if (req.file)
                fs_1.default.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Country, city, and entry date are required.' });
        }
        const db = await (0, db_1.getDb)();
        // Reject duplicate entry date — two entries cannot start on the same day
        const newDate = entry_time.substring(0, 10); // YYYY-MM-DD
        const conflict = await db.get(`SELECT id FROM journey_entries WHERE substr(entry_time, 1, 10) = ?`, [newDate]);
        if (conflict) {
            if (req.file)
                fs_1.default.unlinkSync(req.file.path);
            return res.status(409).json({
                error: `An entry already exists for ${newDate}. Two entries cannot share the same entry date.`
            });
        }
        const relativeFilename = req.file ? path_1.default.basename(req.file.path) : '';
        const originalFilename = req.file ? req.file.originalname : '';
        const result = await db.run(`INSERT INTO journey_entries (country, city, entry_time, file_path, file_name, location, amount, currency, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            country.trim(),
            city.trim(),
            entry_time, // YYYY-MM-DD HH:MM
            relativeFilename,
            originalFilename,
            '', // location (not needed)
            null, // amount (not needed)
            null, // currency (not needed)
            notes || ''
        ]);
        const createdEntry = await db.get('SELECT * FROM journey_entries WHERE id = ?', [result.lastID]);
        res.status(201).json(createdEntry);
    }
    catch (error) {
        console.error('Error creating journey entry:', error);
        if (req.file && fs_1.default.existsSync(req.file.path))
            fs_1.default.unlinkSync(req.file.path);
        res.status(500).json({ error: error.message });
    }
});
// PUT update journey entry or replace receipt
router.put('/:id', upload.single('file'), async (req, res) => {
    try {
        const entryId = req.params.id;
        const { country, city, entry_time, notes } = req.body;
        const db = await (0, db_1.getDb)();
        const existing = await db.get('SELECT * FROM journey_entries WHERE id = ?', [entryId]);
        if (!existing) {
            if (req.file)
                fs_1.default.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Journey entry not found' });
        }
        // If the entry date is being changed, check no other entry uses that date
        if (entry_time !== undefined) {
            const newDate = entry_time.substring(0, 10);
            const existingDate = existing.entry_time.substring(0, 10);
            if (newDate !== existingDate) {
                const conflict = await db.get(`SELECT id FROM journey_entries WHERE substr(entry_time, 1, 10) = ? AND id != ?`, [newDate, entryId]);
                if (conflict) {
                    if (req.file)
                        fs_1.default.unlinkSync(req.file.path);
                    return res.status(409).json({
                        error: `An entry already exists for ${newDate}. Two entries cannot share the same entry date.`
                    });
                }
            }
        }
        let filePath = existing.file_path;
        let fileName = existing.file_name;
        if (req.file) {
            // Delete old file
            if (existing.file_path && existing.file_path.trim() !== '') {
                const oldFilePath = path_1.default.join(uploadsDir, existing.file_path);
                if (fs_1.default.existsSync(oldFilePath) && fs_1.default.lstatSync(oldFilePath).isFile()) {
                    fs_1.default.unlinkSync(oldFilePath);
                }
            }
            filePath = path_1.default.basename(req.file.path);
            fileName = req.file.originalname;
        }
        await db.run(`UPDATE journey_entries 
       SET country = ?, city = ?, entry_time = ?, file_path = ?, file_name = ?, location = ?, amount = ?, currency = ?, notes = ?
       WHERE id = ?`, [
            country !== undefined ? country.trim() : existing.country,
            city !== undefined ? city.trim() : existing.city,
            entry_time !== undefined ? entry_time : existing.entry_time,
            filePath,
            fileName,
            '', // location
            null, // amount
            null, // currency
            notes !== undefined ? notes : existing.notes,
            entryId
        ]);
        const updated = await db.get('SELECT * FROM journey_entries WHERE id = ?', [entryId]);
        res.json(updated);
    }
    catch (error) {
        console.error('Error updating journey entry:', error);
        if (req.file && fs_1.default.existsSync(req.file.path))
            fs_1.default.unlinkSync(req.file.path);
        res.status(500).json({ error: error.message });
    }
});
// DELETE journey entry
router.delete('/:id', async (req, res) => {
    try {
        const entryId = req.params.id;
        const db = await (0, db_1.getDb)();
        const existing = await db.get('SELECT * FROM journey_entries WHERE id = ?', [entryId]);
        if (!existing) {
            return res.status(404).json({ error: 'Journey entry not found' });
        }
        // Remove old file
        if (existing.file_path && existing.file_path.trim() !== '') {
            const filePath = path_1.default.join(uploadsDir, existing.file_path);
            if (fs_1.default.existsSync(filePath) && fs_1.default.lstatSync(filePath).isFile()) {
                fs_1.default.unlinkSync(filePath);
            }
        }
        await db.run('DELETE FROM journey_entries WHERE id = ?', [entryId]);
        res.json({ message: 'Journey entry deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting journey entry:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
