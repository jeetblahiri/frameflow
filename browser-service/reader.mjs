const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export async function showReader(page) {
  const source = page.url();
  const article = await page.evaluate(() => {
    const root =
      document.querySelector(
        '[itemprop=articleBody],.article-content,.entry-content,article,main',
      ) || document.body;
    const title = (document.querySelector('h1')?.textContent || document.title).slice(0, 500);
    const blocks = [...root.querySelectorAll('p,h2,h3,img')]
      .filter((el) => !el.closest('nav,aside,footer,[class*=advert]'))
      .slice(0, 150)
      .map((el) =>
        el.tagName === 'IMG'
          ? { image: el.currentSrc || el.src, alt: el.alt || '' }
          : { text: el.textContent.trim().slice(0, 12000), heading: el.tagName !== 'P' },
      )
      .filter((b) => b.image || b.text);
    return { title, blocks };
  });
  const body = article.blocks
    .map((block) => {
      if (block.image) {
        try {
          const url = new URL(block.image);
          if (!['http:', 'https:'].includes(url.protocol)) return '';
          return `<img src="${escape(url.href)}" alt="${escape(block.alt)}">`;
        } catch {
          return '';
        }
      }
      return block.heading ? `<h2>${escape(block.text)}</h2>` : `<p>${escape(block.text)}</p>`;
    })
    .join('');
  if (!body) throw new Error('This page has no readable article content.');
  await page.setContent(
    `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>html{background:#fff;color:#252b38}body{margin:0;padding:26px 24px 60px;font:18px/1.7 Georgia,serif;overflow-wrap:anywhere}h1{font:600 27px/1.25 system-ui;letter-spacing:-.8px;margin:15px 0 24px}h2{font:600 21px/1.4 system-ui;margin-top:30px}img{max-width:100%;height:auto;border-radius:5px}small{font:12px system-ui;color:#7a8190}p{margin:20px 0}</style></head><body><small>ARTICLE VIEW · ${escape(new URL(source).hostname)}</small><h1>${escape(article.title)}</h1>${body}</body></html>`,
    { waitUntil: 'domcontentloaded', timeout: 15000 },
  );
  return { url: source, title: article.title };
}
