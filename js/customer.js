/* ============================================================
   WATERBOY APP — CUSTOMER APP LOGIC
   ============================================================ */

'use strict';

// ============================================================
// STATE
// ============================================================
let currentUser        = null;
let currentCustomer    = null;
let currentPage        = 'home';
let currentOrdersTab   = 'active';
let currentProductFilter   = 'all';
let currentProductCategory = null;
let notifPanelOpen     = false;
let hydrationGlasses   = 0;
let recurringEnabled   = false;
let selectedFreq       = 'weekly';
let currentDetailProductId = null;
let currentDetailQty   = 1;
let atcProductId       = null;
let atcQty             = 1;
let coStep             = 1;
let coOrderType        = 'onetime';
let coFreq             = 'weekly';
let coSelectedDate     = null;
let coSelectedSlot     = null;
let applePayActive     = false;

const HYDRATION_GOAL = 8;
const DEPOSIT_PER_BOTTLE = 200; // $2.00 in cents

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', function () {
  currentUser = Auth.current();
  loadTheme();

  if (!currentUser || currentUser.role !== 'customer') {
    showLoginScreen();
  } else {
    loadCustomer(currentUser.id);
    showApp();
  }

  initLogin();
  initSignup();
  initNavTabs();
  initNotifPanel();
  initHydration();
  initBackToTop();
  initRecurringToggle();
  initCartPage();
  initCheckoutFlow();
  initModals();
  loadCartBadge();
});

// ============================================================
// THEME
// ============================================================
function loadTheme() {
  const pref = localStorage.getItem('wb_theme');
  if (pref === 'light') {
    document.body.classList.add('light-mode');
  } else {
    document.body.classList.remove('light-mode');
  }
  const toggle = document.getElementById('dark-mode-toggle');
  if (toggle) toggle.checked = pref !== 'light';
}

function toggleDarkMode(cb) {
  if (cb.checked) {
    document.body.classList.remove('light-mode');
    localStorage.setItem('wb_theme', 'dark');
  } else {
    document.body.classList.add('light-mode');
    localStorage.setItem('wb_theme', 'light');
  }
}
window.toggleDarkMode = toggleDarkMode;

// ============================================================
// LOGIN
// ============================================================
function initLogin() {
  const form    = document.getElementById('login-form');
  const errEl   = document.getElementById('login-error');
  const demoBtn = document.getElementById('demo-login-btn');
  const gotoSignup = document.getElementById('goto-signup-btn');

  if (gotoSignup) gotoSignup.addEventListener('click', function (e) { e.preventDefault(); showSignupScreen(); });

  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    errEl.textContent = '';
    const cust = Auth.login('customer', email, password);
    if (!cust) { errEl.textContent = 'Invalid email or password.'; return; }
    currentUser = Auth.current();
    loadCustomer(cust.id);
    showApp();
  });

  if (demoBtn) {
    demoBtn.addEventListener('click', function () {
      document.getElementById('login-email').value = WB.CREDS.customer.email;
      document.getElementById('login-password').value = WB.CREDS.customer.password;
      form.dispatchEvent(new Event('submit'));
    });
  }
}

function showLoginScreen() {
  document.getElementById('login-screen').style.display  = 'flex';
  document.getElementById('signup-screen').style.display = 'none';
  document.getElementById('app-screen').style.display    = 'none';
}

function showSignupScreen() {
  document.getElementById('login-screen').style.display  = 'none';
  document.getElementById('signup-screen').style.display = 'block';
  document.getElementById('app-screen').style.display    = 'none';
}

function showApp() {
  document.getElementById('login-screen').style.display  = 'none';
  document.getElementById('signup-screen').style.display = 'none';
  document.getElementById('app-screen').style.display    = 'flex';
  seedDemoNotifications();
  checkNotifPermission();
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
// SIGNUP
// ============================================================
function initSignup() {
  const backBtn = document.getElementById('back-to-login-btn');
  if (backBtn) backBtn.addEventListener('click', showLoginScreen);

  const form = document.getElementById('signup-form');
  if (!form) return;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    handleSignup();
  });

  const zipInput = document.getElementById('su-zip');
  if (zipInput) {
    zipInput.addEventListener('input', function () {
      const zip = this.value.trim();
      const feedback = document.getElementById('su-zone-feedback');
      if (!feedback) return;
      if (zip.length === 5) {
        const z = getZoneForZip(zip);
        feedback.textContent = z.label;
        feedback.style.color = z.outside ? 'var(--danger)' : z.fee === 0 ? 'var(--success)' : 'var(--cyan)';
        feedback.style.display = 'block';
      } else {
        feedback.style.display = 'none';
      }
    });
  }
}

function handleSignup() {
  const errEl = document.getElementById('signup-error');
  errEl.textContent = '';

  const name     = document.getElementById('su-name').value.trim();
  const email    = document.getElementById('su-email').value.trim();
  const phone    = document.getElementById('su-phone').value.trim();
  const password = document.getElementById('su-password').value;
  const street   = document.getElementById('su-street').value.trim();
  const city     = document.getElementById('su-city').value.trim();
  const state    = document.getElementById('su-state').value.trim();
  const zip      = document.getElementById('su-zip').value.trim();
  const gate     = document.getElementById('su-gate').value.trim();
  const notes    = document.getElementById('su-notes').value.trim();
  const location = document.getElementById('su-location').value;

  if (!name || !email || !phone || !password || !street || !city || !state || !zip || !location) {
    errEl.textContent = 'Please fill in all required fields.';
    return;
  }
  if (password.length < 6) { errEl.textContent = 'Password must be at least 6 characters.'; return; }
  if (!/^\d{5}$/.test(zip)) { errEl.textContent = 'Please enter a valid 5-digit ZIP code.'; return; }

  const existing = Store.getList(WB.KEYS.customers).find(c => c.email === email);
  if (existing) { errEl.textContent = 'An account with that email already exists.'; return; }

  const zoneInfo = getZoneForZip(zip);
  if (zoneInfo.outside) {
    errEl.textContent = 'Sorry, your ZIP code is outside our delivery area. Call us at (916) 619-3218.';
    return;
  }

  const newCust = {
    id: uid('cust_'),
    name, email, phone: phone || '', password,
    address: street, city, zip, state,
    gateCode: gate, deliveryNotes: notes, deliveryLocation: location,
    zone: zoneInfo.zone || 'zone_1', bottles: 0,
    joinedAt: Date.now(), loyaltyPts: 0,
    subscriptionActive: false, subscriptionProduct: null, subscriptionFrequency: null,
    referralCode: name.slice(0,4).toUpperCase() + '-' + Math.random().toString(36).slice(2,6).toUpperCase(),
    totalOrders: 0, totalSpent: 0,
  };

  Store.push(WB.KEYS.customers, newCust);
  Auth.login('customer', email, password);
  currentUser = Auth.current();
  loadCustomer(newCust.id);
  Toast.success('Account Created!', 'Welcome to Waterboy Delivery!');
  showApp();
}

