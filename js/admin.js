/* ============================================================
   WATERBOY APP — ADMIN DASHBOARD LOGIC
   ============================================================ */

'use strict';

let currentAdmin = null;
let currentAdminPage = 'overview';
let sidebarCollapsed = false;
let orderSearchTerm = '';
let customerSearchTerm = '';
let currentPageNum = 1;
const PAGE_SIZE = 10;

document.addEventListener('DOMContentLoaded', function () {
  const user = Auth.current();
  if (!user || user.role !== 'admin') {
    showAdminLogin();
  } else {
    currentAdmin = user;
    showAdminApp();
  }

  initAdminLogin();
  initAdminNav();
  initSidebar();
  initModals();
});

// ============================================================
// LOGIN
// ============================================================
function initAdminLogin() {
  const form = document.getElementById('admin-login-form');
  const err  = document.getElementById('admin-login-error');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const email = document.getElementById('admin-email').value.trim();
    const pass  = document.getElementById('admin-password').value;
    if (err) err.textContent = '';

    const admin = Auth.login('admin', email, pass);
    if (!admin) { if (err) err.textContent = 'Invalid credentials.'; return; }
    currentAdmin = Auth.current();
    showAdminApp();
  });

  const demoBtn = document.getElementById('admin-demo-btn');
  if (demoBtn) {
    demoBtn.addEventListener('click', function () {
      document.getElementById('admin-email').value    = WB.CREDS.admin.email;
      document.getElementById('admin-password').value = WB.CREDS.admin.password;
      form.dispatchEvent(new Event('submit'));
    });
  }
}

function showAdminLogin() {
  document.getElementById('admin-login-screen').style.display = 'flex';
  document.getElementById('admin-app-screen').style.display = 'none';
}

function showAdminApp() {
  document.getElementById('admin-login-screen').style.display = 'none';
  document.getElementById('admin-app-screen').style.display = 'flex';
  adminNavigateTo('overview');

  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn && !logoutBtn.dataset.init) {
    logoutBtn.dataset.init = '1';
    logoutBtn.addEventListener('click', function () {
      Auth.logout();
      currentAdmin = null;
      showAdminLogin();
    });
  }
}

// ============================================================
// SIDEBAR
// ============================================================
function initSidebar() {
  const collapseBtn = document.getElementById('sidebar-collapse-btn');
  if (collapseBtn) {
    collapseBtn.addEventListener('click', function () {
      sidebarCollapsed = !sidebarCollapsed;
      const sidebar = document.getElementById('admin-sidebar');
      if (sidebar) sidebar.classList.toggle('collapsed', sidebarCollapsed);
    });
  }

  // Mobile hamburger
  const hamburger = document.getElementById('admin-hamburger');
  const sidebar   = document.getElementById('admin-sidebar');
  const overlay   = document.getElementById('sidebar-overlay');

  if (hamburger && sidebar && overlay) {
    hamburger.addEventListener('click', function () {
      sidebar.classList.toggle('mobile-open');
      overlay.classList.toggle('visible');
    });
    overlay.addEventListener('click', function () {
      sidebar.classList.remove('mobile-open');
      overlay.classList.remove('visible');
    });
  }
}

// ============================================================
// NAVIGATION
// ============================================================
function initAdminNav() {
  document.querySelectorAll('.sidebar-nav-item[data-page]').forEach(item => {
    item.addEventListener('click', function () {
      adminNavigateTo(this.dataset.page);
      // Close mobile sidebar
      document.getElementById('admin-sidebar')?.classList.remove('mobile-open');
      document.getElementById('sidebar-overlay')?.classList.remove('visible');
    });
  });
}

function adminNavigateTo(page) {
  currentAdminPage = page;

  document.querySelectorAll('.sidebar-nav-item').forEach(i => i.classList.remove('active'));
  const activeItem = document.querySelector(`.sidebar-nav-item[data-page="${page}"]`);
  if (activeItem) activeItem.classList.add('active');

  document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById(`admin-page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const titleMap = {
    overview: 'Dashboard Overview', orders: 'Orders', customers: 'Customers',
    products: 'Products', routes: 'Route Management', drivers: 'Drivers',
    inventory: 'Inventory', payments: 'Payments & Billing', promos: 'Promotions',
    zones: 'Delivery Zones', reports: 'Reports & Analytics', settings: 'Settings',
  };
  const titleEl = document.getElementById('topbar-page-title');
  if (titleEl) titleEl.textContent = titleMap[page] || page;

  const renderers = {
    overview: renderOverview, orders: renderOrdersPage, customers: renderCustomersPage,
    products: renderProductsPage, drivers: renderDriversPage, inventory: renderInventoryPage,
    promos: renderPromosPage, zones: renderZonesPage, reports: renderReportsPage,
    settings: renderSettingsPage, routes: renderRoutesPage, payments: renderPaymentsPage,
  };
  if (renderers[page]) renderers[page]();
}

// ============================================================
// OVERVIEW
// ============================================================
function renderOverview() {
  const stats = Analytics.summary();

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('stat-revenue',    fmtMoney(stats.totalRevenue));
  setEl('stat-orders',     stats.totalOrders);
  setEl('stat-customers',  stats.totalCustomers);
  setEl('stat-today',      stats.todayDeliveries);
  setEl('stat-active',     stats.activeOrders);
  setEl('stat-avg',        fmtMoney(stats.avgOrderValue));

  renderRevenueChart();
  renderRecentOrdersTable();
  renderDriversWidget();
}

function renderRevenueChart() {
  const chartEl = document.getElementById('revenue-chart');
  if (!chartEl) return;

  const data = Analytics.revenueByDay(7);
  const maxRev = Math.max(...data.map(d => d.revenue), 1);

  chartEl.innerHTML = data.map(d => {
    const pct = Math.round((d.revenue / maxRev) * 100);
    return `<div class="bar-col">
      <div class="bar" style="height:${pct}%">
        <div class="bar-tooltip">${fmtMoney(d.revenue)}</div>
      </div>
      <div class="bar-label">${d.label}</div>
    </div>`;
  }).join('');
}

function renderRecentOrdersTable() {
  const tbody = document.getElementById('recent-orders-body');
  if (!tbody) return;

  const orders = Orders.getAll()
    .sort((a,b) => b.createdAt - a.createdAt)
    .slice(0, 8);

  tbody.innerHTML = orders.map(o => `
    <tr>
      <td><span class="mono text-xs" style="color:var(--cyan)">#${o.id.slice(-8).toUpperCase()}</span></td>
      <td>${o.customerName}</td>
      <td>${o.items.map(i=>i.qty+'× '+i.productName).join(', ')}</td>
      <td><span class="badge ${Orders.statusBadgeClass(o.status)}">${Orders.statusLabel(o.status)}</span></td>
      <td><span class="mono">${fmtMoney(o.total)}</span></td>
      <td class="text-muted text-sm">${fmtDate(o.createdAt)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn-icon" onclick="openAdminOrderModal('${o.id}')" title="View">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </td>
    </tr>`).join('');
}

function renderDriversWidget() {
  const el = document.getElementById('drivers-widget');
  if (!el) return;
  const drivers = Store.getList(WB.KEYS.drivers);
  el.innerHTML = drivers.map(d => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--blue-border)">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#16A34A,var(--success));display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:.875rem">${d.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
        <div>
          <div style="font-size:.875rem;font-weight:600">${d.name}</div>
          <div style="font-size:.75rem;color:var(--white-40)">${d.deliveriesToday} today · ${d.deliveriesTotal} total</div>
        </div>
      </div>
      <span class="badge ${d.status === 'active' ? 'badge-green' : 'badge-ghost'}">${d.status === 'active' ? 'Active' : 'Off'}</span>
    </div>`).join('');
}

// ============================================================
// ORDERS PAGE
// ============================================================
let ordersActiveFilter = 'all';

function renderOrdersPage() {
  let orders = Orders.getAll().sort((a,b) => b.createdAt - a.createdAt);

  // Filter tabs
  const ACTIVE_STATUSES = ['pending','confirmed','preparing','out_for_delivery'];
  if (ordersActiveFilter === 'active')    orders = orders.filter(o => ACTIVE_STATUSES.includes(o.status));
  else if (ordersActiveFilter === 'scheduled') orders = orders.filter(o => o.scheduledFor);
  else if (ordersActiveFilter === 'delivered') orders = orders.filter(o => o.status === 'delivered');
  else if (ordersActiveFilter === 'cancelled') orders = orders.filter(o => o.status === 'cancelled');

  // Date range
  const from = document.getElementById('orders-date-from')?.value;
  const to   = document.getElementById('orders-date-to')?.value;
  if (from) orders = orders.filter(o => o.createdAt >= new Date(from).getTime());
  if (to)   orders = orders.filter(o => o.createdAt <= new Date(to).getTime() + 86399999);

  if (orderSearchTerm) {
    orders = orders.filter(o =>
      o.customerName.toLowerCase().includes(orderSearchTerm) ||
      o.id.toLowerCase().includes(orderSearchTerm) ||
      o.status.includes(orderSearchTerm)
    );
  }

  // Update tab counts
  const allOrders = Orders.getAll();
  const tabCounts = {
    all: allOrders.length,
    active: allOrders.filter(o => ACTIVE_STATUSES.includes(o.status)).length,
    scheduled: allOrders.filter(o => o.scheduledFor).length,
    delivered: allOrders.filter(o => o.status === 'delivered').length,
    cancelled: allOrders.filter(o => o.status === 'cancelled').length,
  };
  document.querySelectorAll('#orders-filter-tabs .filter-tab').forEach(btn => {
    const f = btn.dataset.filter;
    btn.textContent = `${btn.textContent.replace(/\s*\(\d+\)/, '')} (${tabCounts[f] || 0})`;
  });

  const totalPages = Math.ceil(orders.length / PAGE_SIZE);
  const paged = orders.slice((currentPageNum - 1) * PAGE_SIZE, currentPageNum * PAGE_SIZE);

  const tbody = document.getElementById('orders-table-body');
  if (!tbody) return;

  tbody.innerHTML = paged.map(o => {
    const drv = o.driverId ? Store.findById(WB.KEYS.drivers, o.driverId) : null;
    const canCancel = !['delivered','cancelled'].includes(o.status);
    return `<tr>
      <td><span class="mono text-xs" style="color:var(--cyan)">#${o.id.slice(-8).toUpperCase()}</span></td>
      <td>${o.customerName}</td>
      <td>${o.items.map(i=>i.qty+'× '+i.productName.split(' ')[0]).join(', ')}</td>
      <td><span class="badge ${Orders.statusBadgeClass(o.status)}">${Orders.statusLabel(o.status)}</span></td>
      <td>${drv ? drv.name.split(' ')[0] : '<span class="text-muted">Unassigned</span>'}</td>
      <td><span class="mono">${fmtMoney(o.total)}</span></td>
      <td class="text-muted text-sm">${fmtDate(o.createdAt)}</td>
      <td>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn-icon" onclick="openAdminOrderModal('${o.id}')" title="View">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <select class="form-select" style="padding:4px 8px;font-size:.75rem;width:120px" onchange="updateOrderStatus('${o.id}', this.value)">
            ${WB.ORDER_STATUSES.map(s => `<option value="${s}" ${s===o.status?'selected':''}>${Orders.statusLabel(s)}</option>`).join('')}
            <option value="cancelled" ${o.status==='cancelled'?'selected':''}>Cancelled</option>
          </select>
          ${canCancel ? `<button class="btn-icon" style="color:var(--danger)" onclick="openCancelOrderModal('${o.id}')" title="Cancel">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          </button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  renderPagination('orders-pagination', currentPageNum, totalPages, (p) => {
    currentPageNum = p;
    renderOrdersPage();
  });

  const countEl = document.getElementById('orders-count');
  if (countEl) countEl.textContent = `${orders.length} orders`;
}

function openCancelOrderModal(orderId) {
  const order = Orders.getById(orderId);
  if (!order) return;
  document.getElementById('cancel-order-id').value = orderId;
  document.getElementById('cancel-order-summary').innerHTML =
    `<strong>#${order.id.slice(-8).toUpperCase()}</strong> — ${order.customerName} — ${fmtMoney(order.total)}`;
  Modal.open('cancel-order-modal');
}
window.openCancelOrderModal = openCancelOrderModal;

function confirmCancelOrder() {
  const orderId = document.getElementById('cancel-order-id').value;
  const reason  = document.getElementById('cancel-reason').value;
  Orders.updateStatus(orderId, 'cancelled');
  Store.updateItem(WB.KEYS.orders, orderId, { cancelReason: reason });
  Modal.close('cancel-order-modal');
  Toast.success('Order Cancelled', 'The order has been cancelled.');
  renderOrdersPage();
}
window.confirmCancelOrder = confirmCancelOrder;

function updateOrderStatus(orderId, status) {
  Orders.updateStatus(orderId, status);
  Toast.success('Updated', 'Order status changed.');
  renderOrdersPage();
}
window.updateOrderStatus = updateOrderStatus;

function openAdminOrderModal(orderId) {
  const order = Orders.getById(orderId);
  if (!order) return;
  const body = document.getElementById('admin-order-detail-body');
  if (!body) return;

  const drv = order.driverId ? Store.findById(WB.KEYS.drivers, order.driverId) : null;
  body.innerHTML = `
    <div class="d-flex justify-between mb-16">
      <div><div class="text-sm text-muted">Order ID</div><div class="mono text-cyan">#${order.id.slice(-8).toUpperCase()}</div></div>
      <span class="badge ${Orders.statusBadgeClass(order.status)}">${Orders.statusLabel(order.status)}</span>
    </div>
    <div class="two-col-grid mb-16" style="gap:12px">
      <div><div class="text-sm text-muted">Customer</div><div class="fw-600">${order.customerName}</div></div>
      <div><div class="text-sm text-muted">Driver</div><div class="fw-600">${drv ? drv.name : 'Unassigned'}</div></div>
      <div><div class="text-sm text-muted">Placed</div><div>${fmtDateTime(order.createdAt)}</div></div>
      <div><div class="text-sm text-muted">Zone</div><div>${order.zone}</div></div>
    </div>
    <div class="divider"></div>
    <div class="text-sm text-muted mb-8">Items</div>
    ${order.items.map(i => `<div class="order-row"><div class="order-row-name">${i.productName}<div class="order-row-sub">${i.qty} × ${fmtMoney(i.price)}</div></div><div class="order-row-val">${fmtMoney(i.price * i.qty)}</div></div>`).join('')}
    <div class="divider"></div>
    <div class="d-flex justify-between mt-8"><span>Subtotal</span><span class="mono">${fmtMoney(order.subtotal)}</span></div>
    <div class="d-flex justify-between mt-8"><span>Delivery</span><span class="mono">${fmtMoney(order.deliveryFee)}</span></div>
    ${order.discount ? `<div class="d-flex justify-between mt-8" style="color:var(--success)"><span>Discount</span><span class="mono">-${fmtMoney(order.discount)}</span></div>` : ''}
    <div class="d-flex justify-between mt-8" style="font-weight:700;font-size:1rem"><span>Total</span><span class="mono">${fmtMoney(order.total)}</span></div>
    <div class="divider"></div>
    <div class="text-sm text-muted mb-8">Update Status</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      ${WB.ORDER_STATUSES.concat(['cancelled']).map(s => `<button class="btn btn-sm ${s===order.status?'btn-primary':'btn-secondary'}" onclick="updateOrderStatus('${order.id}','${s}');Modal.close('admin-order-modal')">${Orders.statusLabel(s)}</button>`).join('')}
    </div>`;

  Modal.open('admin-order-modal');
}
window.openAdminOrderModal = openAdminOrderModal;

document.addEventListener('DOMContentLoaded', function () {
  const searchInput = document.getElementById('orders-search');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      orderSearchTerm = this.value.toLowerCase();
      currentPageNum = 1;
      renderOrdersPage();
    });
  }
  const statusFilter = document.getElementById('orders-status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', function () {
      currentPageNum = 1;
      renderOrdersPage();
    });
  }
});

