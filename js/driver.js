/* ============================================================
   WATERBOY APP — DRIVER APP LOGIC
   ============================================================ */

'use strict';

let currentDriver = null;
let currentDrvPage = 'route';
let selectedStop = null;
let onDuty = true;

document.addEventListener('DOMContentLoaded', function () {
  const user = Auth.current();

  if (!user || user.role !== 'driver') {
    showDrvLogin();
  } else {
    currentDriver = Store.findById(WB.KEYS.drivers, user.id);
    showDrvApp();
  }

  initDrvLogin();
  initDrvNav();
  initDutyToggle();
  initDeliveryModal();
});

// ============================================================
// LOGIN
// ============================================================
function initDrvLogin() {
  const form = document.getElementById('drv-login-form');
  const err  = document.getElementById('drv-login-error');
  if (!form) return;

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const email = document.getElementById('drv-login-email').value.trim();
    const pass  = document.getElementById('drv-login-password').value;
    if (err) err.textContent = '';

    const drv = Auth.login('driver', email, pass);
    if (!drv) { if (err) err.textContent = 'Invalid credentials.'; return; }
    currentDriver = Store.findById(WB.KEYS.drivers, drv.id);
    showDrvApp();
  });

  const demoBtn = document.getElementById('drv-demo-btn');
  if (demoBtn) {
    demoBtn.addEventListener('click', function () {
      document.getElementById('drv-login-email').value    = WB.CREDS.driver.email;
      document.getElementById('drv-login-password').value = WB.CREDS.driver.password;
      form.dispatchEvent(new Event('submit'));
    });
  }
}

function showDrvLogin() {
  document.getElementById('drv-login-screen').style.display = 'flex';
  document.getElementById('drv-app-screen').style.display = 'none';
}

function showDrvApp() {
  document.getElementById('drv-login-screen').style.display = 'none';
  document.getElementById('drv-app-screen').style.display = 'flex';
  renderDrvHeader();
  drvNavigateTo('route');
}

// ============================================================
// HEADER
// ============================================================
function renderDrvHeader() {
  if (!currentDriver) return;
  const nameEl = document.getElementById('drv-header-name');
  if (nameEl) nameEl.textContent = currentDriver.name.split(' ')[0];
  const dot = document.getElementById('drv-status-dot');
  if (dot) dot.className = 'drv-status-dot ' + (onDuty ? '' : 'off');
  const toggle = document.getElementById('duty-toggle');
  if (toggle) toggle.className = 'toggle-switch ' + (onDuty ? 'on' : '');
}

// ============================================================
// DUTY TOGGLE
// ============================================================
function initDutyToggle() {
  const toggle = document.getElementById('duty-toggle');
  if (!toggle) return;
  toggle.addEventListener('click', function () {
    onDuty = !onDuty;
    this.classList.toggle('on', onDuty);
    const dot = document.getElementById('drv-status-dot');
    if (dot) dot.className = 'drv-status-dot ' + (onDuty ? '' : 'off');
    if (currentDriver) {
      Store.updateItem(WB.KEYS.drivers, currentDriver.id, { status: onDuty ? 'active' : 'off_duty' });
    }
    Toast.info(onDuty ? 'You\'re on duty' : 'You\'re off duty', onDuty ? 'Orders will be assigned to you.' : 'Take a break!');
  });
}

// ============================================================
// NAVIGATION
// ============================================================
function initDrvNav() {
  document.querySelectorAll('.drv-nav-tab[data-page]').forEach(tab => {
    tab.addEventListener('click', function () {
      drvNavigateTo(this.dataset.page);
    });
  });
}