// ============================================================
// NAVIGATION
// ============================================================
function initNavTabs() {
  document.querySelectorAll('.nav-tab[data-page]').forEach(tab => {
    tab.addEventListener('click', function () {
      navigateTo(this.dataset.page);
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

  const titleMap = {
    home: 'Home', products: 'Products', cart: 'Cart',
    orders: 'Orders', bottles: 'My Bottles', account: 'Account',
    rentals: 'Rent a Dispenser',
  };
  const headerTitle = document.getElementById('cust-page-title');
  if (headerTitle) headerTitle.textContent = titleMap[page] || '';

  const renderers = {
    home: renderHome, products: renderProducts, cart: renderCart,
    orders: renderOrders, bottles: renderBottles, account: renderAccount,
    rentals: renderRentals,
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
  if (subEl)   subEl.textContent   = getTimeGreeting();

  updateWeatherChip();
  renderHydrationCard();
  renderActiveOrderBanner();
  renderReorderCards();
  renderSubscriptionCard();
  renderComparisonCard();
  renderZoneChip();
}

function renderZoneChip() {
  const el = document.getElementById('home-zone-chip');
  if (!el || !currentCustomer) return;
  const z = getZoneForZip(currentCustomer.zip || '');
  if (z.outside) {
    el.textContent = '⚠️ Outside area';
    el.style.color = 'var(--danger)';
  } else if (z.fee === 0) {
    el.textContent = '✓ Free delivery';
    el.style.color = 'var(--success)';
  } else {
    el.textContent = z.fee === 499 ? '📦 $4.99 delivery' : '📦 $9.99 delivery';
    el.style.color = 'var(--cyan)';
  }
}

function renderComparisonCard() {
  const el = document.getElementById('why-waterboy-card');
  if (!el) return;
  el.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div style="font-weight:700;font-size:.9375rem;color:var(--white-90)">Why Waterboy?</div>
      <span style="font-size:.75rem;color:var(--cyan);cursor:pointer" onclick="toggleComparisonDetail()">View details ›</span>
    </div>
    <div style="display:grid;grid-template-columns:auto 1fr 1fr 1fr;gap:8px;font-size:.75rem;margin-bottom:8px">
      <span style="color:var(--white-40)">Jugs</span><span style="color:var(--cyan);font-weight:700">Us</span><span style="color:var(--white-40)">Water.com</span><span style="color:var(--success);font-weight:700">Save</span>
      <span>2</span><span style="color:var(--cyan);font-weight:700">$21</span><span style="color:var(--white-40)">$46.96</span><span style="color:var(--success)">$25.96</span>
      <span>4</span><span style="color:var(--cyan);font-weight:700">$42</span><span style="color:var(--white-40)">$48.95</span><span style="color:var(--success)">$6.95</span>
      <span>6</span><span style="color:var(--cyan);font-weight:700">$57</span><span style="color:var(--white-40)">$65.93</span><span style="color:var(--success)">$8.93</span>
    </div>
    <div id="comparison-detail" style="display:none;margin-top:4px">
      <div style="display:grid;grid-template-columns:auto 1fr 1fr 1fr;gap:8px;font-size:.75rem;margin-bottom:8px">
        <span>8</span><span style="color:var(--cyan);font-weight:700">$72</span><span style="color:var(--white-40)">$82.91</span><span style="color:var(--success)">$10.91</span>
        <span>12</span><span style="color:var(--cyan);font-weight:700">$95</span><span style="color:var(--white-40)">$116.87</span><span style="color:var(--success)">$21.87</span>
      </div>
    </div>
    <div style="font-size:.6875rem;color:var(--white-30);margin-top:6px">*Water.com: $8.49/jug + $14.99 delivery fee</div>
    <button class="btn btn-primary btn-sm btn-full" style="margin-top:12px" onclick="openSubScreen('acct-subscription')">See Subscription Plans</button>`;
}

function toggleComparisonDetail() {
  const el = document.getElementById('comparison-detail');
  if (!el) return;
  el.style.display = el.style.display === 'none' ? 'block' : 'none';
}
window.toggleComparisonDetail = toggleComparisonDetail;

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning 🌅';
  if (h < 17) return 'Good afternoon ☀️';
  return 'Good evening 🌙';
}

function updateWeatherChip() {
  const chip = document.getElementById('weather-chip');
  if (!chip) return;
  const temp = getCurrentTemp();
  chip.textContent = getWeatherEmoji(temp) + ' ' + temp + '°F';
}

function getCurrentTemp() {
  // Simulated temp for Elk Grove, CA
  const h = new Date().getHours();
  if (h >= 12 && h <= 16) return 94;
  if (h >= 8 && h < 12)   return 82;
  return 71;
}

function getWeatherEmoji(temp) {
  if (temp >= 90) return '🌡️';
  if (temp >= 80) return '☀️';
  if (temp >= 65) return '⛅';
  return '🌤️';
}

function openWeatherModal() {
  const temp = getCurrentTemp();
  document.getElementById('weather-temp-display').textContent = temp + '°F — ' + (temp >= 90 ? 'Very Hot' : temp >= 80 ? 'Sunny' : 'Partly Cloudy');

  // Hydration calc: 64oz base, +20% if >80°F, +40% if >95°F
  let ozBase = 64;
  if (temp > 95) ozBase = Math.round(64 * 1.4);
  else if (temp > 80) ozBase = Math.round(64 * 1.2);

  const glasses = Math.round(ozBase / 8);
  const gallons = (ozBase / 128).toFixed(1);

  document.getElementById('hydro-oz').textContent = ozBase;
  document.getElementById('hydro-bottles').textContent = glasses;
  document.getElementById('hydro-gal').textContent = gallons;

  let tip = '';
  if (temp > 95) tip = '🔥 Extreme heat! Drink water every 20 minutes and avoid outdoor activity between 10am–4pm.';
  else if (temp > 80) tip = '💡 It\'s hot today! Drink an extra glass per hour outdoors. Stay hydrated!';
  else tip = '✅ Mild temps today. Aim for 8 glasses throughout the day.';
  document.getElementById('hydration-tip').textContent = tip;

  Modal.open('weather-modal');
}
window.openWeatherModal = openWeatherModal;

function openZoneModal() {
  Modal.open('zone-modal');
}
window.openZoneModal = openZoneModal;

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
      if (hydrationGlasses >= HYDRATION_GOAL) Toast.success('Goal Reached!', 'You hit your daily hydration goal! 💧');
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
    const imgHtml = prod.image
      ? `<img src="${prod.image}" alt="${prod.name || ''}" style="width:56px;height:56px;object-fit:contain;border-radius:8px;margin-bottom:6px" onerror="this.outerHTML='<div class=reorder-icon>${prod.icon || '💧'}</div>'" />`
      : `<div class="reorder-icon">${prod.icon || '💧'}</div>`;
    const priceDisplay = prod.price !== null ? fmtMoney(prod.price || 0) : 'Inquire';
    return `<div class="reorder-card" onclick="openAddToCartModal('${prod.id}')">
      ${imgHtml}
      <div class="reorder-name">${prod.name || 'Product'}</div>
      <div class="reorder-price">${priceDisplay}</div>
      <div class="reorder-btn">${prod.inquire ? 'Inquire' : '+ Add to Cart'}</div>
    </div>`;
  }).join('');

  if (!topItems.length) container.innerHTML = '<p style="color:var(--white-40);font-size:.875rem;padding:4px">Order something to see your favorites here.</p>';
}

function renderSubscriptionCard() {
  const card     = document.getElementById('sub-card');
  const noneCard = document.getElementById('sub-none-card');
  if (!currentCustomer) return;
  const c = currentCustomer;
  if (c.subscriptionActive) {
    if (card) {
      card.style.display = 'block';
      const titleEl = document.getElementById('sub-card-title');
      const nextEl  = document.getElementById('sub-card-next');
      const allPlans = [...SUBSCRIPTION_PLANS.monthly, ...SUBSCRIPTION_PLANS.alkaline];
      const plan = allPlans.find(p => p.id === c.subscriptionPlanId);
      const planName = plan ? plan.name : (c.subscriptionDesc || 'Subscription');
      const price = plan ? ` — $${(plan.price/100).toFixed(0)}/mo` : '';
      if (titleEl) titleEl.textContent = planName + price;
      if (nextEl)  nextEl.textContent  = 'Next delivery: this week';
    }
    if (noneCard) noneCard.style.display = 'none';
  } else {
    if (card) card.style.display = 'none';
    if (noneCard) noneCard.style.display = 'block';
  }
}

// ============================================================
// PRODUCTS PAGE
// ============================================================
const PRODUCT_CATEGORIES = [
  '5-Gallon Jugs',
  '3-Gallon Jugs',
  'Glass & Personal Bottles',
  'Aluminum Bottles',
  'Water Dispensers',
  'Hydration & Electrolytes',
  'Canned Drinks (16 fl oz)',
  'Energy & Supplements',
];

function renderProducts() {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  const allProducts = Store.getList(WB.KEYS.products).filter(p => p.active !== false);
  const searchTerm = (document.getElementById('product-search')?.value || '').toLowerCase();

  let shown = allProducts.filter(p => {
    if (searchTerm && !p.name.toLowerCase().includes(searchTerm) && !(p.description || '').toLowerCase().includes(searchTerm)) return false;
    if (currentProductFilter === 'popular') return p.popular;
    if (currentProductCategory) return p.category === currentProductCategory;
    return true;
  });

  // Group by category when not searching/filtering
  if (!searchTerm && currentProductFilter === 'all' && !currentProductCategory) {
    let html = '';
    PRODUCT_CATEGORIES.forEach(cat => {
      const catProducts = shown.filter(p => p.category === cat);
      if (!catProducts.length) return;
      html += `<div class="prod-cat-head">${cat}</div>`;
      html += catProducts.map(p => renderProductCard(p)).join('');
    });
    // Any uncategorized
    const uncategorized = shown.filter(p => !PRODUCT_CATEGORIES.includes(p.category));
    if (uncategorized.length) {
      html += '<div class="prod-cat-head">Other</div>';
      html += uncategorized.map(p => renderProductCard(p)).join('');
    }
    grid.innerHTML = html || `<div class="empty-state"><div class="empty-state-title">No products found</div></div>`;
  } else {
    grid.innerHTML = shown.map(p => renderProductCard(p)).join('') ||
      `<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></div><div class="empty-state-title">No products found</div></div>`;
  }

  initProductSearch();
}

function renderProductCard(p) {
  const priceStr = p.price !== null ? '$' + (p.price / 100).toFixed(2) : 'Inquire';
  const imgHtml = p.image
    ? `<img src="${p.image}" alt="${p.name}" class="product-item-img" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="product-item-icon" style="display:none">${p.icon || '💧'}</div>`
    : `<div class="product-item-icon">${p.icon || '💧'}</div>`;
  const actionBtn = p.inquire
    ? `<button class="product-add-btn product-inquire-btn" onclick="event.stopPropagation();openInquireModal('${p.id}')" aria-label="Inquire about ${p.name}" style="font-size:.65rem;padding:0 8px;width:auto;white-space:nowrap">Inquire</button>`
    : `<button class="product-add-btn" onclick="event.stopPropagation();openAddToCartModal('${p.id}')" aria-label="Add ${p.name}">+</button>`;
  return `<div class="product-item" onclick="openProductDetail('${p.id}')">
    <div class="product-item-img-wrap">${imgHtml}</div>
    <div class="product-item-body">
      <div class="product-item-name">${p.name}${p.popular ? ' <span class="badge badge-cyan" style="font-size:.6rem;padding:2px 6px">Popular</span>' : ''}</div>
      <div class="product-item-desc">${p.description}</div>
      <div class="product-item-price" style="color:${p.price !== null ? 'var(--cyan)' : 'var(--white-40)'}">${priceStr} <span style="color:var(--white-40);font-size:.75rem">${p.unit}</span></div>
    </div>
    <div class="product-item-actions">${actionBtn}</div>
  </div>`;
}

function initProductSearch() {
  const input = document.getElementById('product-search');
  if (!input || input.dataset.init) return;
  input.dataset.init = '1';
  input.addEventListener('input', renderProducts);
}

document.addEventListener('click', function (e) {
  const filterBtn = e.target.closest('.chip[data-filter]');
  if (!filterBtn) return;
  document.querySelectorAll('.chip[data-filter]').forEach(c => c.classList.remove('active'));
  filterBtn.classList.add('active');
  currentProductFilter = filterBtn.dataset.filter;
  currentProductCategory = filterBtn.dataset.category || null;
  if (!filterBtn.dataset.category) currentProductCategory = null;
  renderProducts();
});

// Product Detail
function openProductDetail(productId) {
  const prod = Store.findById(WB.KEYS.products, productId);
  if (!prod) return;
  currentDetailProductId = productId;
  currentDetailQty = 1;

  const iconEl = document.getElementById('detail-icon');
  if (iconEl) {
    if (prod.image) {
      iconEl.innerHTML = `<img src="${prod.image}" alt="${prod.name}" style="width:140px;height:140px;object-fit:contain;border-radius:12px" onerror="this.outerHTML='<span style=font-size:4rem>${prod.icon || '💧'}</span>'" />`;
    } else {
      iconEl.textContent = prod.icon || '💧';
    }
  }
  document.getElementById('detail-name').textContent = prod.name;
  const priceEl = document.getElementById('detail-price');
  if (priceEl) priceEl.textContent = prod.price !== null ? fmtMoney(prod.price) : 'Inquire for Pricing';
  document.getElementById('detail-unit').textContent = prod.unit;
  document.getElementById('detail-desc').textContent = prod.description || '';
  document.getElementById('detail-extra').innerHTML = `
    Category: ${prod.category || 'Water'}<br>
    ${prod.popular ? 'Popular item ⭐<br>' : ''}
    BPA-free • pH balanced • Safe for all ages`;
  document.getElementById('detail-qty').textContent = 1;
  const subtotalEl = document.getElementById('detail-subtotal');
  if (subtotalEl) subtotalEl.textContent = prod.price !== null ? fmtMoney(prod.price) : '';

  const addBtn = document.getElementById('detail-add-btn');
  if (addBtn) {
    if (prod.inquire) {
      addBtn.textContent = 'Inquire About This Product';
      addBtn.onclick = () => openInquireModal(productId);
    } else {
      addBtn.textContent = 'Add to Cart';
      addBtn.onclick = addFromDetail;
    }
  }

  document.getElementById('product-list-view').style.display   = 'none';
  document.getElementById('product-detail-view').style.display = 'block';
}
window.openProductDetail = openProductDetail;

function closeProductDetail() {
  document.getElementById('product-list-view').style.display   = 'block';
  document.getElementById('product-detail-view').style.display = 'none';
  currentDetailProductId = null;
}
window.closeProductDetail = closeProductDetail;

function changeDetailQty(delta) {
  currentDetailQty = Math.max(1, currentDetailQty + delta);
  document.getElementById('detail-qty').textContent = currentDetailQty;
  const prod = Store.findById(WB.KEYS.products, currentDetailProductId);
  if (prod) document.getElementById('detail-subtotal').textContent = fmtMoney(prod.price * currentDetailQty);
}
window.changeDetailQty = changeDetailQty;

function addFromDetail() {
  if (!currentDetailProductId) return;
  const prod = Store.findById(WB.KEYS.products, currentDetailProductId);
  if (!prod) return;
  Cart.add(currentDetailProductId, currentDetailQty);
  loadCartBadge();
  showCartToast(prod.name, currentDetailQty);
  closeProductDetail();
}
window.addFromDetail = addFromDetail;

// Inquire Modal
function openInquireModal(productId) {
  const prod = Store.findById(WB.KEYS.products, productId);
  if (!prod) return;
  const nameEl = document.getElementById('inquire-product-name');
  if (nameEl) nameEl.textContent = prod.name;
  Modal.open('inquire-modal');
}
window.openInquireModal = openInquireModal;

// Add-to-Cart Modal
function openAddToCartModal(productId) {
  const prod = Store.findById(WB.KEYS.products, productId);
  if (!prod) return;
  if (prod.inquire) { openInquireModal(productId); return; }
  atcProductId = productId;
  atcQty = 1;

  document.getElementById('atc-product-name').textContent = prod.name;
  const atcIcon = document.getElementById('atc-icon');
  if (atcIcon) {
    if (prod.image) {
      atcIcon.innerHTML = `<img src="${prod.image}" alt="${prod.name}" style="width:80px;height:80px;object-fit:contain;border-radius:8px" onerror="this.outerHTML='${prod.icon || '💧'}'" />`;
    } else {
      atcIcon.textContent = prod.icon || '💧';
    }
  }
  document.getElementById('atc-price').textContent = fmtMoney(prod.price) + ' each';
  document.getElementById('atc-qty').textContent = 1;
  updateAtcButton(prod);
  Modal.open('add-to-cart-modal');
}
window.openAddToCartModal = openAddToCartModal;

function updateAtcButton(prod) {
  if (!prod) prod = Store.findById(WB.KEYS.products, atcProductId);
  if (!prod) return;
  const btn = document.getElementById('atc-confirm-btn');
  if (btn) btn.textContent = `Add to Cart — ${fmtMoney(prod.price * atcQty)}`;
}

function changeAtcQty(delta) {
  atcQty = Math.max(1, atcQty + delta);
  document.getElementById('atc-qty').textContent = atcQty;
  updateAtcButton();
}
window.changeAtcQty = changeAtcQty;

function confirmAddToCart() {
  if (!atcProductId) return;
  const prod = Store.findById(WB.KEYS.products, atcProductId);
  if (!prod) return;
  Cart.add(atcProductId, atcQty);
  loadCartBadge();
  Modal.close('add-to-cart-modal');
  showCartToast(prod.name, atcQty);
}
window.confirmAddToCart = confirmAddToCart;

function showCartToast(name, qty) {
  Toast.success('Added to cart! ✓', `${name} ×${qty}`);
}

// ============================================================
// CART PAGE
// ============================================================
function initCartPage() {
  const applyBtn = document.getElementById('apply-promo-btn');
  if (applyBtn) {
    applyBtn.addEventListener('click', function () {
      const code = document.getElementById('promo-input')?.value?.trim();
      if (!code) return;
      const subtotal = Cart.total();
      const result = validatePromo(code, subtotal);
      if (result.ok) { Toast.success('Promo Applied!', result.promo.desc); renderCart(); }
      else            { Toast.error('Promo Error', result.msg); }
    });
  }

  const checkoutBtn = document.getElementById('checkout-btn');
  if (checkoutBtn) checkoutBtn.addEventListener('click', openCheckoutFlow);
}

function getDeliveryFeeForCustomer() {
  if (!currentCustomer) return 499;
  const zip = currentCustomer.zip || '';
  const zoneInfo = getZoneForZip(zip);
  return zoneInfo.outside ? 0 : zoneInfo.fee;
}

function renderCart() {
  const listEl  = document.getElementById('cart-list');
  const emptyEl = document.getElementById('cart-empty');
  const summEl  = document.getElementById('cart-summary');
  if (!listEl) return;

  const items    = Cart.get();
  const subtotal = Cart.total();
  const delivery = getDeliveryFeeForCustomer();
  const zoneInfo = currentCustomer ? getZoneForZip(currentCustomer.zip || '') : { label:'', outside:false };
  const promoCode = document.getElementById('promo-input')?.value?.trim().toUpperCase();
  let discount = 0;
  if (promoCode) {
    const pr = validatePromo(promoCode, subtotal);
    if (pr.ok) discount = pr.discount;
  }
  const total = subtotal + (zoneInfo.outside ? 0 : delivery) - discount;
  const recurSect = document.getElementById('recurring-section');

  if (!items.length) {
    listEl.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'flex';
    if (summEl)  summEl.style.display  = 'none';
    if (recurSect) recurSect.style.display = 'none';
    const btn = document.getElementById('checkout-btn');
    if (btn) btn.disabled = true;
    return;
  }

  if (emptyEl) emptyEl.style.display = 'none';
  if (summEl)  summEl.style.display  = 'block';
  if (recurSect) recurSect.style.display = 'block';

  const products = Store.getList(WB.KEYS.products);
  listEl.innerHTML = items.map(item => {
    const prod = products.find(p => p.id === item.productId) || {};
    return `<div class="cart-item">
      <div class="cart-item-icon">${prod.icon || '💧'}</div>
      <div class="cart-item-body">
        <div class="cart-item-name">${item.productName}</div>
        <div class="cart-item-unit">${fmtMoney(item.price)} each</div>
        <div class="cart-item-price">${fmtMoney(item.price * item.qty)}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
        <button class="btn-icon" onclick="removeCartItem('${item.productId}')" title="Remove" style="color:var(--danger);width:30px;height:30px;background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.2)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
        <div class="qty-stepper">
          <button class="qty-btn" onclick="changeCartQty('${item.productId}', ${item.qty - 1})">−</button>
          <span class="qty-val">${item.qty}</span>
          <button class="qty-btn" onclick="changeCartQty('${item.productId}', ${item.qty + 1})">+</button>
        </div>
      </div>
    </div>`;
  }).join('');

  const rows = document.getElementById('cart-summary-rows');
  if (rows) {
    const deliveryDisplay = zoneInfo.outside
      ? '<span style="color:var(--danger)">Call us</span>'
      : delivery === 0 ? '<span style="color:var(--success)">FREE</span>' : fmtMoney(delivery);
    const zoneDisplay = zoneInfo.label ? `<div style="font-size:.75rem;color:${zoneInfo.outside ? 'var(--danger)' : delivery === 0 ? 'var(--success)' : 'var(--white-40)'};margin-top:2px">${zoneInfo.label}</div>` : '';
    rows.innerHTML = `
      <div class="cart-summary-row"><span>Subtotal</span><span>${fmtMoney(subtotal)}</span></div>
      <div class="cart-summary-row"><span>Delivery ${zoneDisplay}</span><span>${deliveryDisplay}</span></div>
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
window.changeCartQty = changeCartQty;

function removeCartItem(productId) {
  Cart.remove(productId);
  renderCart();
}
window.removeCartItem = removeCartItem;

function loadCartBadge() {
  const count = Cart.count();
  const badge = document.getElementById('cart-badge');
  if (badge) { badge.textContent = count; badge.style.display = count ? 'flex' : 'none'; }
}

// ============================================================
// ORDERS PAGE
// ============================================================
function renderOrders() {
  if (!currentCustomer) return;
  const all    = Orders.getForCustomer(currentCustomer.id);
  const active = all.filter(o => !['delivered','cancelled'].includes(o.status));
  const past   = all.filter(o =>  ['delivered','cancelled'].includes(o.status));

  const listEl = document.getElementById('orders-list');
  if (!listEl) return;

  document.getElementById('tab-active-count').textContent = active.length ? ` (${active.length})` : '';
  document.getElementById('tab-past-count').textContent   = past.length   ? ` (${past.length})`   : '';

  const showing = currentOrdersTab === 'active' ? active : past;
  if (!showing.length) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-state-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="12" y2="15"/></svg></div><div class="empty-state-title">${currentOrdersTab === 'active' ? 'No active orders' : 'No past orders'}</div><div class="empty-state-sub">${currentOrdersTab === 'active' ? 'Place an order to see it here.' : 'Completed orders will appear here.'}</div></div>`;
    return;
  }

  const activeDriverStatuses = ['driver_assigned','out_for_delivery','preparing'];
  listEl.innerHTML = showing.map(order => {
    const itemStr = order.items.map(i => `${i.qty}× ${i.productName}`).join(', ');
    const hasDriver = activeDriverStatuses.includes(order.status) && order.driverId;
    const contactBtn = hasDriver
      ? `<button class="btn btn-secondary btn-sm" style="margin-top:10px;width:100%;background:rgba(0,212,255,.12);border:1px solid var(--cyan);color:var(--cyan)" onclick="event.stopPropagation();openChatScreen('${order.id}')">💬 Contact Driver</button>`
      : '';
    return `<div class="order-card" onclick="openOrderDetail('${order.id}')">
      <div class="order-card-head">
        <span class="order-card-id">#${order.id.slice(-8).toUpperCase()}</span>
        <span class="badge ${Orders.statusBadgeClass(order.status)}">${Orders.statusLabel(order.status)}</span>
      </div>
      <div class="order-card-items">${itemStr}</div>
      <div class="order-card-foot">
        <span class="order-card-total">${fmtMoney(order.total)}</span>
        <span class="order-card-date">${fmtDate(order.createdAt)}</span>
      </div>
      ${contactBtn}
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
      <div class="d-flex justify-between items-center"><span class="text-sm text-muted">Order ID</span><span class="mono text-xs" style="color:var(--cyan)">#${order.id.slice(-8).toUpperCase()}</span></div>
      <div class="d-flex justify-between items-center mt-8"><span class="text-sm text-muted">Status</span><span class="badge ${Orders.statusBadgeClass(order.status)}">${Orders.statusLabel(order.status)}</span></div>
      <div class="d-flex justify-between items-center mt-8"><span class="text-sm text-muted">Placed</span><span class="text-sm">${fmtDateTime(order.createdAt)}</span></div>
    </div>
    <div class="divider"></div>
    <div class="text-sm text-muted mb-8">Items</div>
    <div style="font-size:.875rem;color:var(--white-90);line-height:2">${itemStr}</div>
    <div class="divider"></div>
    <div class="cart-summary-row"><span>Subtotal</span><span>${fmtMoney(order.subtotal)}</span></div>
    <div class="cart-summary-row"><span>Delivery</span><span>${fmtMoney(order.deliveryFee)}</span></div>
    ${order.discount ? `<div class="cart-summary-row discount"><span>Discount</span><span>-${fmtMoney(order.discount)}</span></div>` : ''}
    <div class="cart-summary-row total"><span>Total</span><span>${fmtMoney(order.total)}</span></div>
    ${order.status === 'delivered' && order.deliveryPhoto ? `
    <div class="divider"></div>
    <div style="font-size:.9rem;font-weight:700;color:var(--success);margin-bottom:8px">Your delivery has been completed! ✓</div>
    <div style="font-size:.8125rem;color:var(--white-50);margin-bottom:10px">Here's where we left your water:</div>
    <img src="${order.deliveryPhoto}" style="width:100%;border-radius:var(--radius-md);margin-bottom:10px;display:block" />
    <div style="font-size:.8125rem;color:var(--white-50);line-height:1.6">
      ${[order.deliveryLocation ? '📍 ' + order.deliveryLocation : '', order.completedBy ? 'Driver: ' + order.completedBy : '', order.completedAt ? new Date(order.completedAt).toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true}) : ''].filter(Boolean).join(' · ')}
    </div>` : ''}
    ${order.status === 'delivered' && !order.rating ? `<button class="btn btn-secondary btn-full mt-16" onclick="rateOrder('${order.id}',5)">⭐ Rate this delivery</button>` : ''}`;

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
});

// ============================================================
// BOTTLES PAGE
// ============================================================
function renderBottles() {
  if (!currentCustomer) return;
  const bottles = currentCustomer.bottles || 0;

  const countEl   = document.getElementById('bottles-count');
  const depositEl = document.getElementById('deposit-balance');
  const returnedEl = document.getElementById('total-returned');

  if (countEl)    countEl.textContent   = bottles;
  if (depositEl)  depositEl.textContent = fmtMoney(bottles * DEPOSIT_PER_BOTTLE);

  // Count returned bottles from pickups
  const pickups = Store.getList(WB.KEYS.pickups).filter(p => p.customerId === currentCustomer.id && p.date < Date.now());
  const totalReturned = pickups.reduce((sum, p) => sum + (p.count || 0), 0);
  if (returnedEl) returnedEl.textContent = totalReturned;

  const listEl = document.getElementById('pickups-list');
  if (!listEl) return;

  const allPickups = Store.getList(WB.KEYS.pickups)
    .filter(p => p.customerId === currentCustomer.id)
    .sort((a, b) => a.date - b.date);

  if (!allPickups.length) {
    listEl.innerHTML = `<div class="empty-state" style="padding:40px 20px"><div class="empty-state-title">No pickups scheduled</div><div class="empty-state-sub">Schedule a pickup to return empty bottles.</div></div>`;
    return;
  }

  listEl.innerHTML = allPickups.map(p => {
    const dateStr = new Date(p.date).toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' });
    const isPast  = p.date < Date.now();
    const depositAmt = fmtMoney((p.count || 0) * DEPOSIT_PER_BOTTLE);
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--white-04);border:1px solid var(--blue-border);border-radius:var(--radius-md);margin-bottom:10px">
      <div>
        <div style="font-weight:600;font-size:.9375rem">${dateStr}</div>
        <div style="font-size:.8125rem;color:var(--white-40);margin-top:2px">${p.count} bottle${p.count > 1 ? 's' : ''} • ${isPast ? 'Deposit credited: ' + depositAmt : 'Upcoming'}</div>
        ${p.notes ? `<div style="font-size:.75rem;color:var(--white-40);margin-top:2px">${p.notes}</div>` : ''}
      </div>
      <div style="display:flex;align-items:center;gap:10px">
        <span class="badge ${isPast ? 'badge-green' : 'badge-cyan'}">${isPast ? 'Credited' : 'Scheduled'}</span>
        ${!isPast ? `<button class="btn-icon" onclick="cancelPickup('${p.id}')" style="color:var(--danger);width:30px;height:30px;background:rgba(239,68,68,0.1);border-color:rgba(239,68,68,0.2)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="width:14px;height:14px"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function openPickupModal() {
  const dateInput = document.getElementById('pickup-date');
  if (dateInput) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dateInput.min   = tomorrow.toISOString().split('T')[0];
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
    count: countVal, notes,
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
  if (ptsEl)    ptsEl.textContent    = (c.loyaltyPts || 0).toLocaleString() + ' pts';
}

// Sub-screens
function openSubScreen(id) {
  if (!id) id = 'acct-subscription';
  const el = document.getElementById(id);
  if (!el) return;

  if (id === 'acct-personal') populatePersonalInfo();
  if (id === 'acct-address')  populateAddress();
  if (id === 'acct-history')  renderAcctHistory();
  if (id === 'acct-payment')  renderSavedCards();
  if (id === 'acct-subscription') renderSubPlanScreen();
  if (id === 'acct-settings') loadSettingsScreen();
  if (id === 'acct-rentals')  renderAcctRentals();

  el.classList.add('open');
}
window.openSubScreen = openSubScreen;

function closeSubScreen(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}
window.closeSubScreen = closeSubScreen;

function populatePersonalInfo() {
  if (!currentCustomer) return;
  const c = currentCustomer;
  const piName  = document.getElementById('pi-name');
  const piEmail = document.getElementById('pi-email');
  const piPhone = document.getElementById('pi-phone');
  if (piName)  piName.value  = c.name  || '';
  if (piEmail) piEmail.value = c.email || '';
  if (piPhone) piPhone.value = c.phone || '';
}

function savePersonalInfo() {
  if (!currentCustomer) return;
  const name  = document.getElementById('pi-name')?.value.trim();
  const email = document.getElementById('pi-email')?.value.trim();
  const phone = document.getElementById('pi-phone')?.value.trim();
  if (!name || !email) { Toast.warning('Missing Info', 'Name and email are required.'); return; }
  Store.updateItem(WB.KEYS.customers, currentCustomer.id, { name, email, phone });
  currentCustomer = Store.findById(WB.KEYS.customers, currentCustomer.id);
  Toast.success('Saved!', 'Your personal info has been updated.');
  closeSubScreen('acct-personal');
  renderAccount();
}
window.savePersonalInfo = savePersonalInfo;

function populateAddress() {
  if (!currentCustomer) return;
  const c = currentCustomer;
  const els = {
    'addr-street': c.address || '',
    'addr-city':   c.city    || '',
    'addr-zip':    c.zip     || '',
    'addr-gate':   c.gateCode       || '',
    'addr-notes':  c.deliveryNotes  || '',
    'addr-location': c.deliveryLocation || 'Front Door',
  };
  Object.entries(els).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
}

function saveAddress() {
  if (!currentCustomer) return;
  const street   = document.getElementById('addr-street')?.value.trim();
  const city     = document.getElementById('addr-city')?.value.trim();
  const zip      = document.getElementById('addr-zip')?.value.trim();
  const gate     = document.getElementById('addr-gate')?.value.trim();
  const notes    = document.getElementById('addr-notes')?.value.trim();
  const location = document.getElementById('addr-location')?.value;
  if (!street || !city || !zip) { Toast.warning('Missing Fields', 'Street, city and ZIP are required.'); return; }
  Store.updateItem(WB.KEYS.customers, currentCustomer.id, {
    address: street, city, zip, gateCode: gate, deliveryNotes: notes, deliveryLocation: location,
  });
  currentCustomer = Store.findById(WB.KEYS.customers, currentCustomer.id);
  Toast.success('Saved!', 'Your delivery address has been updated.');
  closeSubScreen('acct-address');
}
window.saveAddress = saveAddress;

function renderAcctHistory() {
  const listEl = document.getElementById('acct-history-list');
  if (!listEl || !currentCustomer) return;
  const orders = Orders.getForCustomer(currentCustomer.id);
  if (!orders.length) {
    listEl.innerHTML = '<div class="empty-state"><div class="empty-state-title">No orders yet</div></div>';
    return;
  }
  listEl.innerHTML = orders.map(order => {
    const itemStr = order.items.map(i => `${i.qty}× ${i.productName}`).join(', ');
    return `<div class="order-card" onclick="openOrderDetail('${order.id}')">
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

function renderSavedCards() {
  const listEl = document.getElementById('saved-cards-list');
  if (!listEl) return;
  const cards = JSON.parse(localStorage.getItem('wb_saved_cards') || '[]');
  if (!cards.length) {
    listEl.innerHTML = '<div style="text-align:center;padding:20px;font-size:.875rem;color:var(--white-40)">No saved cards</div>';
    return;
  }
  listEl.innerHTML = cards.map((card, i) => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 16px;background:var(--blue-card);border:1px solid var(--blue-border);border-radius:var(--radius-md)">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:1.5rem">💳</span>
        <div>
          <div style="font-weight:600;font-size:.9375rem">${card.brand} ····${card.last4}</div>
          <div style="font-size:.8125rem;color:var(--white-40)">Expires ${card.expiry}</div>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="removeCard(${i})" style="color:var(--danger)">Remove</button>
    </div>`).join('');
}

function removeCard(index) {
  const cards = JSON.parse(localStorage.getItem('wb_saved_cards') || '[]');
  cards.splice(index, 1);
  localStorage.setItem('wb_saved_cards', JSON.stringify(cards));
  renderSavedCards();
  Toast.info('Card Removed', 'Card has been removed from your account.');
}
window.removeCard = removeCard;

function renderSubPlanScreen() {
  if (!currentCustomer) return;
  const banner = document.getElementById('current-plan-banner');
  if (banner) {
    const c = currentCustomer;
    if (c.subscriptionActive) {
      banner.style.display = 'block';
      const planName = document.getElementById('current-plan-name');
      const planDets = document.getElementById('current-plan-details');
      const allPlans = [...SUBSCRIPTION_PLANS.monthly, ...SUBSCRIPTION_PLANS.alkaline];
      const activePlan = allPlans.find(p => p.id === c.subscriptionPlanId);
      if (planName) planName.textContent = activePlan ? activePlan.name : (c.subscriptionDesc || 'Active Plan');
      if (planDets) planDets.textContent = capitalize(c.subscriptionFrequency || '') + ' delivery • Next: this week';
    } else {
      banner.style.display = 'none';
    }
  }

  const planListEl = document.getElementById('sub-plan-list');
  if (!planListEl) return;

  const tagColors = { cyan:'var(--cyan)', green:'var(--success)', yellow:'#eab308', blue:'#3b82f6', purple:'#a855f7' };

  function renderPlanGroup(plans, groupTitle) {
    return `<div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--white-40);margin:16px 0 10px">${groupTitle}</div>` +
      plans.map(plan => {
        const color = tagColors[plan.tagColor] || 'var(--cyan)';
        const isFeatured = plan.tag === 'MOST POPULAR' || plan.tag === 'BEST VALUE';
        return `<div class="sub-plan-card${isFeatured ? ' sub-plan-featured' : ''}" onclick="selectPlan('${plan.id}')">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <span class="sub-plan-name">${plan.name}</span>
            <span style="font-family:var(--font-mono);font-size:1rem;font-weight:800;color:${color}">$${(plan.price/100).toFixed(0)}<span style="font-size:.75rem;font-weight:400;color:var(--white-40)">/mo</span></span>
          </div>
          <div style="font-size:.6875rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${color};margin-bottom:8px">${plan.tag}</div>
          <div style="font-size:.8125rem;color:var(--white-70);margin-bottom:8px">${plan.jugs} × 5-gal jugs ${plan.freq}</div>
          <ul style="list-style:none;padding:0;margin:0 0 10px;display:flex;flex-direction:column;gap:4px">
            ${plan.features.map(f => `<li style="font-size:.8rem;color:var(--white-60);display:flex;align-items:center;gap:6px"><span style="color:${color}">✓</span>${f}</li>`).join('')}
          </ul>
          ${plan.savings ? `<div style="font-size:.75rem;color:var(--success);font-weight:600">${plan.savings}</div>` : ''}
          <button class="btn btn-primary btn-full btn-sm" style="margin-top:12px;pointer-events:none">Select Plan</button>
        </div>`;
      }).join('');
  }

  planListEl.innerHTML =
    renderPlanGroup(SUBSCRIPTION_PLANS.monthly, 'Monthly Bundles') +
    renderPlanGroup(SUBSCRIPTION_PLANS.alkaline, 'Alkaline Upgrades') +
    `<div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--white-40);margin:16px 0 10px">À La Carte (Weekly × 4 Weeks)</div>
    <div style="background:var(--blue-card);border:1px solid var(--blue-border);border-radius:var(--radius-md);padding:14px;font-size:.8125rem">
      <div style="display:grid;grid-template-columns:auto 1fr 1fr 1fr 1fr;gap:8px;color:var(--white-70)">
        <span style="color:var(--white-40);font-size:.75rem">Freq</span><span style="color:var(--white-40);font-size:.75rem">1 jug</span><span style="color:var(--white-40);font-size:.75rem">2 jugs</span><span style="color:var(--white-40);font-size:.75rem">3 jugs</span><span style="color:var(--white-40);font-size:.75rem">4 jugs</span>
        <span style="font-weight:600">Weekly</span><span>$30</span><span>$60</span><span>$90</span><span>$120</span>
        <span style="font-weight:600">Bi-Weekly</span><span>$15</span><span>$30</span><span>$45</span><span>$60</span>
        <span style="font-weight:600">Monthly</span><span>$7.50</span><span>$15</span><span>$22.50</span><span>$30</span>
      </div>
      <div style="font-size:.75rem;color:var(--white-40);margin-top:10px">$7.50 per jug • Schedule below</div>
    </div>`;
}

function selectPlan(planId) {
  if (!currentCustomer) return;
  const allPlans = [...SUBSCRIPTION_PLANS.monthly, ...SUBSCRIPTION_PLANS.alkaline];
  const plan = allPlans.find(p => p.id === planId);
  if (!plan) return;

  const isAlkaline = SUBSCRIPTION_PLANS.alkaline.some(p => p.id === planId);
  const productId = isAlkaline ? 'p_5g1' : 'p_5g1';

  Store.updateItem(WB.KEYS.customers, currentCustomer.id, {
    subscriptionActive: true,
    subscriptionProduct: productId,
    subscriptionFrequency: 'monthly',
    subscriptionQty: plan.jugs,
    subscriptionDesc: `${plan.name} — ${plan.jugs} jugs/mo`,
    subscriptionPlanId: planId,
    subscriptionPrice: plan.price,
  });
  currentCustomer = Store.findById(WB.KEYS.customers, currentCustomer.id);
  Notifs.push(currentCustomer.id, 'subscription', 'Subscription Started!', `You're now on the ${plan.name} plan. $${(plan.price/100).toFixed(0)}/mo.`);
  Toast.success('Subscription Activated!', `${plan.name} — $${(plan.price/100).toFixed(0)}/mo`);
  renderSubPlanScreen();
  renderSubscriptionCard();
}
window.selectPlan = selectPlan;

function pauseSubscription() {
  const modal = document.getElementById('pause-sub-modal');
  if (!modal) return;
  document.getElementById('pause-sub-form').style.display = 'block';
  document.getElementById('pause-sub-success').style.display = 'none';
  document.querySelectorAll('input[name="pause-reason"]').forEach(r => r.checked = false);
  const durEl = document.getElementById('pause-duration');
  if (durEl) durEl.value = '';
  const notesEl = document.getElementById('pause-notes');
  if (notesEl) notesEl.value = '';
  Modal.open('pause-sub-modal');
}
window.pauseSubscription = pauseSubscription;

function submitPauseSubscription() {
  const reason = document.querySelector('input[name="pause-reason"]:checked')?.value;
  const duration = document.getElementById('pause-duration')?.value;
  if (!reason) { Toast.warning('Required', 'Please select a reason.'); return; }
  if (!duration) { Toast.warning('Required', 'Please select a pause duration.'); return; }
  const notes = document.getElementById('pause-notes')?.value?.trim() || '';
  localStorage.setItem('wb_pause_reason', JSON.stringify({ reason, duration, notes, pausedAt: Date.now() }));
  if (currentCustomer) {
    currentCustomer.subscriptionActive = false;
    Store.updateItem(WB.KEYS.customers, currentCustomer.id, { subscriptionActive: false });
  }
  document.getElementById('pause-sub-form').style.display = 'none';
  document.getElementById('pause-sub-success').style.display = 'block';
  renderSubscriptionCard();
  renderSubPlanScreen();
}
window.submitPauseSubscription = submitPauseSubscription;

function confirmPauseSubscription() {
  Modal.close('pause-sub-modal');
}
window.confirmPauseSubscription = confirmPauseSubscription;

function cancelSubscription() {
  if (!currentCustomer) return;
  if (!confirm('Cancel your subscription? This will stop all recurring deliveries.')) return;
  Store.updateItem(WB.KEYS.customers, currentCustomer.id, {
    subscriptionActive: false, subscriptionProduct: null, subscriptionFrequency: null,
  });
  currentCustomer = Store.findById(WB.KEYS.customers, currentCustomer.id);
  Toast.info('Subscription Cancelled', 'Your recurring deliveries have been stopped.');
  renderSubPlanScreen();
  renderSubscriptionCard();
}
window.cancelSubscription = cancelSubscription;

function contactForBusiness() {
  window.location.href = 'tel:9166193218';
}
window.contactForBusiness = contactForBusiness;

// Settings
function loadSettingsScreen() {
  const toggle = document.getElementById('dark-mode-toggle');
  if (toggle) toggle.checked = !document.body.classList.contains('light-mode');

  const prefs = JSON.parse(localStorage.getItem('wb_notif_prefs') || '{}');
  const notifIds = ['notif-order','notif-reminder','notif-updates','notif-missed','notif-payment','notif-promo'];
  notifIds.forEach(id => {
    const el = document.getElementById(id);
    const key = id.replace('notif-','');
    if (el) el.checked = prefs[key] !== false;
  });
}

function saveNotifPref(type, cb) {
  const prefs = JSON.parse(localStorage.getItem('wb_notif_prefs') || '{}');
  prefs[type] = cb.checked;
  localStorage.setItem('wb_notif_prefs', JSON.stringify(prefs));
}
window.saveNotifPref = saveNotifPref;

function deleteAccountConfirm() {
  if (!confirm('Delete your account? This cannot be undone.')) return;
  if (currentCustomer) {
    const custs = Store.getList(WB.KEYS.customers).filter(c => c.id !== currentCustomer.id);
    localStorage.setItem(WB.KEYS.customers, JSON.stringify(custs));
  }
  Auth.logout();
  Cart.clear();
  currentUser = null;
  currentCustomer = null;
  closeSubScreen('acct-settings');
  showLoginScreen();
  Toast.info('Account Deleted', 'Your account has been removed.');
}
window.deleteAccountConfirm = deleteAccountConfirm;

document.addEventListener('DOMContentLoaded', function () {
  // Logout
  const logoutItem = document.getElementById('logout-menu-item');
  if (logoutItem) logoutItem.addEventListener('click', doLogout);
  const settingsLogout = document.getElementById('settings-logout-btn');
  if (settingsLogout) settingsLogout.addEventListener('click', doLogout);

  // Settings gear icon
  const settingsBtn = document.getElementById('settings-btn');
  if (settingsBtn) settingsBtn.addEventListener('click', () => openSubScreen('acct-settings'));
});

function doLogout() {
  Auth.logout();
  Cart.clear();
  currentUser = null;
  currentCustomer = null;
  // Close all sub-screens
  document.querySelectorAll('.sub-screen.open').forEach(s => s.classList.remove('open'));
  showLoginScreen();
  Toast.info('Signed out', '');
}

// ============================================================
// CHECKOUT FLOW
// ============================================================
function initCheckoutFlow() {
  // Card number auto-format
  const cardNum = document.getElementById('card-number');
  if (cardNum) {
    cardNum.addEventListener('input', function () {
      let v = this.value.replace(/\D/g, '').slice(0, 16);
      this.value = v.replace(/(.{4})/g, '$1 ').trim();
    });
  }
  const cardExp = document.getElementById('card-expiry');
  if (cardExp) {
    cardExp.addEventListener('input', function () {
      let v = this.value.replace(/\D/g, '').slice(0, 4);
      if (v.length >= 3) v = v.slice(0,2) + '/' + v.slice(2);
      this.value = v;
    });
  }
  const termsChk = document.getElementById('terms-agree');
  if (termsChk) termsChk.addEventListener('change', updatePayBtn);
}

function openCheckoutFlow() {
  const items = Cart.get();
  if (!items.length) { Toast.warning('Cart Empty', 'Add items before checking out.'); return; }
  coStep       = 1;
  coOrderType  = 'onetime';
  coFreq       = 'weekly';
  coSelectedDate = null;
  coSelectedSlot = null;

  const flow = document.getElementById('checkout-flow');
  if (flow) { flow.style.display = 'flex'; flow.style.flexDirection = 'column'; }

  document.body.style.overflow = 'hidden';
  goToCoStep(1);
  selectOrderType('onetime');
  updateCoTotal();
}
window.openCheckoutFlow = openCheckoutFlow;

function closeCheckout() {
  const flow = document.getElementById('checkout-flow');
  if (flow) flow.style.display = 'none';
  document.body.style.overflow = '';
}
window.closeCheckout = closeCheckout;

function updateCoTotal() {
  const subtotal = Cart.total();
  const delivery = getDeliveryFeeForCustomer();
  const total    = subtotal + delivery;
  const display  = document.getElementById('co-order-total-display');
  const payBtn   = document.getElementById('pay-btn');
  if (display) display.textContent = fmtMoney(total);
  if (payBtn)  payBtn.textContent  = `Pay ${fmtMoney(total)}`;
  const apayAmt = document.getElementById('apple-pay-amount');
  const gpayAmt = document.getElementById('gpay-amount');
  if (apayAmt) apayAmt.textContent = fmtMoney(total);
  if (gpayAmt) gpayAmt.textContent = fmtMoney(total);
  return total;
}

function goToCoStep(n) {
  coStep = n;
  ['co-step-type','co-step-calendar','co-step-payment','co-step-confirm'].forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.style.display = i + 1 === n ? 'flex' : 'none';
  });

  // Update step indicators
  for (let i = 1; i <= 4; i++) {
    const dot = document.getElementById('co-dot-' + i);
    if (dot) {
      dot.classList.remove('active','done');
      if (i < n) dot.classList.add('done');
      else if (i === n) dot.classList.add('active');
    }
  }

  // Back button visibility
  const backBtn = document.getElementById('co-back-btn');
  if (backBtn) backBtn.style.visibility = n > 1 && n < 4 ? 'visible' : 'hidden';

  if (n === 2) buildCalendar();
  if (n === 3) { updateCoTotal(); updatePayBtn(); }
}

function coNext() {
  if (coStep === 1) {
    goToCoStep(2);
  } else if (coStep === 2) {
    if (!coSelectedDate) { Toast.warning('Select a Date', 'Please choose a delivery date.'); return; }
    if (!coSelectedSlot) { Toast.warning('Select a Time', 'Please choose a delivery window.'); return; }
    goToCoStep(3);
  }
}
window.coNext = coNext;

function coBack() {
  if (coStep > 1 && coStep < 4) goToCoStep(coStep - 1);
}
window.coBack = coBack;

// Step 1 – Order Type
function selectOrderType(type) {
  coOrderType = type;
  document.getElementById('co-type-card-onetime')  ? null : null;

  ['type-onetime','type-recurring'].forEach(id => {
    const card = document.getElementById(id);
    if (card) card.classList.toggle('selected', id === 'type-' + type);
  });
  ['check-onetime','check-recurring'].forEach(id => {
    const chk = document.getElementById(id);
    if (chk) chk.textContent = id === 'check-' + type ? '✓' : '';
  });

  const freqSec = document.getElementById('recurring-freq-section');
  if (freqSec) freqSec.style.display = type === 'recurring' ? 'block' : 'none';
}
window.selectOrderType = selectOrderType;

function selectCoFreq(btn, freq) {
  coFreq = freq;
  document.querySelectorAll('[data-cofreq]').forEach(b => {
    b.className = b === btn ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
  });

  const datesDiv = document.getElementById('co-delivery-dates');
  if (datesDiv) {
    const today = new Date();
    const firstDate = new Date(today);
    firstDate.setDate(today.getDate() + 3);

    const freqDays = { weekly: 7, biweekly: 14, monthly: 30, custom: 7 };
    const days = freqDays[freq] || 7;
    const nextDate = new Date(firstDate.getTime() + days * 86400000);

    datesDiv.innerHTML = `First delivery: <strong>${firstDate.toLocaleDateString('en-US', { month:'short', day:'numeric' })}</strong> &nbsp;·&nbsp; Next: <strong>${nextDate.toLocaleDateString('en-US', { month:'short', day:'numeric' })}</strong>`;
  }
}
window.selectCoFreq = selectCoFreq;

// Step 2 – Calendar
function buildCalendar() {
  const now = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const monthLabel = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const labelEl = document.getElementById('cal-month-label');
  if (labelEl) labelEl.textContent = monthLabel;

  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const grid     = document.getElementById('cal-grid');
  if (!grid) return;

  // Convert to Mon-based offset (0=Mon, 6=Sun)
  let startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let html = '';
  for (let i = 0; i < startOffset; i++) html += '<div class="cal-day cal-day-empty"></div>';

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d);
    const dow  = date.getDay(); // 0=Sun
    const isSun  = dow === 0;
    const isPast = date < today;
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const blockedDates = Store.getList(WB.KEYS.blockedDates || 'wb_blocked_dates');
    const isBlocked = blockedDates.includes(dateStr);
    const isAvail = !isSun && !isPast && !isBlocked;

    html += `<div class="cal-day ${isAvail ? 'cal-day-available' : 'cal-day-unavailable'}${coSelectedDate === dateStr ? ' selected' : ''}"
      data-date="${dateStr}"
      ${isAvail ? `onclick="selectCalDay(this,'${dateStr}')"` : ''}>
      ${d}
    </div>`;
  }
  grid.innerHTML = html;

  // Reset time slots
  document.getElementById('time-slots').style.display = 'none';
  coSelectedSlot = null;
}

function selectCalDay(el, dateStr) {
  coSelectedDate = dateStr;
  document.querySelectorAll('.cal-day').forEach(d => d.classList.remove('selected'));
  el.classList.add('selected');

  const timeSlotsEl = document.getElementById('time-slots');
  if (timeSlotsEl) timeSlotsEl.style.display = 'block';
  document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('active'));
  coSelectedSlot = null;

  const displayEl = document.getElementById('selected-dt-display');
  if (displayEl) displayEl.style.display = 'none';
}
window.selectCalDay = selectCalDay;

function selectTimeSlot(el, slot) {
  coSelectedSlot = slot;
  document.querySelectorAll('.time-slot').forEach(s => s.classList.remove('active'));
  el.classList.add('active');

  const slotLabels = { morning: 'Morning (8am – 12pm)', afternoon: 'Afternoon (12 – 4pm)', evening: 'Evening (4 – 6pm)' };
  const date = new Date(coSelectedDate + 'T12:00:00');
  const dateStr = date.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });

  const displayEl = document.getElementById('selected-dt-display');
  const textEl    = document.getElementById('selected-dt-text');
  if (displayEl) displayEl.style.display = 'flex';
  if (textEl) textEl.textContent = dateStr + ' — ' + slotLabels[slot];
}
window.selectTimeSlot = selectTimeSlot;

