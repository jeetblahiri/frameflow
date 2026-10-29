import { expect, it } from 'vitest';
import { normalizeWebsiteUrl } from '../../src/lib/urls';
it('accepts the reported pasted ScienceAlert address without a scheme', () => {
  expect(
    normalizeWebsiteUrl(
      ' sciencealert.com/this-woman-lived-24-years-without-knowing-she-was-missing-her-entire-cerebellum ',
    ).href,
  ).toBe(
    'https://sciencealert.com/this-woman-lived-24-years-without-knowing-she-was-missing-her-entire-cerebellum',
  );
  expect(normalizeWebsiteUrl('http://example.com/a?b=1').protocol).toBe('http:');
});
it('rejects non-web schemes, malformed addresses and embedded credentials', () => {
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,test',
    'file:///etc/passwd',
    'not a website',
    'https://user:password@example.com',
  ])
    expect(() => normalizeWebsiteUrl(value)).toThrow();
});