// ============================================================
// CUSTOMERS PAGE
// ============================================================
function renderCustomersPage() {
  let customers = Store.getList(WB.KEYS.customers).sort((a,b) => b.joinedAt - a.joinedAt);

  if (customerSearchTerm) {
    customers = customers.filter(c =>
      c.name.toLowerCase().includes(customerSearchTerm) ||
      c.email.toLowerCase().includes(customerSearchTerm) ||
      c.phone.includes(customerSearchTerm)
    );
  }

  const totalPages = Math.ceil(customers.length / PAGE_SIZE);
  const paged = customers.slice((currentPageNum - 1) * PAGE_SIZE, currentPageNum * PAGE_SIZE);
  const tbody = document.getElementById('customers-table-body');
  if (!tbody) return;

  tbody.innerHTML = paged.map(c => `
    <tr>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:34px;height:34px;border-radius:50%;background:linear-gradient(135deg,var(--cyan-dim),var(--cyan));display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--blue-deep);font-size:.8125rem">${c.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
          <div><div style="font-weight:600;font-size:.875rem">${c.name}</div><div style="font-size:.75rem;color:var(--white-40)">${c.email}</div></div>
        </div>
      </td>
      <td>${c.phone}</td>
      <td>${c.city}</td>
      <td><span class="${c.subscriptionActive ? 'badge badge-green' : 'badge badge-ghost'}">${c.subscriptionActive ? 'Active' : 'None'}</span></td>
      <td><span class="mono">${fmtMoney(c.totalSpent)}</span></td>
      <td>${c.loyaltyPts.toLocaleString()} pts</td>
      <td class="text-sm text-muted">${fmtDate(c.joinedAt)}</td>
      <td>
        <button class="btn-icon" onclick="openCustomerModal('${c.id}')" title="View">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      </td>
    </tr>`).join('');

  renderPagination('customers-pagination', currentPageNum, totalPages, (p) => {
    currentPageNum = p;
    renderCustomersPage();
  });

  const countEl = document.getElementById('customers-count');
  if (countEl) countEl.textContent = `${customers.length} customers`;
}

function openCustomerModal(custId) {
  const cust = Store.findById(WB.KEYS.customers, custId);
  if (!cust) return;
  const body = document.getElementById('customer-detail-body');
  if (!body) return;

  const orders  = Orders.getForCustomer(custId);
  const products = Store.getList(WB.KEYS.products);
  const subProd  = cust.subscriptionProduct ? products.find(p => p.id === cust.subscriptionProduct) : null;
  const notes   = (cust.adminNotes || []).slice().reverse();
  const isActive = cust.active !== false;

  body.innerHTML = `
    <div style="display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:16px;border-bottom:1px solid var(--blue-border)">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,var(--cyan-dim),var(--cyan));display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--blue-deep);font-size:1.25rem">${cust.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
        <div>
          <div style="font-size:1.125rem;font-weight:700">${cust.name}</div>
          <div style="font-size:.875rem;color:var(--white-40)">${cust.email} · ${cust.phone}</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <span class="badge ${isActive ? 'badge-green' : 'badge-red'}">${isActive ? 'Active' : 'Deactivated'}</span>
        <button class="btn btn-sm ${isActive ? 'btn-danger' : 'btn-secondary'}" onclick="toggleCustomerActive('${custId}')">${isActive ? 'Deactivate' : 'Reactivate'}</button>
      </div>
    </div>

    <!-- Inline Edit -->
    <div style="margin-top:16px">
      <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--white-40);margin-bottom:10px">Edit Info</div>
      <div class="two-col-grid" style="gap:10px;margin-bottom:10px">
        <div><label class="form-label" style="font-size:.75rem">Name</label><input id="cedit-name" class="form-input" style="font-size:.875rem" value="${cust.name}" /></div>
        <div><label class="form-label" style="font-size:.75rem">Phone</label><input id="cedit-phone" class="form-input" style="font-size:.875rem" value="${cust.phone}" /></div>
        <div><label class="form-label" style="font-size:.75rem">Address</label><input id="cedit-address" class="form-input" style="font-size:.875rem" value="${cust.address}" /></div>
        <div><label class="form-label" style="font-size:.75rem">City / ZIP</label>
          <div style="display:flex;gap:6px">
            <input id="cedit-city" class="form-input" style="font-size:.875rem;flex:1" value="${cust.city}" />
            <input id="cedit-zip" class="form-input" style="font-size:.875rem;width:80px" value="${cust.zip}" />
          </div>
        </div>
      </div>
      <button class="btn btn-sm btn-secondary" onclick="saveCustomerEdit('${custId}')">Save Changes</button>
    </div>

    <!-- Stats -->
    <div class="two-col-grid mt-16" style="gap:10px">
      <div><div class="text-sm text-muted">Bottles on Hand</div><div class="fw-600">${cust.bottles}</div></div>
      <div><div class="text-sm text-muted">Loyalty Points</div><div class="fw-600" style="color:var(--cyan)">${cust.loyaltyPts.toLocaleString()}</div></div>
      <div><div class="text-sm text-muted">Total Orders</div><div class="fw-600">${cust.totalOrders}</div></div>
      <div><div class="text-sm text-muted">Total Spent</div><div class="fw-600 mono">${fmtMoney(cust.totalSpent)}</div></div>
      <div><div class="text-sm text-muted">Referral Code</div><div class="mono" style="font-size:.875rem;color:var(--cyan)">${cust.referralCode}</div></div>
      <div><div class="text-sm text-muted">Member Since</div><div style="font-size:.875rem">${fmtDate(cust.joinedAt)}</div></div>
    </div>

    ${cust.subscriptionActive ? `<div style="margin-top:12px;padding:10px 14px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:var(--radius-sm)"><span class="badge badge-green">Subscription Active</span><div style="font-size:.875rem;margin-top:5px">${subProd ? subProd.name : ''} · ${cust.subscriptionFrequency}</div></div>` : ''}

    <div class="divider"></div>

    <!-- Order History -->
    <div class="text-sm text-muted mb-8">Order History (${orders.length} orders)</div>
    ${orders.slice(0,6).map(o => `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--blue-border)">
        <div>
          <div style="font-size:.875rem;font-weight:600">${o.items.map(i=>i.qty+'× '+i.productName.split(' ')[0]).join(', ')}</div>
          <div style="font-size:.75rem;color:var(--white-40)">${fmtDateTime(o.createdAt)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span class="badge ${Orders.statusBadgeClass(o.status)}">${Orders.statusLabel(o.status)}</span>
          <span class="mono" style="font-size:.875rem">${fmtMoney(o.total)}</span>
        </div>
      </div>`).join('')}
    ${orders.length > 6 ? `<div style="font-size:.8125rem;color:var(--cyan);margin-top:8px">+${orders.length-6} more orders</div>` : ''}

    <div class="divider"></div>

    <!-- Internal Notes -->
    <div class="text-sm text-muted mb-8">Internal Notes</div>
    <div id="customer-notes-list" style="margin-bottom:12px">
      ${notes.length ? notes.map(n => `
        <div style="padding:10px 14px;background:var(--white-04);border-left:3px solid var(--cyan-dim);border-radius:0 var(--radius-sm) var(--radius-sm) 0;margin-bottom:8px">
          <div style="font-size:.875rem">${n.text}</div>
          <div style="font-size:.75rem;color:var(--white-40);margin-top:4px">${fmtDateTime(n.at)} by Admin</div>
        </div>`).join('') : '<div style="font-size:.8125rem;color:var(--white-40);margin-bottom:8px">No notes yet.</div>'}
    </div>
    <div style="display:flex;gap:8px">
      <input id="customer-note-input" class="form-input" style="flex:1;font-size:.875rem" placeholder="Add a note…" onkeydown="if(event.key==='Enter')addCustomerNote('${custId}')" />
      <button class="btn btn-sm btn-secondary" onclick="addCustomerNote('${custId}')">Add Note</button>
    </div>`;

  Modal.open('customer-detail-modal');
}
window.openCustomerModal = openCustomerModal;

