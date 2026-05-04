/* ============================================================
   WATERBOY APP — CUSTOMER APP LOGIC
   ============================================================ */

'use strict';

// ============================================================
// STATE
// ============================================================
let currentUser = null;
let currentCustomer = null;
let currentPage = 'home';
let currentOrdersTab = 'active';
let currentProductFilter = 'all';
let notifPanelOpen = false;
let hydrationGlasses = 0;
let recurringEnabled = false;
let selectedFreq = 'weekly';
const HYDRATION_GOAL = 8;

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
  currentUser = Auth.current();

  if (!currentUser || currentUser.role !== 'customer') {
    showLoginScreen();
  } else {
    loadCustomer(currentUser.id);
    showApp();
  }

  initLogin();
  initNavTabs();
  initNotifPanel();
  initHydration();
  initBackToTop();
  initRecurringToggle();
  loadCartBadge();
});

// ============================================================
// LOGIN
// ============================================================
function initLogin() {
  const form = document.getElementById('login-form');
  const errEl = document.getElementById('login-error');

  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    errEl.textContent = '';

    const cust = Auth.login('customer', email, password);
    if (!cust) {
      errEl.textContent = 'Invalid email or password.';
      return;
    }
    currentUser = Auth.current();
    loadCustomer(cust.id);
    showApp();
  });

  const demoBtn = document.getElementById('demo-login-btn');
  if (demoBtn) {
    demoBtn.addEventListener('click', function () {
      document.getElementById('login-email').value = WB.CREDS.customer.email;
      document.getElementById('login-password').value = WB.CREDS.customer.password;
      form.dispatchEvent(new Event('submit'));
    });
  }
}

function showLoginScreen() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display = 'none';
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'flex';
  navigateTo('home');
  renderHome();
}

function loadCustomer(id) {
  currentCustomer = Store.findById(WB.KEYS.customers, id);
  if (!currentCustomer) return;
  const unread = Notifs.unreadCount(currentCustomer.id);
  const badge = document.getElementById('notif-badge');
  if (badge) { badge.textContent = unread; badge.style.display = unread ? 'flex' : 'none'; }
}

// ============================================================
// NAVIGATION
// ============================================================
function initNavTabs() {
  document.querySelectorAll('.nav-tab[data-page]').forEach(tab => {
    tab.addEventListener('click', function () {
      const page = this.dataset.page;
      navigateTo(page);
    });
  });
}

function navigateTo(page) {
  if (notifPanelOpen) closeNotifPanel();
  currentPage = page;

  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  const activeTab = document.querySelector(`.nav-tab[data-page="${page}"]`);
  if (activeTab) activeTab.classList.add('active');

  document.querySelectorAll('.cust-page').forEach(p => p.classList.remove('active'));
  const pageEl = document.getElementById(`page-${page}`);
  if (pageEl) pageEl.classList.add('active');

  const titleMap = { home:'Home', products:'Products', cart:'Cart', orders:'Orders', bottles:'My Bottles', account:'Account' };
  const headerTitle = document.getElementById('cust-page-title');
  if (headerTitle) headerTitle.textContent = titleMap[page] || '';

  const renderers = {
    home: renderHome,
    products: renderProducts,
    cart: renderCart,
    orders: renderOrders,
    bottles: renderBottles,
    account: renderAccount,
  };
  if (renderers[page]) renderers[page]();
}

// ============================================================
// HOME PAGE
// ============================================================
function renderHome() {
  if (!currentCustomer) return;
  const c = currentCustomer;

  const greetEl = document.getElementById('home-greeting-name');
  const subEl   = document.getElementById('home-greeting-sub');
  if (greetEl) greetEl.textContent = 'Hey, ' + c.name.split(' ')[0] + '!';
  if (subEl)   subEl.textContent = getTimeGreeting();

  renderHydrationCard();
  renderActiveOrderBanner();
  renderReorderCards();
  renderSubscriptionCard();
}

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning 🌅';
  if (h < 17) return 'Good afternoon ☀️';
  return 'Good evening 🌙';
}

