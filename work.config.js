export default {
  project: 'pip',
  commands: {
    api: {
      run: 'bun --env-file=.env.local server/index.ts',
      autoStart: true,
      restart: 'on-exit',
      portless: false,
    },
    preview: {
      run: 'bun --bun vite preview --host 0.0.0.0 --port 4313',
      autoStart: false,
      portless: false,
    },
    https: {
      run: 'PIP_HTTPS=1 bun --bun vite preview --host 0.0.0.0 --port 4312',
      autoStart: false,
      portless: false,
    },
    dev: { run: 'bun --bun vite --host 0.0.0.0 --port 4314', autoStart: false, portless: false },
    web: {
      run: 'bun --bun vite preview --host 0.0.0.0 --port 4310',
      autoStart: true,
      restart: 'on-exit',
      portless: false,
    },
  },
};
