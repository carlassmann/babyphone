import { createHash } from 'node:crypto';
import { rm } from 'node:fs/promises';
await rm('dist/pip-local-ca.crt', { force: true });
const assets = Array.from(new Bun.Glob('**/*').scanSync('dist'))
  .filter((path) => path !== 'sw.js' && path !== '_headers')
  .sort()
  .map((path) => `/${path}`);
const source = await Bun.file('public/sw.js').text();
const hash = createHash('sha256').update(source);
for (const asset of assets) hash.update(asset).update(await Bun.file(`dist${asset}`).bytes());
const version = hash.digest('hex').slice(0, 12);
await Bun.write(
  'dist/sw.js',
  source
    .replace("'pip-shell-v1'", `'pip-shell-${version}'`)
    .replace(/const ASSETS = \[[\s\S]*?\];/, `const ASSETS = ${JSON.stringify(['/', ...assets])};`),
);