function renderHydrationCard() {
  const pct = Math.round((hydrationGlasses / HYDRATION_GOAL) * 100);
  const bar = document.getElementById('hydration-bar');
  const amt = document.getElementById('hydration-amount');
  if (bar) bar.style.width = pct + '%';
  if (amt) amt.innerHTML = `${hydrationGlasses}<span> / ${HYDRATION_GOAL} glasses</span>`;
  document.querySelectorAll('.hydration-glass').forEach((g, i) => {
    g.classList.toggle('filled', i < hydrationGlasses);
    g.innerHTML = i < hydrationGlasses ? '💧' : '○';
  });
}

function initHydration() {
  const stored = parseInt(sessionStorage.getItem('wb_hydration') || '0');
  hydrationGlasses = Math.min(stored, HYDRATION_GOAL);
  renderHydrationCard();

  document.querySelectorAll('.hydration-glass').forEach((g, i) => {
    g.addEventListener('click', function () {
      hydrationGlasses = i + 1 <= hydrationGlasses ? i : i + 1;
      sessionStorage.setItem('wb_hydration', hydrationGlasses);
      renderHydrationCard();
      if (hydrationGlasses >= HYDRATION_GOAL) {
        Toast.success('Goal Reached!', 'You hit your daily hydration goal! 💧');
      }
    });
  });
}

function renderActiveOrderBanner() {
  const banner = document.getElementById('active-order-banner');
  if (!banner || !currentCustomer) return;

  const orders = Orders.getForCustomer(currentCustomer.id);
  const active = orders.find(o => !['delivered','cancelled'].includes(o.status));

  if (!active) { banner.style.display = 'none'; return; }
  banner.style.display = 'block';

  const statusIdx = WB.ORDER_STATUSES.indexOf(active.status);
  const labels = ['Pending','Confirmed','Preparing','On the Way','Delivered'];
  const emojis = ['⏳','✅','📦','🚚','🎉'];

  banner.querySelector('.active-order-status').textContent = emojis[statusIdx] + ' ' + labels[statusIdx];
  banner.querySelector('.active-order-id').textContent = '#' + active.id.slice(-8).toUpperCase();

  const steps = banner.querySelectorAll('.step-dot');
  steps.forEach((s, i) => {
    s.classList.remove('done','active');
    if (i < statusIdx) s.classList.add('done');
    else if (i === statusIdx) s.classList.add('active');
  });

  const etaMap = { pending:'Waiting to be confirmed', confirmed:'Being prepared soon', preparing:'Getting ready for pickup', out_for_delivery:'~30–45 min away', delivered:'Delivered!' };
  const etaEl = banner.querySelector('.active-order-eta');
  if (etaEl) etaEl.textContent = etaMap[active.status] || '';

  banner.onclick = () => navigateTo('orders');
}

function renderReorderCards() {
  const container = document.getElementById('reorder-scroll');
  if (!container || !currentCustomer) return;

  const orders = Orders.getForCustomer(currentCustomer.id).filter(o => o.status === 'delivered');
  const seen = {};
  const items = [];
  orders.forEach(o => o.items.forEach(i => { if (!seen[i.productId]) { seen[i.productId] = true; items.push(i); } }));

  const products = Store.getList(WB.KEYS.products);
  const topItems = items.slice(0, 5);

  container.innerHTML = topItems.map(item => {
    const prod = products.find(p => p.id === item.productId) || {};
    return `
      <div class="reorder-card" onclick="addToCartQuick('${prod.id}')">
        <div class="reorder-icon">${prod.icon || '💧'}</div>
        <div class="reorder-name">${prod.name || 'Product'}</div>
        <div class="reorder-price">${fmtMoney(prod.price || 0)}</div>
        <div class="reorder-btn">+ Add to Cart</div>
      </div>`;
  }).join('');

  if (!topItems.length) container.innerHTML = '<p style="color:var(--white-40);font-size:.875rem;padding:4px">Order something to see your favorites here.</p>';
}

function addToCartQuick(productId) {
  Cart.add(productId, 1);
  loadCartBadge();
  Toast.success('Added to cart!', '');
}

function renderSubscriptionCard() {
  const card = document.getElementById('sub-card');
  if (!card || !currentCustomer) return;

  const c = currentCustomer;
  if (c.subscriptionActive) {
    const products = Store.getList(WB.KEYS.products);
    const prod = products.find(p => p.id === c.subscriptionProduct);
    card.style.display = 'block';
    card.querySelector('.sub-card-title').textContent = (prod ? prod.name : 'Subscription') + ' — ' + capitalize(c.subscriptionFrequency || '');
    card.querySelector('.sub-card-next').textContent = 'Next delivery: this week';
    const pauseBtn = card.querySelector('.sub-pause-btn');
    if (pauseBtn) pauseBtn.textContent = 'Pause';
  } else {
    card.style.display = 'none';
  }
}

