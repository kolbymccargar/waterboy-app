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
    settings: renderSettingsPage,
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
function renderOrdersPage() {
  const statusFilter = document.getElementById('orders-status-filter')?.value || 'all';
  let orders = Orders.getAll().sort((a,b) => b.createdAt - a.createdAt);

  if (statusFilter !== 'all') orders = orders.filter(o => o.status === statusFilter);
  if (orderSearchTerm) {
    orders = orders.filter(o =>
      o.customerName.toLowerCase().includes(orderSearchTerm) ||
      o.id.toLowerCase().includes(orderSearchTerm) ||
      o.status.includes(orderSearchTerm)
    );
  }

  const totalPages = Math.ceil(orders.length / PAGE_SIZE);
  const paged = orders.slice((currentPageNum - 1) * PAGE_SIZE, currentPageNum * PAGE_SIZE);

  const tbody = document.getElementById('orders-table-body');
  if (!tbody) return;

  tbody.innerHTML = paged.map(o => {
    const drv = o.driverId ? Store.findById(WB.KEYS.drivers, o.driverId) : null;
    return `<tr>
      <td><span class="mono text-xs" style="color:var(--cyan)">#${o.id.slice(-8).toUpperCase()}</span></td>
      <td>${o.customerName}</td>
      <td>${o.items.map(i=>i.qty+'× '+i.productName.split(' ')[0]).join(', ')}</td>
      <td><span class="badge ${Orders.statusBadgeClass(o.status)}">${Orders.statusLabel(o.status)}</span></td>
      <td>${drv ? drv.name.split(' ')[0] : '<span class="text-muted">Unassigned</span>'}</td>
      <td><span class="mono">${fmtMoney(o.total)}</span></td>
      <td class="text-muted text-sm">${fmtDate(o.createdAt)}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="btn-icon" onclick="openAdminOrderModal('${o.id}')" title="View">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <select class="form-select" style="padding:4px 8px;font-size:.75rem;width:130px" onchange="updateOrderStatus('${o.id}', this.value)">
            ${WB.ORDER_STATUSES.map(s => `<option value="${s}" ${s===o.status?'selected':''}>${Orders.statusLabel(s)}</option>`).join('')}
            <option value="cancelled" ${o.status==='cancelled'?'selected':''}>Cancelled</option>
          </select>
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

  const orders = Orders.getForCustomer(custId);
  const products = Store.getList(WB.KEYS.products);
  const subProd  = cust.subscriptionProduct ? products.find(p => p.id === cust.subscriptionProduct) : null;

  body.innerHTML = `
    <div style="text-align:center;padding-bottom:20px;border-bottom:1px solid var(--blue-border)">
      <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,var(--cyan-dim),var(--cyan));display:flex;align-items:center;justify-content:center;font-weight:700;color:var(--blue-deep);font-size:1.375rem;margin:0 auto 12px">${cust.name.split(' ').map(w=>w[0]).join('').slice(0,2)}</div>
      <div style="font-size:1.125rem;font-weight:700">${cust.name}</div>
      <div style="font-size:.875rem;color:var(--white-40);margin-top:3px">${cust.email}</div>
      <div style="font-size:.875rem;color:var(--white-40)">${cust.phone}</div>
    </div>
    <div class="two-col-grid mt-16" style="gap:12px">
      <div><div class="text-sm text-muted">Address</div><div style="font-size:.875rem">${cust.address}, ${cust.city}</div></div>
      <div><div class="text-sm text-muted">ZIP</div><div style="font-size:.875rem">${cust.zip}</div></div>
      <div><div class="text-sm text-muted">Bottles on Hand</div><div class="stat-value" style="font-size:1.25rem">${cust.bottles}</div></div>
      <div><div class="text-sm text-muted">Loyalty Points</div><div class="stat-value" style="font-size:1.25rem;color:var(--cyan)">${cust.loyaltyPts.toLocaleString()}</div></div>
      <div><div class="text-sm text-muted">Total Orders</div><div class="fw-600">${cust.totalOrders}</div></div>
      <div><div class="text-sm text-muted">Total Spent</div><div class="fw-600 mono">${fmtMoney(cust.totalSpent)}</div></div>
      <div><div class="text-sm text-muted">Referral Code</div><div class="mono text-cyan" style="font-size:.875rem">${cust.referralCode}</div></div>
      <div><div class="text-sm text-muted">Member Since</div><div style="font-size:.875rem">${fmtDate(cust.joinedAt)}</div></div>
    </div>
    ${cust.subscriptionActive ? `<div style="margin-top:16px;padding:12px 16px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:var(--radius-sm)"><span class="badge badge-green">Subscription Active</span><div style="font-size:.875rem;margin-top:6px">${subProd ? subProd.name : ''} · ${cust.subscriptionFrequency}</div></div>` : ''}
    <div class="divider"></div>
    <div class="text-sm text-muted mb-8">Recent Orders (${orders.length} total)</div>
    ${orders.slice(0,4).map(o => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--blue-border)"><div><div style="font-size:.875rem;font-weight:600">${o.items.map(i=>i.qty+'× '+i.productName.split(' ')[0]).join(', ')}</div><div style="font-size:.75rem;color:var(--white-40)">${fmtDate(o.createdAt)}</div></div><div style="display:flex;align-items:center;gap:8px"><span class="badge ${Orders.statusBadgeClass(o.status)}">${Orders.statusLabel(o.status)}</span><span class="mono" style="font-size:.875rem">${fmtMoney(o.total)}</span></div></div>`).join('')}`;

  Modal.open('customer-detail-modal');
}
window.openCustomerModal = openCustomerModal;

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

  grid.innerHTML = products.map(p => `
    <div class="card">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
        <div style="font-size:1.75rem">${p.icon}</div>
        <span class="badge ${p.category === 'delivery' ? 'badge-cyan' : p.category === 'dispensers' ? 'badge-blue' : 'badge-ghost'}">${p.category}</span>
      </div>
      <div style="font-weight:700;font-size:.9375rem;margin-bottom:4px">${p.name}</div>
      <div style="font-size:.8125rem;color:var(--white-40);margin-bottom:10px">${p.description}</div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span class="mono text-cyan">${fmtMoney(p.price)}</span>
        <span style="font-size:.75rem;color:var(--white-40)">${p.unit}</span>
      </div>
      ${p.popular ? '<div class="mt-8"><span class="badge badge-yellow">Popular</span></div>' : ''}
    </div>`).join('');
}

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
    return `<div class="driver-card">
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
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--blue-border);font-size:.8125rem;color:var(--white-40)">
        ${d.vehicle} · ${d.plate}
      </div>
    </div>`;
  }).join('');
}

