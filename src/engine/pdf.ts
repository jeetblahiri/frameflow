/** Shared lazy PDF setup; every font and decoder stays on the app's own origin. */
export async function openPdf(data: Uint8Array) {
  const pdf = await import('pdfjs-dist');
  pdf.GlobalWorkerOptions.workerSrc = (
    await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  ).default;
  const base = new URL(`${import.meta.env.BASE_URL}pdf-assets/`, document.baseURI).href;
  return pdf.getDocument({
    data,
    cMapUrl: `${base}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}standard_fonts/`,
    wasmUrl: `${base}wasm/`,
  }).promise;
}
