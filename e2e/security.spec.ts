import { test, expect } from '@playwright/test';
test('HTTP boundary rejects foreign origins and wrong device credentials', async ({ request }) => {
  const blocked = await request.post('/api/register', {
    headers: { Origin: 'https://other.example' },
    data: { name: 'Intruder', role: 'parent' },
  });
  expect(blocked.status()).toBe(403);
  const response = await request.post('/api/register', {
    data: { name: 'Test parent', role: 'parent' },
  });
  const session = await response.json();
  expect(response.ok()).toBe(true);
  const unauthorized = await request.post('/api/role', {
    data: { ...session, token: 'wrong', role: 'baby' },
  });
  expect(unauthorized.status()).toBe(401);
  const invalidPush = await request.post('/api/subscription', {
    data: {
      ...session,
      subscription: {
        endpoint: 'http://127.0.0.1:4311/api/config',
        keys: { auth: 'a', p256dh: 'b' },
      },
    },
  });
  expect(invalidPush.status()).toBe(400);
  const leave = await request.post('/api/leave', { data: session });
  expect(leave.ok()).toBe(true);
  expect((await request.post('/api/role', { data: { ...session, role: 'baby' } })).status()).toBe(
    401,
  );
});
