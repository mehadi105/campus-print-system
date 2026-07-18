const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');
const { clearOrders, addOrder } = require('../utils/orderStore');

describe('Admin Order Management (SCRUM-61)', () => {
  let server;
  let baseUrl;

  before(async () => {
    server = app.listen(0);
    await new Promise((resolve) => server.once('listening', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  after(async () => {
    clearOrders();
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  });

  beforeEach(() => {
    clearOrders();
    addOrder({
      id: 'ord-admin-1',
      studentEmail: 'sadi@university.edu',
      documentName: 'Report.pdf',
      copies: 1,
      pages: 8,
      colorMode: 'Color',
      duplex: 'Single-Sided',
      paperSize: 'A4',
      printerTerminal: 'Library T1',
      estimatedCost: 40,
      status: 'Pending',
      createdAt: '2026-07-18T08:00:00.000Z',
      updatedAt: '2026-07-18T08:00:00.000Z',
    });
    addOrder({
      id: 'ord-admin-2',
      studentEmail: 'imtiaz@university.edu',
      documentName: 'Slides.pptx',
      copies: 2,
      pages: 12,
      colorMode: 'Black & White',
      duplex: 'Double-Sided',
      paperSize: 'Legal',
      printerTerminal: 'CSE Lab',
      estimatedCost: 60,
      status: 'Completed',
      createdAt: '2026-07-17T08:00:00.000Z',
      updatedAt: '2026-07-17T09:00:00.000Z',
    });
  });

  it('lists all orders for admin', async () => {
    const res = await fetch(`${baseUrl}/api/admin/orders`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.count, 2);
  });

  it('filters admin orders by status', async () => {
    const res = await fetch(`${baseUrl}/api/admin/orders?status=Pending`);
    const body = await res.json();
    assert.equal(body.count, 1);
    assert.equal(body.orders[0].id, 'ord-admin-1');
  });

  it('searches admin orders by query', async () => {
    const res = await fetch(`${baseUrl}/api/admin/orders?q=slides`);
    const body = await res.json();
    assert.equal(body.count, 1);
    assert.equal(body.orders[0].documentName, 'Slides.pptx');
  });

  it('updates order status', async () => {
    const res = await fetch(`${baseUrl}/api/admin/orders/ord-admin-1/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'Processing' }),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.order.status, 'Processing');
  });
});
