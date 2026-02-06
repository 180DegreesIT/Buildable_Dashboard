import puppeteer from 'puppeteer';

// ─── Page Config ────────────────────────────────────────────────────────────

interface PageConfig {
  landscape: boolean;
  title: string;
}

const PAGE_CONFIG: Record<string, PageConfig> = {
  'executive-summary': { landscape: false, title: 'Executive Summary' },
  'financial':         { landscape: true,  title: 'Financial Deep Dive' },
  'regional':          { landscape: true,  title: 'Regional Performance' },
  'targets':           { landscape: false, title: 'Target Management' },
};

export const VALID_PAGES = Object.keys(PAGE_CONFIG);

export function getPageTitle(slug: string): string {
  return PAGE_CONFIG[slug]?.title ?? slug;
}

// ─── Date Formatting ────────────────────────────────────────────────────────

function formatDateAU(dateStr: string): string {
  const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T00:00:00'));
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatTimestampAU(): string {
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// ─── PDF Generation ─────────────────────────────────────────────────────────

export async function generatePdf(pageSlug: string, weekEnding: string): Promise<Buffer> {
  const config = PAGE_CONFIG[pageSlug];
  if (!config) {
    throw new Error(`Unknown page slug: ${pageSlug}. Valid pages: ${VALID_PAGES.join(', ')}`);
  }

  const clientPort = process.env.CLIENT_PORT || '4200';
  const printUrl = `http://localhost:${clientPort}/#/print/${pageSlug}?week=${weekEnding}`;

  const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  };

  // Allow overriding the browser executable (e.g. Edge on Windows)
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    await page.setViewport({ width: 1280, height: 900 });

    await page.goto(printUrl, {
      waitUntil: 'networkidle0',
      timeout: 30_000,
    });

    // Wait for the page to signal it has finished loading data
    await page.waitForSelector('[data-print-ready="true"]', {
      timeout: 15_000,
    });

    const weekFormatted = formatDateAU(weekEnding);
    const timestamp = formatTimestampAU();

    const headerTemplate = `
      <div style="font-size: 9px; width: 100%; padding: 0 40px; display: flex; justify-content: space-between; color: #666;">
        <span>Buildable Approvals Pty Ltd</span>
        <span>Week ending: ${weekFormatted}</span>
      </div>
    `;

    const footerTemplate = `
      <div style="font-size: 8px; width: 100%; text-align: center; color: #999;">
        Page <span class="pageNumber"></span> of <span class="totalPages"></span> &mdash; Generated ${timestamp}
      </div>
    `;

    const pdfBuffer = await page.pdf({
      format: 'A4',
      landscape: config.landscape,
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate,
      margin: {
        top: '80px',
        bottom: '60px',
        left: '40px',
        right: '40px',
      },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}
