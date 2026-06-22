const fs = require('fs');
const path = require('path');

const root = process.cwd();
const lockPath = path.join(root, 'package-lock.json');

if (!fs.existsSync(lockPath)) {
  console.log('[patch-reown] package-lock.json not found; skipping.');
  process.exit(0);
}

const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
const packagePaths = Object.keys(lock.packages || {}).filter((packagePath) =>
  packagePath.endsWith('node_modules/@reown/appkit'),
);

const fetchBlock =
  /        try \{\r?\n            apiProjectConfig = await ApiController\.fetchProjectConfig\(\);\r?\n            (shouldUseApiConfig|useApiConfig) = apiProjectConfig !== null && apiProjectConfig !== undefined;\r?\n        \}\r?\n        catch \(e\) \{\r?\n            console\.warn\('\[Reown Config\] Failed to fetch remote project configuration\. Using local\/default values\.', e\);\r?\n        \}/;

let patched = 0;
let alreadyPatched = 0;

for (const packagePath of packagePaths) {
  const target = path.join(
    root,
    packagePath,
    'dist',
    'esm',
    'src',
    'utils',
    'ConfigUtil.js',
  );

  if (!fs.existsSync(target)) continue;

  const source = fs.readFileSync(target, 'utf8');

  if (source.includes('Cookieverse: basic WalletConnect QR mode')) {
    alreadyPatched += 1;
    continue;
  }

  const match = source.match(fetchBlock);

  if (!match) {
    console.warn('[patch-reown] expected source block not found:', target);
    continue;
  }

  const apiFlag = match[1];
  const after = `        // Cookieverse: basic WalletConnect QR mode does not consume remote
        // project features, so avoid an unnecessary rate-limited cloud request.
        if (!isBasic) {
            try {
                apiProjectConfig = await ApiController.fetchProjectConfig();
                ${apiFlag} = apiProjectConfig !== null && apiProjectConfig !== undefined;
            }
            catch (e) {
                console.warn('[Reown Config] Failed to fetch remote project configuration. Using local/default values.', e);
            }
        }`;

  fs.writeFileSync(target, source.replace(fetchBlock, after));
  patched += 1;
}

console.log(
  `[patch-reown] patched ${patched}; already patched ${alreadyPatched}; discovered ${packagePaths.length}.`,
);