function saveCustomerEdit(custId) {
  const name    = document.getElementById('cedit-name')?.value.trim();
  const phone   = document.getElementById('cedit-phone')?.value.trim();
  const address = document.getElementById('cedit-address')?.value.trim();
  const city    = document.getElementById('cedit-city')?.value.trim();
  const zip     = document.getElementById('cedit-zip')?.value.trim();
  if (!name) { Toast.warning('Required', 'Name cannot be empty.'); return; }
  const updated = Store.updateItem(WB.KEYS.customers, custId, { name, phone, address, city, zip });
  console.log('[Admin] Customer updated in localStorage:', updated);
  Toast.success('Saved', 'Customer info updated.');
  renderCustomersPage();
}
window.saveCustomerEdit = saveCustomerEdit;

function addCustomerNote(custId) {
  const input = document.getElementById('customer-note-input');
  const text  = input?.value.trim();
  if (!text) return;
  const cust  = Store.findById(WB.KEYS.customers, custId);
  if (!cust) return;
  const notes = cust.adminNotes || [];
  notes.push({ id: uid('note_'), text, at: Date.now() });
  Store.updateItem(WB.KEYS.customers, custId, { adminNotes: notes });
  input.value = '';
  // Re-render notes list
  const listEl = document.getElementById('customer-notes-list');
  if (listEl) {
    listEl.innerHTML = notes.slice().reverse().map(n => `
      <div style="padding:10px 14px;background:var(--white-04);border-left:3px solid var(--cyan-dim);border-radius:0 var(--radius-sm) var(--radius-sm) 0;margin-bottom:8px">
        <div style="font-size:.875rem">${n.text}</div>
        <div style="font-size:.75rem;color:var(--white-40);margin-top:4px">${fmtDateTime(n.at)} by Admin</div>
      </div>`).join('');
  }
  Toast.success('Note Added', 'Internal note saved.');
}
window.addCustomerNote = addCustomerNote;

function toggleCustomerActive(custId) {
  const cust = Store.findById(WB.KEYS.customers, custId);
  if (!cust) return;
  const nowActive = cust.active === false;
  Store.updateItem(WB.KEYS.customers, custId, { active: nowActive });
  Toast.success('Updated', `${cust.name} ${nowActive ? 'reactivated' : 'deactivated'}.`);
  Modal.close('customer-detail-modal');
  renderCustomersPage();
}
window.toggleCustomerActive = toggleCustomerActive;

document.addEventListener('DOMContentLoaded', function () {
  const searchInput = document.getElementById('customers-search');
  if (searchInput) {
    searchInput.addEventListener('input', function () {
      customerSearchTerm = this.value.toLowerCase();
      currentPageNum = 1;
      renderCustomersPage();
    });
  }
});