// Step 3 – Payment
function updatePayBtn() {
  const termsOk = document.getElementById('terms-agree')?.checked;
  const payBtn  = document.getElementById('pay-btn');
  if (payBtn) {
    payBtn.disabled = !termsOk;
    if (termsOk) {
      const total = updateCoTotal();
      payBtn.textContent = `Pay ${fmtMoney(total)}`;
    }
  }
}
window.updatePayBtn = updatePayBtn;

function processPayment() {
  const cardNum  = document.getElementById('card-number')?.value.replace(/\s/g,'');
  const cardExp  = document.getElementById('card-expiry')?.value;
  const cardCvv  = document.getElementById('card-cvv')?.value;
  const cardName = document.getElementById('card-name')?.value.trim();

  if (!cardNum || cardNum.length < 13) { Toast.error('Invalid Card', 'Please enter a valid card number.'); return; }
  if (!cardExp || cardExp.length < 5)  { Toast.error('Invalid Expiry', 'Please enter a valid expiry date.'); return; }
  if (!cardCvv || cardCvv.length < 3)  { Toast.error('Invalid CVV', 'Please enter your CVV.'); return; }
  if (!cardName) { Toast.error('Missing Name', 'Please enter the name on your card.'); return; }

  // Save card if requested
  if (document.getElementById('save-card')?.checked) {
    const cards = JSON.parse(localStorage.getItem('wb_saved_cards') || '[]');
    const brand = cardNum.startsWith('4') ? 'Visa' : cardNum.startsWith('5') ? 'Mastercard' : 'Card';
    cards.push({ brand, last4: cardNum.slice(-4), expiry: cardExp, name: cardName });
    localStorage.setItem('wb_saved_cards', JSON.stringify(cards));
  }

  const payBtn = document.getElementById('pay-btn');
  if (payBtn) { payBtn.disabled = true; payBtn.textContent = 'Processing…'; }

  setTimeout(() => finalizeOrder(), 1500);
}
window.processPayment = processPayment;

