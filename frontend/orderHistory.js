document.addEventListener('DOMContentLoaded', () => {
  const body = document.getElementById('orderHistoryBody');
  if (!body) return;

  const API_BASE = window.CAMPUS_API_BASE || 'http://localhost:3000';
  const searchInput = document.getElementById('orderSearchInput');
  const statusFilter = document.getElementById('orderStatusFilter');
  const refreshBtn = document.getElementById('orderHistoryRefreshBtn');

  function currentEmail() {
    try {
      const student = JSON.parse(localStorage.getItem('currentStudent') || 'null');
      return student?.email || '';
    } catch {
      return '';
    }
  }

  function formatDate(iso) {
    if (!iso) return '-';
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  function statusClass(status) {
    const value = (status || '').toLowerCase();
    if (value === 'completed') return 'completed';
    if (value === 'processing') return 'processing';
    if (value === 'cancelled') return 'cancelled';
    return 'pending';
  }

  async function loadOrders() {
    const email = currentEmail();
    const params = new URLSearchParams();
    if (email) params.set('email', email);
    if (searchInput?.value.trim()) params.set('q', searchInput.value.trim());
    if (statusFilter?.value) params.set('status', statusFilter.value);

    body.innerHTML = '<tr><td colspan="5">Loading previous orders…</td></tr>';

    try {
      const res = await fetch(`${API_BASE}/api/orders/history?${params.toString()}`);
      const data = await res.json();
      const orders = data.orders || [];

      if (!orders.length) {
        body.innerHTML = '<tr><td colspan="5">No previous orders found.</td></tr>';
        return;
      }

      body.innerHTML = orders
        .map((order) => {
          const pages = (order.pages || 1) * (order.copies || 1);
          return `
            <tr>
              <td>${order.documentName || '-'}</td>
              <td>${formatDate(order.createdAt)}</td>
              <td>${pages}</td>
              <td>৳ ${Number(order.estimatedCost || 0).toFixed(0)}</td>
              <td><span class="status-badge ${statusClass(order.status)}">${order.status || 'Pending'}</span></td>
            </tr>
          `;
        })
        .join('');
    } catch {
      body.innerHTML = '<tr><td colspan="5">Unable to load order history. Is the API running?</td></tr>';
    }
  }

  searchInput?.addEventListener('input', () => {
    clearTimeout(searchInput._timer);
    searchInput._timer = setTimeout(loadOrders, 250);
  });
  statusFilter?.addEventListener('change', loadOrders);
  refreshBtn?.addEventListener('click', loadOrders);

  loadOrders();
});