// ============================================================
// PRODUCTS PAGE
// ============================================================
function renderProductsPage() {
  const products = Store.getList(WB.KEYS.products);
  const grid = document.getElementById('admin-products-grid');
  if (!grid) return;

  grid.innerHTML = products.map(p => {
    const catBadge = p.category === 'delivery' ? 'badge-cyan' : p.category === 'dispensers' ? 'badge-blue' : 'badge-ghost';
    const isActive = p.active !== false;
    return `<div class="card" style="${!isActive ? 'opacity:.55' : ''}">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
        <div style="font-size:1.75rem">${p.icon}</div>
        <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end">
          <span class="badge ${catBadge}">${p.category}</span>
          ${!isActive ? '<span class="badge badge-ghost">Inactive</span>' : ''}
          ${p.popular ? '<span class="badge badge-yellow">Popular</span>' : ''}
        </div>
      </div>
      <div style="font-weight:700;font-size:.9375rem;margin-bottom:4px">${p.name}</div>
      <div style="font-size:.8125rem;color:var(--white-40);margin-bottom:10px">${p.description}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <span class="mono text-cyan">${fmtMoney(p.price)}</span>
        <span style="font-size:.75rem;color:var(--white-40)">${p.unit}</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm btn-secondary" onclick="openProductModal('${p.id}')">Edit</button>
        <button class="btn btn-sm ${isActive ? 'btn-secondary' : 'btn-primary'}" onclick="toggleProductActive('${p.id}')">${isActive ? 'Deactivate' : 'Activate'}</button>
        <button class="btn btn-sm btn-danger" onclick="deleteProduct('${p.id}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

function openProductModal(productId) {
  const titleEl = document.getElementById('product-modal-title');
  const idEl    = document.getElementById('product-modal-id');
  const nameEl  = document.getElementById('product-modal-name');
  const descEl  = document.getElementById('product-modal-desc');
  const priceEl = document.getElementById('product-modal-price');
  const unitEl  = document.getElementById('product-modal-unit');
  const iconEl  = document.getElementById('product-modal-icon');
  const catEl   = document.getElementById('product-modal-category');
  const popEl   = document.getElementById('product-modal-popular');

  if (productId) {
    const p = Store.findById(WB.KEYS.products, productId);
    if (!p) return;
    if (titleEl) titleEl.textContent = 'Edit Product';
    if (idEl)    idEl.value    = p.id;
    if (nameEl)  nameEl.value  = p.name;
    if (descEl)  descEl.value  = p.description || '';
    if (priceEl) priceEl.value = (p.price / 100).toFixed(2);
    if (unitEl)  unitEl.value  = p.unit || '';
    if (iconEl)  iconEl.value  = p.icon || '';
    if (catEl)   catEl.value   = p.category || 'delivery';
    if (popEl)   popEl.checked = !!p.popular;
  } else {
    if (titleEl) titleEl.textContent = 'Add New Product';
    if (idEl)    idEl.value   = '';
    if (nameEl)  nameEl.value = '';
    if (descEl)  descEl.value = '';
    if (priceEl) priceEl.value = '';
    if (unitEl)  unitEl.value  = 'per bottle';
    if (iconEl)  iconEl.value  = '💧';
    if (catEl)   catEl.value   = 'delivery';
    if (popEl)   popEl.checked = false;
  }
  Modal.open('product-edit-modal');
}
window.openProductModal = openProductModal;

function saveProduct() {
  const id    = document.getElementById('product-modal-id')?.value?.trim();
  const name  = document.getElementById('product-modal-name')?.value?.trim();
  const desc  = document.getElementById('product-modal-desc')?.value?.trim();
  const price = parseFloat(document.getElementById('product-modal-price')?.value);
  const unit  = document.getElementById('product-modal-unit')?.value?.trim();
  const icon  = document.getElementById('product-modal-icon')?.value?.trim();
  const cat   = document.getElementById('product-modal-category')?.value || 'delivery';
  const pop   = document.getElementById('product-modal-popular')?.checked || false;

  if (!name) { Toast.warning('Required', 'Product name is required.'); return; }
  if (isNaN(price) || price < 0) { Toast.warning('Required', 'Enter a valid price.'); return; }

  const priceCents = Math.round(price * 100);

  if (id) {
    const updated = Store.updateItem(WB.KEYS.products, id, { name, description: desc, price: priceCents, unit, icon, category: cat, popular: pop });
    console.log('[Admin] Product saved to localStorage:', updated);
    Toast.success('Product Updated', `${name} saved — price set to $${price.toFixed(2)}.`);
  } else {
    const newProd = {
      id: uid('prod_'),
      name, description: desc, price: priceCents, unit, icon, category: cat, popular: pop, active: true,
    };
    Store.push(WB.KEYS.products, newProd);
    console.log('[Admin] New product created in localStorage:', newProd);
    Toast.success('Product Added', `${name} added to catalog.`);
  }

  Modal.close('product-edit-modal');
  renderProductsPage();
}
window.saveProduct = saveProduct;

function deleteProduct(productId) {
  const p = Store.findById(WB.KEYS.products, productId);
  if (!p) return;
  if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
  Store.removeItem(WB.KEYS.products, productId);
  console.log('[Admin] Product deleted from localStorage:', productId);
  Toast.success('Deleted', `${p.name} removed from catalog.`);
  renderProductsPage();
}
window.deleteProduct = deleteProduct;

function toggleProductActive(productId) {
  const p = Store.findById(WB.KEYS.products, productId);
  if (!p) return;
  const nowActive = p.active === false;
  const updated = Store.updateItem(WB.KEYS.products, productId, { active: nowActive });
  console.log('[Admin] Product active state toggled in localStorage:', updated);
  Toast.success('Updated', `${p.name} ${nowActive ? 'activated' : 'deactivated'}.`);
  renderProductsPage();
}
window.toggleProductActive = toggleProductActive;

// ============================================================
// DRIVERS PAGE
// ============================================================
function renderDriversPage() {
  const drivers = Store.getList(WB.KEYS.drivers);
  const grid = document.getElementById('drivers-grid');
  if (!grid) return;

  grid.innerHTML = drivers.map(d => {
    const zone = Store.findById(WB.KEYS.zones, d.zone);
    const activeOrders = Orders.getForDriver(d.id).length;
    const driverOrders = Orders.getAll().filter(o => o.driverId === d.id && o.status === 'delivered');
    const weekRevenue  = driverOrders.filter(o => o.createdAt >= daysAgo(7)).reduce((s,o) => s+o.total, 0);
    return `<div class="driver-card" onclick="openDriverDetailModal('${d.id}')" style="cursor:pointer">
      <div class="driver-card-head">
        <div class="driver-card-avatar">${d.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
        <div>
          <div class="driver-card-name">${d.name}</div>
          <div class="driver-card-zone">${zone?.name || d.zone}</div>
        </div>
        <span class="badge ${d.status === 'active' ? 'badge-green' : 'badge-ghost'}" style="margin-left:auto">${d.status === 'active' ? 'Active' : 'Off Duty'}</span>
      </div>
      <div class="driver-stats-row">
        <div class="driver-stat-mini"><div class="driver-stat-mini-val">${activeOrders}</div><div class="driver-stat-mini-lbl">Active</div></div>
        <div class="driver-stat-mini"><div class="driver-stat-mini-val">${d.deliveriesToday}</div><div class="driver-stat-mini-lbl">Today</div></div>
        <div class="driver-stat-mini"><div class="driver-stat-mini-val">${d.deliveriesTotal}</div><div class="driver-stat-mini-lbl">Total</div></div>
        <div class="driver-stat-mini"><div class="driver-stat-mini-val" style="color:var(--warning)">${d.rating}</div><div class="driver-stat-mini-lbl">Rating</div></div>
      </div>
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--blue-border);display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:.8125rem;color:var(--white-40)">${d.vehicle} · ${d.plate}</span>
        <span style="font-size:.8125rem;color:var(--cyan);font-weight:600">${fmtMoney(weekRevenue)} / 7d</span>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px" onclick="event.stopPropagation()">
        <button class="btn btn-sm btn-secondary" style="flex:1" onclick="openDriverDetailModal('${d.id}')">View Details</button>
        <button class="btn btn-sm ${d.status==='active'?'btn-danger':'btn-secondary'}" onclick="toggleDriverStatus('${d.id}')">${d.status==='active'?'Deactivate':'Activate'}</button>
      </div>
    </div>`;
  }).join('');
}

function openDriverDetailModal(drvId) {
  const d = Store.findById(WB.KEYS.drivers, drvId);
  if (!d) return;
  const body = document.getElementById('driver-detail-body');
  if (!body) return;

  const allOrders = Orders.getAll().filter(o => o.driverId === drvId && o.status === 'delivered');
  const DAY_LABELS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const weekBreakdown = DAY_LABELS.map((label, i) => {
    const dayOrders = allOrders.filter(o => {
      const d = new Date(o.createdAt); return d.getDay() === (i + 1) % 7;
    });
    return { label, count: dayOrders.length, revenue: dayOrders.reduce((s,o) => s+o.total, 0) };
  });
  const maxCount = Math.max(...weekBreakdown.map(d => d.count), 1);

  const zone = Store.findById(WB.KEYS.zones, d.zone);
  const completionRate = allOrders.length ? Math.min(100, Math.round((allOrders.length / Math.max(d.deliveriesTotal, 1)) * 100)) : 0;
  const avgRating = allOrders.filter(o => o.rating).reduce((s,o) => s+o.rating, 0) / (allOrders.filter(o => o.rating).length || 1);

  body.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid var(--blue-border)">
      <div style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#16A34A,var(--success));display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.25rem;color:#fff">${d.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
      <div>
        <div style="font-size:1.125rem;font-weight:700">${d.name}</div>
        <div style="font-size:.875rem;color:var(--white-40)">${d.email} · ${d.phone}</div>
        <div style="font-size:.875rem;color:var(--white-40)">${d.vehicle} · ${d.plate} · ${zone?.name || d.zone}</div>
      </div>
      <span class="badge ${d.status==='active'?'badge-green':'badge-ghost'}" style="margin-left:auto">${d.status==='active'?'Active':'Off Duty'}</span>
    </div>
    <div class="stats-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:20px">
      <div class="stat-card accent-cyan" style="padding:14px"><div class="stat-value" style="font-size:1.5rem">${d.deliveriesTotal}</div><div class="stat-label">Total Deliveries</div></div>
      <div class="stat-card accent-green" style="padding:14px"><div class="stat-value" style="font-size:1.5rem">${d.deliveriesToday}</div><div class="stat-label">Today</div></div>
      <div class="stat-card accent-yellow" style="padding:14px"><div class="stat-value" style="font-size:1.5rem">${avgRating.toFixed(1)}★</div><div class="stat-label">Avg Rating</div></div>
      <div class="stat-card accent-purple" style="padding:14px"><div class="stat-value" style="font-size:1.5rem">${completionRate}%</div><div class="stat-label">On-time Rate</div></div>
    </div>
    <div style="font-weight:700;font-size:.875rem;margin-bottom:12px">Weekly Delivery Breakdown (Mon–Sat)</div>
    <div style="display:flex;align-items:flex-end;gap:8px;height:100px;margin-bottom:6px">
      ${weekBreakdown.map(day => {
        const pct = Math.round((day.count / maxCount) * 100);
        return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%">
          <div style="font-size:.6875rem;color:var(--cyan);font-weight:600">${day.count}</div>
          <div style="flex:1;width:100%;display:flex;align-items:flex-end">
            <div style="width:100%;height:${Math.max(pct,4)}%;background:linear-gradient(0deg,var(--cyan-dim),var(--cyan));border-radius:3px 3px 0 0;min-height:4px"></div>
          </div>
        </div>`;
      }).join('')}
    </div>
    <div style="display:flex;gap:8px">
      ${weekBreakdown.map(d => `<div style="flex:1;text-align:center;font-size:.6875rem;color:var(--white-40)">${d.label}</div>`).join('')}
    </div>`;

  Modal.open('driver-detail-modal');
}
window.openDriverDetailModal = openDriverDetailModal;

function toggleDriverStatus(drvId) {
  const d = Store.findById(WB.KEYS.drivers, drvId);
  if (!d) return;
  const newStatus = d.status === 'active' ? 'off_duty' : 'active';
  Store.updateItem(WB.KEYS.drivers, drvId, { status: newStatus });
  Toast.success('Updated', `${d.name} is now ${newStatus === 'active' ? 'active' : 'off duty'}.`);
  renderDriversPage();
}
window.toggleDriverStatus = toggleDriverStatus;

function openAddDriverModal() {
  const zones = Store.getList(WB.KEYS.zones);
  const zoneSelect = document.getElementById('driver-modal-zone');
  if (zoneSelect) zoneSelect.innerHTML = zones.filter(z => z.active).map(z => `<option value="${z.id}">${z.name}</option>`).join('');
  ['driver-modal-id','driver-modal-name','driver-modal-phone','driver-modal-email',
   'driver-modal-vehicle','driver-modal-plate','driver-modal-password'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('add-driver-modal-title').textContent = 'Add New Driver';
  Modal.open('add-driver-modal');
}
window.openAddDriverModal = openAddDriverModal;

function saveDriver() {
  const name     = document.getElementById('driver-modal-name')?.value.trim();
  const phone    = document.getElementById('driver-modal-phone')?.value.trim();
  const email    = document.getElementById('driver-modal-email')?.value.trim();
  const vehicle  = document.getElementById('driver-modal-vehicle')?.value.trim();
  const plate    = document.getElementById('driver-modal-plate')?.value.trim();
  const zone     = document.getElementById('driver-modal-zone')?.value;
  const password = document.getElementById('driver-modal-password')?.value.trim() || 'drive2026';

  if (!name || !email) { Toast.warning('Required', 'Name and email are required.'); return; }

  const newDriver = {
    id: uid('drv_'), name, phone, email, vehicle, plate, zone,
    password, status:'active', deliveriesToday:0, deliveriesTotal:0,
    rating:5.0, joinedAt:Date.now(), avatar:null,
  };
  Store.push(WB.KEYS.drivers, newDriver);
  console.log('[Admin] New driver created in localStorage:', newDriver);
  Modal.close('add-driver-modal');
  Toast.success('Driver Added', `${name} added to the team.`);
  renderDriversPage();
}
window.saveDriver = saveDriver;

// ============================================================
// INVENTORY PAGE
// ============================================================
function renderInventoryPage() {
  const inv = Store.getList(WB.KEYS.inventory);
  const grid = document.getElementById('inventory-grid');
  if (!grid) return;

  // Low stock alerts banner
  const banner = document.getElementById('inventory-alerts-banner');
  const lowItems = inv.filter(i => i.qty <= i.lowAt);
  if (banner) {
    if (lowItems.length) {
      banner.innerHTML = `<div style="display:flex;align-items:center;gap:10px;padding:14px 20px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:var(--radius-md);margin-bottom:16px">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2" style="width:20px;height:20px;flex-shrink:0"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <div>
          <div style="font-weight:700;color:var(--danger);font-size:.875rem">Low Stock Alert — ${lowItems.length} item${lowItems.length>1?'s':''} at or below reorder level</div>
          <div style="font-size:.8125rem;color:var(--white-70)">${lowItems.map(i=>i.label).join(' · ')}</div>
        </div>
      </div>`;
    } else {
      banner.innerHTML = '';
    }
  }

  grid.innerHTML = inv.map(item => {
    const prod = Store.findById(WB.KEYS.products, item.productId);
    const pct  = Math.round((item.qty / (item.lowAt * 5)) * 100);
    const isLow  = item.qty <= item.lowAt * 2 && item.qty > item.lowAt;
    const isCrit = item.qty <= item.lowAt;
    return `<div class="inventory-card ${isCrit ? 'critical' : isLow ? 'low-stock' : ''}">
      <div class="inventory-icon">${prod?.icon || '📦'}</div>
      <div class="inventory-body">
        <div class="inventory-name">${item.label}</div>
        <div style="display:flex;align-items:baseline;gap:6px">
          <span class="inventory-qty ${isCrit ? 'crit' : isLow ? 'low' : ''}">${item.qty}</span>
          <span class="inventory-unit">${item.unit}</span>
          ${isCrit ? '<span class="badge badge-red">Critical</span>' : isLow ? '<span class="badge badge-yellow">Low</span>' : '<span class="badge badge-green">OK</span>'}
        </div>
        <div style="font-size:.75rem;color:var(--white-40);margin-top:3px">Reorder at: ${item.lowAt} ${item.unit}</div>
        <div class="progress-wrap mt-8"><div class="progress-bar" style="width:${Math.min(pct,100)}%;background:${isCrit?'var(--danger)':isLow?'var(--warning)':'linear-gradient(90deg,var(--cyan-dim),var(--cyan))'}"></div></div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button class="btn btn-sm btn-primary" onclick="openUpdateStockModal('${item.id}')">Update Stock</button>
        <button class="btn btn-sm btn-secondary" onclick="restockItem('${item.id}')">Quick Restock</button>
      </div>
    </div>`;
  }).join('');

  renderStockHistoryLog();
}

function renderStockHistoryLog() {
  const logEl = document.getElementById('stock-history-log');
  if (!logEl) return;
  const log = Store.getList('wb_stock_log');
  if (!log.length) {
    logEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--white-40);font-size:.875rem">No stock adjustments recorded yet.</div>';
    return;
  }
  logEl.innerHTML = log.slice().reverse().map(entry => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--blue-border)">
      <div>
        <div style="font-size:.875rem;font-weight:600">${entry.label}</div>
        <div style="font-size:.75rem;color:var(--white-40)">${entry.reason || '—'}</div>
      </div>
      <div style="text-align:right">
        <div style="font-family:var(--font-mono);font-size:.875rem;color:${entry.delta > 0 ? 'var(--success)' : 'var(--danger)'}">${entry.delta > 0 ? '+' : ''}${entry.delta}</div>
        <div style="font-size:.75rem;color:var(--white-40)">${fmtDateTime(entry.at)}</div>
      </div>
    </div>`).join('');
}

function openUpdateStockModal(invId) {
  const item = Store.findById(WB.KEYS.inventory, invId);
  if (!item) return;
  document.getElementById('update-stock-inv-id').value = invId;
  document.getElementById('update-stock-title').textContent = `Update Stock — ${item.label}`;
  document.getElementById('update-stock-qty').value = '';
  document.getElementById('update-stock-reason').value = '';
  document.getElementById('update-stock-type').value = 'add';
  Modal.open('update-stock-modal');
}
window.openUpdateStockModal = openUpdateStockModal;

