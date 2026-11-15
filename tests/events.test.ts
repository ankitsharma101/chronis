import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp } from './test-helper.js';

test('Event Lifecycle & Filtering Suite', async (t) => {
  const ctx = await setupTestApp();

  t.after(async () => {
    await ctx.close();
  });

  await t.test('POST /events creates an event with valid payload', async () => {
    const payload = {
      type: 'conversation',
      title: 'Morning Meeting',
      content: 'Discussed architectural boundaries with the team'
    };

    const res = await fetch(`${ctx.baseUrl}/events`, {
      method: 'POST',
      headers: ctx.authHeaders,
      body: JSON.stringify(payload)
    });

    assert.equal(res.status, 201);
    const data = await res.json();
    assert.ok(data.id);
    assert.equal(data.type, 'conversation');
    assert.equal(data.title, payload.title);
    assert.equal(data.content, payload.content);
    assert.equal(data.user_id, 'test_user');
  });

  await t.test('POST /events rejects unsupported event category with 400', async () => {
    const res = await fetch(`${ctx.baseUrl}/events`, {
      method: 'POST',
      headers: ctx.authHeaders,
      body: JSON.stringify({
        type: 'weather',
        title: 'Sunny',
        content: '22C'
      })
    });

    assert.equal(res.status, 400);
    const data = await res.json();
    assert.equal(data.error, 'ValidationError');
  });

  await t.test('POST /events rejects missing title or content with 400', async () => {
    const res = await fetch(`${ctx.baseUrl}/events`, {
      method: 'POST',
      headers: ctx.authHeaders,
      body: JSON.stringify({ type: 'note' })
    });

    assert.equal(res.status, 400);
  });

  await t.test('GET /events/:id retrieves an existing event', async () => {
    const createRes = await fetch(`${ctx.baseUrl}/events`, {
      method: 'POST',
      headers: ctx.authHeaders,
      body: JSON.stringify({
        type: 'location',
        title: 'Coffee Roasters',
        content: 'Bought whole beans'
      })
    });

    const created = await createRes.json();

    const getRes = await fetch(`${ctx.baseUrl}/events/${created.id}`, {
      headers: ctx.authHeaders
    });

    assert.equal(getRes.status, 200);
    const fetched = await getRes.json();
    assert.equal(fetched.id, created.id);
    assert.equal(fetched.title, 'Coffee Roasters');
  });

  await t.test('GET /events/:id returns 404 for non-existent event', async () => {
    const res = await fetch(`${ctx.baseUrl}/events/non-existent-uuid`, {
      headers: ctx.authHeaders
    });
    assert.equal(res.status, 404);
  });

  await t.test('DELETE /events/:id deletes the event permanently', async () => {
    const createRes = await fetch(`${ctx.baseUrl}/events`, {
      method: 'POST',
      headers: ctx.authHeaders,
      body: JSON.stringify({
        type: 'note',
        title: 'Temporary Note',
        content: 'Will be deleted'
      })
    });
    const created = await createRes.json();

    const delRes = await fetch(`${ctx.baseUrl}/events/${created.id}`, {
      method: 'DELETE',
      headers: ctx.authHeaders
    });
    assert.equal(delRes.status, 200);

    const checkRes = await fetch(`${ctx.baseUrl}/events/${created.id}`, {
      headers: ctx.authHeaders
    });
    assert.equal(checkRes.status, 404);
  });

  await t.test('GET /events supports pagination (limit, page)', async () => {
    for (let i = 0; i < 12; i++) {
      await fetch(`${ctx.baseUrl}/events`, {
        method: 'POST',
        headers: ctx.authHeaders,
        body: JSON.stringify({
          type: 'note',
          title: `Note ${i + 1}`,
          content: `Content ${i + 1}`
        })
      });
    }

    const res1 = await fetch(`${ctx.baseUrl}/events?page=1&limit=5`, {
      headers: ctx.authHeaders
    });
    assert.equal(res1.status, 200);
    const d1 = await res1.json();
    assert.equal(d1.events.length, 5);
    assert.equal(d1.page, 1);
    assert.equal(d1.has_more, true);

    const res3 = await fetch(`${ctx.baseUrl}/events?page=3&limit=5`, {
      headers: ctx.authHeaders
    });
    const d3 = await res3.json();
    assert.ok(d3.events.length <= 5);
  });

  await t.test('GET /events supports category filtering', async () => {
    await fetch(`${ctx.baseUrl}/events`, {
      method: 'POST',
      headers: ctx.authHeaders,
      body: JSON.stringify({ type: 'conversation', title: 'Conv A', content: 'Chat' })
    });
    await fetch(`${ctx.baseUrl}/events`, {
      method: 'POST',
      headers: ctx.authHeaders,
      body: JSON.stringify({ type: 'location', title: 'Loc B', content: 'Gym' })
    });

    const res = await fetch(`${ctx.baseUrl}/events?type=conversation`, {
      headers: ctx.authHeaders
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.events.length >= 1);
    assert.ok(data.events.every((e: any) => e.type === 'conversation'));
  });
});
