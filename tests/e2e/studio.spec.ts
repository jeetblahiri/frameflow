import JSZip from 'jszip';
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Project } from '../../src/model';
async function project(page: Page): Promise<Project> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((res, rej) => {
      const r = indexedDB.open('frameflow-studio', 1);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return new Promise((res, rej) => {
      const tx = db.transaction('projects');
      const r = tx.objectStore('projects').get('current');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  });
}
async function start(page: Page) {
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Start recording', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Finish recording' })).toBeVisible();
}
async function addFile(page: Page, name: string, mimeType: string, buffer: Buffer) {
  await page.getByRole('button', { name: /Import content/ }).click();
  await page.getByTestId('asset-file-input').setInputFiles({ name, mimeType, buffer });
  await expect(page.getByRole('dialog')).toBeHidden();
}
function pdfFixture() {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << >> /Contents 4 0 R >>',
    '<< /Length 32 >>\nstream\n0.2 0.6 0.4 rg 0 0 300 400 re f\nendstream',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << >> /Contents 6 0 R >>',
    '<< /Length 32 >>\nstream\n0.6 0.2 0.4 rg 0 0 300 400 re f\nendstream',
  ];
  let out = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out);
  out += `xref\n0 7\n0000000000 65535 f \n${offsets
    .slice(1)
    .map((n) => `${String(n).padStart(10, '0')} 00000 n `)
    .join('\n')}\ntrailer\n<< /Size 7 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out);
}
function wavFixture() {
  const rate = 44100,
    seconds = 3,
    length = rate * seconds,
    b = Buffer.alloc(44 + length * 2);
  b.write('RIFF');
  b.writeUInt32LE(b.length - 8, 4);
  b.write('WAVEfmt ', 8);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(rate, 24);
  b.writeUInt32LE(rate * 2, 28);
  b.writeUInt16LE(2, 32);
  b.writeUInt16LE(16, 34);
  b.write('data', 36);
  b.writeUInt32LE(length * 2, 40);
  for (let i = 0; i < length; i++)
    b.writeInt16LE(Math.round(Math.sin((i / rate) * Math.PI * 440) * 7000), 44 + i * 2);
  return b;
}
test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await expect(page.getByRole('heading', { name: /Your ideas/ })).toBeVisible();
});
test('keeps canvas movement and Focus Lens transforms independent, and persists them', async ({
  page,
}) => {
  await expect(page.getByTestId('composition')).toHaveJSProperty('width', 1080);
  await expect(page.getByTestId('composition')).toHaveJSProperty('height', 1920);
  await page.waitForTimeout(800);
  const before = await project(page);
  await page.getByRole('button', { name: 'Canvas', exact: true }).click();
  await page.getByRole('button', { name: 'Toggle content library', exact: true }).click();
  const card = page.locator('[data-asset="cover"] .board-preview');
  const box = await card.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + 30, box!.y + 30);
  await page.mouse.down();
  await page.mouse.move(box!.x + 75, box!.y + 65, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(800);
  const moved = await project(page);
  expect(moved.assets[0].x).toBeGreaterThan(before.assets[0].x + 30);
  await page.getByRole('button', { name: 'Focus The overview effect', exact: true }).click();
  await page.getByRole('slider', { name: 'Focus zoom' }).fill('2');
  await page.getByRole('button', { name: 'Fill / crop' }).click();
  await page.getByRole('slider', { name: 'Focus zoom' }).fill('1.5');
  await page.waitForTimeout(800);
  const focused = await project(page);
  expect(focused.assets[0].x).toBe(moved.assets[0].x);
  expect(focused.scenes[0].composition.layers[0].zoom).toBe(1.5);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Your ideas/ })).toBeVisible();
  expect((await project(page)).scenes[0].composition.layers[0].zoom).toBe(1.5);
});
test('imports images, text, PDF pages and audio; backs up and restores project media', async ({
  page,
}, testInfo) => {
  await addFile(
    page,
    'diagram.svg',
    'image/svg+xml',
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#bada55"/></svg>',
    ),
  );
  await addFile(
    page,
    'notes.txt',
    'text/plain',
    Buffer.from('A useful note\n\nContent imported from a local file.'),
  );
  await addFile(page, 'two-pages.pdf', 'application/pdf', pdfFixture());
  await page.getByRole('button', { name: 'Focus two-pages', exact: true }).click();
  await page.getByLabel('PDF page').selectOption('2');
  await expect
    .poll(async () =>
      page
        .getByTestId('composition')
        .evaluate((c: HTMLCanvasElement) =>
          [...c.getContext('2d')!.getImageData(540, 960, 1, 1).data]
            .slice(0, 3)
            .reduce((n, v, i) => n + Math.abs(v - [153, 51, 102][i]), 0),
        ),
    )
    .toBeLessThan(6);
  await addFile(page, 'soundtrack.wav', 'audio/wav', wavFixture());
  await page.getByRole('button', { name: 'Focus soundtrack', exact: true }).click();
  await page.getByRole('button', { name: 'Play media with audio' }).click();
  await expect(page.getByRole('button', { name: 'Pause media' })).toBeVisible();
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save project', exact: true }).click();
  const file = await dl;
  const path = await file.path();
  await file.saveAs(testInfo.outputPath('backup.frameflow'));
  expect(path).toBeTruthy();
  await page.getByTestId('project-file-input').setInputFiles(path!);
  await expect(page.locator('.toast')).toContainText('Project opened');
  await page.waitForTimeout(800);
  const p = await project(page);
  expect(p.assets).toHaveLength(9);
  expect(p.assets.filter((a) => a.blobKey)).toHaveLength(3);
  expect(p.scenes[0].composition.layers[0].assetId).toBe(
    p.assets.find((a) => a.name === 'soundtrack')!.id,
  );
});
test('records camera, microphone, annotations, scene changes and pause/resume into one playable vertical take', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Disable camera', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Enable microphone', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Disable microphone', exact: true })).toBeVisible();
  await start(page);
  await page.waitForTimeout(1300);
  await page.getByRole('button', { name: 'Pen (P)', exact: true }).click();
  const frame = await page.getByTestId('composition').boundingBox();
  await page.mouse.move(frame!.x + frame!.width * 0.2, frame!.y + frame!.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(frame!.x + frame!.width * 0.8, frame!.y + frame!.height * 0.4, {
    steps: 10,
  });
  await page.mouse.up();
  await page.waitForTimeout(700);
  await page.getByRole('button', { name: 'Pause recording', exact: true }).click();
  const time = await page.locator('.record-timer').innerText();
  await page.waitForTimeout(1100);
  expect(await page.locator('.record-timer').innerText()).toBe(time);
  await page.getByRole('button', { name: 'Next scene', exact: true }).click();
  await page.getByRole('button', { name: 'Resume recording', exact: true }).click();
  await page.waitForTimeout(1400);
  await page.getByRole('button', { name: 'Finish recording' }).click();
  await expect(page.getByRole('button', { name: 'Download video', exact: true })).toBeVisible();
  const meta = await page.getByLabel('Recording preview').evaluate(async (v: HTMLVideoElement) => {
    if (v.readyState < 1)
      await new Promise((r) => v.addEventListener('loadedmetadata', r, { once: true }));
    return { w: v.videoWidth, h: v.videoHeight, duration: v.duration };
  });
  expect(meta.w).toBe(1080);
  expect(meta.h).toBe(1920);
  const dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download video', exact: true }).click();
  const file = await dl;
  await file.saveAs(testInfo.outputPath(file.suggestedFilename()));
  expect(errors).toEqual([]);
  await page.getByRole('button', { name: 'Trim this take', exact: true }).click();
  await page.getByLabel('Trim start').fill('0.5');
  await page.getByLabel('Trim end').fill('1.5');
  const trimDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Trim & download', exact: true }).click();
  const trimmed = await trimDownload;
  await trimmed.saveAs(testInfo.outputPath(trimmed.suggestedFilename()));
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: /Recordings/ }).click();
  await expect(page.getByLabel('Recording preview')).toBeVisible();
});
test('surfaces denied permissions and opens websites in a live mobile viewport', async ({
  page,
}) => {
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('denied', 'NotAllowedError');
    };
  });
  await page.getByRole('button', { name: 'Enable microphone', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('access was denied');
  await page.getByRole('button', { name: /Import content/ }).click();
  await page.getByRole('button', { name: 'From a link' }).click();
  await page.getByLabel('Content URL').fill('https://www.youtube.com/watch?v=example');
  await page.getByRole('button', { name: 'Add to library' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.locator('iframe.mobile-webpage')).toHaveAttribute(
    'src',
    'https://www.youtube.com/watch?v=example',
  );
  await expect(page.getByRole('button', { name: 'Connect website capture' })).toBeVisible();
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Connect website capture');
});
test('restores recoverable recording chunks after an interrupted session', async ({ page }) => {
  await start(page);
  await page.waitForTimeout(2400);
  page.on('dialog', (d) => d.accept());
  await page.reload();
  await expect(page.getByText('Your last take was interrupted.')).toBeVisible();
  await page.getByRole('button', { name: 'Recover take' }).click();
  await expect(page.getByRole('button', { name: 'Download video' })).toBeVisible();
});
test('supports tablet and portrait layouts with a fixed vertical output and annotation controls', async ({
  page,
}) => {
  for (const viewport of [
    { width: 1024, height: 768 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    await page.reload();
    await expect(page.getByRole('heading', { name: /Your ideas/ })).toBeVisible();
    const b = await page.getByTestId('composition').boundingBox();
    expect(b!.width / b!.height).toBeCloseTo(9 / 16, 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  await page.getByRole('button', { name: 'Pen (P)', exact: true }).click();
  const c = page.getByTestId('composition');
  const b = await c.boundingBox();
  await page.mouse.move(b!.x + b!.width * 0.2, b!.y + b!.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(b!.x + b!.width * 0.7, b!.y + b!.height * 0.3, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Undo last annotation' })).toBeEnabled();
});

test('mixes local video, an imported audio track and microphone without resetting the take', async ({
  page,
}, testInfo) => {
  await page.getByRole('button', { name: 'Canvas', exact: true }).click();
  const videoBytes = await page.evaluate(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 360;
    canvas.height = 640;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#d67342';
    ctx.fillRect(0, 0, 360, 640);
    const audio = new AudioContext();
    await audio.resume();
    const osc = audio.createOscillator();
    osc.frequency.value = 660;
    const gain = audio.createGain();
    gain.gain.value = 0.18;
    const destination = audio.createMediaStreamDestination();
    osc.connect(gain);
    gain.connect(destination);
    osc.start();
    const capture = canvas.captureStream(30);
    const stream = new MediaStream([
      ...capture.getVideoTracks(),
      ...destination.stream.getAudioTracks(),
    ]);
    const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8,opus' });
    const chunks: Blob[] = [];
    return await new Promise<number[]>((resolve) => {
      let i = 0;
      const timer = setInterval(() => {
        ctx.fillStyle = i++ % 2 ? '#d67342' : '#c96238';
        ctx.fillRect(0, 0, 360, 640);
      }, 33);
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        clearInterval(timer);
        osc.stop();
        capture.getTracks().forEach((t) => t.stop());
        await audio.close();
        resolve([...new Uint8Array(await new Blob(chunks).arrayBuffer())]);
      };
      recorder.start();
      setTimeout(() => recorder.stop(), 1100);
    });
  });
  await addFile(page, 'motion.webm', 'video/webm', Buffer.from(videoBytes));
  await page.getByRole('button', { name: 'Focus motion', exact: true }).click();
  await page.getByRole('button', { name: 'Play media with audio', exact: true }).click();
  await addFile(page, 'background.wav', 'audio/wav', wavFixture());
  await page.getByRole('button', { name: 'Play background', exact: true }).click();
  await page.getByRole('button', { name: 'Enable microphone', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Disable microphone', exact: true })).toBeVisible();
  await start(page);
  await page.waitForTimeout(1600);
  await page.getByRole('button', { name: 'Next scene', exact: true }).click();
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: 'Finish recording' }).click();
  await expect(page.getByRole('button', { name: 'Download video' })).toBeVisible();
  const levels = await page
    .getByLabel('Recording preview')
    .evaluate(async (video: HTMLVideoElement) => {
      const data = await (await fetch(video.src)).arrayBuffer();
      const c = new AudioContext();
      const buffer = await c.decodeAudioData(data);
      const samples = buffer.getChannelData(0),
        rate = buffer.sampleRate;
      // Short coherent windows avoid phase cancellation across a looped media splice.
      const amplitude = (hz: number, start: number) => {
        let strongest = 0;
        for (let window = 0; window < 6; window++) {
          const from = Math.floor((start + window * 0.05) * rate),
            n = Math.floor(0.05 * rate);
          let re = 0,
            im = 0;
          for (let i = 0; i < n; i++) {
            const v = samples[from + i] || 0,
              angle = (2 * Math.PI * hz * (from + i)) / rate;
            re += v * Math.cos(angle);
            im += v * Math.sin(angle);
          }
          strongest = Math.max(strongest, (2 * Math.hypot(re, im)) / n);
        }
        return strongest;
      };
      const result = {
        early220: amplitude(220, 0.6),
        late220: amplitude(220, buffer.duration - 0.6),
        early440: amplitude(440, 0.6),
        late440: amplitude(440, buffer.duration - 0.6),
        early660: amplitude(660, 0.6),
        late660: amplitude(660, buffer.duration - 0.6),
      };
      await c.close();
      return result;
    });
  await testInfo.attach('audio-spectrum.json', {
    body: JSON.stringify(levels, null, 2),
    contentType: 'application/json',
  });
  expect(levels.early220).toBeGreaterThan(0.02);
  expect(levels.late220).toBeGreaterThan(0.02);
  expect(levels.early440).toBeGreaterThan(0.0002);
  expect(levels.late440).toBeGreaterThan(0.0002);
  expect(levels.early660).toBeGreaterThan(levels.late660 * 4 + 0.005);
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download video' }).click();
  const file = await event;
  await file.saveAs(testInfo.outputPath(`mixed-${file.suggestedFilename()}`));
});

test('keeps the current project intact when an imported archive is invalid', async ({ page }) => {
  await addFile(
    page,
    'original.svg',
    'image/svg+xml',
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#abc123"/></svg>',
    ),
  );
  await page.waitForTimeout(750);
  const before = await project(page),
    asset = before.assets.find((a) => a.name === 'original')!;
  const contents = await page.evaluate(async (key) => {
    const request = indexedDB.open('frameflow-studio', 1);
    const db = await new Promise<IDBDatabase>((r) => (request.onsuccess = () => r(request.result)));
    const blob = await new Promise<Blob>((r) => {
      const req = db.transaction('media').objectStore('media').get(key);
      req.onsuccess = () => r(req.result);
    });
    return blob.text();
  }, asset.blobKey!);
  const broken = structuredClone(before);
  broken.scenes[0].composition.camera.size = -1;
  const zip = new JSZip();
  zip.file('project.json', JSON.stringify(broken));
  zip.file(`media/${asset.blobKey}`, 'replacement content');
  await page.getByTestId('project-file-input').setInputFiles({
    name: 'broken.frameflow',
    mimeType: 'application/zip',
    buffer: await zip.generateAsync({ type: 'nodebuffer' }),
  });
  await expect(page.getByRole('alert')).toContainText('camera size');
  expect((await project(page)).id).toBe(before.id);
  const after = await page.evaluate(async (key) => {
    const request = indexedDB.open('frameflow-studio', 1);
    const db = await new Promise<IDBDatabase>((r) => (request.onsuccess = () => r(request.result)));
    const blob = await new Promise<Blob>((r) => {
      const req = db.transaction('media').objectStore('media').get(key);
      req.onsuccess = () => r(req.result);
    });
    return blob.text();
  }, asset.blobKey!);
  expect(after).toBe(contents);
});
test('recovers from a native encoder startup failure without leaving a stale session', async ({
  page,
}) => {
  await page.evaluate(() => {
    const Native = window.MediaRecorder;
    let fail = true;
    window.MediaRecorder = class extends Native {
      start(timeslice?: number) {
        if (fail) {
          fail = false;
          throw new DOMException('Encoder temporarily unavailable', 'NotSupportedError');
        }
        super.start(timeslice);
      }
    };
  });
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Start recording', exact: true })
    .click();
  await expect(page.getByRole('alert')).toContainText('Encoder temporarily unavailable');
  await expect(page.getByRole('dialog')).toBeVisible();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Start recording', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Finish recording' })).toBeVisible();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: 'Finish recording' }).click();
  await expect(page.getByRole('button', { name: 'Download video' })).toBeVisible();
});
test('enforces a production content policy without allowing inline scripts', async ({ page }) => {
  test.skip(process.env.FRAMEFLOW_E2E_PRODUCTION !== '1', 'Production build policy only');
  const policy = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'");
  const executed = await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'window.__unexpectedInlineScript = true';
    document.head.append(script);
    return '__unexpectedInlineScript' in window;
  });
  expect(executed).toBe(false);
});

test('imports a file dropped in the import dialog exactly once', async ({ page }) => {
  await page.getByRole('button', { name: /Import content/ }).click();
  const transfer = await page.evaluateHandle(() => {
    const data = new DataTransfer();
    data.items.add(
      new File(
        [
          '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#abcdef"/></svg>',
        ],
        'dropped.svg',
        { type: 'image/svg+xml' },
      ),
    );
    return data;
  });
  await page.locator('.drop-zone').dispatchEvent('drop', { dataTransfer: transfer });
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.waitForTimeout(800);
  const saved = await project(page);
  expect(saved.assets.filter((a) => a.name === 'dropped')).toHaveLength(1);
  await expect(page.locator('.global-drop')).toBeHidden();
});

test('renders PDF pages without the newest Map APIs', async ({ page }) => {
  await page.evaluate(() => {
    Reflect.deleteProperty(Map.prototype, 'getOrInsertComputed');
    Reflect.deleteProperty(WeakMap.prototype, 'getOrInsertComputed');
  });
  await addFile(page, 'compatibility.pdf', 'application/pdf', pdfFixture());
  await page.getByRole('button', { name: 'Focus compatibility', exact: true }).click();
  await page.getByLabel('PDF page').selectOption('2');
  await expect
    .poll(() =>
      page
        .getByTestId('composition')
        .evaluate((c: HTMLCanvasElement) =>
          [...c.getContext('2d')!.getImageData(540, 960, 1, 1).data]
            .slice(0, 3)
            .reduce((total, value, i) => total + Math.abs(value - [153, 51, 102][i]), 0),
        ),
    )
    .toBeLessThan(6);
});

test('starts with a quiet studio and keeps the presenter across scenes, including large cutouts', async ({
  page,
}) => {
  await expect(page.locator('.library')).toBeHidden();
  await expect(page.locator('.controls-panel')).toBeHidden();
  await expect(page.locator('.canvas-world')).toBeHidden();
  await page.getByRole('button', { name: 'Enable camera', exact: true }).click();
  await page.getByRole('button', { name: 'Presenter', exact: true }).click();
  await page.getByRole('slider', { name: 'Camera size', exact: true }).fill('1.4');
  await page.getByRole('slider', { name: 'Presenter horizontal position' }).fill('-0.3');
  await page.getByRole('slider', { name: 'Presenter vertical position' }).fill('0.2');
  await page.getByRole('button', { name: 'Next scene', exact: true }).click();
  await page.waitForTimeout(800);
  let saved = await project(page);
  expect(saved.presenter).toMatchObject({ enabled: true, size: 1.4, x: -0.3, y: 0.2 });
  expect(
    saved.scenes.every((s) => s.composition.camera.enabled && s.composition.camera.size === 1.4),
  ).toBe(true);
  // Pixel evidence that the live camera is still composited in the second scene.
  await expect
    .poll(() =>
      page.locator('.recording-canvas').evaluate((c: HTMLCanvasElement) => {
        const p = c.getContext('2d')!.getImageData(500, 650, 1, 1).data;
        return p[1] > p[0] + 40 && p[1] > p[2] + 40;
      }),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Remove background', exact: true }).click();
  await expect(page.getByText('Background removal ready · processed on this device.')).toBeVisible({
    timeout: 30000,
  });
  await page.getByRole('button', { name: 'Next scene', exact: true }).click();
  await page.waitForTimeout(800);
  saved = await project(page);
  expect(saved.presenter?.background).toBe('remove');
  await page.reload();
  await page.getByRole('button', { name: 'Presenter', exact: true }).click();
  await expect(page.getByRole('slider', { name: 'Camera size', exact: true })).toHaveValue('1.4');
  await expect(page.getByRole('button', { name: 'Remove background', exact: true })).toHaveClass(
    /active/,
  );
});

test('runs a mobile webpage, switches between interaction and annotations, and composes a permitted capture', async ({
  page,
}) => {
  await page.route('https://mobile.frameflow.test/', (r) =>
    r.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#44bb88}section{height:1000px}footer{height:1000px;background:#ee4488}@media(min-width:500px){body{background:red}}</style><section><input aria-label="Your name"><button onclick="this.textContent='Clicked'">Try me</button></section><footer>Footer</footer>`,
    }),
  );
  // Deterministic stand-in for the browser permission dialog and screen pixels.
  // Actual frame cropping is additionally checked in the manual Chromium smoke test.
  await page.evaluate(() => {
    Object.defineProperty(window, 'CropTarget', {
      value: {
        fromElement: async (el: Element) => {
          if (!el.classList.contains('output-border')) throw new Error('Wrong capture target');
          return { target: true };
        },
      },
      configurable: true,
    });
    navigator.mediaDevices.getDisplayMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 390;
      canvas.height = 693;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#44bb88';
      ctx.fillRect(0, 0, 390, 693);
      const stream = canvas.captureStream(30);
      setInterval(() => ctx.fillRect(0, 0, 390, 693), 33);
      const track = stream.getVideoTracks()[0] as MediaStreamTrack & {
        cropTo: () => Promise<void>;
      };
      track.cropTo = async () => {};
      (window as Window & { testWebStream?: MediaStream }).testWebStream = stream;
      return stream;
    };
  });
  await page.getByRole('button', { name: 'Import content', exact: true }).click();
  await page.getByRole('button', { name: 'From a link' }).click();
  await page.getByLabel('Content URL').fill('https://mobile.frameflow.test/');
  await page.getByRole('button', { name: 'Add to library' }).click();
  const frame = page.frameLocator('iframe.mobile-webpage');
  await frame.getByLabel('Your name').fill('Frameflow');
  // Keyboard input avoids Chromium's emulated-viewport hit-testing quirk for scaled OOPIFs.
  // Native pointer interaction is verified in the non-emulated capture smoke test.
  await frame.getByRole('button', { name: 'Try me' }).press('Enter');
  await expect(frame.getByRole('button', { name: 'Clicked' })).toBeVisible();
  expect(await frame.locator('body').evaluate(() => innerWidth)).toBe(390);
  await frame.locator('body').evaluate(() => window.scrollTo(0, 1100));
  expect(await frame.locator('body').evaluate(() => scrollY)).toBeGreaterThan(1000);
  await page.getByRole('button', { name: 'Connect website capture' }).click();
  await expect(page.getByRole('button', { name: 'Disconnect capture' })).toBeVisible();
  await expect
    .poll(() =>
      page
        .locator('.recording-canvas')
        .evaluate((c: HTMLCanvasElement) =>
          [...c.getContext('2d')!.getImageData(540, 960, 1, 1).data].slice(0, 3),
        ),
    )
    .toEqual([68, 187, 136]);
  await page.getByRole('button', { name: 'Pen (P)', exact: true }).click();
  const box = (await page.getByTestId('composition').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.3, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Undo last annotation' })).toBeEnabled();
  await start(page);
  await page.waitForTimeout(1200);
  await page.evaluate(() =>
    (window as Window & { testWebStream?: MediaStream }).testWebStream
      ?.getVideoTracks()[0]
      .dispatchEvent(new Event('ended')),
  );
  await expect(page.getByRole('button', { name: 'Resume recording' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume recording' }).click();
  await expect(page.getByRole('alert')).toContainText('Reconnect website capture');
  await page.getByRole('button', { name: 'Finish recording' }).click();
  await expect(page.getByLabel('Recording preview')).toBeVisible();
});
