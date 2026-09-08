import { createJazzContext } from 'jazz-tools/backend';
import { app } from '../schema';
import permissions from '../permissions';
export function openDatabase(path = process.env.PIP_DATA_PATH || './.data/jazz') {
  const remote = process.env.JAZZ_SERVER_URL;
  if (process.env.VERCEL && !remote)
    throw new Error('Vercel requires an external Jazz server. Local storage is development only.');
  const context = createJazzContext({
    appId: process.env.JAZZ_APP_ID || 'pip-local-v1',
    app,
    permissions,
    driver: remote ? { type: 'memory' } : { type: 'persistent', dataPath: path },
    ...(remote ? { serverUrl: remote, backendSecret: process.env.JAZZ_BACKEND_SECRET } : {}),
  });
  return { db: remote ? context.asBackend() : context.db(), context };
}
