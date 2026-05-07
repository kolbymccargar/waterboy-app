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

  const renderers = { route: renderRoute, bottles: renderBottles, map: renderDrvMap, account: renderAccount, messages: renderDrvMessages };
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

const DEMO_TIME_WINDOWS = ['8:00–10:00 AM','9:00–11:00 AM','10:00 AM–12:00 PM','11:00 AM–1:00 PM','12:00–2:00 PM','1:00–3:00 PM','2:00–4:00 PM'];
const DEMO_NOTES = ['','Gate code: #2241','Leave at door','Ring bell twice','','Call on arrival',''];

function renderStopList(orders) {
  const list = document.getElementById('stop-list');
  if (!list) return;

  if (!orders.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon" style="background:rgba(34,197,94,0.12);color:var(--success)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polyline points="20 6 9 17 4 12"/></svg></div><div class="empty-state-title">All deliveries done!</div><div class="empty-state-sub">Great work today. Check back for new orders.</div></div>`;
    return;
  }

  list.innerHTML = orders.map((order, idx) => {
    const cust       = Store.findById(WB.KEYS.customers, order.customerId);
    const bottles    = order.items.reduce((s, i) => s + i.qty, 0);
    const pickupQty  = cust?.bottles || 0;
    const mapsUrl    = `https://maps.google.com/?q=${encodeURIComponent(order.customerAddress)}`;
    const timeWindow = DEMO_TIME_WINDOWS[idx % DEMO_TIME_WINDOWS.length];
    const note       = DEMO_NOTES[idx % DEMO_NOTES.length];
    const isDone     = order.status === 'delivered';
    const isMissed   = order.status === 'missed' || order.status === 'cancelled';
    const statusBadge = isDone ? 'badge-green' : isMissed ? 'badge-red' : 'badge-yellow';
    const statusTxt   = isDone ? 'Completed' : isMissed ? 'Missed' : 'Pending';

    return `
      <div class="stop-card ${isDone ? 'priority-normal' : 'priority-high'}" style="${isDone ? 'opacity:.7' : ''}">
        <div class="stop-card-head">
          <div class="stop-number">${idx + 1}</div>
          <div style="flex:1;min-width:0">
            <div class="stop-customer-name">${order.customerName}</div>
            <div style="font-size:.75rem;color:var(--white-40)">⏱ ${timeWindow}</div>
          </div>
          <span class="badge ${statusBadge}">${statusTxt}</span>
        </div>
        <a href="${mapsUrl}" target="_blank" class="stop-address" style="text-decoration:none;color:inherit;display:flex;align-items:flex-start;gap:6px;padding:8px 0;border-top:1px solid var(--blue-border)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px;flex-shrink:0;margin-top:2px;stroke:var(--cyan)"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
          <span style="font-size:.8125rem;color:var(--white-70)">${order.customerAddress}</span>
        </a>
        <div class="stop-meta">
          <span class="stop-items">${order.items.map(i => `${i.qty}× ${i.productName}`).join(', ')}</span>
          <span class="stop-bottles-badge">💧 ${bottles} deliver · ⬆ ${pickupQty} return</span>
        </div>
        ${note ? `<div style="font-size:.75rem;color:var(--warning);margin-top:6px;display:flex;align-items:center;gap:5px"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>${note}</div>` : ''}
        ${!isDone && !isMissed ? `
        <div class="stop-actions">
          <a href="${mapsUrl}" target="_blank" class="btn btn-secondary btn-sm flex-1" style="text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:13px;height:13px"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>Navigate
          </a>
          <button class="btn btn-primary btn-sm flex-1" onclick="event.stopPropagation();openCameraFlow('${order.id}')">📷 Complete</button>
          <button class="btn btn-sm" style="background:rgba(239,68,68,0.12);color:var(--danger);border:1px solid rgba(239,68,68,0.25)" onclick="event.stopPropagation();markMissed('${order.id}')">Missed</button>
        </div>
        <button class="btn btn-secondary btn-sm btn-full" style="margin-top:8px;background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.3);color:var(--success)" onclick="event.stopPropagation();openDrvChat('${order.id}')">💬 Message Customer</button>` : isDone ? `
        <div style="display:flex;align-items:center;gap:8px;margin-top:10px">
          <div style="display:flex;align-items:center;gap:6px;font-size:.8125rem;color:var(--success);font-weight:600">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px"><polyline points="20 6 9 17 4 12"/></svg>Delivery completed
          </div>
          ${order.deliveryPhoto ? `<button onclick="event.stopPropagation();viewDeliveryPhoto('${order.id}')" style="margin-left:auto;background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.22);border-radius:8px;padding:4px 10px;cursor:pointer;display:flex;align-items:center;gap:5px;font-size:.75rem;color:var(--cyan)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:12px;height:12px"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>Photo</button>` : `<span style="margin-left:auto;font-size:.7rem;color:var(--warning)">No photo</span>`}
        </div>` : ''}
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
// BOTTLES PAGE
// ============================================================
function renderBottles() {
  if (!currentDriver) return;
  const orders = Orders.getForDriver(currentDriver.id);

  const toDeliver = orders.reduce((s, o) => s + o.items.reduce((s2, i) => s2 + i.qty, 0), 0);
  const toPickup  = orders.reduce((s, o) => {
    const cust = Store.findById(WB.KEYS.customers, o.customerId);
    return s + (cust?.bottles || 0);
  }, 0);
  const returned  = Store.getList(WB.KEYS.orders)
    .filter(o => o.driverId === currentDriver.id && o.status === 'delivered')
    .reduce((s, o) => {
      const cust = Store.findById(WB.KEYS.customers, o.customerId);
      return s + (cust?.bottles || 0);
    }, 0);

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('btl-deliver',  toDeliver);
  setEl('btl-pickup',   toPickup);
  setEl('btl-returned', returned);

  const listEl = document.getElementById('bottles-list');
  if (!listEl) return;

  if (!orders.length) {
    listEl.innerHTML = '<div class="empty-state" style="padding:32px 0"><div class="empty-state-title">No bottles to track</div><div class="empty-state-sub">All deliveries complete for today.</div></div>';
    return;
  }

  listEl.innerHTML = orders.map((order, idx) => {
    const cust    = Store.findById(WB.KEYS.customers, order.customerId);
    const deliver = order.items.reduce((s, i) => s + i.qty, 0);
    const pickup  = cust?.bottles || 0;
    const isDone  = order.status === 'delivered';
    return `<div style="background:var(--blue-card);border:1px solid var(--blue-border);border-radius:var(--radius-md);padding:14px 16px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <div class="stop-number" style="width:24px;height:24px;font-size:.75rem">${idx + 1}</div>
        <div style="font-weight:600;color:var(--white-90);font-size:.875rem">${order.customerName}</div>
        ${isDone ? `<span class="badge badge-green" style="margin-left:auto">Done</span>` : `<span class="badge badge-yellow" style="margin-left:auto">Pending</span>`}
      </div>
      <div style="display:flex;gap:10px">
        <div style="flex:1;background:rgba(0,212,255,0.07);border:1px solid rgba(0,212,255,0.15);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:1.25rem;font-weight:800;color:var(--cyan)">${deliver}</div>
          <div style="font-size:.6875rem;color:var(--white-40);margin-top:2px">Deliver</div>
        </div>
        <div style="flex:1;background:rgba(234,179,8,0.07);border:1px solid rgba(234,179,8,0.15);border-radius:8px;padding:10px;text-align:center">
          <div style="font-size:1.25rem;font-weight:800;color:#EAB308">${pickup}</div>
          <div style="font-size:.6875rem;color:var(--white-40);margin-top:2px">Pick Up</div>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ============================================================
// ACCOUNT PAGE
// ============================================================
function renderAccount() {
  if (!currentDriver) return;
  const d = currentDriver;

  const avi = document.getElementById('drv-avatar-text');
  if (avi) avi.textContent = d.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setEl('drv-profile-name', d.name);
  setEl('drv-profile-role', 'Waterboy Driver');
  setEl('drv-acct-email',   d.email || '—');
  setEl('drv-acct-phone',   d.phone || '—');
  setEl('drv-acct-empid',   d.id);

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

// ============================================================
// MARK MISSED
// ============================================================
function markMissed(orderId) {
  Orders.updateStatus(orderId, 'missed');
  Toast.warning('Marked Missed', 'Order flagged as missed. Dispatch has been notified.');
  renderRoute();
}
window.markMissed = markMissed;

// ============================================================
// CAMERA DELIVERY FLOW
// ============================================================
let _cameraStream = null;
let _capturedPhoto = null;
let _photoOrderId = null;

function showCamStep(step) {
  ['permission','viewfinder','review','form'].forEach(s => {
    const el = document.getElementById('cam-step-' + s);
    if (!el) return;
    el.style.display = (s === step) ? 'flex' : 'none';
  });
}

function openCameraFlow(orderId) {
  _photoOrderId = orderId;
  _capturedPhoto = null;
  _cameraStream = null;

  const screen = document.getElementById('drv-camera-screen');
  if (screen) screen.style.display = 'flex';
  showCamStep('permission');
}
window.openCameraFlow = openCameraFlow;

function closeCameraFlow() {
  stopCameraStream();
  const screen = document.getElementById('drv-camera-screen');
  if (screen) screen.style.display = 'none';
  _photoOrderId = null;
  _capturedPhoto = null;
}
window.closeCameraFlow = closeCameraFlow;

async function startCamera() {
  showCamStep('viewfinder');
  const errEl = document.getElementById('cam-error-msg');
  if (errEl) errEl.style.display = 'none';

  const video = document.getElementById('cam-video');
  if (!video) return;

  try {
    _cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    video.srcObject = _cameraStream;
    video.play();
  } catch (err) {
    // Camera denied or unavailable — show error state
    if (errEl) errEl.style.display = 'flex';
  }
}
window.startCamera = startCamera;

function stopCameraStream() {
  const video = document.getElementById('cam-video');
  if (video) { video.srcObject = null; }
  if (_cameraStream) {
    _cameraStream.getTracks().forEach(t => t.stop());
    _cameraStream = null;
  }
}

function capturePhoto() {
  const video = document.getElementById('cam-video');
  if (!video) return;
  const canvas = document.createElement('canvas');
  canvas.width  = video.videoWidth  || 1280;
  canvas.height = video.videoHeight || 720;
  canvas.getContext('2d').drawImage(video, 0, 0);
  _capturedPhoto = canvas.toDataURL('image/jpeg', 0.7);
  stopCameraStream();

  const reviewImg = document.getElementById('cam-review-img');
  if (reviewImg) reviewImg.src = _capturedPhoto;
  showCamStep('review');
}
window.capturePhoto = capturePhoto;

function retakePhoto() {
  _capturedPhoto = null;
  startCamera();
}
window.retakePhoto = retakePhoto;

function acceptPhoto() {
  const thumb = document.getElementById('cam-form-thumb');
  if (thumb) thumb.src = _capturedPhoto;

  // Pre-fill bottles delivered from the order
  if (_photoOrderId) {
    const order = Orders.getById(_photoOrderId);
    if (order) {
      const qty = order.items.reduce((s, i) => s + i.qty, 0);
      const delInput = document.getElementById('cam-bottles-delivered');
      if (delInput) delInput.value = qty;
    }
  }

  // Clear previous notes
  const notesEl = document.getElementById('cam-notes');
  if (notesEl) notesEl.value = '';
  const pickupEl = document.getElementById('cam-bottles-pickup');
  if (pickupEl) pickupEl.value = '0';

  showCamStep('form');
}
window.acceptPhoto = acceptPhoto;

function confirmDelivery() {
  if (!_photoOrderId) return;
  const order = Orders.getById(_photoOrderId);
  if (!order) return;

  const deliveryLocation  = (document.getElementById('cam-location')?.value)          || 'Front Door';
  const bottlesDelivered  = parseInt(document.getElementById('cam-bottles-delivered')?.value) || 0;
  const bottlesPickedUp   = parseInt(document.getElementById('cam-bottles-pickup')?.value)    || 0;
  const notes             = (document.getElementById('cam-notes')?.value || '').trim();
  const now               = new Date().toISOString();

  Orders.updateStatus(_photoOrderId, 'delivered');
  Store.updateItem(WB.KEYS.orders, _photoOrderId, {
    deliveryPhoto:    _capturedPhoto,
    photoTimestamp:   now,
    deliveryLocation,
    bottlesDelivered,
    bottlesPickedUp,
    deliveryNotes:    notes,
    completedBy:      currentDriver ? currentDriver.name : 'Driver',
    completedAt:      now,
  });

  if (currentDriver) {
    Store.updateItem(WB.KEYS.drivers, currentDriver.id, {
      deliveriesToday: (currentDriver.deliveriesToday || 0) + 1,
      deliveriesTotal: (currentDriver.deliveriesTotal || 0) + 1,
    });
    currentDriver = Store.findById(WB.KEYS.drivers, currentDriver.id);
  }

  Notifs.push(order.customerId, 'order_update', 'Order Delivered! ✓', 'Your water has arrived. Tap to see your delivery photo!', _photoOrderId);

  closeCameraFlow();
  Toast.success('Delivery confirmed! ✓', 'Photo saved with delivery record.');
  renderRoute();
}
window.confirmDelivery = confirmDelivery;

function skipPhoto() {
  if (!confirm('Skipping photo proof is not recommended. Your admin will be notified. Continue?')) return;
  if (!_photoOrderId) return;
  const order = Orders.getById(_photoOrderId);
  if (!order) return;

  const now = new Date().toISOString();
  Orders.updateStatus(_photoOrderId, 'delivered');
  Store.updateItem(WB.KEYS.orders, _photoOrderId, {
    deliveryPhoto:  null,
    noPhotoFlag:    true,
    completedBy:    currentDriver ? currentDriver.name : 'Driver',
    completedAt:    now,
  });

  if (currentDriver) {
    Store.updateItem(WB.KEYS.drivers, currentDriver.id, {
      deliveriesToday: (currentDriver.deliveriesToday || 0) + 1,
      deliveriesTotal: (currentDriver.deliveriesTotal || 0) + 1,
    });
    currentDriver = Store.findById(WB.KEYS.drivers, currentDriver.id);
  }

  Notifs.push(order.customerId, 'order_update', 'Order Delivered! ✓', 'Your water has been delivered.', _photoOrderId);

  closeCameraFlow();
  Toast.warning('Delivery confirmed (no photo)', 'Admin has been notified.');
  renderRoute();
}
window.skipPhoto = skipPhoto;

// ============================================================
// VIEW DELIVERY PHOTO (driver side — in stop-detail-modal)
// ============================================================
function viewDeliveryPhoto(orderId) {
  const order = Orders.getById(orderId);
  if (!order) return;

  const titleEl = document.getElementById('stop-modal-title');
  if (titleEl) titleEl.textContent = 'Delivery Proof';

  const body = document.getElementById('stop-detail-body');
  if (!body) return;

  const ts = order.completedAt
    ? new Date(order.completedAt).toLocaleString('en-US', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit', hour12:true })
    : '—';

  body.innerHTML = `
    ${order.deliveryPhoto
      ? `<img src="${order.deliveryPhoto}" style="width:100%;border-radius:var(--radius-md);margin-bottom:14px" />`
      : `<div style="height:120px;background:var(--blue-card);border-radius:var(--radius-md);display:flex;align-items:center;justify-content:center;color:var(--white-40);font-size:.875rem;margin-bottom:14px">No photo</div>`}
    <div class="bottle-return-row"><span class="bottle-return-label">Location</span><span class="fw-600">${order.deliveryLocation || '—'}</span></div>
    <div class="bottle-return-row"><span class="bottle-return-label">Driver</span><span class="fw-600">${order.completedBy || '—'}</span></div>
    <div class="bottle-return-row"><span class="bottle-return-label">Time</span><span class="fw-600">${ts}</span></div>
    <div class="bottle-return-row"><span class="bottle-return-label">Bottles Delivered</span><span class="fw-600">${order.bottlesDelivered ?? '—'}</span></div>
    <div class="bottle-return-row" style="border-bottom:none"><span class="bottle-return-label">Bottles Picked Up</span><span class="fw-600">${order.bottlesPickedUp ?? '—'}</span></div>
    ${order.deliveryNotes ? `<div style="margin-top:12px;padding:10px;background:var(--blue-card);border:1px solid var(--blue-border);border-radius:var(--radius-sm);font-size:.8125rem;color:var(--white-70)">${order.deliveryNotes}</div>` : ''}
    <button class="btn btn-ghost btn-full" style="margin-top:16px" onclick="Modal.close('stop-detail-modal')">Close</button>
  `;

  Modal.open('stop-detail-modal');
}
window.viewDeliveryPhoto = viewDeliveryPhoto;

// ============================================================
// LEGACY: openCompleteModal — now uses camera flow
// ============================================================
function openCompleteModal(orderId) {
  openCameraFlow(orderId);
}
window.openCompleteModal = openCompleteModal;

// ============================================================
// MAP PAGE (Change 8)
// ============================================================
function renderDrvMap() {
  const stops = Store.getList(WB.KEYS.orders).filter(o =>
    o.status !== 'cancelled' && (!currentDriver || o.driverId === currentDriver?.id)
  );

  const demoStops = [
    { name:'Maria Torres',   address:'5842 Laguna Blvd',      status:'delivered',        mapsQ:'5842+Laguna+Blvd,+Elk+Grove,+CA' },
    { name:'James Nguyen',   address:'4210 Bruceville Rd',     status:'delivered',        mapsQ:'4210+Bruceville+Rd,+Elk+Grove,+CA' },
    { name:'Rachel Patel',   address:'2345 Elk Hills Dr',      status:'out_for_delivery', mapsQ:'2345+Elk+Hills+Dr,+Elk+Grove,+CA' },
    { name:'Brian Martinez', address:'3421 Whitelock Pkwy',    status:'confirmed',        mapsQ:'3421+Whitelock+Pkwy,+Elk+Grove,+CA' },
    { name:'Jessica Wang',   address:'5589 Freeport Blvd',     status:'confirmed',        mapsQ:'5589+Freeport+Blvd,+Elk+Grove,+CA' },
  ];

  const nextStop = demoStops.find(s => s.status === 'out_for_delivery') || demoStops.find(s => s.status === 'confirmed');
  const navBtn = document.getElementById('drv-navigate-btn');
  if (navBtn && nextStop) {
    navBtn.href = 'https://maps.google.com/?q=' + nextStop.mapsQ;
    navBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:20px;height:20px"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg> Navigate to ${nextStop.name}`;
  }

  const listEl = document.getElementById('drv-map-stop-list');
  if (!listEl) return;

  const colorMap = {
    delivered:        '#22C55E',
    out_for_delivery: 'var(--cyan)',
    confirmed:        '#EAB308',
  };
  const labelMap = {
    delivered:        'Completed',
    out_for_delivery: 'Next Stop',
    confirmed:        'Remaining',
  };

  listEl.innerHTML = demoStops.map((stop, i) => {
    const color = colorMap[stop.status] || '#EAB308';
    const label = labelMap[stop.status] || 'Pending';
    const pulse = stop.status === 'out_for_delivery' ? 'animation:pulse 1.5s ease-in-out infinite;' : '';
    return `<div style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--blue-card);border:1px solid var(--blue-border);border-radius:var(--radius-sm)">
      <div style="width:28px;height:28px;border-radius:50%;background:rgba(10,22,40,0.6);border:2px solid ${color};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-family:var(--font-mono);font-size:.75rem;font-weight:700;color:${color}">${i + 1}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:.875rem;font-weight:600;color:var(--white-90)">${stop.name}</div>
        <div style="font-size:.75rem;color:var(--white-40);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${stop.address}</div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <div style="width:8px;height:8px;border-radius:50%;background:${color};${pulse}"></div>
        <span style="font-size:.75rem;font-weight:600;color:${color}">${label}</span>
      </div>
    </div>`;
  }).join('');
}

// ============================================================
// DRIVER MESSAGES
// ============================================================
let drvCurrentThreadId = null;

function renderDrvMessages() {
  const el = document.getElementById('drv-messages-list');
  if (!el || !currentDriver) return;

  const threads = Store.getList(WB.KEYS.messages).filter(t => t.driverId === currentDriver.id);

  if (!threads.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">💬</div><div class="empty-state-title">No messages</div><div class="empty-state-sub">Customer messages during deliveries will appear here.</div></div>`;
    return;
  }

  el.innerHTML = threads.map(thread => {
    const lastMsg  = thread.messages && thread.messages.length ? thread.messages[thread.messages.length - 1] : null;
    const unread   = thread.messages ? thread.messages.filter(m => m.senderRole === 'customer' && !m.readByDriver).length : 0;
    const cust     = Store.findById(WB.KEYS.customers, thread.customerId);
    const custName = cust ? cust.name : 'Customer';
    return `<div style="background:var(--blue-card);border:1px solid var(--blue-border);border-radius:var(--radius-md);padding:14px;cursor:pointer;display:flex;align-items:center;gap:12px" onclick="openDrvChat('${thread.orderId || ''}', '${thread.id}')">
      <div style="width:42px;height:42px;border-radius:50%;background:linear-gradient(135deg,var(--cyan),#0099bb);display:flex;align-items:center;justify-content:center;font-weight:700;color:#000;flex-shrink:0">${custName.charAt(0)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;color:var(--white-90)">${custName}</div>
        <div style="font-size:.8rem;color:var(--white-40);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${lastMsg ? lastMsg.text : 'No messages yet'}</div>
      </div>
      ${unread > 0 ? `<span style="background:var(--cyan);color:#000;border-radius:50%;width:20px;height:20px;font-size:.7rem;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">${unread}</span>` : ''}
    </div>`;
  }).join('');

  updateDrvMsgBadge();
}
window.renderDrvMessages = renderDrvMessages;

function updateDrvMsgBadge() {
  if (!currentDriver) return;
  const threads  = Store.getList(WB.KEYS.messages).filter(t => t.driverId === currentDriver.id);
  const unreadTotal = threads.reduce((sum, t) => {
    return sum + (t.messages ? t.messages.filter(m => m.senderRole === 'customer' && !m.readByDriver).length : 0);
  }, 0);
  const badge = document.getElementById('drv-msg-badge');
  if (badge) {
    if (unreadTotal > 0) {
      badge.textContent = unreadTotal;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
}

function openDrvChat(orderId, threadId) {
  const threads = Store.getList(WB.KEYS.messages);
  let thread = threadId ? threads.find(t => t.id === threadId) : threads.find(t => t.orderId === orderId);

  if (!thread && orderId) {
    const order = Orders.getById(orderId);
    if (!order) return;
    thread = {
      id:         uid('msg_thread'),
      orderId:    orderId,
      customerId: order.customerId,
      driverId:   currentDriver ? currentDriver.id : 'drv_1',
      messages:   [],
      createdAt:  Date.now(),
    };
    Store.push(WB.KEYS.messages, thread);
  }
  if (!thread) return;

  drvCurrentThreadId = thread.id;

  const cust = Store.findById(WB.KEYS.customers, thread.customerId);
  const nameEl = document.getElementById('drv-chat-cust-name');
  if (nameEl) nameEl.textContent = cust ? cust.name : 'Customer';

  const screen = document.getElementById('drv-chat-screen');
  if (screen) screen.classList.add('open');

  renderDrvChatMessages(thread.id);

  // Mark all customer messages as read
  if (thread.messages) {
    thread.messages = thread.messages.map(m => m.senderRole === 'customer' ? { ...m, readByDriver: true } : m);
    Store.updateItem(WB.KEYS.messages, thread.id, { messages: thread.messages });
  }
  updateDrvMsgBadge();
}
window.openDrvChat = openDrvChat;

function closeDrvChat() {
  const screen = document.getElementById('drv-chat-screen');
  if (screen) screen.classList.remove('open');
  drvCurrentThreadId = null;
}
window.closeDrvChat = closeDrvChat;

function renderDrvChatMessages(threadId) {
  const threads = Store.getList(WB.KEYS.messages);
  const thread  = threads.find(t => t.id === threadId);
  const el      = document.getElementById('drv-chat-messages');
  if (!el) return;

  if (!thread || !thread.messages || !thread.messages.length) {
    el.innerHTML = `<div style="text-align:center;color:var(--white-40);font-size:.85rem;padding:20px 0">Start the conversation!</div>`;
    return;
  }

  el.innerHTML = thread.messages.map(msg => {
    const isDriver = msg.senderRole === 'driver';
    const time = msg.sentAt ? new Date(msg.sentAt).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true }) : '';
    return `<div style="display:flex;justify-content:${isDriver ? 'flex-end' : 'flex-start'};margin-bottom:8px">
      <div style="max-width:75%;padding:10px 14px;border-radius:${isDriver ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};background:${isDriver ? 'var(--success)' : '#1e3a4a'};color:${isDriver ? '#000' : 'var(--white-90)'};font-size:.875rem;line-height:1.4">
        ${msg.text}
        <div style="font-size:.65rem;opacity:.6;text-align:right;margin-top:4px">${time}</div>
      </div>
    </div>`;
  }).join('');

  el.scrollTop = el.scrollHeight;
}

function sendDriverMessage() {
  if (!drvCurrentThreadId || !currentDriver) return;
  const input = document.getElementById('drv-chat-input');
  const text  = input ? input.value.trim() : '';
  if (!text) return;

  const threads = Store.getList(WB.KEYS.messages);
  const thread  = threads.find(t => t.id === drvCurrentThreadId);
  if (!thread) return;

  const msg = {
    id:         uid('msg'),
    senderRole: 'driver',
    senderId:   currentDriver.id,
    text:       text,
    sentAt:     Date.now(),
  };

  if (!thread.messages) thread.messages = [];
  thread.messages.push(msg);
  Store.updateItem(WB.KEYS.messages, drvCurrentThreadId, { messages: thread.messages });

  if (input) input.value = '';
  renderDrvChatMessages(drvCurrentThreadId);
}
window.sendDriverMessage = sendDriverMessage;

document.addEventListener('DOMContentLoaded', function () {
  const inp = document.getElementById('drv-chat-input');
  if (inp) {
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendDriverMessage(); }
    });
  }
  updateDrvMsgBadge();
});
