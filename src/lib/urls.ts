/** Accept ordinary pasted domains without turning non-web schemes into website requests. */
export function normalizeWebsiteUrl(input: string): URL {
  const value = input.trim();
  if (
    !value ||
    (/^[a-z][a-z\d+.-]*:/i.test(value) &&
      !/^https?:/i.test(value) &&
      !/^[\w.-]+:\d+(?:\/|$)/.test(value))
  )
    throw new Error('Enter a website address, for example https://sciencealert.com.');
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    throw new Error('This website address is invalid. Check the domain and try again.');
  }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Use an HTTP or HTTPS website address without embedded credentials.');
  return url;
}
