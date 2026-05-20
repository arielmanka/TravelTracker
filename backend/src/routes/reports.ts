import { Router } from 'express';
import { getDb } from '../db';
import { generateReportPDF } from '../services/pdfService';

const router = Router();

// GET download compiled PDF report
router.get('/export', async (req, res) => {
  try {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=travel_report.pdf');
    
    await generateReportPDF(res);
  } catch (error: any) {
    console.error('Error generating PDF report download:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to compile and export travel report PDF' });
    }
  }
});

// GET analytics aggregates for frontend visualizations (days per country & monthly trends)
router.get('/analytics', async (req, res) => {
  try {
    const db = await getDb();
    
    // Fetch all journey entries
    const entries = await db.all('SELECT * FROM journey_entries ORDER BY entry_time ASC');
    
    const todayStr = new Date().toISOString().split('T')[0];
    const countryDatesMap: Record<string, Set<string>> = {};
    const monthlyStaysMap: Record<string, Set<string>> = {}; // unique dates visited in each month YYYY-MM
    
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const country = entry.country.trim();
      
      if (!countryDatesMap[country]) {
        countryDatesMap[country] = new Set<string>();
      }
      
      const startStr = entry.entry_time.substring(0, 10);
      let endStr = todayStr;
      const hasNext = i < entries.length - 1;
      if (hasNext) {
        endStr = entries[i + 1].entry_time.substring(0, 10);
      }
      
      const start = new Date(startStr + 'T00:00:00');
      const end = new Date(endStr + 'T00:00:00');
      
      const current = new Date(start);
      if (hasNext) {
        while (current < end) {
          const dateStr = current.toISOString().split('T')[0];
          countryDatesMap[country].add(dateStr);
          
          const monthKey = dateStr.substring(0, 7); // YYYY-MM
          if (!monthlyStaysMap[monthKey]) {
            monthlyStaysMap[monthKey] = new Set<string>();
          }
          monthlyStaysMap[monthKey].add(dateStr);
          
          current.setDate(current.getDate() + 1);
        }
      } else {
        while (current <= end) {
          const dateStr = current.toISOString().split('T')[0];
          countryDatesMap[country].add(dateStr);
          
          const monthKey = dateStr.substring(0, 7);
          if (!monthlyStaysMap[monthKey]) {
            monthlyStaysMap[monthKey] = new Set<string>();
          }
          monthlyStaysMap[monthKey].add(dateStr);
          
          current.setDate(current.getDate() + 1);
        }
      }
    }
    
    // Format country stays data
    const countryStays = Object.entries(countryDatesMap).map(([country, dates]) => ({
      country,
      days: dates.size
    })).sort((a, b) => b.days - a.days); // Sort descending
    
    // Format monthly trends data
    const trends = Object.entries(monthlyStaysMap).map(([month, dates]) => ({
      month,
      days: dates.size
    })).sort((a, b) => a.month.localeCompare(b.month)); // Sort chronological
    
    res.json({
      countryStays,
      trends
    });
  } catch (error: any) {
    console.error('Error compiling analytics aggregates:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
