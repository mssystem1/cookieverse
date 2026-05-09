// src/lib/share.ts

export type ShareToXInput = {
  text: string;
  url?: string;
  imageBlob?: Blob | null;
  filename?: string;
  preferNative?: boolean;
};

export type ShareToXResult =
  | { ok: true; method: 'native-image-share' }
  | { ok: true; method: 'clipboard-plus-x-intent' }
  | { ok: true; method: 'x-intent' }
  | { ok: false; method: 'failed'; error: string };

function isLikelyIOS() {
  if (typeof navigator === 'undefined') return false;

  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS desktop mode
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function isLikelyMobile() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  return (
    window.innerWidth <= 1024 ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia?.('(pointer: coarse)').matches
  );
}

async function copyTextSafely(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // ignore
  }

  return false;
}

function openXIntent(text: string, url?: string) {
  const xUrl =
    `https://x.com/intent/tweet?text=${encodeURIComponent(text)}` +
    `${url ? `&url=${encodeURIComponent(url)}` : ''}`;

  window.open(xUrl, '_blank', 'noopener,noreferrer');
}

export async function shareToX(input: ShareToXInput): Promise<ShareToXResult> {
  const text = input.text.trim();

  const url =
    input.url ||
    (typeof window !== 'undefined'
      ? window.location.href
      : 'https://www.cookieverse.tech/app');

  const fullText = `${text}${url ? `\n\n${url}` : ''}`;

  const imageBlob = input.imageBlob || null;

  let imageFile: File | null = null;

  if (imageBlob) {
    imageFile = new File(
      [imageBlob],
      input.filename || 'cookieverse-wallet-roast.png',
      {
        type: imageBlob.type || 'image/png',
      },
    );
  }

  const mobile = isLikelyMobile();
  const ios = isLikelyIOS();

  // For iOS/Base App/Safari-like mobile behavior:
  // Copy full text first, then open native share sheet with image.
  if (imageFile && mobile && navigator.share) {
    try {
      await copyTextSafely(fullText);

      const canShareImage =
        !navigator.canShare ||
        navigator.canShare({
          files: [imageFile],
        });

      if (canShareImage) {
        // Do NOT pass url separately here.
        // Some targets handle { text, url, files } badly.
        // Full URL is already inside fullText.
        await navigator.share({
          title: 'Cookieverse Wallet Roast',
          text: fullText,
          files: [imageFile],
        });

        return { ok: true, method: 'native-image-share' };
      }
    } catch (e: any) {
      // If user cancels share sheet, do not force-open X.
      if (
        e?.name === 'AbortError' ||
        String(e?.message || '').toLowerCase().includes('abort')
      ) {
        return {
          ok: false,
          method: 'failed',
          error: 'Share cancelled.',
        };
      }

      // Continue to fallback
    }
  }

  // Desktop / unsupported image sharing:
  // Copy full text, then open X composer with text only.
  const copied = await copyTextSafely(fullText);

  try {
    openXIntent(text, url);

    return copied
      ? { ok: true, method: 'clipboard-plus-x-intent' }
      : { ok: true, method: 'x-intent' };
  } catch (e: any) {
    return {
      ok: false,
      method: 'failed',
      error: e?.message || 'Failed to open X composer.',
    };
  }
}