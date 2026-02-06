/**
 * API client for PDF export endpoint.
 * The actual server-side PDF generation is built in Plan 03-02.
 * Until then, calls to this will return 404, which is expected.
 */

export async function downloadPdf(pageSlug: string, weekEnding: string): Promise<void> {
  const res = await fetch(`/api/v1/exports/pdf/${pageSlug}?week=${weekEnding}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? `PDF export failed: ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${pageSlug}-${weekEnding}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
