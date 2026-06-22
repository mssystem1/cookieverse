import assert from 'node:assert/strict';

const origin = String(process.argv[2] || 'http://127.0.0.1:3000').replace(
  /\/+$/,
  '',
);

function metaContent(html: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,
      'i',
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,
      'i',
    ),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }

  return '';
}

function canonicalHref(html: string) {
  return (
    html.match(
      /<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i,
    )?.[1] ||
    html.match(
      /<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["'][^>]*>/i,
    )?.[1] ||
    ''
  );
}

async function fetchHtml(pathname: string) {
  const response = await fetch(`${origin}${pathname}`, {
    headers: { accept: 'text/html' },
  });
  assert.equal(response.status, 200, `${pathname} returned ${response.status}`);
  return response.text();
}

async function checkRichMetadata(pathname: '/' | '/app') {
  const html = await fetchHtml(pathname);
  const expectedCanonical = `${origin}${pathname === '/' ? '' : pathname}`;

  assert.match(html, /<title>Cookieverse<\/title>/i);
  assert(metaContent(html, 'description').length > 40);
  assert.equal(metaContent(html, 'og:title'), 'Cookieverse');
  assert(metaContent(html, 'og:description').length > 40);
  assert.equal(metaContent(html, 'og:image:width'), '1200');
  assert.equal(metaContent(html, 'og:image:height'), '630');
  assert.equal(metaContent(html, 'twitter:card'), 'summary_large_image');
  assert(metaContent(html, 'twitter:image').includes('/brand/'));
  assert.equal(canonicalHref(html), expectedCanonical);

  const baseAppIds = html.match(/name=["']base:app_id["']/gi) || [];
  assert.equal(baseAppIds.length, 1, `${pathname} must contain one base:app_id`);

  const imageUrl = metaContent(html, 'og:image');
  const imageResponse = await fetch(imageUrl);
  assert.equal(imageResponse.status, 200, `${imageUrl} must return 200`);
  assert.match(
    imageResponse.headers.get('content-type') || '',
    /^image\/jpeg/i,
  );
}

async function checkMiniIsolation() {
  const html = await fetchHtml('/mini');

  assert.equal(metaContent(html, 'description'), 'AI blessing cookies');
  assert.equal(metaContent(html, 'og:image'), '');
  assert(metaContent(html, 'fc:miniapp'), 'Mini App embed metadata is missing');
}

async function main() {
  await checkRichMetadata('/');
  await checkRichMetadata('/app');
  await checkMiniIsolation();

  console.log(`Cookieverse metadata checks passed for ${origin}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
