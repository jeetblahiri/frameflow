import JSZip from 'jszip';
export const PROJECT_ARCHIVE_LIMIT = 512 * 1024 * 1024;
export const METADATA_LIMIT = 8 * 1024 * 1024;
/** Check advertised expanded sizes before the ZIP decoder allocates entry buffers. */
export function checkZipBudget(
  bytes: Uint8Array,
  maxExpanded = PROJECT_ARCHIVE_LIMIT,
  maxEntries = 1600,
) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let pos = bytes.length - 22; pos >= Math.max(0, bytes.length - 65557); pos--) {
    if (
      view.getUint32(pos, true) === 0x06054b50 &&
      pos + 22 + view.getUint16(pos + 20, true) === bytes.length
    ) {
      end = pos;
      break;
    }
  }
  if (end < 0) throw new Error('This file is not a supported ZIP archive.');
  const count = view.getUint16(end + 10, true),
    offset = view.getUint32(end + 16, true);
  if (
    view.getUint16(end + 4, true) ||
    view.getUint16(end + 6, true) ||
    count === 65535 ||
    offset === 0xffffffff
  )
    throw new Error('Split and ZIP64 archives are not supported. Export a smaller project.');
  if (count > maxEntries) throw new Error('This archive contains too many files.');
  let pos = offset,
    total = 0;
  for (let i = 0; i < count; i++) {
    if (pos + 46 > end || view.getUint32(pos, true) !== 0x02014b50)
      throw new Error('This archive has an invalid file directory.');
    const size = view.getUint32(pos + 24, true),
      nameLength = view.getUint16(pos + 28, true),
      extra = view.getUint16(pos + 30, true),
      comment = view.getUint16(pos + 32, true);
    if (size === 0xffffffff || size > 300 * 1024 * 1024 || (total += size) > maxExpanded)
      throw new Error('This archive exceeds the expanded size limit. Export a smaller project.');
    const name = new TextDecoder().decode(bytes.subarray(pos + 46, pos + 46 + nameLength));
    if (
      name.startsWith('/') ||
      name.includes('\\') ||
      name.split('/').includes('..') ||
      view.getUint16(pos + 8, true) & 1
    )
      throw new Error('Unsafe or encrypted archive entries are not supported.');
    pos += 46 + nameLength + extra + comment;
    if (pos > end) throw new Error('This archive has a truncated file directory.');
  }
}
export async function openArchive(file: File, maxExpanded = PROJECT_ARCHIVE_LIMIT) {
  if (file.size > PROJECT_ARCHIVE_LIMIT)
    throw new Error('Project archives must be smaller than 512 MB.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  checkZipBudget(bytes, maxExpanded);
  return JSZip.loadAsync(bytes);
}
/** Bound the actual decoder output as well as the sizes declared in the file directory. */
export function readArchiveEntry(entry: JSZip.JSZipObject, limit: number): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const chunks: Uint8Array[] = [];
    let size = 0,
      failed = false;
    const stream = (
      entry as JSZip.JSZipObject & {
        internalStream(type: 'uint8array'): JSZip.JSZipStreamHelper<Uint8Array>;
      }
    ).internalStream('uint8array');
    stream
      .on('data', (chunk: Uint8Array) => {
        size += chunk.length;
        if (size > limit) {
          failed = true;
          stream.pause();
          reject(new Error(`${entry.name} exceeds the import size limit.`));
        } else chunks.push(chunk);
      })
      .on('error', reject)
      .on('end', () => {
        if (failed) return;
        const bytes = new Uint8Array(size);
        let at = 0;
        for (const chunk of chunks) {
          bytes.set(chunk, at);
          at += chunk.length;
        }
        resolve(bytes);
      });
    stream.resume();
  });
}