// ============================================================
// PRODUCTS PAGE
// ============================================================
function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  const products = Store.getList(WB.KEYS.products).filter(p => p.category === 'delivery');
  const filtered = currentProductFilter === 'all'
    ? products
    : products.filter(p => p.id === currentProductFilter || p.popular);

  const searchTerm = (document.getElementById('product-search')?.value || '').toLowerCase();
  const shown = products.filter(p =>
    (!searchTerm || p.name.toLowerCase().includes(searchTerm)) &&
    (currentProductFilter === 'all' || (currentProductFilter === 'popular' && p.popular) || p.category === currentProductFilter)
  );

  grid.innerHTML = shown.map(p => `
    <div class="product-item">
      <div class="product-item-icon">${p.icon}</div>
      <div class="product-item-body">
        <div class="product-item-name">${p.name}${p.popular ? ' <span class="badge badge-cyan" style="font-size:.65rem;padding:2px 7px">Popular</span>' : ''}</div>
        <div class="product-item-desc">${p.description}</div>
        <div class="product-item-price">${fmtMoney(p.price)} <span style="color:var(--white-40);font-size:.75rem">${p.unit}</span></div>
      </div>
      <div class="product-item-actions">
        <button class="product-add-btn" onclick="addToCartQuick('${p.id}')" aria-label="Add ${p.name}">+</button>
      </div>
    </div>`).join('');

  if (!shown.length) grid.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></div><div class="empty-state-title">No products found</div></div>`;

  initProductSearch();
}

function initProductSearch() {
  const input = document.getElementById('product-search');
  if (!input || input.dataset.init) return;
  input.dataset.init = '1';
  input.addEventListener('input', renderProducts);
}

document.querySelectorAll && document.addEventListener('click', function (e) {
  const filterBtn = e.target.closest('.chip[data-filter]');
  if (!filterBtn) return;
  document.querySelectorAll('.chip[data-filter]').forEach(c => c.classList.remove('active'));
  filterBtn.classList.add('active');
  currentProductFilter = filterBtn.dataset.filter;
  renderProducts();
});

// ============================================================
// CART PAGE
// ============================================================
function renderCart() {
  const listEl  = document.getElementById('cart-list');
  const emptyEl = document.getElementById('cart-empty');
  const summEl  = document.getElementById('cart-summary');
  if (!listEl) return;

  const items = Cart.get();
  const settings = Store.get(WB.KEYS.settings) || SEED.settings;
  const subtotal  = Cart.total();
  const delivery  = subtotal >= settings.freeDeliveryThreshold ? 0 : settings.deliveryFee;
  const promoCode = document.getElementById('promo-input')?.value?.trim().toUpperCase();
  let discount    = 0;
  let promoResult = null;

  if (promoCode) {
    promoResult = validatePromo(promoCode, subtotal);
    if (promoResult.ok) discount = promoResult.discount;
  }

  const total = subtotal + delivery - discount;

  const recurSect = document.getElementById('recurring-section');
  if (!items.length) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'flex';
    if (summEl)  summEl.style.display = 'none';
    if (recurSect) recurSect.style.display = 'none';
    return;
  }
  if (recurSect) recurSect.style.display = 'block';

  if (emptyEl) emptyEl.style.display = 'none';
  if (summEl)  summEl.style.display = 'block';

  const products = Store.getList(WB.KEYS.products);
  listEl.innerHTML = items.map(item => {
    const prod = products.find(p => p.id === item.productId) || {};
    return `
      <div class="cart-item">
        <div class="cart-item-icon">${prod.icon || '💧'}</div>
        <div class="cart-item-body">
          <div class="cart-item-name">${item.productName}</div>
          <div class="cart-item-unit">${fmtMoney(item.price)} each</div>
          <div class="cart-item-price">${fmtMoney(item.price * item.qty)}</div>
        </div>
        <div class="qty-stepper">
          <button class="qty-btn" onclick="changeCartQty('${item.productId}', ${item.qty - 1})">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" onclick="changeCartQty('${item.productId}', ${item.qty + 1})">+</button>
        </div>
      </div>`;
  }).join('');

  // Summary
  const rows = document.getElementById('cart-summary-rows');
  if (rows) {
    rows.innerHTML = `
      <div class="cart-summary-row"><span>Subtotal</span><span>${fmtMoney(subtotal)}</span></div>
      <div class="cart-summary-row"><span>Delivery</span><span>${delivery === 0 ? '<span style="color:var(--success)">FREE</span>' : fmtMoney(delivery)}</span></div>
      ${discount ? `<div class="cart-summary-row discount"><span>Promo (${promoCode})</span><span>-${fmtMoney(discount)}</span></div>` : ''}
      <div class="cart-summary-row total"><span>Total</span><span>${fmtMoney(total)}</span></div>`;
  }

  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) checkoutBtn.disabled = false;

  loadCartBadge();
}

function changeCartQty(productId, qty) {
  Cart.setQty(productId, qty);
  renderCart();
}

function loadCartBadge() {
  const count = Cart.count();
  const badge = document.getElementById('cart-badge');
  if (badge) { badge.textContent = count; badge.style.display = count ? 'flex' : 'none'; }
}

document.addEventListener('DOMContentLoaded', function () {
  // Promo input
  const applyBtn = document.getElementById('apply-promo-btn');
  if (applyBtn) {
    applyBtn.addEventListener('click', function () {
      const code = document.getElementById('promo-input')?.value?.trim();
      if (!code) return;
      const items = Cart.get();
      const subtotal = Cart.total();
      const result = validatePromo(code, subtotal);
      if (result.ok) { Toast.success('Promo Applied!', result.promo.desc); renderCart(); }
      else            { Toast.error('Promo Error', result.msg); }
    });
  }

  // Checkout
  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', placeOrder);
  }
});

function placeOrder() {
  if (!currentCustomer) return;
  const items = Cart.get();
  if (!items.length) { Toast.warning('Cart Empty', 'Add items before checking out.'); return; }

  const promoCode = document.getElementById('promo-input')?.value?.trim().toUpperCase() || null;
  const btn = document.getElementById('checkout-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Placing Order…'; }

  setTimeout(() => {
    const order = Orders.create(currentCustomer.id, items, promoCode);
    if (!order) { Toast.error('Error', 'Could not place order.'); if (btn) { btn.disabled = false; btn.textContent = 'Place Order'; } return; }

    // Save recurring subscription if enabled
    if (recurringEnabled) {
      const customDays = selectedFreq === 'custom'
        ? parseInt(document.getElementById('recurring-custom-days')?.value) || 7
        : null;
      const firstProduct = items[0]?.productId || null;
      Store.updateItem(WB.KEYS.customers, currentCustomer.id, {
        subscriptionActive: true,
        subscriptionProduct: firstProduct,
        subscriptionFrequency: selectedFreq,
        subscriptionCustomDays: customDays,
      });
      Notifs.push(currentCustomer.id, 'subscription', 'Recurring Delivery Set!',
        `Your ${selectedFreq} delivery has been scheduled.`);
    }

    Cart.clear();
    currentCustomer = Store.findById(WB.KEYS.customers, currentCustomer.id);
    Notifs.push(currentCustomer.id, 'order_update', 'Order Received!', 'Your order has been placed and is pending confirmation.', order.id);

    const msg = recurringEnabled
      ? 'Order placed & recurring delivery scheduled!'
      : 'We\'ll confirm your order shortly.';
    Toast.success('Order Placed!', msg);
    if (btn) { btn.disabled = false; btn.textContent = 'Place Order'; }
    loadCartBadge();
    navigateTo('orders');
  }, 800);
}

// ============================================================
// ORDERS PAGE
// ============================================================
function renderOrders() {
  if (!currentCustomer) return;
  const all = Orders.getForCustomer(currentCustomer.id);
  const active = all.filter(o => !['delivered','cancelled'].includes(o.status));
  const past   = all.filter(o =>  ['delivered','cancelled'].includes(o.status));

  const listEl = document.getElementById('orders-list');
  if (!listEl) return;

  const showing = currentOrdersTab === 'active' ? active : past;

  // Tab counts
  const tabActive = document.getElementById('tab-active-count');
  const tabPast   = document.getElementById('tab-past-count');
  if (tabActive) tabActive.textContent = active.length ? ` (${active.length})` : '';
  if (tabPast)   tabPast.textContent   = past.length   ? ` (${past.length})` : '';

  if (!showing.length) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/></svg></div><div class="empty-state-title">${currentOrdersTab === 'active' ? 'No active orders' : 'No past orders'}</div><div class="empty-state-sub">${currentOrdersTab === 'active' ? 'Place an order to see it here.' : 'Completed orders will appear here.'}</div></div>`;
    return;
  }

  listEl.innerHTML = showing.map(order => {
    const itemStr = order.items.map(i => `${i.qty}× ${i.productName}`).join(', ');
    return `
      <div class="order-card" onclick="openOrderDetail('${order.id}')">
        <div class="order-card-head">
          <span class="order-card-id">#${order.id.slice(-8).toUpperCase()}</span>
          <span class="badge ${Orders.statusBadgeClass(order.status)}">${Orders.statusLabel(order.status)}</span>
        </div>
        <div class="order-card-items">${itemStr}</div>
        <div class="order-card-foot">
          <span class="order-card-total">${fmtMoney(order.total)}</span>
          <span class="order-card-date">${fmtDate(order.createdAt)}</span>
        </div>
      </div>`;
  }).join('');
}