function saveStockUpdate() {
  const invId  = document.getElementById('update-stock-inv-id').value;
  const type   = document.getElementById('update-stock-type').value;
  const qty    = parseInt(document.getElementById('update-stock-qty').value);
  const reason = document.getElementById('update-stock-reason').value.trim();
  if (isNaN(qty) || qty < 0) { Toast.warning('Invalid', 'Enter a valid quantity.'); return; }

  const item = Store.findById(WB.KEYS.inventory, invId);
  if (!item) return;

  let newQty;
  let delta;
  if (type === 'add')    { newQty = item.qty + qty; delta = qty; }
  else if (type === 'set') { newQty = qty; delta = qty - item.qty; }
  else                   { newQty = Math.max(0, item.qty - qty); delta = -(Math.min(qty, item.qty)); }

  Store.updateItem(WB.KEYS.inventory, invId, { qty: newQty });

  // Log entry
  const log = Store.getList('wb_stock_log');
  log.push({ invId, label: item.label, delta, reason, at: Date.now(), id: uid('log_') });
  Store.set('wb_stock_log', log);

  console.log('[Admin] Stock updated in localStorage:', invId, { type, qty, newQty, delta });
  Modal.close('update-stock-modal');
  Toast.success('Stock Updated', `${item.label} is now ${newQty} ${item.unit}.`);
  renderInventoryPage();
}
window.saveStockUpdate = saveStockUpdate;

function restockItem(invId) {
  const item = Store.findById(WB.KEYS.inventory, invId);
  if (!item) return;
  const delta = item.lowAt * 3;
  const newQty = item.qty + delta;
  Store.updateItem(WB.KEYS.inventory, invId, { qty: newQty });
  const log = Store.getList('wb_stock_log');
  log.push({ invId, label: item.label, delta, reason: 'Quick Restock', at: Date.now(), id: uid('log_') });
  Store.set('wb_stock_log', log);
  Toast.success('Restocked!', `${item.label} replenished to ${newQty} ${item.unit}.`);
  renderInventoryPage();
}
window.restockItem = restockItem;

// ============================================================
// PROMOS PAGE
// ============================================================
function renderPromosPage() {
  const promos = Store.getList(WB.KEYS.promos);
  const grid = document.getElementById('promos-grid');
  if (!grid) return;

  grid.innerHTML = promos.map(p => `
    <div class="promo-card">
      <div style="display:flex;align-items:flex-start;justify-content:space-between">
        <div class="promo-code">${p.code}</div>
        <span class="badge ${p.active ? 'badge-green' : 'badge-ghost'}">${p.active ? 'Active' : 'Inactive'}</span>
      </div>
      <div class="promo-desc">${p.desc}</div>
      <div class="promo-usage">${p.uses} / ${p.maxUses} uses · expires ${fmtDate(p.expires)}</div>
      <div style="margin-top:8px"><span class="badge badge-cyan">${p.type === 'percent' ? p.value + '% off' : fmtMoney(p.value) + ' off'}</span> <span class="badge badge-ghost">Min ${fmtMoney(p.minOrder)}</span></div>
      <div class="promo-actions">
        <button class="btn btn-sm ${p.active ? 'btn-danger' : 'btn-secondary'}" onclick="togglePromo('${p.id}')">${p.active ? 'Deactivate' : 'Activate'}</button>
      </div>
      <div style="margin-top:10px">
        <div style="display:flex;justify-content:space-between;font-size:.75rem;color:var(--white-40);margin-bottom:4px"><span>Usage</span><span>${Math.round(p.uses/p.maxUses*100)}%</span></div>
        <div class="progress-wrap"><div class="progress-bar" style="width:${Math.round(p.uses/p.maxUses*100)}%"></div></div>
      </div>
    </div>`).join('');
}

function togglePromo(promoId) {
  const promo = Store.findById(WB.KEYS.promos, promoId);
  if (!promo) return;
  Store.updateItem(WB.KEYS.promos, promoId, { active: !promo.active });
  Toast.success('Updated', `Promo ${promo.active ? 'deactivated' : 'activated'}.`);
  renderPromosPage();
}
window.togglePromo = togglePromo;

// ============================================================
// ZONES PAGE
// ============================================================
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function renderZonesPage() {
  const zones = Store.getList(WB.KEYS.zones);
  const grid = document.getElementById('zones-grid');
  if (!grid) return;

  grid.innerHTML = zones.map(z => {
    const zoneOrders = Orders.getAll().filter(o => o.zone === z.id && !['delivered','cancelled'].includes(o.status));
    const days = z.deliveryDays || [1,2,3,4,5,6];
    const dayCheckboxes = DAY_NAMES.map((name, i) => `
      <label style="display:flex;align-items:center;gap:4px;font-size:.75rem;cursor:pointer">
        <input type="checkbox" class="zone-day-cb" data-zone="${z.id}" data-day="${i}" ${days.includes(i) ? 'checked' : ''}
          onchange="saveZoneDeliveryDays('${z.id}')" style="accent-color:var(--cyan);width:13px;height:13px" />
        ${name}
      </label>`).join('');

    const zipChips = (z.zipCodes || []).map(zip =>
      `<span style="display:inline-flex;align-items:center;gap:4px;background:var(--white-04);border:1px solid var(--blue-border);border-radius:6px;padding:3px 8px;font-size:.75rem;font-family:var(--font-mono)">
        ${zip}
        <button onclick="removeZipFromZone('${z.id}','${zip}')" style="background:none;border:none;color:var(--white-40);cursor:pointer;padding:0;line-height:1;font-size:.875rem" title="Remove">×</button>
      </span>`
    ).join('');

    return `<div class="zone-card ${!z.active ? 'inactive' : ''}">
      <div class="zone-card-head">
        <div class="zone-card-name">${z.name}</div>
        <span class="badge ${z.active ? 'badge-green' : 'badge-ghost'}">${z.active ? 'Active' : 'Inactive'}</span>
      </div>
      <div style="font-size:.8125rem;color:var(--white-40);margin-bottom:10px">${z.city} · ${zoneOrders.length} active orders</div>

      <div style="font-size:.75rem;font-weight:600;color:var(--white-40);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">ZIP Codes</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px">${zipChips || '<span style="font-size:.8125rem;color:var(--white-40)">No ZIPs added</span>'}</div>
      <div style="display:flex;gap:8px;margin-bottom:14px">
        <input id="zip-input-${z.id}" class="form-input" placeholder="Add ZIP" style="flex:1;font-family:var(--font-mono);font-size:.875rem" maxlength="10" onkeydown="if(event.key==='Enter')addZipToZone('${z.id}')" />
        <button class="btn btn-sm btn-secondary" onclick="addZipToZone('${z.id}')">Add</button>
      </div>

      <div style="font-size:.75rem;font-weight:600;color:var(--white-40);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Delivery Days</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px">${dayCheckboxes}</div>

      <button class="btn btn-ghost btn-sm btn-full" onclick="toggleZone('${z.id}')">${z.active ? 'Disable Zone' : 'Enable Zone'}</button>
    </div>`;
  }).join('');
}

function toggleZone(zoneId) {
  const zone = Store.findById(WB.KEYS.zones, zoneId);
  if (!zone) return;
  Store.updateItem(WB.KEYS.zones, zoneId, { active: !zone.active });
  Toast.success('Zone Updated', `${zone.name} ${zone.active ? 'disabled' : 'enabled'}.`);
  renderZonesPage();
}
window.toggleZone = toggleZone;

function addZipToZone(zoneId) {
  const input = document.getElementById('zip-input-' + zoneId);
  const zip = input?.value?.trim();
  if (!zip) return;
  const zone = Store.findById(WB.KEYS.zones, zoneId);
  if (!zone) return;
  const zips = zone.zipCodes || [];
  if (zips.includes(zip)) { Toast.warning('Duplicate', `ZIP ${zip} is already in this zone.`); return; }
  const updated = Store.updateItem(WB.KEYS.zones, zoneId, { zipCodes: [...zips, zip] });
  console.log('[Admin] Zone ZIPs updated in localStorage:', updated);
  Toast.success('ZIP Added', `${zip} added to ${zone.name}.`);
  renderZonesPage();
}
window.addZipToZone = addZipToZone;

function removeZipFromZone(zoneId, zip) {
  const zone = Store.findById(WB.KEYS.zones, zoneId);
  if (!zone) return;
  const updated = Store.updateItem(WB.KEYS.zones, zoneId, { zipCodes: (zone.zipCodes || []).filter(z => z !== zip) });
  console.log('[Admin] Zone ZIPs updated in localStorage:', updated);
  Toast.success('ZIP Removed', `${zip} removed from ${zone.name}.`);
  renderZonesPage();
}
window.removeZipFromZone = removeZipFromZone;

function saveZoneDeliveryDays(zoneId) {
  const checked = [];
  document.querySelectorAll(`.zone-day-cb[data-zone="${zoneId}"]`).forEach(cb => {
    if (cb.checked) checked.push(parseInt(cb.dataset.day));
  });
  const updated = Store.updateItem(WB.KEYS.zones, zoneId, { deliveryDays: checked });
  console.log('[Admin] Zone delivery days saved to localStorage:', updated);
}
window.saveZoneDeliveryDays = saveZoneDeliveryDays;

// ============================================================
// REPORTS PAGE
// ============================================================
let reportRangeDays = 7;

