/** Inline styles position canvas objects; scripts and media stay on controlled sources. */
export const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data: blob:",
  "media-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "connect-src 'self' blob: data: https: http:",
  "object-src 'none'",
  'frame-src https: http:',
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