function drvNavigateTo(page) {
  currentDrvPage = page;
  document.querySelectorAll('.drv-nav-tab').forEach(t => t.classList.remove('active'));
  const activeTab = document.querySelector(`.drv-nav-tab[data-page="${page}"]`);
  if (activeTab) activeTab.classList.add('active');

  document.querySelectorAll('.drv-page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById(`drv-page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const renderers = { route: renderRoute, schedule: renderSchedule, earnings: renderEarnings, profile: renderProfile };
  if (renderers[page]) renderers[page]();
}

// ============================================================
// ROUTE PAGE
// ============================================================
function renderRoute() {
  if (!currentDriver) return;
  const orders = Orders.getForDriver(currentDriver.id);

  renderStatsStrip(orders);
  renderStopList(orders);
}

function renderStatsStrip(orders) {
  const delivered = Store.getList(WB.KEYS.orders).filter(o => o.driverId === currentDriver.id && o.status === 'delivered');
  const midnight  = new Date(); midnight.setHours(0,0,0,0);
  const todayDel  = delivered.filter(o => o.updatedAt >= midnight.getTime()).length;
  const totalBottles = orders.reduce((sum, o) => sum + o.items.reduce((s2, i) => s2 + i.qty, 0), 0);

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('drv-stat-pending',    orders.length);
  setEl('drv-stat-delivered',  todayDel);
  setEl('drv-stat-bottles',    totalBottles);
}

function renderStopList(orders) {
  const list = document.getElementById('stop-list');
  if (!list) return;

  const priorityClass = (status) => {
    if (status === 'out_for_delivery') return 'priority-high';
    if (status === 'preparing')        return 'priority-med';
    return 'priority-normal';
  };

  if (!orders.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon" style="background:rgba(34,197,94,0.12);color:var(--success)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg></div><div class="empty-state-title">All deliveries done!</div><div class="empty-state-sub">Great work today. Check back for new orders.</div></div>`;
    return;
  }

  list.innerHTML = orders.map((order, idx) => {
    const bottles = order.items.reduce((s, i) => s + i.qty, 0);
    const isOOD   = order.status === 'out_for_delivery';
    return `
      <div class="stop-card ${priorityClass(order.status)}" onclick="openStopDetail('${order.id}')">
        <div class="stop-card-head">
          <div class="stop-number">${idx + 1}</div>
          <div class="stop-customer-name">${order.customerName}</div>
          <span class="badge ${Orders.statusBadgeClass(order.status)}">${Orders.statusLabel(order.status)}</span>
        </div>
        <div class="stop-address">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${order.customerAddress}
        </div>
        <div class="stop-meta">
          <span class="stop-items">${order.items.map(i => `${i.qty}× ${i.productName}`).join(', ')}</span>
          <span class="stop-bottles-badge">💧 ${bottles} btl</span>
        </div>
        <div class="stop-actions">
          <button class="btn btn-secondary btn-sm flex-1" onclick="event.stopPropagation();callCustomer('${order.customerId}')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.08 1.23 2 2 0 012.06 1h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 8.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
            Call
          </button>
          ${order.status !== 'out_for_delivery' ? `<button class="btn btn-primary btn-sm flex-1" onclick="event.stopPropagation();markOutForDelivery('${order.id}')">Out for Delivery</button>` : `<button class="btn btn-primary btn-sm flex-1" onclick="event.stopPropagation();markDelivered('${order.id}')">✓ Mark Delivered</button>`}
        </div>
      </div>`;
  }).join('');
}

function callCustomer(custId) {
  const cust = Store.findById(WB.KEYS.customers, custId);
  if (cust) Toast.info('Calling…', cust.phone);
}
window.callCustomer = callCustomer;

function markOutForDelivery(orderId) {
  Orders.updateStatus(orderId, 'out_for_delivery');
  Toast.success('Updated', 'Order marked as out for delivery.');
  renderRoute();
  if (selectedStop === orderId) renderStopDetail(orderId);
}
window.markOutForDelivery = markOutForDelivery;

function markDelivered(orderId) {
  Orders.updateStatus(orderId, 'delivered');
  const order = Orders.getById(orderId);
  if (order) {
    Notifs.push(order.customerId, 'order_update', 'Order Delivered! ✓', 'Your water has arrived. Enjoy!', orderId);
    if (currentDriver) {
      Store.updateItem(WB.KEYS.drivers, currentDriver.id, {
        deliveriesToday: (currentDriver.deliveriesToday || 0) + 1,
        deliveriesTotal: (currentDriver.deliveriesTotal || 0) + 1,
      });
      currentDriver = Store.findById(WB.KEYS.drivers, currentDriver.id);
    }
  }
  Toast.success('Delivered!', 'Order marked as complete.');
  Modal.close('stop-detail-modal');
  renderRoute();
}
window.markDelivered = markDelivered;

// ============================================================
// STOP DETAIL MODAL
// ============================================================
function initDeliveryModal() {
  Modal.init('stop-detail-modal');
}

function openStopDetail(orderId) {
  selectedStop = orderId;
  renderStopDetail(orderId);
  Modal.open('stop-detail-modal');
}
window.openStopDetail = openStopDetail;

function renderStopDetail(orderId) {
  const order = Orders.getById(orderId);
  if (!order) return;
  const body = document.getElementById('stop-detail-body');
  if (!body) return;

  const cust = Store.findById(WB.KEYS.customers, order.customerId);
  const bottles = order.items.reduce((s, i) => s + i.qty, 0);
  const returnBottles = cust ? cust.bottles : 0;

  body.innerHTML = `
    <div class="delivery-detail-addr">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
      <div>
        <div style="font-weight:700;font-size:.9375rem">${order.customerName}</div>
        <div style="color:var(--white-40);font-size:.875rem;margin-top:3px">${order.customerAddress}</div>
        ${cust?.phone ? `<div style="color:var(--cyan);font-size:.8125rem;margin-top:4px">${cust.phone}</div>` : ''}
      </div>
    </div>
    <div class="delivery-map-placeholder">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>
      Map integration (Google Maps / Waze)
    </div>
    <div style="font-size:.875rem;font-weight:700;margin-bottom:10px">Delivery Items</div>
    ${order.items.map(i => `<div class="bottle-return-row"><span class="bottle-return-label">${i.productName}</span><span class="fw-600">${i.qty} bottles</span></div>`).join('')}
    <div class="bottle-return-row" style="border-top:1px solid var(--blue-border);margin-top:4px;padding-top:12px">
      <span class="bottle-return-label" style="color:var(--warning)">⬆ Bottles to Pick Up</span>
      <div class="qty-stepper" style="scale:.9">
        <button class="qty-btn" onclick="adjustReturn(-1)">−</button>
        <span class="qty-val" id="return-qty">${returnBottles}</span>
        <button class="qty-btn" onclick="adjustReturn(1)">+</button>
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:20px">
      ${order.status !== 'out_for_delivery'
        ? `<button class="btn btn-secondary flex-1" onclick="markOutForDelivery('${order.id}')">Out for Delivery</button>`
        : `<button class="btn btn-primary flex-1" onclick="markDelivered('${order.id}')">✓ Mark Delivered</button>`}
      <button class="btn btn-ghost" onclick="Modal.close('stop-detail-modal')">Cancel</button>
    </div>`;
}

let _returnAdj = 0;
function adjustReturn(delta) {
  _returnAdj += delta;
  const el = document.getElementById('return-qty');
  if (el) el.textContent = Math.max(0, parseInt(el.textContent) + delta);
}
window.adjustReturn = adjustReturn;

// ============================================================
// SCHEDULE PAGE
// ============================================================
function renderSchedule() {
  const tabsEl = document.getElementById('schedule-day-tabs');
  if (!tabsEl) return;

  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(); d.setDate(d.getDate() + i);
    days.push(d);
  }

  tabsEl.innerHTML = days.map((d, i) => {
    const orders = Store.getList(WB.KEYS.orders).filter(o => {
      const od = new Date(o.createdAt);
      return od.toDateString() === d.toDateString() && o.driverId === (currentDriver?.id);
    });
    return `<div class="day-tab ${i === 0 ? 'active' : ''}" onclick="switchScheduleDay(this, ${i})">
      <span class="day-tab-name">${d.toLocaleDateString('en-US',{weekday:'short'})}</span>
      <span class="day-tab-num">${d.getDate()}</span>
      <span class="day-tab-count">${orders.length} stops</span>
    </div>`;
  }).join('');

  renderScheduleSlots(0, days);
}

function switchScheduleDay(el, dayIdx) {
  document.querySelectorAll('.day-tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  const days = [];
  for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() + i); days.push(d); }
  renderScheduleSlots(dayIdx, days);
}
window.switchScheduleDay = switchScheduleDay;

function renderScheduleSlots(dayIdx, days) {
  const slotsEl = document.getElementById('schedule-slots');
  if (!slotsEl) return;

  const d = days[dayIdx];
  const allOrders = Store.getList(WB.KEYS.orders);
  const dayOrders = dayIdx === 0
    ? Orders.getForDriver(currentDriver?.id || '')
    : allOrders.filter(o => {
        const od = new Date(o.createdAt);
        return od.toDateString() === d.toDateString() && o.driverId === currentDriver?.id;
      });

  if (!dayOrders.length) {
    slotsEl.innerHTML = '<div class="empty-state" style="padding:40px 20px"><div class="empty-state-title">No deliveries scheduled</div></div>';
    return;
  }

  const timeSlots = ['9:00 AM','10:00 AM','11:00 AM','12:00 PM','1:00 PM','2:00 PM','3:00 PM','4:00 PM','5:00 PM'];
  slotsEl.innerHTML = dayOrders.map((order, i) => {
    const timeStr = timeSlots[i % timeSlots.length];
    return `<div class="time-slot">
      <div class="time-slot-time">${timeStr}</div>
      <div class="time-slot-card">
        <div class="time-slot-name">${order.customerName}</div>
        <div class="time-slot-address">${order.customerAddress}</div>
        <div class="time-slot-items">${order.items.map(i => `${i.qty}× ${i.productName}`).join(', ')}</div>
      </div>
    </div>`;
  }).join('');
}

// ============================================================
// EARNINGS PAGE
// ============================================================
function renderEarnings() {
  if (!currentDriver) return;

  const allOrders = Store.getList(WB.KEYS.orders).filter(o => o.driverId === currentDriver.id && o.status === 'delivered');
  const midnight  = new Date(); midnight.setHours(0,0,0,0);
  const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const todayOrders = allOrders.filter(o => o.updatedAt >= midnight.getTime());
  const weekOrders  = allOrders.filter(o => o.updatedAt >= weekStart.getTime());

  const basePerStop = 350; // $3.50 per stop
  const tipRate     = 0.15;

  const todayEarnings = todayOrders.length * basePerStop + Math.floor(todayOrders.reduce((s,o)=>s+o.total,0) * tipRate / 100);
  const weekEarnings  = weekOrders.length  * basePerStop + Math.floor(weekOrders.reduce((s,o)=>s+o.total,0)  * tipRate / 100);
  const totalEarnings = allOrders.length   * basePerStop + Math.floor(allOrders.reduce((s,o)=>s+o.total,0)   * tipRate / 100);

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('earnings-total', fmtMoney(weekEarnings));
  setEl('earnings-today', fmtMoney(todayEarnings));
  setEl('earnings-stops-today', todayOrders.length);
  setEl('earnings-week-stops', weekOrders.length);
  setEl('earnings-base',       fmtMoney(weekOrders.length * basePerStop));
  setEl('earnings-tips',       fmtMoney(weekEarnings - weekOrders.length * basePerStop));
  setEl('earnings-alltime',    fmtMoney(totalEarnings));
}

// ============================================================
// PROFILE PAGE
// ============================================================
function renderProfile() {
  if (!currentDriver) return;
  const d = currentDriver;

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const avi = document.getElementById('drv-avatar-text');
  if (avi) avi.textContent = d.name.split(' ').map(w=>w[0]).join('').slice(0,2);

  setEl('drv-profile-name',    d.name);
  setEl('drv-profile-zone',    'Zone: ' + (Store.findById(WB.KEYS.zones, d.zone)?.name || d.zone));
  setEl('drv-profile-rating',  d.rating.toFixed(1));
  setEl('drv-vehicle-name',    d.vehicle);
  setEl('drv-vehicle-plate',   d.plate);
  setEl('drv-total-deliveries',d.deliveriesTotal.toLocaleString());

  const logoutBtn = document.getElementById('drv-logout-btn');
  if (logoutBtn && !logoutBtn.dataset.init) {
    logoutBtn.dataset.init = '1';
    logoutBtn.addEventListener('click', function () {
      Auth.logout();
      currentDriver = null;
      showDrvLogin();
    });
  }
}
