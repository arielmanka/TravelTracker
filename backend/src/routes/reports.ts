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
    
    const today = new Date();
    // Use UTC for consistent date math
    const todayStr = today.toISOString().split('T')[0];
    const pastYear = new Date(today);
    pastYear.setDate(pastYear.getDate() - 365);
    const pastYearStr = pastYear.toISOString().split('T')[0];
    
    const countryDatesMap: Record<string, Set<string>> = {};
    const monthlyCountryStaysMap: Record<string, Record<string, Set<string>>> = {}; // YYYY-MM -> Country -> Dates
    
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const country = entry.country.trim();
      
      if (!countryDatesMap[country]) {
        countryDatesMap[country] = new Set<string>();
      }
      
      const startStr = entry.entry_time.substring(0, 10);
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
          const dateStr = current.toISOString().split('T')[0];
          if (dateStr >= pastYearStr && dateStr <= todayStr) {
            countryDatesMap[country].add(dateStr);
            
            const monthKey = dateStr.substring(0, 7); // YYYY-MM
            if (!monthlyCountryStaysMap[monthKey]) {
              monthlyCountryStaysMap[monthKey] = {};
            }
            if (!monthlyCountryStaysMap[monthKey][country]) {
              monthlyCountryStaysMap[monthKey][country] = new Set<string>();
            }
            monthlyCountryStaysMap[monthKey][country].add(dateStr);
          }
          current.setDate(current.getDate() + 1);
        }
      } else {
        while (current <= end) {
          const dateStr = current.toISOString().split('T')[0];
          if (dateStr >= pastYearStr && dateStr <= todayStr) {
            countryDatesMap[country].add(dateStr);
            
            const monthKey = dateStr.substring(0, 7);
            if (!monthlyCountryStaysMap[monthKey]) {
              monthlyCountryStaysMap[monthKey] = {};
            }
            if (!monthlyCountryStaysMap[monthKey][country]) {
              monthlyCountryStaysMap[monthKey][country] = new Set<string>();
            }
            monthlyCountryStaysMap[monthKey][country].add(dateStr);
          }
          current.setDate(current.getDate() + 1);
        }
      }
    }
    
    // Format country stays data
    const countryStays = Object.entries(countryDatesMap)
      .map(([country, dates]) => ({
        country,
        days: dates.size
      }))
      .filter(c => c.days > 0)
      .sort((a, b) => b.days - a.days); // Sort descending
    
    // Format monthly trends data
    const trends = Object.entries(monthlyCountryStaysMap).map(([month, countryStaysObj]) => {
      const trendItem: any = { month };
      for (const [country, dates] of Object.entries(countryStaysObj)) {
        trendItem[country] = dates.size;
      }
      return trendItem;
    }).sort((a, b) => a.month.localeCompare(b.month)); // Sort chronological
    
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