function finalizeOrder() {
  if (!currentCustomer) return;
  const items     = Cart.get();
  const promoCode = document.getElementById('promo-input')?.value?.trim().toUpperCase() || null;

  const order = Orders.create(currentCustomer.id, items, promoCode);
  if (!order) { Toast.error('Error', 'Could not place order.'); return; }

  // Save recurring if chosen
  if (coOrderType === 'recurring' && currentCustomer) {
    const firstItem = items[0]?.productId || null;
    Store.updateItem(WB.KEYS.customers, currentCustomer.id, {
      subscriptionActive: true,
      subscriptionProduct: firstItem,
      subscriptionFrequency: coFreq,
    });
  }

  Cart.clear();
  currentCustomer = Store.findById(WB.KEYS.customers, currentCustomer.id);
  Notifs.push(currentCustomer.id, 'order_update', 'Order Confirmed!', 'Your order has been confirmed and is being prepared.', order.id);

  showOrderConfirmation(order);
}

function showOrderConfirmation(order) {
  const idEl   = document.getElementById('confirm-order-id');
  const detEl  = document.getElementById('confirm-details');
  if (idEl)  idEl.textContent = '#' + order.id.slice(-8).toUpperCase();
  if (detEl) {
    const slotLabels = { morning: '8am – 12pm', afternoon: '12 – 4pm', evening: '4 – 6pm' };
    const itemStr = order.items.map(i => `${i.qty}× ${i.productName}`).join(', ');
    let html = `<strong>Items:</strong> ${itemStr}<br>`;
    html += `<strong>Total:</strong> ${fmtMoney(order.total)}<br>`;
    if (coSelectedDate) {
      const d = new Date(coSelectedDate + 'T12:00:00');
      html += `<strong>Delivery:</strong> ${d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })}`;
      if (coSelectedSlot) html += `, ${slotLabels[coSelectedSlot]}`;
    }
    detEl.innerHTML = html;
  }

  // Animate confirm circle
  const circle = document.getElementById('confirm-circle');
  if (circle) circle.classList.add('pop');

  goToCoStep(4);
  loadCartBadge();
  renderSubscriptionCard();
}

