"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFontPaths = getFontPaths;
exports.ensureFonts = ensureFonts;
exports.registerFonts = registerFonts;
const https_1 = __importDefault(require("https"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
function getFontPaths() {
    const dbPath = process.env.DATABASE_PATH || './data/travel_tracker.db';
    const fontsDir = path_1.default.join(path_1.default.dirname(dbPath), 'fonts');
    return {
        fontsDir,
        regular: path_1.default.join(fontsDir, 'Roboto-Regular.ttf'),
        bold: path_1.default.join(fontsDir, 'Roboto-Bold.ttf')
    };
}
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        // Ensure parent directory exists
        const dir = path_1.default.dirname(dest);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        const file = fs_1.default.createWriteStream(dest);
        const request = (targetUrl) => {
            https_1.default.get(targetUrl, (response) => {
                if (response.statusCode === 301 || response.statusCode === 302) {
                    const redirectUrl = response.headers.location;
                    if (redirectUrl) {
                        request(redirectUrl);
                    }
                    else {
                        reject(new Error(`Redirect status code ${response.statusCode} but no location header`));
                    }
                    return;
                }
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download file: status code ${response.statusCode}`));
                    return;
                }
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', (err) => {
                fs_1.default.unlink(dest, () => { }); // delete partial file
                reject(err);
            });
        };
        request(url);
    });
}
/**
 * Downloads Roboto font files if they do not exist in the data/fonts folder.
 */
async function ensureFonts() {
    const paths = getFontPaths();
    if (fs_1.default.existsSync(paths.regular) && fs_1.default.existsSync(paths.bold)) {
        console.log('Roboto fonts already present.');
        return;
    }
    console.log('Roboto fonts not found. Downloading for PDF Unicode support...');
    const regularUrl = 'https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf';
    const boldUrl = 'https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Bold.ttf';
    try {
        await downloadFile(regularUrl, paths.regular);
        console.log('Downloaded Roboto-Regular.ttf successfully.');
        await downloadFile(boldUrl, paths.bold);
        console.log('Downloaded Roboto-Bold.ttf successfully.');
    }
    catch (error) {
        console.error('Failed to download Roboto fonts. PDFs will fallback to Helvetica (non-ASCII characters might not render correctly):', error);
    }
}
/**
 * Registers Roboto fonts with the given PDFDocument if they exist.
 * Returns true if registration was successful.
 */
function registerFonts(doc) {
    const paths = getFontPaths();
    if (fs_1.default.existsSync(paths.regular) && fs_1.default.existsSync(paths.bold)) {
        try {
            doc.registerFont('Roboto', paths.regular);
            doc.registerFont('Roboto-Bold', paths.bold);
            return true;
        }
        catch (e) {
            console.error('Error registering Roboto fonts with PDFKit:', e);
        }
    }
    return false;
}
