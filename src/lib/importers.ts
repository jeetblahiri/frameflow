import JSZip from 'jszip';
import { openPdf } from '../engine/pdf';
import type { Asset, Project } from '../model';
import { uid } from '../model';
import { getMedia, putMedia, putMediaBatch } from './storage';
import { validateProject } from './project-validation';
import { openArchive, readArchiveEntry, PROJECT_ARCHIVE_LIMIT, METADATA_LIMIT } from './archive';

export interface ImportAdapter {
  name: string;
  accepts: (file: File) => boolean;
  import: (file: File) => Promise<Asset[]>;
}
const base = (file: File, kind: Asset['kind']): Asset => ({
  id: uid(),
  kind,
  name: file.name.replace(/\.[^.]+$/, '').slice(0, 120),
  width: 1080,
  height: 1920,
  x: 50 + Math.random() * 600,
  y: 50 + Math.random() * 400,
  boardWidth: 230,
  mime: file.type,
});
async function store(asset: Asset, blob: Blob) {
  asset.blobKey = asset.id;
  await putMedia(asset.id, blob);
  asset.src = URL.createObjectURL(blob);
  return asset;
}
function safeSvg(text: string) {
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (doc.querySelector('parsererror, script, foreignObject, iframe'))
    throw new Error('This SVG contains embedded code or HTML. Export a plain SVG or PNG instead.');
  for (const el of doc.querySelectorAll('*'))
    for (const attr of [...el.attributes]) {
      if (
        /^on/i.test(attr.name) ||
        (/href$/i.test(attr.name) &&
          !attr.value.startsWith('#') &&
          !attr.value.startsWith('data:image/')) ||
        /url\(\s*['"]?(https?:|\/\/)/i.test(attr.value)
      )
        throw new Error(
          'This SVG references external content. Embed its images or import a PNG to keep recording reliable.',
        );
    }
  return text;
}
const imageAdapter: ImportAdapter = {
  name: 'Images',
  accepts: (f) => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg|avif)$/i.test(f.name),
  async import(file) {
    let blob: Blob = file;
    if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name))
      blob = new Blob([safeSvg(await file.text())], { type: 'image/svg+xml' });
    const asset = base(file, 'image');
    asset.mime = blob.type || file.type;
    const url = URL.createObjectURL(blob);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      asset.width = image.naturalWidth;
      asset.height = image.naturalHeight;
      if (!asset.width || !asset.height) throw new Error('The image has no readable dimensions.');
    } finally {
      URL.revokeObjectURL(url);
    }
    return [await store(asset, blob)];
  },
};
const mediaAdapter: ImportAdapter = {
  name: 'Local audio & video',
  accepts: (f) =>
    /^(video|audio)\//.test(f.type) || /\.(mp4|mov|webm|m4v|mp3|wav|ogg|m4a)$/i.test(f.name),
  async import(file) {
    const audio = file.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(file.name);
    const asset = base(file, audio ? 'audio' : 'video');
    const url = URL.createObjectURL(file);
    try {
      const el = document.createElement(audio ? 'audio' : 'video');
      el.preload = 'metadata';
      el.src = url;
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () =>
            reject(
              new Error(
                'This media format could not be read. Try H.264 MP4 video or MP3/WAV audio.',
              ),
            ),
          10000,
        );
        el.onloadedmetadata = () => {
          clearTimeout(timer);
          resolve();
        };
        el.onerror = () => {
          clearTimeout(timer);
          reject(
            new Error(
              'This browser does not support this media codec. Convert it to H.264 MP4 or MP3/WAV.',
            ),
          );
        };
      });
      if (el instanceof HTMLVideoElement) {
        asset.width = el.videoWidth;
        asset.height = el.videoHeight;
      }
      el.removeAttribute('src');
      el.load();
    } finally {
      URL.revokeObjectURL(url);
    }
    return [await store(asset, file)];
  },
};
const pdfAdapter: ImportAdapter = {
  name: 'PDF documents',
  accepts: (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name),
  async import(file) {
    const doc = await openPdf(new Uint8Array(await file.arrayBuffer()));
    try {
      const page = await doc.getPage(1);
      const v = page.getViewport({ scale: 1 });
      const asset = base(file, 'pdf');
      asset.width = v.width;
      asset.height = v.height;
      asset.pages = doc.numPages;
      return [await store(asset, file)];
    } finally {
      await doc.loadingTask.destroy();
    }
  },
};
const textAdapter: ImportAdapter = {
  name: 'Text & Markdown',
  accepts: (f) => f.type.startsWith('text/') || /\.(txt|md)$/i.test(f.name),
  async import(file) {
    const asset = base(file, 'article');
    asset.text = (await file.slice(0, 128 * 1024).text()).slice(0, 30000);
    asset.background = '#e9e9dc';
    asset.color = '#35483b';
    asset.fontSize = 46;
    return [asset];
  },
};
const slidesAdapter: ImportAdapter = {
  name: 'PowerPoint text',
  accepts: (f) => /\.pptx$/i.test(f.name),
  async import(file) {
    const zip = await openArchive(file, 200 * 1024 * 1024);
    const files = Object.keys(zip.files)
      .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => Number(a.match(/(\d+)\.xml/)![1]) - Number(b.match(/(\d+)\.xml/)![1]));
    if (files.length > 100)
      throw new Error('Import at most 100 slides at a time, or export the deck as a PDF.');
    const assets: Asset[] = [];
    for (const [i, name] of files.entries()) {
      const xml = new DOMParser().parseFromString(
        new TextDecoder().decode(await readArchiveEntry(zip.file(name)!, METADATA_LIMIT)),
        'application/xml',
      );
      const text = [...xml.getElementsByTagName('a:p')]
        .map((p) => [...p.getElementsByTagName('a:t')].map((t) => t.textContent).join(''))
        .join('\n\n');
      if (text.trim())
        assets.push({
          ...base(file, 'article'),
          name: `${file.name} · ${i + 1}`.slice(0, 120),
          text: text.slice(0, 30000),
          background: '#e9e9dc',
          color: '#35483b',
          fontSize: 48,
          x: 80 + i * 260,
          y: 80,
        });
    }
    if (!assets.length)
      throw new Error(
        'No slide text found. Export the presentation to PDF to preserve its design.',
      );
    return assets;
  },
};
export const adapters: ImportAdapter[] = [
  imageAdapter,
  mediaAdapter,
  pdfAdapter,
  slidesAdapter,
  textAdapter,
];
export async function importFile(file: File): Promise<Asset[]> {
  if (file.size > 300 * 1024 * 1024)
    throw new Error(
      `${file.name} is over 300 MB. Use a smaller source file for this browser studio.`,
    );
  const adapter = adapters.find((a) => a.accepts(file));
  if (!adapter)
    throw new Error(
      `${file.name}: unsupported file. Try images, PDF, MP4, MP3, text, Markdown, or PPTX (text only).`,
    );
  return adapter.import(file);
}
export async function importUrl(input: string): Promise<Asset[]> {
  const url = new URL(input);
  if (url.username || url.password)
    throw new Error('Use a website URL without embedded credentials.');
  if (!['https:', 'http:'].includes(url.protocol))
    throw new Error('Use a complete HTTP or HTTPS link.');
  if (/\.(png|jpe?g|webp|gif|svg|pdf|mp4|webm|mp3)(\?|$)/i.test(url.pathname)) {
    try {
      const response = await fetch(url.href, { mode: 'cors', credentials: 'omit' });
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      return importFile(
        new File([blob], decodeURIComponent(url.pathname.split('/').pop() || 'Imported asset'), {
          type: blob.type,
        }),
      );
    } catch {
      throw new Error(
        'This source does not allow direct browser import. Download the file yourself, then import it here.',
      );
    }
  }
  return [
    {
      id: uid(),
      kind: 'webpage',
      name: (url.hostname.replace(/^www\./, '') + url.pathname.slice(0, 80)).slice(0, 120),
      url: url.href,
      width: 390,
      height: 693,
      x: 120,
      y: 120,
      boardWidth: 240,
    },
  ];
}
export async function exportProject(project: Project): Promise<Blob> {
  const zip = new JSZip();
  const plain = structuredClone(project);
  let total = 0;
  for (const a of plain.assets)
    if (a.blobKey) {
      const blob = await getMedia(a.blobKey);
      if (!blob)
        throw new Error(
          `Original media is missing: ${a.name}. Re-import it before backing up this project.`,
        );
      total += blob.size;
      if (total > PROJECT_ARCHIVE_LIMIT - METADATA_LIMIT)
        throw new Error(
          'This project exceeds the 512 MB archive limit. Split it into smaller projects.',
        );
      zip.file(`media/${a.blobKey}`, blob);
      delete a.src;
    }
  const metadata = JSON.stringify(plain, null, 2);
  if (new Blob([metadata]).size > METADATA_LIMIT)
    throw new Error('Project metadata is too large. Clear old annotations before backing up.');
  zip.file('project.json', metadata);
  return zip.generateAsync({ type: 'blob', compression: 'STORE' });
}
export async function importProject(file: File): Promise<Project> {
  const zip = await openArchive(file);
  const entry = zip.file('project.json');
  if (!entry) throw new Error('This is not a Frameflow project archive.');
  const project = validateProject(
    JSON.parse(new TextDecoder().decode(await readArchiveEntry(entry, METADATA_LIMIT))),
  );
  const pending: { key: string; blob: Blob }[] = [];
  let total = 0;
  for (const asset of project.assets) {
    if (asset.blobKey) {
      const entry = zip.file(`media/${asset.blobKey}`);
      if (!entry) throw new Error(`Missing media: ${asset.name}`);
      const bytes = await readArchiveEntry(
        entry,
        Math.min(300 * 1024 * 1024, PROJECT_ARCHIVE_LIMIT - total),
      );
      total += bytes.length;
      const blob = new Blob([bytes as Uint8Array<ArrayBuffer>], {
        type: asset.mime || 'application/octet-stream',
      });
      if (asset.mime?.split(';')[0].toLowerCase() === 'image/svg+xml') safeSvg(await blob.text());
      // Import into a fresh namespace; an archive can never overwrite existing source media.
      asset.blobKey = uid();
      pending.push({ key: asset.blobKey, blob });
    } else if (asset.src) safeSvg(decodeURIComponent(asset.src.slice(asset.src.indexOf(',') + 1)));
  }
  // No persistent changes occur until every model, file and SVG has passed validation.
  await putMediaBatch(pending);
  for (const asset of project.assets)
    if (asset.blobKey) {
      const item = pending.find((p) => p.key === asset.blobKey)!;
      asset.src = URL.createObjectURL(item.blob);
    }
  return project;
}