// Apple Pay Simulation
function triggerApplePay() {
  applePayActive = true;
  const overlay = document.getElementById('apple-pay-overlay');
  const sheet   = document.getElementById('apple-pay-sheet');
  if (overlay) { overlay.style.opacity = '1'; overlay.style.visibility = 'visible'; }
  if (sheet)   { setTimeout(() => { sheet.style.transform = 'translateX(-50%) translateY(0)'; }, 10); }

  updateCoTotal();

  // Face ID simulation
  const icon   = document.getElementById('face-id-icon');
  const label  = document.getElementById('face-id-label');
  const status = document.getElementById('face-id-status');

  if (icon) icon.textContent  = '🔒';
  if (label) label.textContent = 'Confirm with Face ID';
  if (status) status.textContent = 'Double-click to confirm';

  setTimeout(() => {
    if (!applePayActive) return;
    if (icon) icon.textContent   = '😐';
    if (status) status.textContent = 'Scanning…';
  }, 700);

  setTimeout(() => {
    if (!applePayActive) return;
    if (icon) icon.textContent   = '✅';
    if (label) label.textContent  = 'Payment Confirmed!';
    if (status) status.textContent = '';
  }, 1700);

  setTimeout(() => {
    if (!applePayActive) return;
    cancelApplePay(true);
    finalizeOrder();
  }, 2500);
}
window.triggerApplePay = triggerApplePay;

