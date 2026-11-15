import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp } from './test-helper.js';

test('Privacy Enforcement & Access Control Suite', async (t) => {
  const ctx = await setupTestApp();

  t.after(async () => {
    await ctx.close();
  });

  await t.test('GET /permissions returns all four categories enabled by default', async () => {
    const res = await fetch(`${ctx.baseUrl}/permissions`, {
      headers: ctx.authHeaders
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.permissions.conversation, true);
    assert.equal(data.permissions.location, true);
    assert.equal(data.permissions.physiological, true);
    assert.equal(data.permissions.note, true);
  });

  await t.test('All enabled categories are returned in GET /events', async () => {
    for (const type of ['conversation', 'location', 'physiological', 'note']) {
      await fetch(`${ctx.baseUrl}/events`, {
        method: 'POST',
        headers: ctx.authHeaders,
        body: JSON.stringify({ type, title: `Test ${type}`, content: `Details for ${type}` })
      });
    }

    const res = await fetch(`${ctx.baseUrl}/events`, {
      headers: ctx.authHeaders
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    const returnedTypes = new Set(data.events.map((e: any) => e.type));
    assert.ok(returnedTypes.has('conversation'));
    assert.ok(returnedTypes.has('location'));
    assert.ok(returnedTypes.has('physiological'));
    assert.ok(returnedTypes.has('note'));
  });

  await t.test('Disabled category is NOT returned by backend in GET /events', async () => {
    // Turn location and conversation OFF
    const updateRes = await fetch(`${ctx.baseUrl}/permissions`, {
      method: 'PUT',
      headers: ctx.authHeaders,
      body: JSON.stringify({ location: false, conversation: false })
    });
    assert.equal(updateRes.status, 200);

    const eventsRes = await fetch(`${ctx.baseUrl}/events`, {
      headers: ctx.authHeaders
    });
    assert.equal(eventsRes.status, 200);
    const eventsData = await eventsRes.json();
    const types = eventsData.events.map((e: any) => e.type);

    assert.ok(!types.includes('location'), 'Location must NOT be returned');
    assert.ok(!types.includes('conversation'), 'Conversation must NOT be returned');
    assert.ok(types.includes('physiological'), 'Physiological should still be returned');
    assert.ok(types.includes('note'), 'Note should still be returned');
  });

  await t.test('GET /events/:id returns 403 Forbidden when category is disabled', async () => {
    // 1. Create a physiological event
    const createRes = await fetch(`${ctx.baseUrl}/events`, {
      method: 'POST',
      headers: ctx.authHeaders,
      body: JSON.stringify({
        type: 'physiological',
        title: 'Heart Rate Spike',
        content: '165 bpm peak'
      })
    });
    const created = await createRes.json();

    // 2. Disable physiological
    await fetch(`${ctx.baseUrl}/permissions`, {
      method: 'PUT',
      headers: ctx.authHeaders,
      body: JSON.stringify({ physiological: false })
    });

    // 3. Attempt direct access
    const directRes = await fetch(`${ctx.baseUrl}/events/${created.id}`, {
      headers: ctx.authHeaders
    });

    assert.equal(directRes.status, 403);
    const body = await directRes.json();
    assert.equal(body.error, 'Forbidden');
    assert.equal(body.privacy_blocked, true);
    assert.ok(!body.title, 'Sensitive title must NOT be leaked');
    assert.ok(!body.content, 'Sensitive content must NOT be leaked');
  });

  await t.test('Changing permission dynamically affects subsequent requests', async () => {
    const createRes = await fetch(`${ctx.baseUrl}/events`, {
      method: 'POST',
      headers: ctx.authHeaders,
      body: JSON.stringify({
        type: 'note',
        title: 'Secret Thoughts',
        content: 'Private reflections'
      })
    });
    const created = await createRes.json();

    // Turn OFF
    await fetch(`${ctx.baseUrl}/permissions`, {
      method: 'PUT',
      headers: ctx.authHeaders,
      body: JSON.stringify({ note: false })
    });

    const resOff = await fetch(`${ctx.baseUrl}/events/${created.id}`, { headers: ctx.authHeaders });
    assert.equal(resOff.status, 403);

    // Turn back ON
    await fetch(`${ctx.baseUrl}/permissions`, {
      method: 'PUT',
      headers: ctx.authHeaders,
      body: JSON.stringify({ note: true })
    });

    const resOn = await fetch(`${ctx.baseUrl}/events/${created.id}`, { headers: ctx.authHeaders });
    assert.equal(resOn.status, 200);
    const bodyOn = await resOn.json();
    assert.equal(bodyOn.id, created.id);
  });

  await t.test('GET /events?type=disabled_category returns empty array', async () => {
    // Ensure location is OFF
    await fetch(`${ctx.baseUrl}/permissions`, {
      method: 'PUT',
      headers: ctx.authHeaders,
      body: JSON.stringify({ location: false })
    });

    const res = await fetch(`${ctx.baseUrl}/events?type=location`, {
      headers: ctx.authHeaders
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.events.length, 0);
    assert.equal(data.total, 0);
  });
});
