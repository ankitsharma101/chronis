import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp } from './test-helper.js';

test('Edge Cases & Multi-User Isolation Suite', async (t) => {
  const ctx = await setupTestApp('alice');

  t.after(async () => {
    await ctx.close();
  });

  await t.test('PUT /permissions rejects non-boolean or invalid category with 400', async () => {
    const res = await fetch(`${ctx.baseUrl}/permissions`, {
      method: 'PUT',
      headers: ctx.authHeaders,
      body: JSON.stringify({ conversation: 'yes' })
    });
    assert.equal(res.status, 400);

    const res2 = await fetch(`${ctx.baseUrl}/permissions`, {
      method: 'PUT',
      headers: ctx.authHeaders,
      body: JSON.stringify({ crypto: true })
    });
    assert.equal(res2.status, 400);
  });

  await t.test('GET /events with invalid page or limit returns 400', async () => {
    const res = await fetch(`${ctx.baseUrl}/events?page=invalid`, {
      headers: ctx.authHeaders
    });
    assert.equal(res.status, 400);
  });

  await t.test('Multi-user isolation: User A data is not visible to User B', async () => {
    const aliceHeaders = {
      'X-User-Id': 'alice',
      'Content-Type': 'application/json'
    };
    const bobHeaders = {
      'X-User-Id': 'bob',
      'Content-Type': 'application/json'
    };

    // Alice creates an event
    const aliceCreate = await fetch(`${ctx.baseUrl}/events`, {
      method: 'POST',
      headers: aliceHeaders,
      body: JSON.stringify({
        type: 'note',
        title: "Alice's Secret Note",
        content: 'Confidential thoughts'
      })
    });
    const aliceEvent = await aliceCreate.json();

    // Bob lists events -> Bob should NOT see Alice's event
    const bobEventsRes = await fetch(`${ctx.baseUrl}/events`, {
      headers: bobHeaders
    });
    const bobData = await bobEventsRes.json();
    assert.ok(!bobData.events.some((e: any) => e.id === aliceEvent.id));

    // Bob attempts direct fetch of Alice's event -> 404 (not in Bob's tenancy)
    const bobDirectRes = await fetch(`${ctx.baseUrl}/events/${aliceEvent.id}`, {
      headers: bobHeaders
    });
    assert.equal(bobDirectRes.status, 404);

    // Alice turns note OFF -> Bob's permissions remain unaffected
    await fetch(`${ctx.baseUrl}/permissions`, {
      method: 'PUT',
      headers: aliceHeaders,
      body: JSON.stringify({ note: false })
    });

    const bobPermsRes = await fetch(`${ctx.baseUrl}/permissions`, {
      headers: bobHeaders
    });
    const bobPerms = await bobPermsRes.json();
    assert.equal(bobPerms.permissions.note, true);
  });
});