function cancelApplePay(silent) {
  applePayActive = false;
  const overlay = document.getElementById('apple-pay-overlay');
  const sheet   = document.getElementById('apple-pay-sheet');
  if (sheet)   sheet.style.transform = 'translateX(-50%) translateY(100%)';
  setTimeout(() => {
    if (overlay) { overlay.style.opacity = '0'; overlay.style.visibility = 'hidden'; }
  }, 350);
}
window.cancelApplePay = cancelApplePay;

// Google Pay Simulation
function triggerGooglePay() {
  const overlay = document.getElementById('google-pay-overlay');
  const sheet   = document.getElementById('google-pay-sheet');
  if (overlay) { overlay.style.opacity = '1'; overlay.style.visibility = 'visible'; }
  if (sheet)   setTimeout(() => { sheet.style.transform = 'translateX(-50%) translateY(0)'; }, 10);
  updateCoTotal();
}
window.triggerGooglePay = triggerGooglePay;

function cancelGooglePay() {
  const overlay = document.getElementById('google-pay-overlay');
  const sheet   = document.getElementById('google-pay-sheet');
  if (sheet)   sheet.style.transform = 'translateX(-50%) translateY(100%)';
  setTimeout(() => {
    if (overlay) { overlay.style.opacity = '0'; overlay.style.visibility = 'hidden'; }
  }, 350);
}
window.cancelGooglePay = cancelGooglePay;

function processGooglePay() {
  const sheet = document.getElementById('google-pay-sheet');
  if (sheet) {
    const btn = sheet.querySelector('button:first-of-type');
    if (btn) { btn.textContent = 'Processing…'; btn.disabled = true; }
  }
  setTimeout(() => {
    cancelGooglePay();
    finalizeOrder();
  }, 1200);
}
window.processGooglePay = processGooglePay;

function openTermsModal() {
  Modal.open('terms-modal');
}
window.openTermsModal = openTermsModal;

// ============================================================
// NOTIFICATIONS
// ============================================================
function initNotifPanel() {
  const notifBtn  = document.getElementById('notif-btn');
  const closeBtn  = document.getElementById('notif-close-btn');
  const markAllBtn = document.getElementById('mark-all-read-btn');
  if (notifBtn)   notifBtn.addEventListener('click', toggleNotifPanel);
  if (closeBtn)   closeBtn.addEventListener('click', closeNotifPanel);
  if (markAllBtn) markAllBtn.addEventListener('click', function () {
    if (currentCustomer) {
      Notifs.markAllRead(currentCustomer.id);
      renderNotifList();
      loadCustomer(currentCustomer.id);
    }
  });
}

function toggleNotifPanel() { notifPanelOpen ? closeNotifPanel() : openNotifPanel(); }

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
  if (currentCustomer) loadCustomer(currentCustomer.id);
}
window.markNotifRead = markNotifRead;

function checkNotifPermission() {
  const perm = localStorage.getItem('wb_notif_perm');
  if (!perm) {
    setTimeout(() => Modal.open('notif-permission-modal'), 800);
  }
}

function allowNotifications() {
  localStorage.setItem('wb_notif_perm', 'allowed');
  Modal.close('notif-permission-modal');
  Toast.success('Notifications On', 'You\'ll receive order and delivery updates.');
}
window.allowNotifications = allowNotifications;

function denyNotifications() {
  localStorage.setItem('wb_notif_perm', 'denied');
  Modal.close('notif-permission-modal');
}
window.denyNotifications = denyNotifications;

function seedDemoNotifications() {
  if (localStorage.getItem('wb_demo_notifs_v1') || !currentCustomer) return;
  const uid2 = currentCustomer.id;

  // Replace existing notifications for this user
  const allNotifs = Store.getList(WB.KEYS.notifications).filter(n => n.userId !== uid2);

  const demoNotifs = [
    { id: uid('notif_'), userId: uid2, type: 'order_update', title: 'Order #WB-38291 Confirmed ✓', body: 'Your order has been confirmed and is being prepared for delivery.', read: false, createdAt: Date.now() - 900000, orderId: null },
    { id: uid('notif_'), userId: uid2, type: 'subscription', title: 'Delivery Tomorrow: 12–4pm', body: 'Reminder: Your 4 bottles are scheduled for delivery tomorrow between 12pm and 4pm.', read: false, createdAt: Date.now() - 3600000, orderId: null },
    { id: uid('notif_'), userId: uid2, type: 'order_update', title: '🚚 Driver on the Way!', body: 'Marcus is headed your way! Estimated arrival: 15 minutes. Get ready!', read: false, createdAt: Date.now() - 7200000, orderId: null },
    { id: uid('notif_'), userId: uid2, type: 'order_update', title: 'Missed Delivery — Reschedule', body: 'We missed you! Your delivery was attempted today. Tap to reschedule at no charge.', read: true, createdAt: Date.now() - 86400000, orderId: null },
    { id: uid('notif_'), userId: uid2, type: 'payment',      title: 'Payment Receipt — $42.97', body: 'Thank you! Your payment of $42.97 has been received for Order #WB-38291.', read: true, createdAt: Date.now() - 172800000, orderId: null },
    { id: uid('notif_'), userId: uid2, type: 'promo',        title: '💧 Save 20% — Code COOL20', body: 'Summer special! Use code COOL20 for 20% off your next order. Expires soon!', read: true, createdAt: Date.now() - 259200000, orderId: null },
  ];

  Store.set(WB.KEYS.notifications, [...allNotifs, ...demoNotifs]);
  localStorage.setItem('wb_demo_notifs_v1', 'true');
  loadCustomer(currentCustomer.id);
}

// ============================================================
// RECURRING DELIVERY (Cart Page Toggle)
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
// MODALS INIT
// ============================================================
function initModals() {
  ['pickup-modal','order-detail-modal','add-to-cart-modal','weather-modal','zone-modal','terms-modal','notif-permission-modal','pause-sub-modal'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('click', e => { if (e.target === el) Modal.close(id); });
    el.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => Modal.close(btn.dataset.closeModal || id));
    });
  });

  // Sheet overlays backdrop close
  const apOverlay = document.getElementById('apple-pay-overlay');
  if (apOverlay) apOverlay.addEventListener('click', e => { if (e.target === apOverlay) cancelApplePay(); });
  const gpOverlay = document.getElementById('google-pay-overlay');
  if (gpOverlay) gpOverlay.addEventListener('click', e => { if (e.target === gpOverlay) cancelGooglePay(); });
}

