import { networkInterfaces } from 'node:os';
import { mkdir } from 'node:fs/promises';
const addresses = Object.values(networkInterfaces()).flatMap((interfaces) =>
  (interfaces || [])
    .filter((item) => item.family === 'IPv4' && !item.internal)
    .map((item) => item.address),
);
await mkdir('.certs', { recursive: true });
function openssl(args: string[]) {
  const result = Bun.spawnSync(['openssl', ...args], { stderr: 'pipe' });
  if (result.exitCode) throw new Error(result.stderr.toString());
}
if (!(await Bun.file('.certs/ca.key').exists()))
  openssl([
    'req',
    '-x509',
    '-newkey',
    'rsa:2048',
    '-nodes',
    '-keyout',
    '.certs/ca.key',
    '-out',
    '.certs/ca.crt',
    '-days',
    '365',
    '-subj',
    '/CN=Pip local development CA',
    '-addext',
    'basicConstraints=critical,CA:TRUE',
    '-addext',
    'keyUsage=critical,keyCertSign,cRLSign',
  ]);
openssl([
  'req',
  '-newkey',
  'rsa:2048',
  '-nodes',
  '-keyout',
  '.certs/server.key',
  '-out',
  '.certs/server.csr',
  '-subj',
  '/CN=Pip local prototype',
]);
await Bun.write(
  '.certs/extensions.cnf',
  `subjectAltName=DNS:localhost,IP:127.0.0.1${addresses.map((ip) => `,IP:${ip}`).join('')}\nbasicConstraints=CA:FALSE\nkeyUsage=digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n`,
);
openssl([
  'x509',
  '-req',
  '-in',
  '.certs/server.csr',
  '-CA',
  '.certs/ca.crt',
  '-CAkey',
  '.certs/ca.key',
  '-CAcreateserial',
  '-out',
  '.certs/server.crt',
  '-days',
  '30',
  '-extfile',
  '.certs/extensions.cnf',
]);
await Bun.write('public/pip-local-ca.crt', Bun.file('.certs/ca.crt'));
console.log('Local HTTPS certificates generated. No system trust settings changed.');
for (const address of addresses) console.log(`Phone URL: https://${address}:4312`);
