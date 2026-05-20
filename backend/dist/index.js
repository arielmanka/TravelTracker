"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const db_1 = require("./db");
// Load environmental variables
dotenv_1.default.config();
// Initialize routes
const trips_1 = __importDefault(require("./routes/trips"));
const receipts_1 = __importDefault(require("./routes/receipts"));
const entries_1 = __importDefault(require("./routes/entries"));
const settings_1 = __importDefault(require("./routes/settings"));
const reports_1 = __importDefault(require("./routes/reports"));
const llm_1 = __importDefault(require("./routes/llm"));
const app = (0, express_1.default)();
const port = process.env.PORT || 8000;
const uploadsDir = process.env.UPLOADS_DIR || './data/receipts';
// Global Middlewares
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Serve uploaded receipts statically
app.use('/uploads', express_1.default.static(path_1.default.resolve(uploadsDir)));
// Register API Router mount points
app.use('/api/trips', trips_1.default);
app.use('/api/receipts', receipts_1.default);
app.use('/api/entries', entries_1.default);
app.use('/api/settings', settings_1.default);
app.use('/api/reports', reports_1.default);
app.use('/api/llm', llm_1.default);
// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
});
// Start service
async function startServer() {
    try {
        // Connect and verify SQLite schema
        await (0, db_1.getDb)();
        app.listen(port, () => {
            console.log(`Backend server started on port ${port}`);
            console.log(`Receipt uploads hosted from: ${path_1.default.resolve(uploadsDir)}`);
        });
    }
    catch (error) {
        console.error('Failed to start TravelTracker Backend Server:', error);
        process.exit(1);
    }
}
startServer();