// ============================================================
// BACK TO TOP
// ============================================================
function initBackToTop() {
  const btn  = document.getElementById('back-to-top');
  const main = document.querySelector('.cust-main');
  if (!btn || !main) return;
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
// PLAN DETAIL VIEW (Change 5)
// ============================================================
const PLAN_DETAILS = {
  starter: {
    name: 'Starter', price: '~$13.98/mo', id: 'starter',
    jugs: 2, freq: 'Bi-Weekly', deposit: '$4.00 deposit (refundable)',
    extras: ['Free delivery on all orders', 'Bottle pickup scheduling', 'Account portal access'],
    includes: '2 five-gallon jugs every 2 weeks',
  },
  popular: {
    name: 'Premium', price: '~$27.96/mo', id: 'popular',
    jugs: 4, freq: 'Weekly', deposit: '$8.00 deposit (refundable)',
    extras: ['Free delivery on all orders', 'Priority delivery scheduling', 'Bottle pickup scheduling', 'Loyalty points x2', 'Account portal access'],
    includes: '4 five-gallon jugs every week',
  },
  family: {
    name: 'Family', price: '~$41.94/mo', id: 'family',
    jugs: 6, freq: 'Weekly', deposit: '$12.00 deposit (refundable)',
    extras: ['Free delivery on all orders', 'Priority delivery scheduling', 'Bottle pickup scheduling', 'Loyalty points x3', 'Account portal access', 'Dedicated account manager'],
    includes: '6 five-gallon jugs every week',
  },
  business: {
    name: 'Business', price: 'Custom pricing', id: 'business',
    jugs: '8+', freq: 'Custom', deposit: 'Custom deposit',
    extras: ['Custom delivery schedule', 'Bulk pricing discounts', 'Dedicated account manager', 'Priority support', 'Invoice billing available'],
    includes: '8+ jugs on a custom schedule',
  },
};

function openPlanDetail(planId) {
  const plan = PLAN_DETAILS[planId];
  if (!plan) return;
  const screen = document.getElementById('plan-detail-screen');
  const titleEl = document.getElementById('plan-detail-title');
  const bodyEl = document.getElementById('plan-detail-body');
  if (!screen || !bodyEl) return;

  const currentSub = currentCustomer?.subscriptionDesc || '';
  const isCurrent = !!(currentCustomer?.subscriptionActive && currentCustomer?.subscriptionPlanId === planId);
  const currentPlanJugs = currentCustomer?.subscriptionQty || 0;
  const jugDiff = plan.jugs !== '8+' ? plan.jugs - currentPlanJugs : null;

  const comparisonHtml = currentCustomer?.subscriptionActive && !isCurrent && jugDiff !== null && jugDiff !== 0 && currentPlanJugs > 0
    ? `<div style="margin-bottom:16px;padding:12px;background:rgba(0,212,255,0.06);border:1px solid var(--cyan-dim);border-radius:var(--radius-sm);font-size:.875rem;color:var(--cyan)">
        ${jugDiff > 0 ? `You'd get <strong>${jugDiff} more jug${jugDiff>1?'s':''}</strong> per delivery compared to your current plan.`
                      : `This plan has <strong>${Math.abs(jugDiff)} fewer jug${Math.abs(jugDiff)>1?'s':''}</strong> per delivery than your current plan.`}
       </div>` : '';

  const actionHtml = plan.id === 'business'
    ? `<a href="tel:9166193218" class="btn btn-primary btn-full btn-lg" style="margin-top:20px;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:8px">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:18px;height:18px"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81a19.79 19.79 0 01-3.07-8.63A2 2 0 012 .18h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.09-1.16a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 14.92z"/></svg>
         Contact Us — (916) 619-3218
       </a>`
    : isCurrent
    ? `<div style="margin-top:20px;padding:12px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:var(--radius-md);text-align:center">
         <span class="badge badge-green" style="font-size:.875rem;padding:6px 16px">This is your current plan</span>
       </div>`
    : `<button class="btn btn-primary btn-full btn-lg" style="margin-top:20px" onclick="selectPlanFromDetail('${plan.id}')">
         ${currentCustomer?.subscriptionActive ? 'Switch to ' + plan.name : 'Select ' + plan.name + ' Plan'}
       </button>`;

  if (titleEl) titleEl.textContent = plan.name + ' Plan';
  bodyEl.innerHTML = `
    <div style="padding-bottom:32px">
      <div style="text-align:center;margin-bottom:24px">
        <div style="font-family:var(--font-head);font-size:1.5rem;font-weight:800;color:var(--white-90)">${plan.name}</div>
        <div style="font-family:var(--font-mono);font-size:1.75rem;font-weight:700;color:var(--cyan);margin-top:4px">${plan.price}</div>
        <div style="font-size:.875rem;color:var(--white-40);margin-top:4px">${plan.includes}</div>
      </div>
      ${comparisonHtml}
      <div style="background:var(--blue-card);border:1px solid var(--blue-border);border-radius:var(--radius-md);padding:16px;margin-bottom:16px">
        <div style="font-size:.75rem;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--white-40);margin-bottom:12px">What's Included</div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;gap:10px;align-items:center;font-size:.875rem;color:var(--white-70)">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2.5" style="width:16px;height:16px;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>
            <span><strong style="color:var(--white-90)">${plan.jugs} five-gallon jugs</strong> per delivery</span>
          </div>
          <div style="display:flex;gap:10px;align-items:center;font-size:.875rem;color:var(--white-70)">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2.5" style="width:16px;height:16px;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>
            <span><strong style="color:var(--white-90)">${plan.freq}</strong> delivery schedule</span>
          </div>
          <div style="display:flex;gap:10px;align-items:center;font-size:.875rem;color:var(--white-70)">
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2.5" style="width:16px;height:16px;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>
            <span>${plan.deposit}</span>
          </div>
          ${plan.extras.map(e => `<div style="display:flex;gap:10px;align-items:center;font-size:.875rem;color:var(--white-70)"><svg viewBox="0 0 24 24" fill="none" stroke="var(--cyan)" stroke-width="2.5" style="width:16px;height:16px;flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg><span>${e}</span></div>`).join('')}
        </div>
      </div>
      ${actionHtml}
    </div>`;
  screen.classList.add('open');
}
window.openPlanDetail = openPlanDetail;

function closePlanDetail() {
  const screen = document.getElementById('plan-detail-screen');
  if (screen) screen.classList.remove('open');
}
window.closePlanDetail = closePlanDetail;

function selectPlanFromDetail(planId) {
  selectPlan(planId);
  closePlanDetail();
  Toast.success('Plan Selected', 'Your plan has been updated.');
}
window.selectPlanFromDetail = selectPlanFromDetail;

// ============================================================
// SWIPEABLE TABS (Change 2)
// ============================================================
(function initSwipeTabs() {
  const PAGES = ['home', 'products', 'cart', 'orders', 'bottles', 'account'];
  let startX = 0, startY = 0;

  function onTouchStart(e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }

  function onTouchEnd(e) {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) < 50 || Math.abs(dy) > Math.abs(dx) * 0.8) return;

    const idx = PAGES.indexOf(currentPage);
    if (idx === -1) return;

    let nextPage;
    let dir;
    if (dx < 0) {
      nextPage = PAGES[(idx + 1) % PAGES.length];
      dir = 'right';
    } else {
      nextPage = PAGES[(idx - 1 + PAGES.length) % PAGES.length];
      dir = 'left';
    }

    document.querySelectorAll('.cust-page').forEach(p => {
      p.classList.remove('slide-from-left', 'slide-from-right');
    });

    navigateTo(nextPage);

    const pageEl = document.getElementById('page-' + nextPage);
    if (pageEl) {
      pageEl.classList.add('slide-from-' + dir);
      setTimeout(() => pageEl.classList.remove('slide-from-left', 'slide-from-right'), 300);
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    const main = document.querySelector('.cust-main');
    if (main) {
      main.addEventListener('touchstart', onTouchStart, { passive: true });
      main.addEventListener('touchend', onTouchEnd, { passive: true });
    }
  });
}());

// ============================================================
// RENTALS PAGE
// ============================================================
let rfStep          = 1;
let rfSelectedModel = null;
let rfSelectedTier  = null;

function renderRentals() {
  const el = document.getElementById('rentals-list');
  if (!el) return;

  el.innerHTML = Object.values(RENTAL_PLANS).map(plan => {
    const bestTier = plan.tiers.find(t => t.bestValue);
    return `<div class="product-card" style="cursor:pointer" onclick="openRentalFlow('${plan.id}')">
      <div class="product-card-img-wrap">
        <img src="${plan.image}" alt="${plan.name}" style="width:100%;height:140px;object-fit:cover;border-radius:10px 10px 0 0">
      </div>
      <div class="product-card-body">
        <div class="product-card-name">${plan.name}</div>
        <div class="product-card-desc" style="font-size:.8rem;color:var(--white-60);margin-bottom:8px">${plan.desc}</div>
        <div style="font-size:.8rem;color:var(--cyan)">From ${fmtMoney(bestTier.price)}/mo</div>
        <div style="font-size:.75rem;color:var(--white-40);margin-top:2px">Retail value: ${fmtMoney(plan.retailPrice)}</div>
        <button class="btn btn-primary btn-full" style="margin-top:12px">Rent Now</button>
      </div>
    </div>`;
  }).join('');
}
window.renderRentals = renderRentals;

function openRentalFlow(modelId) {
  rfStep          = 1;
  rfSelectedModel = modelId || null;
  rfSelectedTier  = null;

  const flow = document.getElementById('rental-flow');
  if (flow) { flow.style.display = 'flex'; flow.style.flexDirection = 'column'; }
  document.body.style.overflow = 'hidden';

  goToRfStep(1);

  if (modelId) {
    rfSelectModel(modelId);
    goToRfStep(2);
  }
}
window.openRentalFlow = openRentalFlow;

function closeRentalFlow() {
  const flow = document.getElementById('rental-flow');
  if (flow) flow.style.display = 'none';
  document.body.style.overflow = '';
}
window.closeRentalFlow = closeRentalFlow;

function goToRfStep(n) {
  rfStep = n;
  for (let i = 1; i <= 5; i++) {
    const el = document.getElementById('rf-step-' + i);
    if (el) el.style.display = i === n ? 'flex' : 'none';
    const dot = document.getElementById('rf-dot-' + i);
    if (dot) {
      dot.classList.remove('active','done');
      if (i < n) dot.classList.add('done');
      else if (i === n) dot.classList.add('active');
    }
  }

  const backBtn = document.getElementById('rf-back-btn');
  if (backBtn) backBtn.style.visibility = n > 1 && n < 5 ? 'visible' : 'hidden';

  if (n === 1) renderRfModelCards();
  if (n === 2) { renderRfTierCards(); renderRfPriceSummary(); }
  if (n === 4) renderRfOrderSummary();

  updateRfNextBtn();
}

function renderRfModelCards() {
  const el = document.getElementById('rf-dispenser-cards');
  if (!el) return;
  el.innerHTML = Object.values(RENTAL_PLANS).map(plan => {
    const selected = rfSelectedModel === plan.id;
    return `<div class="rf-model-card ${selected ? 'selected' : ''}" onclick="rfSelectModel('${plan.id}')" style="border:2px solid ${selected ? 'var(--cyan)' : 'var(--border)'};border-radius:14px;padding:16px;cursor:pointer;margin-bottom:12px;background:var(--card-bg)">
      <div style="font-weight:600;color:var(--white-90)">${plan.name}</div>
      <div style="font-size:.8rem;color:var(--white-60);margin-top:4px">${plan.desc}</div>
      <div style="font-size:.8rem;color:var(--cyan);margin-top:6px">From ${fmtMoney(plan.tiers.find(t=>t.bestValue).price)}/mo</div>
    </div>`;
  }).join('');
}

function renderRfTierCards() {
  const el = document.getElementById('rf-tier-cards');
  if (!el || !rfSelectedModel) return;
  const plan = RENTAL_PLANS[rfSelectedModel];
  if (!plan) return;

  const nameEl  = document.getElementById('rf-model-name');
  const imgEl   = document.getElementById('rf-model-img');
  const retailEl = document.getElementById('rf-retail-price');
  if (nameEl)   nameEl.textContent  = plan.name;
  if (imgEl)    imgEl.src           = plan.image;
  if (retailEl) retailEl.textContent = fmtMoney(plan.retailPrice);

  el.innerHTML = plan.tiers.map(tier => {
    const selected = rfSelectedTier === tier.months;
    return `<div class="rf-tier-card ${selected ? 'selected' : ''}" onclick="rfSelectTier(${tier.months})" style="border:2px solid ${selected ? 'var(--cyan)' : 'var(--border)'};border-radius:14px;padding:14px 16px;cursor:pointer;margin-bottom:10px;background:var(--card-bg);position:relative">
      ${tier.bestValue ? '<span style="position:absolute;top:10px;right:12px;font-size:.7rem;background:var(--cyan);color:#000;padding:2px 8px;border-radius:20px;font-weight:700">BEST VALUE</span>' : ''}
      <div style="font-weight:600;color:var(--white-90)">${tier.label}</div>
      <div style="font-size:1.1rem;color:var(--cyan);margin-top:2px">${fmtMoney(tier.price)}<span style="font-size:.8rem;color:var(--white-60)">/mo</span></div>
      <div style="font-size:.75rem;color:var(--white-40);margin-top:2px">Total: ${fmtMoney(tier.totalCost)}${tier.savings ? ` · Save ${fmtMoney(tier.savings)}` : ''}</div>
    </div>`;
  }).join('');
}

function renderRfOrderSummary() {
  if (!rfSelectedModel || rfSelectedTier === null) return;
  const plan = RENTAL_PLANS[rfSelectedModel];
  const tier = plan && plan.tiers.find(t => t.months === rfSelectedTier);
  if (!plan || !tier) return;

  const summaryEl = document.getElementById('rf-order-summary');
  if (summaryEl) {
    summaryEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span>${plan.name}</span><span style="color:var(--cyan)">${fmtMoney(tier.price)}/mo</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:4px"><span style="color:var(--white-50)">Duration</span><span>${tier.label}</span></div>
      <div style="display:flex;justify-content:space-between;border-top:1px solid var(--blue-border);padding-top:8px;margin-top:4px;font-weight:600"><span>Due Today</span><span style="color:var(--cyan)">${fmtMoney(tier.price)}</span></div>`;
  }

  const rfPayBtn = document.getElementById('rf-pay-btn');
  if (rfPayBtn) {
    rfPayBtn.disabled = false;
    rfPayBtn.textContent = `Start Rental — Pay ${fmtMoney(tier.price)}`;
  }
}

function rfSelectModel(modelId) {
  rfSelectedModel = modelId;
  renderRfModelCards();
  updateRfNextBtn();
}
window.rfSelectModel = rfSelectModel;

function rfSelectTier(months) {
  rfSelectedTier = months;
  renderRfTierCards();
  renderRfPriceSummary();
  updateRfNextBtn();
}
window.rfSelectTier = rfSelectTier;

function renderRfPriceSummary() {
  if (!rfSelectedModel || rfSelectedTier === null) return;
  const plan = RENTAL_PLANS[rfSelectedModel];
  const tier = plan && plan.tiers.find(t => t.months === rfSelectedTier);
  if (!plan || !tier) return;
  const monthlyEl = document.getElementById('rf-monthly-display');
  const totalEl   = document.getElementById('rf-total-display');
  if (monthlyEl) monthlyEl.textContent = fmtMoney(tier.price) + '/mo';
  if (totalEl)   totalEl.textContent   = fmtMoney(tier.totalCost);
}