function openOrderDetail(orderId) {
  const order = Orders.getById(orderId);
  if (!order) return;
  const overlay = document.getElementById('order-detail-modal');
  if (!overlay) return;

  const itemStr = order.items.map(i => `${i.qty}× ${i.productName} — ${fmtMoney(i.price * i.qty)}`).join('<br>');
  overlay.querySelector('.order-detail-body').innerHTML = `
    <div style="margin-bottom:14px">
      <div class="d-flex justify-between items-center">
        <span class="text-sm text-muted">Order ID</span>
        <span class="mono text-xs" style="color:var(--cyan)">#${order.id.slice(-8).toUpperCase()}</span>
      </div>
      <div class="d-flex justify-between items-center mt-8">
        <span class="text-sm text-muted">Status</span>
        <span class="badge ${Orders.statusBadgeClass(order.status)}">${Orders.statusLabel(order.status)}</span>
      </div>
      <div class="d-flex justify-between items-center mt-8">
        <span class="text-sm text-muted">Placed</span>
        <span class="text-sm">${fmtDateTime(order.createdAt)}</span>
      </div>
    </div>
    <div class="divider"></div>
    <div class="text-sm text-muted mb-8">Items</div>
    <div style="font-size:.875rem;color:var(--white-90);line-height:2">${itemStr}</div>
    <div class="divider"></div>
    <div class="cart-summary-row"><span>Subtotal</span><span>${fmtMoney(order.subtotal)}</span></div>
    <div class="cart-summary-row"><span>Delivery</span><span>${fmtMoney(order.deliveryFee)}</span></div>
    ${order.discount ? `<div class="cart-summary-row discount"><span>Discount</span><span>-${fmtMoney(order.discount)}</span></div>` : ''}
    <div class="cart-summary-row total"><span>Total</span><span>${fmtMoney(order.total)}</span></div>
    ${order.status === 'delivered' && !order.rating ? `<button class="btn btn-secondary btn-full mt-16" onclick="rateOrder('${order.id}', 5)">⭐ Rate this delivery</button>` : ''}`;

  Modal.open('order-detail-modal');
}

