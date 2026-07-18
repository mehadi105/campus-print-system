const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const app = require('../server');
const { clearOrders, addOrder, updateOrder } = require('../utils/orderStore');

function sampleOrder(overrides = {}) {
  return {
    id: overrides.id || `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    studentEmail: overrides.studentEmail || 'sadi@university.edu',
    documentName: overrides.documentName || 'Lab_Report.pdf',
    copies: overrides.copies || 1,
    colorMode: overrides.colorMode || 'Black & White',
    duplex: overrides.duplex || 'Single-Sided',
    orientation: 'Portrait',
    paperSize: overrides.paperSize || 'A4',
    pageRange: 'All',
    printerTerminal: overrides.printerTerminal || 'Central Library - Terminal 1',
    pages: overrides.pages || 10,
    paymentMethod: 'Wallet',
    estimatedCost: overrides.estimatedCost || 20,
    status: overrides.status || 'Pending',
    createdAt: overrides.createdAt || new Date().toISOString(),
    updatedAt: overrides.updatedAt || new Date().toISOString(),
  };
}

describe('Order Tracking (SCRUM-57)', () => {
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

  beforeEach(() => clearOrders());

  it('creates a print order', async () => {
    const res = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        studentEmail: 'sadi@university.edu',
        documentName: 'Assignment.pdf',
        copies: 2,
        pages: 5,
        colorMode: 'Black & White',
        duplex: 'Single-Sided',
        paperSize: 'A4',
        printerTerminal: 'CSE Lab - Terminal B',
        paymentMethod: 'Wallet',
      }),
    });
    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.success, true);
    assert.equal(body.order.status, 'Pending');
    assert.equal(body.order.estimatedCost, 20);
  });

  it('returns order status for tracking', async () => {
    const order = addOrder(sampleOrder({ id: 'ord-track-1', status: 'Processing' }));
    const res = await fetch(`${baseUrl}/api/orders/${order.id}/status`);
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.status.status, 'Processing');
    assert.equal(body.status.documentName, 'Lab_Report.pdf');
  });

  it('returns order history filtered by email and status', async () => {
    addOrder(sampleOrder({ id: 'ord-a', status: 'Completed', documentName: 'A.pdf' }));
    addOrder(sampleOrder({ id: 'ord-b', status: 'Pending', documentName: 'B.pdf' }));
    addOrder(
      sampleOrder({
        id: 'ord-c',
        studentEmail: 'imtiaz@university.edu',
        status: 'Completed',
        documentName: 'C.pdf',
      })
    );

    const res = await fetch(
      `${baseUrl}/api/orders/history?email=${encodeURIComponent('sadi@university.edu')}&status=Completed`
    );
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.count, 1);
    assert.equal(body.orders[0].id, 'ord-a');
  });

  it('supports search query across document names', async () => {
    addOrder(sampleOrder({ id: 'ord-search', documentName: 'Thesis_Final.pdf', status: 'Pending' }));
    addOrder(sampleOrder({ id: 'ord-other', documentName: 'Notes.docx', status: 'Pending' }));

    const res = await fetch(`${baseUrl}/api/orders/history?q=thesis`);
    const body = await res.json();
    assert.equal(body.count, 1);
    assert.equal(body.orders[0].id, 'ord-search');
  });

  it('updates tracked status through store for later admin workflow', () => {
    addOrder(sampleOrder({ id: 'ord-upd', status: 'Pending' }));
    const updated = updateOrder('ord-upd', { status: 'Completed' });
    assert.equal(updated.status, 'Completed');
  });
});
