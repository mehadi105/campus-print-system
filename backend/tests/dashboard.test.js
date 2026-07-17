const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const app = require('../server');
const { getUsers, saveUsers } = require('../utils/userStore');

describe('Dashboard API (SCRUM-26)', () => {
  let server;
  let baseUrl;
  let previousUsers;

  before(async () => {
    previousUsers = getUsers();
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    const { port } = server.address();
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    saveUsers(previousUsers);
    await new Promise((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  beforeEach(() => {
    const hashed = bcrypt.hashSync('test1234', 10);
    saveUsers([
      {
        firstName: 'Sadi',
        lastName: 'Ahmed',
        email: 'sadi@university.edu',
        password: hashed,
        gender: 'male',
        rollId: '2207104',
        department: 'CSE',
        session: '2022-23',
        semester: '4-1',
        status: 'Active',
        walletBalance: 1250,
        usedPages: 50,
        totalPages: 100,
        registeredAt: new Date().toISOString(),
      },
    ]);
  });

  it('returns 400 when email is missing', async () => {
    const res = await fetch(`${baseUrl}/api/dashboard`);
    const body = await res.json();
    assert.equal(res.status, 400);
    assert.equal(body.success, false);
  });

  it('returns 404 when student does not exist', async () => {
    const res = await fetch(
      `${baseUrl}/api/dashboard?email=${encodeURIComponent('missing@university.edu')}`
    );
    const body = await res.json();
    assert.equal(res.status, 404);
    assert.equal(body.success, false);
  });

  it('returns dashboard payload for a registered student', async () => {
    const res = await fetch(
      `${baseUrl}/api/dashboard?email=${encodeURIComponent('sadi@university.edu')}`
    );
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.student.email, 'sadi@university.edu');
    assert.equal(body.student.fullName, 'Sadi Ahmed');
    assert.equal(body.student.walletBalance, 1250);
    assert.equal(body.stats.pagesRemaining, 50);
    assert.ok(Array.isArray(body.recentActivity));
    assert.ok(body.recentActivity.length >= 1);
  });
});
