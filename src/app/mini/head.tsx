// src/app/mini/head.tsx
export default function Head() {
  // Use your deployed HTTPS origin here or NEXT_PUBLIC_BASE_URL
  const base =
    process.env.NEXT_PUBLIC_BASE_URL || 'https://monad-fortune-cookies.vercel.app';

  // IMPORTANT:
  // - version MUST be "1"
  // - action.type MUST be "launch_frame"
  // - imageUrl MUST exist and be 3:2 (e.g., 1200x800)
  const embed = {
    version: '1',
    imageUrl: `${base}/ms-logo.png`,
    button: {
      title: 'Fortune Cookie', // <= 32 chars
      action: {
        type: 'launch_frame',
        name: 'Fortune Cookie',
        url: `${base}/mini`, // optional but recommended
        splashImageUrl: `${base}/ms-logo-mini.png`, // 200x200 ok
        splashBackgroundColor: '#0b0b10',
      },
    },
  };

  const json = JSON.stringify(embed);
  const domain = new URL(base).host;

  return (
    <>
      <meta name="fc:miniapp" content={json} />
      {/* Back-compat tag for older clients */}
      <meta name="fc:frame" content={json} />
      {/* Helpful for some resolvers */}
      <meta name="fc:miniapp:domain" content={domain} />
      {/* OG for general debuggers */}
      <meta property="og:title" content="Fortune Cookie" />
      <meta property="og:description" content="Mint a Fortune Cookie" />
      <meta property="og:image" content={`${base}/ms-logo.png`} />
    </>
  );
}
