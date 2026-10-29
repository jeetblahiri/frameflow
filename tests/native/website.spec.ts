import { test, expect } from '@playwright/test';
test.afterEach(async ({ page }) => {
  // Stop native tracks before Playwright closes a failed test's active sharing window.
  await page
    .evaluate(() =>
      document.querySelectorAll('video').forEach((video) => {
        if (video.srcObject instanceof MediaStream)
          video.srcObject.getTracks().forEach((track) => track.stop());
      }),
    )
    .catch(() => {});
});
// Requires a visible desktop Chromium window. No media-stream mocks or fake screen source.
test('scrolls and records a real local website tab that denies iframe embedding', async ({
  page,
  context,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  const cdp = await context.newCDPSession(page);
  const { windowId } = await cdp.send('Browser.getWindowForTarget');
  await cdp.send('Browser.setWindowBounds', { windowId, bounds: { width: 1440, height: 1000 } });
  await cdp.send('Browser.grantPermissions', {
    origin: new URL(page.url()).origin,
    permissions: ['capturedSurfaceControl'],
  });
  await expect.poll(() => page.evaluate(() => innerWidth)).toBe(1440);
  const initialFrame = (await page.getByTestId('composition').boundingBox())!;
  const initialViewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  await page.getByRole('button', { name: 'Import content', exact: true }).click();
  await page.getByRole('button', { name: 'From a link' }).click();
  await page.getByLabel('Content URL').fill('http://127.0.0.1:4321');
  await page.getByRole('button', { name: 'Add to library' }).click();
  await page.getByRole('button', { name: 'Script', exact: true }).click();
  const reader = (await page
    .getByRole('region', { name: 'Script reading area', exact: true })
    .boundingBox())!;
  expect(reader.y + reader.height).toBeLessThan(
    (await page.getByTestId('composition').boundingBox())!.y,
  );
  await expect(page.locator('iframe.mobile-webpage')).toHaveCount(0);
  const popup = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Open website window', exact: true }).click();
  const source = await popup;
  await source.waitForLoadState('domcontentloaded');
  expect(await source.evaluate(() => window.opener)).toBeNull();
  await expect.poll(() => source.evaluate(() => innerWidth)).toBeLessThan(500);
  await page.bringToFront();
  await page.getByRole('button', { name: 'Share website tab', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Disconnect', exact: true })).toBeVisible({
    timeout: 20000,
  });
  const sharedFrame = (await page.getByTestId('composition').boundingBox())!;
  for (const key of ['x', 'width', 'height'] as const)
    expect(Math.abs(sharedFrame[key] - initialFrame[key])).toBeLessThan(1);
  const sharedViewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  if (initialViewport.height === sharedViewport.height)
    expect(Math.abs(sharedFrame.y - initialFrame.y)).toBeLessThan(1);
  const pixel = (expected: number[]) =>
    page
      .locator('.recording-canvas')
      .evaluate(
        (c: HTMLCanvasElement, rgb) =>
          [...c.getContext('2d')!.getImageData(540, 1200, 1, 1).data]
            .slice(0, 3)
            .reduce((n, value, i) => n + Math.abs(value - rgb[i]), 0),
        expected,
      );
  await expect.poll(() => pixel([68, 187, 136])).toBeLessThan(20);
  // Full website interaction stays in the actual local source window.
  await source.getByRole('button', { name: 'Change color' }).click();
  await page.bringToFront();
  await expect.poll(() => pixel([240, 180, 94])).toBeLessThan(20);
  await source.getByLabel('Your name').fill('Frameflow');
  await page.bringToFront();
  await expect.poll(() => pixel([204, 136, 238])).toBeLessThan(20);
  await page.getByRole('button', { name: 'Scroll here', exact: true }).click();
  await expect(page.locator('.website-hint')).toContainText('Scroll over the frame');
  const box = (await page.getByTestId('composition').boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6);
  await page.mouse.wheel(0, 1400);
  await expect.poll(() => source.evaluate(() => scrollY)).toBeGreaterThan(100);
  await expect.poll(() => pixel([238, 68, 136])).toBeLessThan(20);
  await page.getByRole('button', { name: 'Pen (P)', exact: true }).click();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.4);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.4, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Undo last annotation' })).toBeEnabled();
  const stoppedAt = await source.evaluate(() => scrollY);
  await page.mouse.wheel(0, -600);
  await page.waitForTimeout(500);
  expect(await source.evaluate(() => scrollY)).toBe(stoppedAt);
  await page.screenshot({ path: info.outputPath('native-website.png') });
  await page.getByRole('button', { name: 'Start recording', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Start recording', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Finish recording' })).toBeVisible();
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: 'Finish recording' }).click();
  const video = page.getByLabel('Recording preview');
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.videoWidth)).toBe(1080);
  await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.videoHeight)).toBe(1920);
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download video' }).click();
  const download = await downloading;
  await download.saveAs(info.outputPath(download.suggestedFilename()));
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await source.close();
  await expect(page.getByRole('heading', { name: 'Your website, in frame.' })).toBeVisible();
  expect(errors).toEqual([]);
});