window.openOrderDetail = openOrderDetail;

function rateOrder(orderId, rating) {
  Store.updateItem(WB.KEYS.orders, orderId, { rating });
  Toast.success('Thanks!', 'Your rating has been saved.');
  Modal.close('order-detail-modal');
}
window.rateOrder = rateOrder;

document.addEventListener('DOMContentLoaded', function () {
  document.querySelectorAll('.orders-tab').forEach(tab => {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.orders-tab').forEach(t => t.classList.remove('active'));
      this.classList.add('active');
      currentOrdersTab = this.dataset.tab;
      renderOrders();
    });
  });
  Modal.init('order-detail-modal');
});

// ============================================================
// NOTIFICATIONS
// ============================================================
function initNotifPanel() {
  const notifBtn = document.getElementById('notif-btn');
  const closeBtn = document.getElementById('notif-close-btn');
  if (notifBtn) notifBtn.addEventListener('click', toggleNotifPanel);
  if (closeBtn) closeBtn.addEventListener('click', closeNotifPanel);
}

function toggleNotifPanel() {
  notifPanelOpen ? closeNotifPanel() : openNotifPanel();
}

function openNotifPanel() {
  notifPanelOpen = true;
  const panel = document.getElementById('notif-panel');
  if (panel) { panel.classList.add('open'); renderNotifList(); }
}

