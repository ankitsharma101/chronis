import test from 'node:test';
import assert from 'node:assert/strict';
import { setupTestApp } from './test-helper.ts';

test('Audit Log Immutability & Action Logging Suite', async (t) => {
  const ctx = await setupTestApp();

  t.after(async () => {
    await ctx.close();
  });

  await t.test('Audit log is strictly read-only: POST, PUT, DELETE return 405', async () => {
    const postRes = await fetch(`${ctx.baseUrl}/audit-log`, {
      method: 'POST',
      headers: ctx.authHeaders,
      body: JSON.stringify({ action: 'FORGE_LOG' })
    });
    assert.equal(postRes.status, 405);

    const putRes = await fetch(`${ctx.baseUrl}/audit-log`, {
      method: 'PUT',
      headers: ctx.authHeaders,
      body: JSON.stringify({ action: 'MODIFY_LOG' })
    });
    assert.equal(putRes.status, 405);

    const delRes = await fetch(`${ctx.baseUrl}/audit-log`, {
      method: 'DELETE',
      headers: ctx.authHeaders
    });
    assert.equal(delRes.status, 405);
  });

  await t.test('Audit entry is created when event is created', async () => {
    await fetch(`${ctx.baseUrl}/events`, {
      method: 'POST',
      headers: ctx.authHeaders,
      body: JSON.stringify({
        type: 'note',
        title: 'Audit Note',
        content: 'Verifying audit creation'
      })
    });

    const res = await fetch(`${ctx.baseUrl}/audit-log`, {
      headers: ctx.authHeaders
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    const createLogs = data.audit_logs.filter((l: any) => l.action === 'CREATE_EVENT' && l.event_type === 'note');
    assert.ok(createLogs.length >= 1);
    assert.equal(createLogs[0].result, 'SUCCESS');
    assert.ok(createLogs[0].timestamp);
    assert.equal(createLogs[0].user_id, 'test_user');
  });

  await t.test('Audit entry is created when permissions are toggled', async () => {
    await fetch(`${ctx.baseUrl}/permissions`, {
      method: 'PUT',
      headers: ctx.authHeaders,
      body: JSON.stringify({ conversation: false })
    });

    const res = await fetch(`${ctx.baseUrl}/audit-log`, {
      headers: ctx.authHeaders
    });
    const data = await res.json();
    const permLogs = data.audit_logs.filter((l: any) => l.action === 'UPDATE_PERMISSION' && l.event_type === 'conversation');
    assert.ok(permLogs.length >= 1);
    assert.equal(permLogs[0].result, 'SUCCESS');
  });

  await t.test('Audit entry records DENIED when blocked resource is probed', async () => {
    // 1. Create location event
    const createRes = await fetch(`${ctx.baseUrl}/events`, {
      method: 'POST',
      headers: ctx.authHeaders,
      body: JSON.stringify({
        type: 'location',
        title: 'Secret Base',
        content: 'Classified coordinates'
      })
    });
    const created = await createRes.json();

    // 2. Turn location OFF
    await fetch(`${ctx.baseUrl}/permissions`, {
      method: 'PUT',
      headers: ctx.authHeaders,
      body: JSON.stringify({ location: false })
    });

    // 3. Attempt direct access -> 403
    const blockedRes = await fetch(`${ctx.baseUrl}/events/${created.id}`, {
      headers: ctx.authHeaders
    });
    assert.equal(blockedRes.status, 403);

    // 4. Verify audit log shows DENIED
    const auditRes = await fetch(`${ctx.baseUrl}/audit-log`, {
      headers: ctx.authHeaders
    });
    const data = await auditRes.json();
    const deniedLogs = data.audit_logs.filter((l: any) => l.result === 'DENIED' && l.event_type === 'location');
    assert.ok(deniedLogs.length >= 1);
    assert.equal(deniedLogs[0].action, 'GET_EVENT');
  });

  await t.test('Audit entry is created when event is deleted', async () => {
    const createRes = await fetch(`${ctx.baseUrl}/events`, {
      method: 'POST',
      headers: ctx.authHeaders,
      body: JSON.stringify({
        type: 'physiological',
        title: 'Vitals',
        content: 'HR 72'
      })
    });
    const created = await createRes.json();

    await fetch(`${ctx.baseUrl}/events/${created.id}`, {
      method: 'DELETE',
      headers: ctx.authHeaders
    });

    const auditRes = await fetch(`${ctx.baseUrl}/audit-log`, {
      headers: ctx.authHeaders
    });
    const data = await auditRes.json();
    const deleteLogs = data.audit_logs.filter((l: any) => l.action === 'DELETE_EVENT' && l.event_type === 'physiological');
    assert.ok(deleteLogs.length >= 1);
    assert.equal(deleteLogs[0].result, 'SUCCESS');
  });
});
