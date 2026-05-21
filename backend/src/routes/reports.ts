import { Router } from 'express';
import { getDb } from '../db';
import { generateReportPDF } from '../services/pdfService';
import { generateNonResidencyPDF } from '../services/nonResidencyPdfService';

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

// GET download Proof of Non-Residency PDF for a given target country
router.get('/non-residency', async (req, res) => {
  try {
    const country   = ((req.query.country  as string) || '').trim();
    const ownerName = ((req.query.name     as string) || '').trim();

    if (!country) {
      return res.status(400).json({ error: 'country query parameter is required.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=non_residency_${country.replace(/\s+/g, '_')}.pdf`
    );

    await generateNonResidencyPDF(country, ownerName, res);
  } catch (error: any) {
    console.error('Error generating non-residency PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate non-residency proof PDF' });
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

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const country = entry.country.trim();

      if (!countryDatesMap[country]) {
        countryDatesMap[country] = new Set<string>();
      }

      // Non-last entry: stay spans [startStr, nextEntryStartStr) exclusive.
      // Last entry: endStr === startStr, so the loop runs once for the entry day only.
      const startStr = entry.entry_time.substring(0, 10);
      const hasNext = i < entries.length - 1;
      const endStr = hasNext
        ? entries[i + 1].entry_time.substring(0, 10)
        : startStr;

      const current = new Date(startStr + 'T00:00:00Z');
      const end     = new Date(endStr   + 'T00:00:00Z');

      // For the last entry end === start so the loop executes exactly once.
      while (current <= end) {
        const dateStr = current.toISOString().split('T')[0];
        if (dateStr >= pastYearStr && dateStr <= todayStr) {
          countryDatesMap[country].add(dateStr);
        }
        current.setDate(current.getDate() + 1);
        if (hasNext && current >= end) break;
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

    // Build all months in the 365-day window (past 12 complete months + current)
    const allMonths: string[] = [];
    const cursor = new Date(pastYear.getFullYear(), pastYear.getMonth(), 1);
    const todayMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    while (cursor <= todayMonthStart) {
      const mm = String(cursor.getMonth() + 1).padStart(2, '0');
      allMonths.push(`${cursor.getFullYear()}-${mm}`);
      cursor.setMonth(cursor.getMonth() + 1);
    }

    // Pre-sort all dates per country for efficient scanning
    const countryDatesSorted: Record<string, string[]> = {};
    for (const [country, dates] of Object.entries(countryDatesMap)) {
      countryDatesSorted[country] = Array.from(dates).sort();
    }

    // For each month, compute the cumulative days spent in the 365-day window up to end of that month
    const allCountries = Object.keys(countryDatesMap);
    const trends = allMonths.map(month => {
      const trendItem: any = { month };
      const monthEndStr = `${month}-31`; // string compare works; we just need an upper bound
      for (const country of allCountries) {
        const sorted = countryDatesSorted[country] || [];
        // Count all dates in [pastYearStr, min(monthEnd, todayStr)]
        const upperBound = monthEndStr < todayStr ? monthEndStr : todayStr;
        let count = 0;
        for (const d of sorted) {
          if (d > upperBound) break;
          count++;
        }
        trendItem[country] = count;
      }
      return trendItem;
    });

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
