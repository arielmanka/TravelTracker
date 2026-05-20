import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { getDb } from '../db';

const router = Router();
const uploadsDir = process.env.UPLOADS_DIR || './data/receipts';

// Ensure the target directory for receipt files exists
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Multer storage configurations
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename using current epoch and random number to prevent overrides
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
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
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Destination ID, location, and timestamp are required' });
    }
    
    const db = await getDb();
    
    // Ensure parent destination exists
    const destination = await db.get('SELECT id FROM destinations WHERE id = ?', [destination_id]);
    if (!destination) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Valid Destination ID is required' });
    }
    
    // Store only the relative filename in the DB
    const relativeFilename = path.basename(req.file.path);
    
    const result = await db.run(
      `INSERT INTO receipts (destination_id, file_path, file_name, location, timestamp, amount, currency, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        destination_id,
        relativeFilename,
        req.file.originalname,
        location,
        timestamp,
        amount ? parseFloat(amount) : null,
        currency || null,
        notes || ''
      ]
    );
    
    const createdReceipt = await db.get('SELECT * FROM receipts WHERE id = ?', [result.lastID]);
    res.status(201).json(createdReceipt);
  } catch (error: any) {
    console.error('Error uploading receipt:', error);
    // Cleanup uploaded file on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

// PUT update receipt details or replace the uploaded image
router.put('/:id', upload.single('file'), async (req, res) => {
  try {
    const receiptId = req.params.id;
    const { location, timestamp, amount, currency, notes } = req.body;
    
    const db = await getDb();
    const existingReceipt = await db.get('SELECT * FROM receipts WHERE id = ?', [receiptId]);
    
    if (!existingReceipt) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Receipt not found' });
    }
    
    let filePath = existingReceipt.file_path;
    let fileName = existingReceipt.file_name;
    
    if (req.file) {
      // Delete old file from filesystem
      const oldFilePath = path.join(uploadsDir, existingReceipt.file_path);
      if (fs.existsSync(oldFilePath)) {
        fs.unlinkSync(oldFilePath);
      }
      
      // Update with new uploaded file metadata
      filePath = path.basename(req.file.path);
      fileName = req.file.originalname;
    }
    
    await db.run(
      `UPDATE receipts 
       SET file_path = ?, file_name = ?, location = ?, timestamp = ?, amount = ?, currency = ?, notes = ?
       WHERE id = ?`,
      [
        filePath,
        fileName,
        location !== undefined ? location : existingReceipt.location,
        timestamp !== undefined ? timestamp : existingReceipt.timestamp,
        amount !== undefined ? (amount ? parseFloat(amount) : null) : existingReceipt.amount,
        currency !== undefined ? currency : existingReceipt.currency,
        notes !== undefined ? notes : existingReceipt.notes,
        receiptId
      ]
    );
    
    const updatedReceipt = await db.get('SELECT * FROM receipts WHERE id = ?', [receiptId]);
    res.json(updatedReceipt);
  } catch (error: any) {
    console.error('Error updating receipt:', error);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message });
  }
});

// DELETE receipt from database and remove its physical file
router.delete('/:id', async (req, res) => {
  try {
    const receiptId = req.params.id;
    const db = await getDb();
    
    const receipt = await db.get('SELECT * FROM receipts WHERE id = ?', [receiptId]);
    if (!receipt) {
      return res.status(404).json({ error: 'Receipt not found' });
    }
    
    // Remove the file from the uploads directory
    const filePath = path.join(uploadsDir, receipt.file_path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    // Delete entry in database
    await db.run('DELETE FROM receipts WHERE id = ?', [receiptId]);
    res.json({ message: 'Receipt deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting receipt:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