function closeNotifPanel() {
  notifPanelOpen = false;
  const panel = document.getElementById('notif-panel');
  if (panel) panel.classList.remove('open');
}

function renderNotifList() {
  if (!currentCustomer) return;
  const list = document.getElementById('notif-list');
  if (!list) return;

  const notifs = Notifs.getForUser(currentCustomer.id);
  if (!notifs.length) {
    list.innerHTML = '<div class="empty-state"><div class="empty-state-title">No notifications</div></div>';
    return;
  }

  list.innerHTML = notifs.map(n => `
    <div class="notif-item ${n.read ? '' : 'unread'}" onclick="markNotifRead('${n.id}')">
      <div class="notif-dot ${n.read ? 'read' : ''}"></div>
      <div class="flex-1">
        <div class="notif-item-title">${n.title}</div>
        <div class="notif-item-body">${n.body}</div>
        <div class="notif-item-time">${timeAgo(n.createdAt)}</div>
      </div>
    </div>`).join('');
}

function markNotifRead(id) {
  Notifs.markRead(id);
  renderNotifList();
  loadCustomer(currentCustomer.id);
}
window.markNotifRead = markNotifRead;

document.addEventListener('DOMContentLoaded', function () {
  const markAllBtn = document.getElementById('mark-all-read-btn');
  if (markAllBtn) {
    markAllBtn.addEventListener('click', function () {
      if (currentCustomer) {
        Notifs.markAllRead(currentCustomer.id);
        renderNotifList();
        loadCustomer(currentCustomer.id);
      }
    });
  }
});

// ============================================================
// ACCOUNT PAGE
// ============================================================
function renderAccount() {
  if (!currentCustomer) return;
  const c = currentCustomer;

  const nameEl   = document.getElementById('account-name');
  const emailEl  = document.getElementById('account-email');
  const avatarEl = document.getElementById('account-avatar-text');
  const ptsEl    = document.getElementById('loyalty-pts');

  if (nameEl)   nameEl.textContent   = c.name;
  if (emailEl)  emailEl.textContent  = c.email;
  if (avatarEl) avatarEl.textContent = getInitials(c.name);
  if (ptsEl)    ptsEl.textContent    = c.loyaltyPts.toLocaleString() + ' pts';

  document.addEventListener('DOMContentLoaded', function () {}, { once: true });
}

document.addEventListener('DOMContentLoaded', function () {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', function () {
      Auth.logout();
      Cart.clear();
      currentUser = null;
      currentCustomer = null;
      showLoginScreen();
      Toast.info('Signed out', '');
    });
  }
});

// ============================================================
// BACK TO TOP
// ============================================================
function initBackToTop() {
  const btn = document.getElementById('back-to-top');
  if (!btn) return;
  const main = document.querySelector('.cust-main');
  if (!main) return;
  main.addEventListener('scroll', () => { btn.style.display = main.scrollTop > 400 ? 'flex' : 'none'; }, { passive: true });
  btn.addEventListener('click', () => main.scrollTo({ top: 0, behavior: 'smooth' }));
}

// ============================================================
// UTILITIES
// ============================================================
function getInitials(name) {
  return (name || '').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();
}

function capitalize(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const min  = Math.floor(diff / 60000);
  const hr   = Math.floor(min / 60);
  const day  = Math.floor(hr / 24);
  if (min < 1)   return 'Just now';
  if (min < 60)  return min + 'm ago';
  if (hr  < 24)  return hr  + 'h ago';
  if (day < 7)   return day + 'd ago';
  return fmtDate(ts);
}

// ============================================================
// RECURRING DELIVERY
// ============================================================
function initRecurringToggle() {
  const toggle = document.getElementById('recurring-toggle');
  if (!toggle) return;
  toggle.addEventListener('click', function () {
    recurringEnabled = !recurringEnabled;
    this.classList.toggle('on', recurringEnabled);
    const opts = document.getElementById('recurring-options');
    if (opts) opts.style.display = recurringEnabled ? 'block' : 'none';
  });
}

