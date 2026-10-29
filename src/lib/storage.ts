import { openDB } from 'idb';
import type { Project, Recovery, Take } from '../model';
const db = openDB('frameflow-studio', 1, {
  upgrade(db) {
    db.createObjectStore('projects');
    db.createObjectStore('media');
    db.createObjectStore('takes', { keyPath: 'id' });
    db.createObjectStore('chunks');
    db.createObjectStore('recovery');
  },
});
export async function saveProject(project: Project) {
  const plain = structuredClone(project);
  plain.assets.forEach((a) => {
    if (a.blobKey) delete a.src;
  });
  await (await db).put('projects', plain, 'current');
}
export async function loadProject(): Promise<Project | undefined> {
  const p = (await (await db).get('projects', 'current')) as Project | undefined;
  if (p)
    for (const a of p.assets)
      if (a.blobKey) {
        const b = await getMedia(a.blobKey);
        if (b) a.src = URL.createObjectURL(b);
      }
  return p;
}
export async function putMedia(key: string, blob: Blob) {
  await (await db).put('media', blob, key);
}
export async function putMediaBatch(items: { key: string; blob: Blob }[]) {
  if (!items.length) return;
  const d = await db;
  const tx = d.transaction('media', 'readwrite');
  for (const item of items) tx.store.put(item.blob, item.key);
  await tx.done;
}
export async function saveRecordingChunk(meta: Recovery, index: number, blob: Blob) {
  const d = await db;
  const tx = d.transaction(['chunks', 'recovery'], 'readwrite');
  tx.objectStore('chunks').put(blob, `${meta.id}:${String(index).padStart(8, '0')}`);
  tx.objectStore('recovery').put(meta, 'pending');
  await tx.done;
}
function chunkRange(id: string) {
  return IDBKeyRange.bound(`${id}:`, `${id}:\uffff`);
}
export async function getMedia(key: string): Promise<Blob | undefined> {
  return (await db).get('media', key);
}
export async function putChunk(id: string, index: number, blob: Blob) {
  await (await db).put('chunks', blob, `${id}:${String(index).padStart(8, '0')}`);
}
export async function setRecovery(data: Recovery) {
  await (await db).put('recovery', data, 'pending');
}
export async function getRecovery(): Promise<Recovery | undefined> {
  return (await db).get('recovery', 'pending');
}
export async function clearRecovery(id: string) {
  const d = await db;
  const tx = d.transaction(['chunks', 'recovery'], 'readwrite');
  const pending = (await tx.objectStore('recovery').get('pending')) as Recovery | undefined;
  if (pending?.id === id) tx.objectStore('recovery').delete('pending');
  tx.objectStore('chunks').delete(chunkRange(id));
  await tx.done;
}
export async function assembleChunks(id: string, mime: string): Promise<Blob> {
  const parts = await (await db).getAll('chunks', chunkRange(id));
  return new Blob(parts, { type: mime });
}
export async function saveTake(take: Take) {
  await (await db).put('takes', take);
}
export async function listTakes(): Promise<Take[]> {
  return ((await (await db).getAll('takes')) as Take[]).sort((a, b) => b.createdAt - a.createdAt);
}
export async function deleteTake(id: string) {
  await (await db).delete('takes', id);
}
export function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
