import { createHash } from 'node:crypto';
const assets = Array.from(new Bun.Glob('**/*').scanSync('dist'))
  .filter((path) => path !== 'sw.js')
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