function selectFrequency(btn, freq) {
  selectedFreq = freq;
  document.querySelectorAll('#recurring-options button[data-freq]').forEach(b => {
    b.className = b === btn ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
  });
  const customWrap = document.getElementById('custom-days-wrap');
  if (customWrap) customWrap.style.display = freq === 'custom' ? 'block' : 'none';
}
window.selectFrequency = selectFrequency;

// ============================================================
// BOTTLES PAGE
// ============================================================
function renderBottles() {
  if (!currentCustomer) return;

  const countEl = document.getElementById('bottles-count');
  if (countEl) countEl.textContent = currentCustomer.bottles || 0;

  const listEl = document.getElementById('pickups-list');
  if (!listEl) return;

  const pickups = Store.getList(WB.KEYS.pickups)
    .filter(p => p.customerId === currentCustomer.id)
    .sort((a, b) => a.date - b.date);

  if (!pickups.length) {
    listEl.innerHTML = `<div class="empty-state" style="margin-top:8px">
      <div class="empty-state-title">No pickups scheduled</div>
      <div class="empty-state-sub">Schedule a pickup to return empty bottles.</div>
    </div>`;
    return;
  }

  listEl.innerHTML = pickups.map(p => {
    const dateStr = new Date(p.date).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
    const isPast = p.date < Date.now();
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--white-04);border:1px solid var(--blue-border);border-radius:var(--radius-md);margin-bottom:10px">
      <div>
        <div style="font-weight:600;font-size:.9375rem">${dateStr}</div>
        <div style="font-size:.8125rem;color:var(--white-40);margin-top:2px">${p.count} bottle${p.count > 1 ? 's' : ''} · ${p.notes || 'No notes'}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="badge ${isPast ? 'badge-ghost' : 'badge-cyan'}">${isPast ? 'Past' : 'Upcoming'}</span>
        ${!isPast ? `<button class="btn-icon" onclick="cancelPickup('${p.id}')" title="Cancel" style="color:var(--danger)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:16px;height:16px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function openPickupModal() {
  const dateInput = document.getElementById('pickup-date');
  if (dateInput) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.min = tomorrow.toISOString().split('T')[0];
    dateInput.value = tomorrow.toISOString().split('T')[0];
  }
  const countInput = document.getElementById('pickup-count');
  if (countInput && currentCustomer) countInput.value = Math.min(currentCustomer.bottles || 1, 20);
  const notesInput = document.getElementById('pickup-notes');
  if (notesInput) notesInput.value = '';
  Modal.open('pickup-modal');
}
window.openPickupModal = openPickupModal;

function savePickup() {
  const dateVal  = document.getElementById('pickup-date')?.value;
  const countVal = parseInt(document.getElementById('pickup-count')?.value) || 0;
  const notes    = document.getElementById('pickup-notes')?.value?.trim() || '';

  if (!dateVal) { Toast.warning('Missing Date', 'Please select a pickup date.'); return; }
  if (countVal < 1) { Toast.warning('Invalid Count', 'Enter at least 1 bottle.'); return; }

  const pickup = {
    id: uid('pkp_'),
    customerId: currentCustomer.id,
    date: new Date(dateVal + 'T12:00:00').getTime(),
    count: countVal,
    notes,
    status: 'scheduled',
    createdAt: Date.now(),
  };

  Store.push(WB.KEYS.pickups, pickup);
  Notifs.push(currentCustomer.id, 'subscription', 'Pickup Scheduled!',
    `Your bottle pickup on ${new Date(pickup.date).toLocaleDateString('en-US', { month:'short', day:'numeric' })} is confirmed.`);

  Modal.close('pickup-modal');
  Toast.success('Pickup Scheduled!', `${countVal} bottle${countVal > 1 ? 's' : ''} on ${new Date(pickup.date).toLocaleDateString('en-US', { month:'short', day:'numeric' })}.`);
  renderBottles();
}
window.savePickup = savePickup;

function cancelPickup(pickupId) {
  Store.removeItem(WB.KEYS.pickups, pickupId);
  Toast.info('Cancelled', 'Pickup has been removed.');
  renderBottles();
}
window.cancelPickup = cancelPickup;

document.addEventListener('DOMContentLoaded', function () {
  Modal.init('pickup-modal');
});

// Expose globals needed by inline onclick handlers
window.addToCartQuick   = addToCartQuick;
window.changeCartQty    = changeCartQty;