// ============================================================
// INVENTORY PAGE
// ============================================================
function renderInventoryPage() {
  const inv = Store.getList(WB.KEYS.inventory);
  const grid = document.getElementById('inventory-grid');
  if (!grid) return;

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
          ${isCrit ? '<span class="badge badge-red">Critical</span>' : isLow ? '<span class="badge badge-yellow">Low</span>' : ''}
        </div>
        <div class="progress-wrap mt-8"><div class="progress-bar" style="width:${Math.min(pct,100)}%;background:${isCrit?'var(--danger)':isLow?'var(--warning)':'linear-gradient(90deg,var(--cyan-dim),var(--cyan))'}"></div></div>
      </div>
      <button class="btn btn-sm btn-secondary" onclick="restockItem('${item.id}')">Restock</button>
    </div>`;
  }).join('');
}

function restockItem(invId) {
  const item = Store.findById(WB.KEYS.inventory, invId);
  if (!item) return;
  const newQty = item.qty + item.lowAt * 3;
  Store.updateItem(WB.KEYS.inventory, invId, { qty: newQty });
  Toast.success('Restocked!', `${item.label} replenished.`);
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
function renderZonesPage() {
  const zones = Store.getList(WB.KEYS.zones);
  const grid = document.getElementById('zones-grid');
  if (!grid) return;

  grid.innerHTML = zones.map(z => {
    const zoneOrders = Orders.getAll().filter(o => o.zone === z.id && !['delivered','cancelled'].includes(o.status));
    return `<div class="zone-card ${!z.active ? 'inactive' : ''}">
      <div class="zone-card-head">
        <div class="zone-card-name">${z.name}</div>
        <span class="badge ${z.active ? 'badge-green' : 'badge-ghost'}">${z.active ? 'Active' : 'Inactive'}</span>
      </div>
      <div style="font-size:.8125rem;color:var(--white-40);margin-bottom:8px">${z.city}</div>
      <div class="zone-zips">${z.zipCodes.map(zip => `<span class="zone-zip-chip">${zip}</span>`).join('')}</div>
      <div style="margin-top:12px;display:flex;justify-content:space-between;font-size:.8125rem">
        <span style="color:var(--white-40)">${zoneOrders.length} active orders</span>
        <button class="btn btn-ghost btn-sm" onclick="toggleZone('${z.id}')">${z.active ? 'Disable' : 'Enable'}</button>
      </div>
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

// ============================================================
// REPORTS PAGE
// ============================================================
function renderReportsPage() {
  const stats = Analytics.summary();
  const data  = Analytics.revenueByDay(7);

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('report-total-revenue',   fmtMoney(stats.totalRevenue));
  setEl('report-total-orders',    stats.totalOrders);
  setEl('report-avg-order',       fmtMoney(stats.avgOrderValue));
  setEl('report-total-customers', stats.totalCustomers);

  const chartEl = document.getElementById('report-chart');
  if (chartEl) {
    const maxRev = Math.max(...data.map(d => d.revenue), 1);
    chartEl.innerHTML = data.map(d => {
      const pct = Math.round((d.revenue / maxRev) * 100);
      return `<div class="bar-col"><div class="bar" style="height:${pct}%"><div class="bar-tooltip">${fmtMoney(d.revenue)}<br>${d.count} orders</div></div><div class="bar-label">${d.label}</div></div>`;
    }).join('');
  }

  // Product breakdown
  const orders   = Orders.getAll().filter(o => o.status === 'delivered');
  const prodSales = {};
  orders.forEach(o => o.items.forEach(i => {
    prodSales[i.productName] = (prodSales[i.productName] || 0) + i.qty;
  }));
  const sorted = Object.entries(prodSales).sort((a,b) => b[1]-a[1]);
  const prodEl = document.getElementById('report-products');
  if (prodEl) {
    const maxQty = sorted[0]?.[1] || 1;
    prodEl.innerHTML = sorted.map(([name, qty]) => `
      <div style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:.875rem"><span>${name}</span><span class="mono">${qty} units</span></div>
        <div class="progress-wrap"><div class="progress-bar" style="width:${Math.round(qty/maxQty*100)}%"></div></div>
      </div>`).join('');
  }
}

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
// MODALS
// ============================================================
function initModals() {
  ['admin-order-modal','customer-detail-modal'].forEach(id => Modal.init(id));
}
