import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { getDb } from './db';
import { ensureFonts } from './services/fontService';

// Load environmental variables
dotenv.config();

// Initialize routes
import tripsRouter from './routes/trips';
import receiptsRouter from './routes/receipts';
import entriesRouter from './routes/entries';
import settingsRouter from './routes/settings';
import reportsRouter from './routes/reports';
import llmRouter from './routes/llm';

const app = express();
const port = process.env.PORT || 8000;
const uploadsDir = process.env.UPLOADS_DIR || './data/receipts';

// Global Middlewares
app.use(cors());
app.use(express.json());

// Serve uploaded receipts statically
app.use('/uploads', express.static(path.resolve(uploadsDir)));

// Register API Router mount points
app.use('/api/trips', tripsRouter);
app.use('/api/receipts', receiptsRouter);
app.use('/api/entries', entriesRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/llm', llmRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// Start service
async function startServer() {
  try {
    // Connect and verify SQLite schema
    await getDb();

    // Ensure Unicode fonts are ready
    await ensureFonts();
    
    app.listen(port, () => {
      console.log(`Backend server started on port ${port}`);
      console.log(`Receipt uploads hosted from: ${path.resolve(uploadsDir)}`);
    });
  } catch (error) {
    console.error('Failed to start TravelTracker Backend Server:', error);
    process.exit(1);
  }
}

startServer();
