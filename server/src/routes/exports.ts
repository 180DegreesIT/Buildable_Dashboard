import { Router, type Request, type Response } from 'express';
import { generatePdf, VALID_PAGES, getPageTitle } from '../services/PdfExportService.js';

const router = Router();

/**
 * GET /pdf/:page?week=YYYY-MM-DD
 *
 * Generates a branded PDF snapshot of the specified dashboard page.
 * Returns the PDF as a downloadable file.
 */
router.get('/pdf/:page', async (req: Request, res: Response) => {
  const page = String(req.params.page);
  const weekRaw = req.query.week;
  const week = typeof weekRaw === 'string' ? weekRaw : undefined;

  // Validate page slug
  if (!VALID_PAGES.includes(page)) {
    res.status(400).json({
      error: `Invalid page: "${page}". Valid pages: ${VALID_PAGES.join(', ')}`,
    });
    return;
  }

  // Validate week query param
  if (!week || !/^\d{4}-\d{2}-\d{2}$/.test(week)) {
    res.status(400).json({
      error: 'Missing or invalid "week" query parameter. Expected format: YYYY-MM-DD',
    });
    return;
  }

  // Validate it parses to a real date
  const parsed = new Date(week + 'T00:00:00');
  if (isNaN(parsed.getTime())) {
    res.status(400).json({
      error: `Invalid date: "${week}"`,
    });
    return;
  }

  try {
    const pdfBuffer = await generatePdf(page, week);
    const title = getPageTitle(page);
    const filename = `${title} - ${week}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err: any) {
    console.error(`PDF generation failed for ${page}:`, err);
    res.status(500).json({
      error: 'PDF generation failed',
      details: err.message,
    });
  }
});

export default router;