function updateRfNextBtn() {
  const next1 = document.getElementById('rf-next-1');
  const next2 = document.getElementById('rf-next-2');
  const next3 = document.getElementById('rf-next-3');
  if (next1) next1.disabled = !rfSelectedModel;
  if (next2) next2.disabled = rfSelectedTier === null;
  const agreeChk = document.getElementById('rf-agree-checkbox');
  if (next3) next3.disabled = !(agreeChk && agreeChk.checked);
}
window.updateRfNextBtn = updateRfNextBtn;

function rfGoTo(n) { goToRfStep(n); }
window.rfGoTo = rfGoTo;

function rfNext() {
  if (rfStep === 1) {
    if (!rfSelectedModel) { Toast.warning('Select a Dispenser', 'Choose a dispenser to continue.'); return; }
    goToRfStep(2);
  } else if (rfStep === 2) {
    if (rfSelectedTier === null) { Toast.warning('Select a Duration', 'Choose a rental duration to continue.'); return; }
    goToRfStep(3);
  } else if (rfStep === 3) {
    const agreeChk = document.getElementById('rf-agree-checkbox');
    if (!agreeChk || !agreeChk.checked) { Toast.warning('Agreement Required', 'Please read and accept the rental agreement.'); return; }
    goToRfStep(4);
  }
}
window.rfNext = rfNext;

function rfBack() {
  if (rfStep > 1 && rfStep < 5) goToRfStep(rfStep - 1);
}
window.rfBack = rfBack;

function rfProcessPayment() {
  const cardNum  = document.getElementById('rf-card-num')?.value.replace(/\s/g,'');
  const cardExp  = document.getElementById('rf-card-exp')?.value;
  const cardCvv  = document.getElementById('rf-card-cvv')?.value;

  if (!cardNum || cardNum.length < 13) { Toast.error('Invalid Card', 'Please enter a valid card number.'); return; }
  if (!cardExp || cardExp.length < 5)  { Toast.error('Invalid Expiry', 'Please enter a valid expiry date.'); return; }
  if (!cardCvv || cardCvv.length < 3)  { Toast.error('Invalid CVV', 'Please enter your CVV.'); return; }

  const btn = document.getElementById('rf-pay-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Processing…'; }
  setTimeout(() => rfStartRental(), 1500);
}
window.rfProcessPayment = rfProcessPayment;

function rfStartRental() {
  if (!currentCustomer || !rfSelectedModel || rfSelectedTier === null) return;
  const plan = RENTAL_PLANS[rfSelectedModel];
  const tier = plan && plan.tiers.find(t => t.months === rfSelectedTier);
  if (!plan || !tier) return;

  const now     = Date.now();
  const endDate = now + tier.months * 30 * 24 * 60 * 60 * 1000;
  const rental  = {
    id:          uid('rent'),
    customerId:  currentCustomer.id,
    customerName: currentCustomer.name,
    modelId:     plan.id,
    modelName:   plan.name,
    months:      tier.months,
    monthlyPrice: tier.price,
    totalCost:   tier.totalCost,
    status:      'active',
    startDate:   now,
    endDate:     endDate,
    nextBilling: now + 30 * 24 * 60 * 60 * 1000,
  };

  Store.push(WB.KEYS.rentals, rental);
  Notifs.push(currentCustomer.id, 'rental', 'Rental Confirmed!', `Your ${plan.name} rental starts today.`);

  const detEl = document.getElementById('rf-confirm-details');
  if (detEl) {
    detEl.innerHTML = `<strong>Dispenser:</strong> ${plan.name}<br>
      <strong>Duration:</strong> ${tier.label}<br>
      <strong>Monthly:</strong> ${fmtMoney(tier.price)}<br>
      <strong>Rental ID:</strong> #${rental.id.slice(-8).toUpperCase()}`;
  }

  goToRfStep(5);
}
window.rfStartRental = rfStartRental;

function renderAcctRentals() {
  const el = document.getElementById('acct-rentals-body');
  if (!el || !currentCustomer) return;

  const rentals = Store.getList(WB.KEYS.rentals).filter(r => r.customerId === currentCustomer.id);
  if (!rentals.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🚰</div><div class="empty-state-title">No active rentals</div><div class="empty-state-sub">Rent a dispenser to see it here.</div></div>
      <button class="btn btn-primary btn-full" style="margin-top:16px" onclick="closeSubScreen('acct-rentals');navigateTo('rentals')">Browse Dispensers</button>`;
    return;
  }

  el.innerHTML = rentals.map(r => {
    const endDate = new Date(r.endDate).toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'});
    const statusColor = r.status === 'active' ? 'var(--cyan)' : r.status === 'ended' ? 'var(--white-40)' : '#f59e0b';
    return `<div style="background:var(--card-bg);border-radius:14px;padding:16px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-weight:600;color:var(--white-90)">${r.modelName}</div>
          <div style="font-size:.8rem;color:var(--white-60);margin-top:2px">${fmtMoney(r.monthlyPrice)}/mo · ${r.months} month${r.months > 1 ? 's' : ''}</div>
        </div>
        <span style="font-size:.75rem;color:${statusColor};text-transform:uppercase;font-weight:700">${r.status}</span>
      </div>
      <div style="font-size:.8rem;color:var(--white-40);margin-top:6px">Ends ${endDate}</div>
      ${r.status === 'active' ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px">
        <button class="btn btn-secondary btn-sm" onclick="rentalExtend('${r.id}')">Extend</button>
        <button class="btn btn-secondary btn-sm" onclick="rentalMaintenance('${r.id}')">Maintenance</button>
        <button class="btn btn-secondary btn-sm" onclick="rentalPurchase('${r.id}')">Purchase</button>
        <button class="btn btn-secondary btn-sm" style="color:#f87171;border-color:#f87171" onclick="rentalEndEarly('${r.id}')">End Early</button>
      </div>` : ''}
    </div>`;
  }).join('');
}
window.renderAcctRentals = renderAcctRentals;

function rentalExtend(rentalId) {
  Toast.info('Coming Soon', 'Extension requests will be available shortly.');
}
window.rentalExtend = rentalExtend;

function rentalMaintenance(rentalId) {
  Toast.info('Request Sent', 'A maintenance visit has been scheduled.');
}
window.rentalMaintenance = rentalMaintenance;

function rentalPurchase(rentalId) {
  const r = Store.findById(WB.KEYS.rentals, rentalId);
  if (!r) return;
  const plan = RENTAL_PLANS[r.modelId];
  if (!plan) return;
  Toast.info('Purchase Request', `Purchase price: ${fmtMoney(plan.retailPrice)}. Our team will contact you.`);
}
window.rentalPurchase = rentalPurchase;

function rentalEndEarly(rentalId) {
  if (!confirm('End this rental early? Early termination fees may apply.')) return;
  Store.updateItem(WB.KEYS.rentals, rentalId, { status: 'ended' });
  Toast.success('Rental Ended', 'Your rental has been ended. We will arrange pickup.');
  renderAcctRentals();
}
window.rentalEndEarly = rentalEndEarly;

document.addEventListener('DOMContentLoaded', function () {
  const rfCardNum = document.getElementById('rf-card-num');
  if (rfCardNum) {
    rfCardNum.addEventListener('input', function () {
      let v = this.value.replace(/\D/g,'').slice(0,16);
      this.value = v.replace(/(.{4})/g,'$1 ').trim();
    });
  }
  const rfCardExp = document.getElementById('rf-card-exp');
  if (rfCardExp) {
    rfCardExp.addEventListener('input', function () {
      let v = this.value.replace(/\D/g,'').slice(0,4);
      if (v.length >= 3) v = v.slice(0,2) + '/' + v.slice(2);
      this.value = v;
    });
  }
  const rfAgree = document.getElementById('rf-agree-checkbox');
  if (rfAgree) rfAgree.addEventListener('change', updateRfNextBtn);
});

// ============================================================
// IN-APP MESSAGING
// ============================================================
let rfCurrentThreadId = null;

function openChatScreen(orderId) {
  const order = Orders.getById(orderId);
  if (!order) return;

  const threads = Store.getList(WB.KEYS.messages);
  let thread = threads.find(t => t.orderId === orderId);

  if (!thread) {
    thread = {
      id:         uid('msg_thread'),
      orderId:    orderId,
      customerId: order.customerId,
      driverId:   order.driverId || 'drv_1',
      driverName: 'Your Driver',
      messages:   [],
      createdAt:  Date.now(),
    };
    Store.push(WB.KEYS.messages, thread);
  }

  rfCurrentThreadId = thread.id;

  const driverName = document.getElementById('chat-driver-name');
  if (driverName) {
    const drivers = Store.getList(WB.KEYS.drivers);
    const driver  = drivers.find(d => d.id === thread.driverId);
    driverName.textContent = driver ? driver.name : 'Your Driver';
  }

  const screen = document.getElementById('chat-screen');
  if (screen) screen.classList.add('open');

  renderChatMessages(thread.id);
}
window.openChatScreen = openChatScreen;

function closeChatScreen() {
  const screen = document.getElementById('chat-screen');
  if (screen) screen.classList.remove('open');
  rfCurrentThreadId = null;
}
window.closeChatScreen = closeChatScreen;

function renderChatMessages(threadId) {
  const threads = Store.getList(WB.KEYS.messages);
  const thread  = threads.find(t => t.id === threadId);
  const el      = document.getElementById('chat-messages');
  if (!el) return;

  if (!thread || !thread.messages || !thread.messages.length) {
    el.innerHTML = `<div style="text-align:center;color:var(--white-40);font-size:.85rem;padding:20px 0">Say hello to your driver!</div>`;
    return;
  }

  el.innerHTML = thread.messages.map(msg => {
    const isCustomer = msg.senderRole === 'customer';
    return `<div style="display:flex;justify-content:${isCustomer ? 'flex-end' : 'flex-start'};margin-bottom:8px;animation:slideUpMsg .2s ease">
      <div style="max-width:75%;padding:10px 14px;border-radius:${isCustomer ? '18px 18px 4px 18px' : '18px 18px 18px 4px'};background:${isCustomer ? 'var(--cyan)' : '#1e3a4a'};color:${isCustomer ? '#000' : 'var(--white-90)'};font-size:.875rem;line-height:1.4">
        ${msg.text}
        <div style="font-size:.65rem;opacity:.6;text-align:right;margin-top:4px">${fmtTime(msg.sentAt)}</div>
      </div>
    </div>`;
  }).join('');

  el.scrollTop = el.scrollHeight;
}

function sendChatMessage() {
  if (!rfCurrentThreadId || !currentCustomer) return;
  const input = document.getElementById('chat-input');
  const text  = input ? input.value.trim() : '';
  if (!text) return;

  const threads = Store.getList(WB.KEYS.messages);
  const thread  = threads.find(t => t.id === rfCurrentThreadId);
  if (!thread) return;

  const msg = {
    id:         uid('msg'),
    senderRole: 'customer',
    senderId:   currentCustomer.id,
    text:       text,
    sentAt:     Date.now(),
  };

  if (!thread.messages) thread.messages = [];
  thread.messages.push(msg);
  Store.updateItem(WB.KEYS.messages, rfCurrentThreadId, { messages: thread.messages });

  if (input) input.value = '';
  renderChatMessages(rfCurrentThreadId);

  showTypingIndicator();
}
window.sendChatMessage = sendChatMessage;

function showTypingIndicator() {
  const el = document.getElementById('chat-typing');
  if (!el) return;
  el.style.display = 'flex';
  const msgsEl = document.getElementById('chat-messages');
  if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;

  setTimeout(() => {
    el.style.display = 'none';
    simulateDriverReply();
  }, 2000 + Math.random() * 1500);
}

function simulateDriverReply() {
  if (!rfCurrentThreadId) return;
  const replies = [
    'On my way! ETA about 10 minutes.',
    'Got your message, almost there!',
    'Thanks for letting me know. See you soon!',
    'I\'m just down the street, be there shortly.',
    'Sure thing! I\'ll take care of it.',
  ];
  const text = replies[Math.floor(Math.random() * replies.length)];

  const threads = Store.getList(WB.KEYS.messages);
  const thread  = threads.find(t => t.id === rfCurrentThreadId);
  if (!thread) return;

  const msg = {
    id:         uid('msg'),
    senderRole: 'driver',
    senderId:   thread.driverId || 'drv_1',
    text:       text,
    sentAt:     Date.now(),
  };

  if (!thread.messages) thread.messages = [];
  thread.messages.push(msg);
  Store.updateItem(WB.KEYS.messages, rfCurrentThreadId, { messages: thread.messages });
  renderChatMessages(rfCurrentThreadId);
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

document.addEventListener('DOMContentLoaded', function () {
  const chatInput = document.getElementById('chat-input');
  if (chatInput) {
    chatInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); }
    });
  }
});
