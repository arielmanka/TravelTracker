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
// Ensure the target directory for receipt files exists
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
// Multer storage configurations
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        // Generate unique filename using current epoch and random number to prevent overrides
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB max file size limit
});
// POST upload file and save receipt details
router.post('/', upload.single('file'), async (req, res) => {
    try {
        const { destination_id, location, timestamp, amount, currency, notes } = req.body;
        if (!req.file) {
            return res.status(400).json({ error: 'Receipt or ticket image file is required' });
        }
        if (!destination_id || !location || !timestamp) {
            // Delete uploaded file if metadata fields are invalid
            fs_1.default.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Destination ID, location, and timestamp are required' });
        }
        const db = await (0, db_1.getDb)();
        // Ensure parent destination exists
        const destination = await db.get('SELECT id FROM destinations WHERE id = ?', [destination_id]);
        if (!destination) {
            fs_1.default.unlinkSync(req.file.path);
            return res.status(400).json({ error: 'Valid Destination ID is required' });
        }
        // Store only the relative filename in the DB
        const relativeFilename = path_1.default.basename(req.file.path);
        const result = await db.run(`INSERT INTO receipts (destination_id, file_path, file_name, location, timestamp, amount, currency, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
            destination_id,
            relativeFilename,
            req.file.originalname,
            location,
            timestamp,
            amount ? parseFloat(amount) : null,
            currency || null,
            notes || ''
        ]);
        const createdReceipt = await db.get('SELECT * FROM receipts WHERE id = ?', [result.lastID]);
        res.status(201).json(createdReceipt);
    }
    catch (error) {
        console.error('Error uploading receipt:', error);
        // Cleanup uploaded file on error
        if (req.file && fs_1.default.existsSync(req.file.path)) {
            fs_1.default.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: error.message });
    }
});
// PUT update receipt details or replace the uploaded image
router.put('/:id', upload.single('file'), async (req, res) => {
    try {
        const receiptId = req.params.id;
        const { location, timestamp, amount, currency, notes } = req.body;
        const db = await (0, db_1.getDb)();
        const existingReceipt = await db.get('SELECT * FROM receipts WHERE id = ?', [receiptId]);
        if (!existingReceipt) {
            if (req.file)
                fs_1.default.unlinkSync(req.file.path);
            return res.status(404).json({ error: 'Receipt not found' });
        }
        let filePath = existingReceipt.file_path;
        let fileName = existingReceipt.file_name;
        if (req.file) {
            // Delete old file from filesystem
            const oldFilePath = path_1.default.join(uploadsDir, existingReceipt.file_path);
            if (fs_1.default.existsSync(oldFilePath)) {
                fs_1.default.unlinkSync(oldFilePath);
            }
            // Update with new uploaded file metadata
            filePath = path_1.default.basename(req.file.path);
            fileName = req.file.originalname;
        }
        await db.run(`UPDATE receipts 
       SET file_path = ?, file_name = ?, location = ?, timestamp = ?, amount = ?, currency = ?, notes = ?
       WHERE id = ?`, [
            filePath,
            fileName,
            location !== undefined ? location : existingReceipt.location,
            timestamp !== undefined ? timestamp : existingReceipt.timestamp,
            amount !== undefined ? (amount ? parseFloat(amount) : null) : existingReceipt.amount,
            currency !== undefined ? currency : existingReceipt.currency,
            notes !== undefined ? notes : existingReceipt.notes,
            receiptId
        ]);
        const updatedReceipt = await db.get('SELECT * FROM receipts WHERE id = ?', [receiptId]);
        res.json(updatedReceipt);
    }
    catch (error) {
        console.error('Error updating receipt:', error);
        if (req.file && fs_1.default.existsSync(req.file.path)) {
            fs_1.default.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: error.message });
    }
});
// DELETE receipt from database and remove its physical file
router.delete('/:id', async (req, res) => {
    try {
        const receiptId = req.params.id;
        const db = await (0, db_1.getDb)();
        const receipt = await db.get('SELECT * FROM receipts WHERE id = ?', [receiptId]);
        if (!receipt) {
            return res.status(404).json({ error: 'Receipt not found' });
        }
        // Remove the file from the uploads directory
        const filePath = path_1.default.join(uploadsDir, receipt.file_path);
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
        }
        // Delete entry in database
        await db.run('DELETE FROM receipts WHERE id = ?', [receiptId]);
        res.json({ message: 'Receipt deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting receipt:', error);
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