function renderReportsPage() {
  const orders = Orders.getAll();
  const cutoff = daysAgo(reportRangeDays);
  const rangeOrders = orders.filter(o => o.createdAt >= cutoff);
  const delivered   = rangeOrders.filter(o => o.status === 'delivered');
  const customers   = Store.getList(WB.KEYS.customers);

  const totalRevenue    = delivered.reduce((s,o) => s+o.total, 0);
  const totalOrders     = rangeOrders.length;
  const newCustomers    = customers.filter(c => c.joinedAt >= cutoff).length;
  const activeSubs      = customers.filter(c => c.subscriptionActive).length;
  const avgOrderValue   = delivered.length ? Math.round(totalRevenue / delivered.length) : 0;
  const deliveryVolume  = delivered.reduce((s,o) => s + o.items.reduce((ss,i) => ss+i.qty, 0), 0);

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('report-total-revenue',   fmtMoney(totalRevenue));
  setEl('report-total-orders',    totalOrders);
  setEl('report-new-customers',   newCustomers);
  setEl('report-active-subs',     activeSubs);
  setEl('report-avg-order',       fmtMoney(avgOrderValue));
  setEl('report-delivery-volume', deliveryVolume + ' btls');

  // SVG line chart
  const chartEl = document.getElementById('report-line-chart');
  if (chartEl) {
    const data = Analytics.revenueByDay(reportRangeDays);
    const allOrders = Orders.getAll().filter(o => o.status === 'delivered');
    const recurringOrders = allOrders.filter(o => o.isRecurring);

    const W = 700, H = 140;
    const maxRev = Math.max(...data.map(d => d.revenue), 1);
    const step = data.length > 1 ? W / (data.length - 1) : W;

    const pts = data.map((d, i) => ({
      x: i * step,
      y: H - Math.max((d.revenue / maxRev) * H, 4),
      ...d
    }));

    const path = pts.map((p, i) => `${i===0?'M':'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const fill = path + ` L${pts[pts.length-1].x.toFixed(1)},${H} L0,${H} Z`;
    const gridLines = [0,25,50,75,100].map(pct =>
      `<line x1="0" y1="${H - (pct/100)*H}" x2="${W}" y2="${H - (pct/100)*H}" stroke="rgba(255,255,255,0.05)" stroke-width="1"/>`
    ).join('');
    const dots = pts.map(p =>
      `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="var(--cyan)" stroke="var(--blue-deep)" stroke-width="2"><title>${p.label}: ${fmtMoney(p.revenue)} · ${p.count} orders</title></circle>`
    ).join('');
    const labels = data.length <= 14 ? pts.map(p =>
      `<text x="${p.x.toFixed(1)}" y="${H+16}" text-anchor="middle" font-size="10" fill="rgba(255,255,255,0.4)">${p.label}</text>`
    ).join('') : '';

    chartEl.innerHTML = `<svg viewBox="0 0 ${W} ${H+24}" style="width:100%;overflow:visible">
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="var(--cyan)" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="var(--cyan)" stop-opacity="0"/>
        </linearGradient>
      </defs>
      ${gridLines}
      <path d="${fill}" fill="url(#lineGrad)"/>
      <path d="${path}" fill="none" stroke="var(--cyan)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${dots}${labels}
    </svg>`;
  }

  // Recurring vs one-time text summary (since we don't have explicit isRecurring flag on seeded orders)
  const allDelivered = orders.filter(o => o.status === 'delivered');
  const subCustomerIds = new Set(customers.filter(c => c.subscriptionActive).map(c => c.id));
  const recurringRev = allDelivered.filter(o => subCustomerIds.has(o.customerId)).reduce((s,o) => s+o.total, 0);
  const onetimeRev   = allDelivered.filter(o => !subCustomerIds.has(o.customerId)).reduce((s,o) => s+o.total, 0);

  // Top products
  const prodSales = {};
  delivered.forEach(o => o.items.forEach(i => {
    prodSales[i.productName] = (prodSales[i.productName] || 0) + i.qty;
  }));
  const sortedProds = Object.entries(prodSales).sort((a,b) => b[1]-a[1]);
  const prodEl = document.getElementById('report-products');
  if (prodEl) {
    const maxQty = sortedProds[0]?.[1] || 1;
    prodEl.innerHTML = sortedProds.slice(0,6).map(([name, qty]) => `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:.8125rem">
          <span>${name}</span><span class="mono">${qty} units</span>
        </div>
        <div class="progress-wrap"><div class="progress-bar" style="width:${Math.round(qty/maxQty*100)}%"></div></div>
      </div>`).join('') ||
      `<div style="padding:20px;text-align:center;color:var(--white-40);font-size:.875rem">No delivered orders in range.</div>` +
      `<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--blue-border)">
        <div style="font-size:.8125rem;margin-bottom:8px;font-weight:600">Recurring vs One-Time Revenue</div>
        <div style="display:flex;gap:16px">
          <div style="flex:1;padding:12px;background:rgba(0,212,255,0.06);border-radius:var(--radius-sm);text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:var(--cyan)">${fmtMoney(recurringRev)}</div>
            <div style="font-size:.75rem;color:var(--white-40)">Subscription</div>
          </div>
          <div style="flex:1;padding:12px;background:rgba(34,197,94,0.06);border-radius:var(--radius-sm);text-align:center">
            <div style="font-size:1.25rem;font-weight:700;color:var(--success)">${fmtMoney(onetimeRev)}</div>
            <div style="font-size:.75rem;color:var(--white-40)">One-Time</div>
          </div>
        </div>
      </div>`;

    if (sortedProds.length) {
      prodEl.innerHTML += `<div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--blue-border)">
        <div style="font-size:.8125rem;margin-bottom:8px;font-weight:600">Recurring vs One-Time Revenue</div>
        <div style="display:flex;gap:16px">
          <div style="flex:1;padding:10px;background:rgba(0,212,255,0.06);border-radius:var(--radius-sm);text-align:center">
            <div style="font-size:1.125rem;font-weight:700;color:var(--cyan)">${fmtMoney(recurringRev)}</div>
            <div style="font-size:.75rem;color:var(--white-40)">Subscription</div>
          </div>
          <div style="flex:1;padding:10px;background:rgba(34,197,94,0.06);border-radius:var(--radius-sm);text-align:center">
            <div style="font-size:1.125rem;font-weight:700;color:var(--success)">${fmtMoney(onetimeRev)}</div>
            <div style="font-size:.75rem;color:var(--white-40)">One-Time</div>
          </div>
        </div>
      </div>`;
    }
  }

  // Revenue by zone
  const zoneRevMap = {};
  delivered.forEach(o => { zoneRevMap[o.zone] = (zoneRevMap[o.zone] || 0) + o.total; });
  const sortedZones = Object.entries(zoneRevMap).sort((a,b) => b[1]-a[1]);
  const zonesEl = document.getElementById('report-zones');
  if (zonesEl) {
    const maxZRev = sortedZones[0]?.[1] || 1;
    zonesEl.innerHTML = sortedZones.map(([zId, rev]) => {
      const zone = Store.findById(WB.KEYS.zones, zId);
      return `<div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:.8125rem">
          <span>${zone?.name || zId}</span><span class="mono">${fmtMoney(rev)}</span>
        </div>
        <div class="progress-wrap"><div class="progress-bar" style="width:${Math.round(rev/maxZRev*100)}%;background:linear-gradient(90deg,rgba(168,85,247,0.5),#A855F7)"></div></div>
      </div>`;
    }).join('') || '<div style="padding:20px;text-align:center;color:var(--white-40);font-size:.875rem">No zone data.</div>';
  }

  // Inventory levels
  const invEl = document.getElementById('report-inventory');
  if (invEl) {
    const inv = Store.getList(WB.KEYS.inventory);
    invEl.innerHTML = `<div style="display:flex;gap:12px;flex-wrap:wrap">` +
      inv.map(item => {
        const pct   = Math.round((item.qty / (item.lowAt * 5)) * 100);
        const isCrit = item.qty <= item.lowAt;
        const isLow  = item.qty <= item.lowAt * 2 && !isCrit;
        const color  = isCrit ? 'var(--danger)' : isLow ? 'var(--warning)' : 'var(--cyan)';
        return `<div style="flex:1;min-width:140px;padding:12px;background:var(--white-04);border-radius:var(--radius-sm);border:1px solid ${isCrit?'rgba(239,68,68,0.3)':isLow?'rgba(245,158,11,0.3)':'var(--blue-border)'}">
          <div style="font-size:.75rem;color:var(--white-40);margin-bottom:4px">${item.label}</div>
          <div style="font-size:1.25rem;font-weight:700;color:${color}">${item.qty}</div>
          <div style="font-size:.625rem;color:var(--white-40)">${item.unit}</div>
          <div class="progress-wrap mt-8" style="height:4px"><div class="progress-bar" style="width:${Math.min(pct,100)}%;background:${color}"></div></div>
        </div>`;
      }).join('') + `</div>`;
  }

  // Wire up range tabs
  document.querySelectorAll('#report-range-tabs .chart-period-tab').forEach(tab => {
    tab.classList.toggle('active', parseInt(tab.dataset.days) === reportRangeDays);
  });
}

// ============================================================
// DELIVERY MAP (Admin Routes)
// ============================================================
const DEMO_MAP_DELIVERIES = [
  { id:'d1', customer:'Maria Torres',    address:'5842 Laguna Blvd, Elk Grove',  status:'completed',   driver:'Alex Rivera' },
  { id:'d2', customer:'James Nguyen',    address:'4210 Bruceville Rd, Elk Grove', status:'completed',   driver:'Alex Rivera' },
  { id:'d3', customer:'Priya Sharma',    address:'7001 Elk Grove Blvd #204',      status:'completed',   driver:'Sam Chen' },
  { id:'d4', customer:'David Kim',       address:'9230 Laguna Springs Dr',        status:'completed',   driver:'Sam Chen' },
  { id:'d5', customer:'Angela Reyes',    address:'3887 Windfield Way',            status:'completed',   driver:'Alex Rivera' },
  { id:'d6', customer:'Tom Williams',    address:'8950 Auto Center Dr',           status:'completed',   driver:'Jordan Lee' },
  { id:'d7', customer:'Sara Castro',     address:'6024 Lotz Pkwy',               status:'completed',   driver:'Jordan Lee' },
  { id:'d8', customer:'Mike Johnson',    address:'4499 Mather Blvd',             status:'completed',   driver:'Sam Chen' },
  { id:'d9', customer:'Rachel Patel',    address:'2345 Elk Hills Dr',            status:'in_progress', driver:'Alex Rivera' },
  { id:'d10',customer:'Chris Lee',       address:'1100 Iron Point Rd',           status:'in_progress', driver:'Sam Chen' },
  { id:'d11',customer:'Natalie Green',   address:'7832 Laguna Blvd',             status:'in_progress', driver:'Jordan Lee' },
  { id:'d12',customer:'Brian Martinez',  address:'3421 Whitelock Pkwy',          status:'pending',     driver:'Alex Rivera' },
  { id:'d13',customer:'Jessica Wang',    address:'5589 Freeport Blvd',           status:'pending',     driver:'Sam Chen' },
  { id:'d14',customer:'Daniel Moore',    address:'8211 Calvine Rd',              status:'pending',     driver:'Jordan Lee' },
  { id:'d15',customer:'Amy Chen',        address:'6750 Elk Grove Blvd',          status:'pending',     driver:'Alex Rivera' },
  { id:'d16',customer:'Robert Davis',    address:'2890 Bradshaw Rd',             status:'pending',     driver:'Sam Chen' },
];

let currentMapFilter = 'all';

function filterDeliveryMap(filter, btn) {
  currentMapFilter = filter;
  document.querySelectorAll('[data-map-filter]').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  const labelMap = { all:'All Deliveries', completed:'Completed', in_progress:'In Progress', pending:'Pending' };
  const labelEl = document.getElementById('admin-map-list-label');
  if (labelEl) labelEl.textContent = labelMap[filter] || 'All Deliveries';

  renderAdminMapList();
}
window.filterDeliveryMap = filterDeliveryMap;

function renderAdminMapList() {
  const listEl = document.getElementById('admin-delivery-map-list');
  if (!listEl) return;

  const filtered = currentMapFilter === 'all'
    ? DEMO_MAP_DELIVERIES
    : DEMO_MAP_DELIVERIES.filter(d => d.status === currentMapFilter);

  if (!filtered.length) {
    listEl.innerHTML = '<div style="font-size:.875rem;color:var(--white-40);padding:12px 0">No deliveries for this filter.</div>';
    return;
  }

  const colorMap = { completed: '#22C55E', in_progress: 'var(--cyan)', pending: '#EAB308' };
  const labelMap = { completed: 'Completed', in_progress: 'In Progress', pending: 'Pending' };

  listEl.innerHTML = filtered.map(d => `
    <div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--blue-card);border:1px solid var(--blue-border);border-radius:var(--radius-sm)">
      <div style="width:10px;height:10px;border-radius:50%;background:${colorMap[d.status]};flex-shrink:0;box-shadow:0 0 6px ${colorMap[d.status]}80"></div>
      <div style="flex:1;min-width:0">
        <div style="font-size:.875rem;font-weight:600;color:var(--white-90)">${d.customer}</div>
        <div style="font-size:.75rem;color:var(--white-40);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${d.address}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:.75rem;font-weight:600;color:${colorMap[d.status]}">${labelMap[d.status]}</div>
        <div style="font-size:.6875rem;color:var(--white-40);margin-top:2px">${d.driver}</div>
      </div>
    </div>`).join('');
}

function initAdminMap() {
  renderAdminMapList();
}

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('#report-range-tabs .chart-period-tab').forEach(tab => {
    tab.addEventListener('click', function () {
      reportRangeDays = parseInt(this.dataset.days);
      document.querySelectorAll('#report-range-tabs .chart-period-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      renderReportsPage();
    });
  });
});

// ============================================================
// SETTINGS PAGE
// ============================================================
function renderSettingsPage() {
  const settings = Store.get(WB.KEYS.settings) || SEED.settings;
  const fields = [
    ['settings-business-name', 'businessName'],
    ['settings-phone',  'phone'],
    ['settings-email',  'email'],
    ['settings-address','address'],
    ['settings-delivery-fee', null],
    ['settings-free-threshold', null],
  ];

  const feeInput = document.getElementById('settings-delivery-fee');
  const freeInput = document.getElementById('settings-free-threshold');
  if (feeInput) feeInput.value = (settings.deliveryFee / 100).toFixed(2);
  if (freeInput) freeInput.value = (settings.freeDeliveryThreshold / 100).toFixed(2);

  ['businessName','phone','email','address'].forEach(key => {
    const el = document.getElementById('settings-' + key.replace(/([A-Z])/g, '-$1').toLowerCase());
    if (el) el.value = settings[key] || '';
  });

  const mainToggle = document.getElementById('settings-maintenance');
  if (mainToggle) mainToggle.classList.toggle('on', settings.maintenanceMode);

  const saveBtn = document.getElementById('settings-save-btn');
  if (saveBtn && !saveBtn.dataset.init) {
    saveBtn.dataset.init = '1';
    saveBtn.addEventListener('click', function () {
      const cur = Store.get(WB.KEYS.settings) || {};
      Store.set(WB.KEYS.settings, {
        ...cur,
        businessName: document.getElementById('settings-business-name')?.value || cur.businessName,
        phone:        document.getElementById('settings-phone')?.value || cur.phone,
        email:        document.getElementById('settings-email')?.value || cur.email,
        address:      document.getElementById('settings-address')?.value || cur.address,
        deliveryFee:  Math.round((parseFloat(document.getElementById('settings-delivery-fee')?.value) || 2.99) * 100),
        freeDeliveryThreshold: Math.round((parseFloat(document.getElementById('settings-free-threshold')?.value) || 30) * 100),
      });
      Toast.success('Settings Saved', 'Your changes have been applied.');
    });
  }

  if (mainToggle && !mainToggle.dataset.init) {
    mainToggle.dataset.init = '1';
    mainToggle.addEventListener('click', function () {
      this.classList.toggle('on');
      const cur = Store.get(WB.KEYS.settings) || {};
      Store.set(WB.KEYS.settings, { ...cur, maintenanceMode: this.classList.contains('on') });
    });
  }
}

// ============================================================
// PAGINATION HELPER
// ============================================================
function renderPagination(containerId, current, total, onPageChange) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (total <= 1) { el.innerHTML = ''; return; }

  const pages = [];
  for (let i = 1; i <= total; i++) pages.push(i);

  el.innerHTML = `
    <button class="pagination-btn" ${current===1?'disabled':''} onclick="(${onPageChange.toString()})(${current-1})">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px"><path d="M15 18l-6-6 6-6"/></svg>
    </button>
    ${pages.map(p => `<button class="pagination-btn ${p===current?'active':''}" onclick="(${onPageChange.toString()})(${p})">${p}</button>`).join('')}
    <button class="pagination-btn" ${current===total?'disabled':''} onclick="(${onPageChange.toString()})(${current+1})">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px"><path d="M9 18l6-6-6-6"/></svg>
    </button>`;
}

// ============================================================
// ROUTES PAGE
// ============================================================
let currentRouteDate = new Date().toISOString().slice(0,10);

function renderRoutesPage() {
  initAdminMap();

  const picker = document.getElementById('route-date-picker');
  if (picker && !picker.value) picker.value = currentRouteDate;
  if (picker) currentRouteDate = picker.value;

  const drivers  = Store.getList(WB.KEYS.drivers).filter(d => d.status === 'active');
  const allOrders = Orders.getAll().filter(o => !['delivered','cancelled'].includes(o.status));

  const dateLabel = new Date(currentRouteDate + 'T12:00:00').toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' });

  // Summary stats
  const statsEl = document.getElementById('route-stats-row');
  if (statsEl) {
    const totalStops = allOrders.length;
    const assignedStops = allOrders.filter(o => o.driverId).length;
    const unassigned = totalStops - assignedStops;
    statsEl.innerHTML = `
      <div class="stat-card accent-cyan"><div class="stat-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h18M3 6l9-3 9 3M3 18l9 3 9-3"/></svg></div><div class="stat-value">${totalStops}</div><div class="stat-label">Total Stops</div></div>
      <div class="stat-card accent-green"><div class="stat-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg></div><div class="stat-value">${assignedStops}</div><div class="stat-label">Assigned</div></div>
      <div class="stat-card accent-yellow"><div class="stat-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/></svg></div><div class="stat-value">${unassigned}</div><div class="stat-label">Unassigned</div></div>
      <div class="stat-card accent-purple"><div class="stat-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="1"/><path d="M16 8h4l3 3v5h-7V8z"/></svg></div><div class="stat-value">${drivers.length}</div><div class="stat-label">Active Drivers</div></div>`;
  }

  const contentEl = document.getElementById('routes-content');
  if (!contentEl) return;

  const driverOptions = Store.getList(WB.KEYS.drivers).map(d =>
    `<option value="${d.id}">${d.name}</option>`
  ).join('');

  contentEl.innerHTML = drivers.map(drv => {
    const route = allOrders
      .filter(o => o.driverId === drv.id)
      .sort((a,b) => (a.routeOrder || 99) - (b.routeOrder || 99));
    const zone  = Store.findById(WB.KEYS.zones, drv.zone);
    const routeRevenue = route.reduce((s,o) => s+o.total, 0);

    const stopsList = route.length
      ? route.map((o, idx) => `
          <div class="route-stop" data-order-id="${o.id}">
            <div class="route-stop-num" onclick="changeRouteOrder('${o.id}')">
              <input type="number" min="1" max="${route.length}" value="${idx+1}"
                style="width:32px;text-align:center;background:none;border:none;color:var(--white-70);font-weight:700;font-size:.875rem;cursor:text"
                onchange="setRouteOrder('${o.id}',this.value,'${drv.id}')" />
            </div>
            <div style="flex:1">
              <div style="font-size:.875rem;font-weight:600">${o.customerName}</div>
              <div style="font-size:.75rem;color:var(--white-40)">${o.customerAddress}</div>
              <div style="font-size:.75rem;color:var(--white-40)">${o.items.map(i=>i.qty+'× '+i.productName.split(' ')[0]).join(', ')}</div>
            </div>
            <div style="text-align:right">
              <span class="badge ${Orders.statusBadgeClass(o.status)}">${Orders.statusLabel(o.status)}</span>
              <div class="mono" style="font-size:.8125rem;margin-top:4px">${fmtMoney(o.total)}</div>
            </div>
            <button class="btn-icon" style="color:var(--danger)" onclick="removeFromRoute('${o.id}')" title="Remove">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>`)
        .join('')
      : `<div style="padding:20px;text-align:center;color:var(--white-40);font-size:.875rem">No stops assigned.</div>`;

    return `<div class="chart-card" style="margin-bottom:0">
      <div class="chart-header">
        <div>
          <div class="chart-title">${drv.name}</div>
          <div style="font-size:.8125rem;color:var(--white-40)">${zone?.name || drv.zone} · ${route.length} stops · ${fmtMoney(routeRevenue)}</div>
        </div>
      </div>
      <div style="margin-bottom:12px">
        ${stopsList}
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <select class="form-select" style="flex:1;font-size:.8125rem" id="add-stop-select-${drv.id}">
          <option value="">Add unassigned stop…</option>
          ${allOrders.filter(o => !o.driverId).map(o => `<option value="${o.id}">#${o.id.slice(-6).toUpperCase()} — ${o.customerName}</option>`).join('')}
        </select>
        <button class="btn btn-sm btn-secondary" onclick="addStopToRoute('${drv.id}')">Add Stop</button>
      </div>
    </div>`;
  }).join('');

  if (!drivers.length) {
    contentEl.innerHTML = '<div class="card" style="text-align:center;padding:40px;color:var(--white-40)">No active drivers found.</div>';
  }
}

function setRouteOrder(orderId, newPos, drvId) {
  Store.updateItem(WB.KEYS.orders, orderId, { routeOrder: parseInt(newPos) });
  renderRoutesPage();
}
window.setRouteOrder = setRouteOrder;

function addStopToRoute(drvId) {
  const sel = document.getElementById(`add-stop-select-${drvId}`);
  const orderId = sel?.value;
  if (!orderId) return;
  const driver = Store.findById(WB.KEYS.drivers, drvId);
  Store.updateItem(WB.KEYS.orders, orderId, { driverId: drvId });
  Toast.success('Stop Added', `Order assigned to ${driver?.name}.`);
  renderRoutesPage();
}
window.addStopToRoute = addStopToRoute;

function removeFromRoute(orderId) {
  Store.updateItem(WB.KEYS.orders, orderId, { driverId: null, routeOrder: null });
  Toast.info('Removed', 'Stop removed from route.');
  renderRoutesPage();
}
window.removeFromRoute = removeFromRoute;

function optimizeRoutes() {
  const drivers = Store.getList(WB.KEYS.drivers).filter(d => d.status === 'active');
  drivers.forEach(d => {
    const route = Orders.getAll().filter(o => o.driverId === d.id && !['delivered','cancelled'].includes(o.status));
    route.sort((a,b) => (a.zone || '').localeCompare(b.zone || ''));
    route.forEach((o, i) => Store.updateItem(WB.KEYS.orders, o.id, { routeOrder: i+1 }));
  });
  Toast.success('Optimized', 'Routes sorted by delivery zone.');
  renderRoutesPage();
}
window.optimizeRoutes = optimizeRoutes;

function printRouteSheet() {
  const drivers = Store.getList(WB.KEYS.drivers).filter(d => d.status === 'active');
  let html = `<html><head><title>Route Sheet — ${currentRouteDate}</title>
    <style>body{font-family:sans-serif;padding:20px}h2{margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-bottom:24px}th,td{border:1px solid #ccc;padding:8px;font-size:12px}th{background:#f0f0f0}</style></head><body>
    <h1>Waterboy Delivery — Route Sheet</h1><p>${new Date(currentRouteDate+'T12:00:00').toLocaleDateString('en-US',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>`;
  drivers.forEach(d => {
    const route = Orders.getAll().filter(o => o.driverId === d.id && !['delivered','cancelled'].includes(o.status)).sort((a,b)=>(a.routeOrder||99)-(b.routeOrder||99));
    html += `<h2>${d.name}</h2><p>${d.vehicle} · ${d.plate}</p>
      <table><tr><th>#</th><th>Customer</th><th>Address</th><th>Items</th><th>Total</th><th>Sig</th></tr>
      ${route.map((o,i) => `<tr><td>${i+1}</td><td>${o.customerName}</td><td>${o.customerAddress}</td><td>${o.items.map(i=>i.qty+'× '+i.productName.split(' ')[0]).join(', ')}</td><td>$${(o.total/100).toFixed(2)}</td><td style="width:80px"></td></tr>`).join('')}
      </table>`;
  });
  html += '</body></html>';
  const w = window.open('','_blank');
  w.document.write(html);
  w.document.close();
  w.print();
}
window.printRouteSheet = printRouteSheet;

document.addEventListener('DOMContentLoaded', function () {
  const picker = document.getElementById('route-date-picker');
  if (picker) picker.addEventListener('change', function () { currentRouteDate = this.value; renderRoutesPage(); });
});

// ============================================================
// PAYMENTS PAGE
// ============================================================
let paymentsActiveFilter = 'all';
let paymentsSearchTerm   = '';
let paymentsPageNum      = 1;

function renderPaymentsPage() {
  let orders = Orders.getAll().sort((a,b) => b.createdAt - a.createdAt);

  if (paymentsActiveFilter === 'delivered') orders = orders.filter(o => o.status === 'delivered');
  else if (paymentsActiveFilter === 'pending')   orders = orders.filter(o => ['pending','confirmed','preparing','out_for_delivery'].includes(o.status));
  else if (paymentsActiveFilter === 'cancelled')  orders = orders.filter(o => o.status === 'cancelled');

  const from = document.getElementById('pay-date-from')?.value;
  const to   = document.getElementById('pay-date-to')?.value;
  if (from) orders = orders.filter(o => o.createdAt >= new Date(from).getTime());
  if (to)   orders = orders.filter(o => o.createdAt <= new Date(to).getTime() + 86399999);

  if (paymentsSearchTerm) {
    orders = orders.filter(o =>
      o.customerName.toLowerCase().includes(paymentsSearchTerm) ||
      o.id.toLowerCase().includes(paymentsSearchTerm)
    );
  }

  // Revenue summary cards
  const now = Date.now();
  const allOrders = Orders.getAll();
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const weekStart  = daysAgo(7);
  const monthStart = daysAgo(30);

  const todayRev  = allOrders.filter(o => o.status==='delivered' && o.createdAt >= todayStart.getTime()).reduce((s,o)=>s+o.total,0);
  const weekRev   = allOrders.filter(o => o.status==='delivered' && o.createdAt >= weekStart).reduce((s,o)=>s+o.total,0);
  const monthRev  = allOrders.filter(o => o.status==='delivered' && o.createdAt >= monthStart).reduce((s,o)=>s+o.total,0);
  const outstanding = allOrders.filter(o => ['pending','confirmed','preparing','out_for_delivery'].includes(o.status)).reduce((s,o)=>s+o.total,0);

  const setEl = (id,val) => { const el=document.getElementById(id); if(el) el.textContent=val; };
  setEl('pay-stat-today', fmtMoney(todayRev));
  setEl('pay-stat-week',  fmtMoney(weekRev));
  setEl('pay-stat-month', fmtMoney(monthRev));
  setEl('pay-stat-outstanding', fmtMoney(outstanding));

  const totalPages = Math.ceil(orders.length / PAGE_SIZE);
  const paged = orders.slice((paymentsPageNum-1)*PAGE_SIZE, paymentsPageNum*PAGE_SIZE);

  const tbody = document.getElementById('payments-table-body');
  if (!tbody) return;

  const PAY_METHODS = ['Visa ····4242','MC ····1234','Apple Pay','Google Pay','Cash'];
  tbody.innerHTML = paged.map((o, idx) => {
    const method = PAY_METHODS[(o.id.charCodeAt(4) || 0) % PAY_METHODS.length];
    const isPaid = o.status === 'delivered';
    const isCancelled = o.status === 'cancelled';
    return `<tr>
      <td><span class="mono text-xs" style="color:var(--cyan)">#${o.id.slice(-8).toUpperCase()}</span></td>
      <td>${o.customerName}</td>
      <td style="font-size:.8125rem;color:var(--white-70)">${o.items.map(i=>i.qty+'× '+i.productName.split(' ')[0]).join(', ')}</td>
      <td><span class="badge ${Orders.statusBadgeClass(o.status)}">${Orders.statusLabel(o.status)}</span></td>
      <td style="font-size:.8125rem;color:var(--white-40)">${method}</td>
      <td><span class="mono">${fmtMoney(o.total)}</span></td>
      <td class="text-muted text-sm">${fmtDate(o.createdAt)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn-icon" onclick="openAdminOrderModal('${o.id}')" title="View">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          ${isPaid ? `<button class="btn btn-sm btn-secondary" style="font-size:.75rem;padding:3px 8px" onclick="openRefundModal('${o.id}')">Refund</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  renderPagination('payments-pagination', paymentsPageNum, totalPages, (p) => {
    paymentsPageNum = p;
    renderPaymentsPage();
  });

  const countEl = document.getElementById('payments-count');
  if (countEl) countEl.textContent = `${orders.length} transactions`;
  const showingEl = document.getElementById('payments-showing');
  if (showingEl) showingEl.textContent = `Showing ${paged.length} of ${orders.length}`;
}

function openRefundModal(orderId) {
  const order = Orders.getById(orderId);
  if (!order) return;
  document.getElementById('refund-order-id').value = orderId;
  document.getElementById('refund-order-summary').innerHTML =
    `<strong>#${order.id.slice(-8).toUpperCase()}</strong> — ${order.customerName}<br>Total: ${fmtMoney(order.total)}`;
  document.getElementById('refund-amount').value = (order.total / 100).toFixed(2);
  document.getElementById('refund-notes').value = '';
  Modal.open('refund-modal');
}
window.openRefundModal = openRefundModal;

function processRefund() {
  const orderId = document.getElementById('refund-order-id').value;
  const reason  = document.getElementById('refund-reason').value;
  const amount  = parseFloat(document.getElementById('refund-amount').value);
  const notes   = document.getElementById('refund-notes').value.trim();
  if (isNaN(amount) || amount <= 0) { Toast.warning('Invalid', 'Enter a valid refund amount.'); return; }
  Store.updateItem(WB.KEYS.orders, orderId, { refunded: true, refundAmount: Math.round(amount*100), refundReason: reason, refundNotes: notes });
  Modal.close('refund-modal');
  Toast.success('Refund Processed', `$${amount.toFixed(2)} refund recorded.`);
  renderPaymentsPage();
}
window.processRefund = processRefund;

function exportPayments() {
  const orders = Orders.getAll().sort((a,b) => b.createdAt - a.createdAt);
  const rows   = [['Order ID','Customer','Status','Total','Date']];
  orders.forEach(o => rows.push([o.id, o.customerName, o.status, (o.total/100).toFixed(2), new Date(o.createdAt).toLocaleDateString()]));
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href = url; a.download = 'waterboy-payments.csv'; a.click();
  URL.revokeObjectURL(url);
  Toast.success('Exported', 'CSV download started.');
}
window.exportPayments = exportPayments;

document.addEventListener('DOMContentLoaded', function () {
  // Orders filter tabs
  document.querySelectorAll('#orders-filter-tabs .filter-tab').forEach(btn => {
    btn.addEventListener('click', function () {
      ordersActiveFilter = this.dataset.filter;
      document.querySelectorAll('#orders-filter-tabs .filter-tab').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      currentPageNum = 1;
      renderOrdersPage();
    });
  });

  // Payments filter tabs
  document.querySelectorAll('#payments-filter-tabs .filter-tab').forEach(btn => {
    btn.addEventListener('click', function () {
      paymentsActiveFilter = this.dataset.filter;
      document.querySelectorAll('#payments-filter-tabs .filter-tab').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      paymentsPageNum = 1;
      renderPaymentsPage();
    });
  });

  const paymentsSearch = document.getElementById('payments-search');
  if (paymentsSearch) {
    paymentsSearch.addEventListener('input', function () {
      paymentsSearchTerm = this.value.toLowerCase();
      paymentsPageNum = 1;
      renderPaymentsPage();
    });
  }

  const payDateFrom = document.getElementById('pay-date-from');
  const payDateTo   = document.getElementById('pay-date-to');
  if (payDateFrom) payDateFrom.addEventListener('change', () => { paymentsPageNum=1; renderPaymentsPage(); });
  if (payDateTo)   payDateTo.addEventListener('change',   () => { paymentsPageNum=1; renderPaymentsPage(); });

  const ordDateFrom = document.getElementById('orders-date-from');
  const ordDateTo   = document.getElementById('orders-date-to');
  if (ordDateFrom) ordDateFrom.addEventListener('change', () => { currentPageNum=1; renderOrdersPage(); });
  if (ordDateTo)   ordDateTo.addEventListener('change',   () => { currentPageNum=1; renderOrdersPage(); });
});

// ============================================================
// BLOCK DELIVERY DAYS
// ============================================================
let blockCalYear  = new Date().getFullYear();
let blockCalMonth = new Date().getMonth();

function renderBlockCalendar() {
  const el = document.getElementById('block-calendar-grid');
  const lbl = document.getElementById('block-cal-month-label');
  if (!el) return;

  const blocked = Store.getList(WB.KEYS.blockedDates);
  const now = new Date();
  const firstDay = new Date(blockCalYear, blockCalMonth, 1);
  const daysInMonth = new Date(blockCalYear, blockCalMonth + 1, 0).getDate();
  const startDow = firstDay.getDay(); // 0=Sun

  if (lbl) lbl.textContent = firstDay.toLocaleDateString('en-US', { month:'long', year:'numeric' });

  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  let html = dayNames.map(d => `<div class="block-cal-header">${d}</div>`).join('');

  // Empty slots before first day
  for (let i = 0; i < startDow; i++) html += '<div class="block-cal-day empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(blockCalYear, blockCalMonth, d);
    const iso  = date.toISOString().slice(0,10);
    const isSun = date.getDay() === 0;
    const isBlocked = blocked.includes(iso);
    const isPast = date < now && !isSameDay(date, now);
    const cls = isSun ? 'block-cal-day sunday' : isBlocked ? 'block-cal-day blocked' : 'block-cal-day available';
    const onclick = (!isSun && !isPast) ? `onclick="toggleBlockedDate('${iso}')"` : '';
    html += `<div class="${cls}${isPast?' past':''}" ${onclick} title="${iso}${isBlocked?' — Blocked':''}">${d}</div>`;
  }

  el.innerHTML = html;
}

function isSameDay(a, b) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
}

function toggleBlockedDate(iso) {
  const blocked = Store.getList(WB.KEYS.blockedDates);
  const idx = blocked.indexOf(iso);
  if (idx >= 0) { blocked.splice(idx, 1); }
  else          { blocked.push(iso); blocked.sort(); }
  Store.set(WB.KEYS.blockedDates, blocked);
  renderBlockCalendar();
}
window.toggleBlockedDate = toggleBlockedDate;

function blockCalPrev() {
  blockCalMonth--;
  if (blockCalMonth < 0) { blockCalMonth = 11; blockCalYear--; }
  renderBlockCalendar();
}
window.blockCalPrev = blockCalPrev;

function blockCalNext() {
  blockCalMonth++;
  if (blockCalMonth > 11) { blockCalMonth = 0; blockCalYear++; }
  renderBlockCalendar();
}
window.blockCalNext = blockCalNext;

// Re-render block calendar when settings page is shown
const _origRenderSettings = renderSettingsPage;
function renderSettingsPage() {
  _origRenderSettings();
  renderBlockCalendar();
}

// ============================================================
// MODALS
// ============================================================
function initModals() {
  ['admin-order-modal','customer-detail-modal','product-edit-modal',
   'update-stock-modal','refund-modal','cancel-order-modal',
   'add-driver-modal','driver-detail-modal'].forEach(id => Modal.init(id));
}
