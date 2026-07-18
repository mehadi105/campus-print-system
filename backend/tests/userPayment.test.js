const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const app = require('../server');
const { getUsers, saveUsers } = require('../utils/userStore');
const { clearPayments } = require('../utils/paymentStore');

describe('User & Payment Management (SCRUM-66)', () => {
  let server;
  let baseUrl;
  let previousUsers;

  before(async () => {
    previousUsers = getUsers();
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    saveUsers(previousUsers);
    clearPayments();
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  beforeEach(() => {
    clearPayments();
    saveUsers([
      {
        firstName: 'Sadi',
        lastName: 'Ahmed',
        email: 'sadi@university.edu',
        password: bcrypt.hashSync('secret123', 10),
        gender: 'male',
        rollId: '2207104',
        department: 'CSE',
        status: 'Active',
        walletBalance: 1000,
        registeredAt: new Date().toISOString(),
      },
      {
        firstName: 'Imtiaj',
        lastName: 'Ahmad',
        email: 'imtiaz@university.edu',
        password: bcrypt.hashSync('secret123', 10),
        gender: 'male',
        rollId: '2207092',
        department: 'CSE',
        status: 'Active',
        walletBalance: 500,
        registeredAt: new Date().toISOString(),
      },
    ]);
  });

  it('lists users for admin', async () => {
    const res = await fetch(`${baseUrl}/api/admin/users`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.count, 2);
    assert.equal(body.users[0].password, undefined);
  });

  it('updates a user account', async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/users/${encodeURIComponent('sadi@university.edu')}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ department: 'EEE', status: 'Active' }),
      }
    );
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.user.department, 'EEE');
  });

  it('deletes a user account', async () => {
    const res = await fetch(
      `${baseUrl}/api/admin/users/${encodeURIComponent('imtiaz@university.edu')}`,
      { method: 'DELETE' }
    );
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.success, true);

    const list = await fetch(`${baseUrl}/api/admin/users`);
    const listBody = await list.json();
    assert.equal(listBody.count, 1);
  });

  it('processes a simulated payment', async () => {
    const res = await fetch(`${baseUrl}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentEmail: 'sadi@university.edu',
        amount: 120,
        method: 'Wallet',
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.payment.status, 'Success');
    assert.equal(body.payment.amount, 120);
  });

  it('updates payment status', async () => {
    const create = await fetch(`${baseUrl}/api/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentEmail: 'sadi@university.edu',
        amount: 50,
        method: 'bKash',
      }),
    });
    const created = await create.json();

    const res = await fetch(`${baseUrl}/api/payments/${created.payment.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Refunded' }),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.payment.status, 'Refunded');
  });
});
