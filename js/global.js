/* ============================================================
   WATERBOY APP — GLOBAL DATA LAYER & UTILITIES
   ============================================================ */

'use strict';

// ============================================================
// CONSTANTS
// ============================================================
const WB = {
  KEYS: {
    customers:    'wb_customers',
    orders:       'wb_orders',
    products:     'wb_products',
    drivers:      'wb_drivers',
    promos:       'wb_promos',
    zones:        'wb_zones',
    inventory:    'wb_inventory',
    notifications:'wb_notifications',
    settings:     'wb_settings',
    currentUser:  'wb_current_user',
    cartKey:      'wb_cart',
    pickups:      'wb_pickups',
    blockedDates: 'wb_blocked_dates',
    seeded:       'wb_seeded_v5',
  },
  CREDS: {
    customer: { email: 'demo@waterboy.com',   password: 'water2026' },
    driver:   { email: 'driver@waterboy.com', password: 'drive2026' },
    admin:    { email: 'admin@waterboy.com',  password: 'admin2026' },
  },
  ORDER_STATUSES: ['pending','confirmed','preparing','out_for_delivery','delivered'],
  STATUS_LABELS: {
    pending:          'Pending',
    confirmed:        'Confirmed',
    preparing:        'Preparing',
    out_for_delivery: 'Out for Delivery',
    delivered:        'Delivered',
    cancelled:        'Cancelled',
  },
};

// ============================================================
// STORAGE HELPERS
// ============================================================
const Store = {
  get(key)     { try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; } },
  set(key, val){ localStorage.setItem(key, JSON.stringify(val)); },
  update(key, fn) {
    const cur = Store.get(key);
    Store.set(key, fn(cur));
  },
  getList(key) { return Store.get(key) || []; },
  push(key, item) {
    const list = Store.getList(key);
    list.push(item);
    Store.set(key, list);
    return item;
  },
  updateItem(key, id, patches) {
    const list = Store.getList(key);
    const idx = list.findIndex(i => i.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...patches, updatedAt: Date.now() };
    Store.set(key, list);
    return list[idx];
  },
  removeItem(key, id) {
    const list = Store.getList(key);
    Store.set(key, list.filter(i => i.id !== id));
  },
  findById(key, id) {
    return Store.getList(key).find(i => i.id === id) || null;
  },
};

// ============================================================
// ID / DATE HELPERS
// ============================================================
function uid(prefix = '') {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function daysAgo(n) {
  return Date.now() - n * 86400000;
}

function hoursAgo(n) {
  return Date.now() - n * 3600000;
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
}

function fmtDateTime(ts) {
  return fmtDate(ts) + ' ' + fmtTime(ts);
}

function fmtMoney(cents) {
  return '$' + (cents / 100).toFixed(2);
}

// ============================================================
// SEED DATA
// ============================================================
const SEED = {

  products: [
    { id:'prod_1', name:'5-Gallon RO Water',      category:'delivery', price:699,  unit:'per bottle', icon:'💧', description:'Pure reverse osmosis water. Crisp, clean, and refreshing.', popular:true },
    { id:'prod_2', name:'5-Gallon Alkaline Water', category:'delivery', price:799,  unit:'per bottle', icon:'⚡', description:'Alkaline ionized water, pH 8.5–9.5. Electrolyte enhanced.', popular:true },
    { id:'prod_3', name:'5-Gallon Hydrogen Water', category:'delivery', price:999,  unit:'per bottle', icon:'🌿', description:'Hydrogen-infused antioxidant water. Premium wellness choice.', popular:false },
    { id:'prod_4', name:'3-Gallon RO Water',       category:'delivery', price:499,  unit:'per bottle', icon:'💧', description:'Compact reverse osmosis water. Perfect for smaller households.', popular:false },
    { id:'prod_5', name:'Standard Dispenser',       category:'dispensers', price:4999, unit:'one-time', icon:'🏠', description:'Hot & cold tabletop dispenser. Easy bottle swap.', popular:true },
    { id:'prod_6', name:'Premium Dispenser',        category:'dispensers', price:7999, unit:'one-time', icon:'✨', description:'Hot, cold & room temp. Includes child lock & night mode.', popular:false },
    { id:'prod_7', name:'40 lb Bag Ice',            category:'instore',   price:499,  unit:'per bag', icon:'🧊', description:'Crystal clear premium ice. Perfect for parties and events.', popular:true },
    { id:'prod_8', name:'5-Gallon Jug (Empty)',     category:'instore',   price:1299, unit:'each', icon:'🫙', description:'BPA-free polycarbonate jug. Reusable for years.', popular:false },
    { id:'prod_9', name:'3-Gallon Jug (Empty)',     category:'instore',   price:999,  unit:'each', icon:'🫙', description:'Compact BPA-free jug. Fits small countertop dispensers.', popular:false },
    { id:'prod_10',name:'Water Pitcher Filter',     category:'instore',   price:2499, unit:'each', icon:'🔬', description:'6-stage countertop filter pitcher. Removes chlorine, lead & more.', popular:false },
    { id:'prod_11',name:'RO Filter Replacement',    category:'instore',   price:4999, unit:'set', icon:'🔧', description:'Compatible with most under-sink RO systems. 6-month supply.', popular:false },
  ],

  zones: [
    { id:'zone_primary', name:'Elk Grove — Primary', city:'Elk Grove', zipCodes:['95624','95757','95758','95759'], active:true, deliveryFee:0, radius:10, center:'7119 Elk Grove Blvd, Elk Grove, CA', deliveryDays:[1,2,3,4,5,6] },
    { id:'zone_1', name:'Elk Grove Central',  city:'Elk Grove', zipCodes:['95624','95758'], active:true,  deliveryFee:299, deliveryDays:[1,2,3,4,5,6] },
    { id:'zone_2', name:'Elk Grove South',    city:'Elk Grove', zipCodes:['95757','95759'], active:true,  deliveryFee:299, deliveryDays:[1,2,3,4,5,6] },
    { id:'zone_3', name:'Elk Grove North',    city:'Elk Grove', zipCodes:['95624','95626'], active:true,  deliveryFee:299, deliveryDays:[1,3,5] },
    { id:'zone_4', name:'Laguna',             city:'Elk Grove', zipCodes:['95758'], active:true,          deliveryFee:299, deliveryDays:[2,4,6] },
    { id:'zone_5', name:'Rancho Cordova',     city:'Rancho Cordova', zipCodes:['95670','95742'], active:false, deliveryFee:499, deliveryDays:[1,2,3,4,5] },
  ],

  drivers: [
    {
      id: 'drv_1',
      name: 'Marcus Johnson',
      email: 'driver@waterboy.com',
      password: 'drive2026',
      phone: '(916) 555-0101',
      vehicle: 'Ram ProMaster 2500',
      plate: '7WBY312',
      zone: 'zone_1',
      status: 'active',
      deliveriesToday: 14,
      deliveriesTotal: 1247,
      rating: 4.9,
      joinedAt: daysAgo(380),
      avatar: null,
    },
    {
      id: 'drv_2',
      name: 'Sofia Ramirez',
      email: 'sofia@waterboy.com',
      password: 'sofia2026',
      phone: '(916) 555-0102',
      vehicle: 'Ford Transit 250',
      plate: '8WBY445',
      zone: 'zone_2',
      status: 'active',
      deliveriesToday: 11,
      deliveriesTotal: 892,
      rating: 4.8,
      joinedAt: daysAgo(290),
      avatar: null,
    },
    {
      id: 'drv_3',
      name: 'Derek Okafor',
      email: 'derek@waterboy.com',
      password: 'derek2026',
      phone: '(916) 555-0103',
      vehicle: 'Chevy Express 2500',
      plate: '4WBY891',
      zone: 'zone_3',
      status: 'off_duty',
      deliveriesToday: 0,
      deliveriesTotal: 634,
      rating: 4.7,
      joinedAt: daysAgo(210),
      avatar: null,
    },
  ],

  promos: [
    { id:'promo_1', code:'WATER10',  type:'percent', value:10, minOrder:1000, maxUses:500,  uses:247, active:true,  expires: daysAgo(-30), desc:'10% off any order' },
    { id:'promo_2', code:'NEWDROP',  type:'fixed',   value:500, minOrder:1500, maxUses:200, uses:89,  active:true,  expires: daysAgo(-14), desc:'$5 off first order' },
    { id:'promo_3', code:'ELKGROVE', type:'percent', value:15, minOrder:2000, maxUses:1000, uses:412, active:true,  expires: daysAgo(-60), desc:'15% off for Elk Grove residents' },
    { id:'promo_4', code:'SUMMER25', type:'percent', value:25, minOrder:3000, maxUses:100,  uses:100, active:false, expires: daysAgo(10),  desc:'Summer 25% off (expired)' },
    { id:'promo_5', code:'FREESHIP', type:'fixed',   value:299, minOrder:500,  maxUses:999, uses:178, active:true,  expires: daysAgo(-90), desc:'$2.99 off (covers delivery)' },
  ],

  customers: [
    { id:'cust_1',  name:'Alex Torres',    email:'demo@waterboy.com',      password:'water2026', phone:'(916) 555-2001', address:'5842 Laguna Blvd',        city:'Elk Grove', zip:'95758', zone:'zone_1', bottles:4, joinedAt:daysAgo(365), loyaltyPts:2840, subscriptionActive:true,  subscriptionProduct:'prod_1', subscriptionFrequency:'weekly',    referralCode:'ALEX-8F2K', totalOrders:52, totalSpent:36400 },
    { id:'cust_2',  name:'Jamie Lee',      email:'jamie@example.com',       password:'demo1234',  phone:'(916) 555-2002', address:'9210 Bruceville Rd',      city:'Elk Grove', zip:'95757', zone:'zone_2', bottles:2, joinedAt:daysAgo(280), loyaltyPts:1420, subscriptionActive:false, subscriptionProduct:null,     subscriptionFrequency:null,        referralCode:'JAMI-K91P', totalOrders:28, totalSpent:18900 },
    { id:'cust_3',  name:'Morgan Chen',    email:'morgan@example.com',      password:'demo1234',  phone:'(916) 555-2003', address:'3401 Elk Grove Blvd',     city:'Elk Grove', zip:'95624', zone:'zone_3', bottles:6, joinedAt:daysAgo(190), loyaltyPts:3100, subscriptionActive:true,  subscriptionProduct:'prod_2', subscriptionFrequency:'biweekly',  referralCode:'MORG-W3X7', totalOrders:41, totalSpent:29800 },
    { id:'cust_4',  name:'Taylor Nguyen',  email:'taylor@example.com',      password:'demo1234',  phone:'(916) 555-2004', address:'7851 Calvine Rd',         city:'Elk Grove', zip:'95624', zone:'zone_1', bottles:3, joinedAt:daysAgo(120), loyaltyPts:760,  subscriptionActive:false, subscriptionProduct:null,     subscriptionFrequency:null,        referralCode:'TAYL-P5M2', totalOrders:14, totalSpent:9800 },
    { id:'cust_5',  name:'Jordan Rivera',  email:'jordan@example.com',      password:'demo1234',  phone:'(916) 555-2005', address:'1200 Harbour Point Dr',   city:'Elk Grove', zip:'95757', zone:'zone_2', bottles:5, joinedAt:daysAgo(400), loyaltyPts:4210, subscriptionActive:true,  subscriptionProduct:'prod_3', subscriptionFrequency:'weekly',    referralCode:'JORD-Q8T4', totalOrders:68, totalSpent:52100 },
    { id:'cust_6',  name:'Riley Park',     email:'riley@example.com',       password:'demo1234',  phone:'(916) 555-2006', address:'4490 Stonefield Dr',      city:'Elk Grove', zip:'95758', zone:'zone_4', bottles:2, joinedAt:daysAgo(60),  loyaltyPts:340,  subscriptionActive:false, subscriptionProduct:null,     subscriptionFrequency:null,        referralCode:'RILE-N2V9', totalOrders:7,  totalSpent:4900 },
    { id:'cust_7',  name:'Cameron Walsh',  email:'cameron@example.com',     password:'demo1234',  phone:'(916) 555-2007', address:'8801 Sheldon Rd',         city:'Elk Grove', zip:'95624', zone:'zone_3', bottles:4, joinedAt:daysAgo(230), loyaltyPts:1880, subscriptionActive:true,  subscriptionProduct:'prod_1', subscriptionFrequency:'monthly',   referralCode:'CAME-H6L3', totalOrders:33, totalSpent:23100 },
    { id:'cust_8',  name:'Drew Patel',     email:'drew@example.com',        password:'demo1234',  phone:'(916) 555-2008', address:'2200 Vineyard Blvd',      city:'Elk Grove', zip:'95758', zone:'zone_4', bottles:1, joinedAt:daysAgo(45),  loyaltyPts:190,  subscriptionActive:false, subscriptionProduct:null,     subscriptionFrequency:null,        referralCode:'DREW-C4R8', totalOrders:4,  totalSpent:2800 },
    { id:'cust_9',  name:'Avery Kim',      email:'avery@example.com',       password:'demo1234',  phone:'(916) 555-2009', address:'6625 Laguna Blvd #204',   city:'Elk Grove', zip:'95758', zone:'zone_1', bottles:3, joinedAt:daysAgo(310), loyaltyPts:2220, subscriptionActive:true,  subscriptionProduct:'prod_2', subscriptionFrequency:'biweekly',  referralCode:'AVER-Z7J5', totalOrders:44, totalSpent:31200 },
    { id:'cust_10', name:'Blake Martin',   email:'blake@example.com',       password:'demo1234',  phone:'(916) 555-2010', address:'1050 Iron Point Rd',      city:'Folsom',    zip:'95630', zone:'zone_1', bottles:2, joinedAt:daysAgo(155), loyaltyPts:910,  subscriptionActive:false, subscriptionProduct:null,     subscriptionFrequency:null,        referralCode:'BLAK-F1Q6', totalOrders:18, totalSpent:12600 },
    { id:'cust_11', name:'Skylar Brooks',  email:'skylar@example.com',      password:'demo1234',  phone:'(916) 555-2011', address:'9900 Gerber Rd',          city:'Elk Grove', zip:'95624', zone:'zone_3', bottles:6, joinedAt:daysAgo(500), loyaltyPts:5600, subscriptionActive:true,  subscriptionProduct:'prod_1', subscriptionFrequency:'weekly',    referralCode:'SKYL-M9B2', totalOrders:87, totalSpent:61000 },
    { id:'cust_12', name:'Quinn Flores',   email:'quinn@example.com',       password:'demo1234',  phone:'(916) 555-2012', address:'3300 Bruceville Rd',      city:'Elk Grove', zip:'95757', zone:'zone_2', bottles:4, joinedAt:daysAgo(88),  loyaltyPts:520,  subscriptionActive:false, subscriptionProduct:null,     subscriptionFrequency:null,        referralCode:'QUIN-T3W0', totalOrders:9,  totalSpent:6300 },
    { id:'cust_13', name:'Peyton Scott',   email:'peyton@example.com',      password:'demo1234',  phone:'(916) 555-2013', address:'7720 Waterman Dr',        city:'Elk Grove', zip:'95758', zone:'zone_4', bottles:2, joinedAt:daysAgo(200), loyaltyPts:1240, subscriptionActive:true,  subscriptionProduct:'prod_1', subscriptionFrequency:'biweekly',  referralCode:'PEYT-A5D1', totalOrders:25, totalSpent:17500 },
    { id:'cust_14', name:'Reese Murphy',   email:'reese@example.com',       password:'demo1234',  phone:'(916) 555-2014', address:'550 Gibson Dr',           city:'Elk Grove', zip:'95624', zone:'zone_3', bottles:3, joinedAt:daysAgo(75),  loyaltyPts:440,  subscriptionActive:false, subscriptionProduct:null,     subscriptionFrequency:null,        referralCode:'REES-G8K4', totalOrders:8,  totalSpent:5600 },
    { id:'cust_15', name:'Finley Adams',   email:'finley@example.com',      password:'demo1234',  phone:'(916) 555-2015', address:'4100 Vineyard Blvd',      city:'Elk Grove', zip:'95758', zone:'zone_4', bottles:5, joinedAt:daysAgo(420), loyaltyPts:3780, subscriptionActive:true,  subscriptionProduct:'prod_2', subscriptionFrequency:'weekly',    referralCode:'FINL-U2P7', totalOrders:61, totalSpent:43500 },
  ],

  buildOrders() {
    const statuses = ['delivered','delivered','delivered','delivered','out_for_delivery','preparing','confirmed','pending'];
    const drivers  = ['drv_1','drv_2','drv_3'];
    const products = ['prod_1','prod_2','prod_3','prod_4'];
    const orders   = [];

    const snap = [
      // Recent active
      { custId:'cust_1', prodId:'prod_1', qty:4, daysBack:0, hrs:3,  status:'out_for_delivery', drvId:'drv_1' },
      { custId:'cust_3', prodId:'prod_2', qty:2, daysBack:0, hrs:1,  status:'preparing',        drvId:'drv_1' },
      { custId:'cust_9', prodId:'prod_2', qty:3, daysBack:0, hrs:5,  status:'confirmed',        drvId:'drv_2' },
      { custId:'cust_5', prodId:'prod_3', qty:2, daysBack:0, hrs:2,  status:'out_for_delivery', drvId:'drv_2' },
      { custId:'cust_11',prodId:'prod_1', qty:6, daysBack:0, hrs:7,  status:'pending',          drvId:null    },
      { custId:'cust_15',prodId:'prod_2', qty:4, daysBack:0, hrs:4,  status:'preparing',        drvId:'drv_1' },
      // Today delivered
      { custId:'cust_2', prodId:'prod_1', qty:2, daysBack:0, hrs:10, status:'delivered',        drvId:'drv_1' },
      { custId:'cust_7', prodId:'prod_1', qty:4, daysBack:0, hrs:9,  status:'delivered',        drvId:'drv_2' },
      { custId:'cust_13',prodId:'prod_1', qty:2, daysBack:0, hrs:8,  status:'delivered',        drvId:'drv_2' },
    ];

    snap.forEach((s, i) => {
      const prod = SEED.products.find(p => p.id === s.prodId);
      const cust = SEED.customers.find(c => c.id === s.custId);
      const subtotal = prod.price * s.qty;
      const delivery = 299;
      const discount = 0;
      orders.push({
        id: 'ord_s' + String(i+1).padStart(3,'0'),
        customerId: s.custId,
        customerName: cust.name,
        customerAddress: cust.address + ', ' + cust.city,
        driverId: s.drvId,
        items: [{ productId: s.prodId, productName: prod.name, qty: s.qty, price: prod.price }],
        subtotal,
        deliveryFee: delivery,
        discount,
        total: subtotal + delivery - discount,
        promoCode: null,
        status: s.status,
        zone: cust.zone,
        createdAt: hoursAgo(s.hrs),
        updatedAt: hoursAgo(Math.max(0, s.hrs - 1)),
        scheduledFor: null,
        notes: '',
        rating: s.status === 'delivered' ? (4 + Math.round(Math.random())) : null,
      });
    });

    // Historical orders — 25 more spread over past 30 days
    const custs = SEED.customers;
    for (let i = 0; i < 25; i++) {
      const cust = custs[i % custs.length];
      const prodId = products[i % products.length];
      const prod = SEED.products.find(p => p.id === prodId);
      const qty = (i % 4) + 1;
      const subtotal = prod.price * qty;
      const delivery = 299;
      const promoOff = i % 5 === 0 ? 500 : 0;
      orders.push({
        id: 'ord_h' + String(i+1).padStart(3,'0'),
        customerId: cust.id,
        customerName: cust.name,
        customerAddress: cust.address + ', ' + cust.city,
        driverId: drivers[i % 3],
        items: [{ productId: prodId, productName: prod.name, qty, price: prod.price }],
        subtotal,
        deliveryFee: delivery,
        discount: promoOff,
        total: subtotal + delivery - promoOff,
        promoCode: i % 5 === 0 ? 'WATER10' : null,
        status: 'delivered',
        zone: cust.zone,
        createdAt: daysAgo(Math.floor(i * 1.2) + 1),
        updatedAt: daysAgo(Math.floor(i * 1.2)),
        scheduledFor: null,
        notes: '',
        rating: 4 + (i % 2),
      });
    }

    return orders;
  },

  notifications: [
    { id:'notif_1', userId:'cust_1', type:'order_update', title:'Order Out for Delivery!', body:'Your 4 bottles are on the way. Marcus is about 30 min away.', read:false, createdAt:hoursAgo(3),  orderId:'ord_s001' },
    { id:'notif_2', userId:'cust_1', type:'promo',        title:'New Promo: ELKGROVE',     body:'Get 15% off your next order with code ELKGROVE. Expires in 60 days.',  read:false, createdAt:hoursAgo(24), orderId:null },
    { id:'notif_3', userId:'cust_1', type:'order_update', title:'Order Delivered ✓',       body:'Your last order of 2 bottles was delivered. Rate your experience!',    read:true,  createdAt:daysAgo(3),   orderId:'ord_h001' },
    { id:'notif_4', userId:'cust_1', type:'subscription', title:'Subscription Reminder',   body:'Your weekly delivery is scheduled for tomorrow between 10am–2pm.',     read:true,  createdAt:daysAgo(6),   orderId:null },
    { id:'notif_5', userId:'cust_1', type:'loyalty',      title:'You earned 70 pts!',      body:'Keep ordering to reach Silver status (500 pts away).',                 read:true,  createdAt:daysAgo(8),   orderId:null },
  ],

  inventory: [
    { id:'inv_1', productId:'prod_1', label:'5-Gal RO — Stock',    qty:480, unit:'bottles', lowAt:50  },
    { id:'inv_2', productId:'prod_2', label:'5-Gal Alkaline — Stock', qty:312, unit:'bottles', lowAt:50 },
    { id:'inv_3', productId:'prod_3', label:'5-Gal Hydrogen — Stock', qty:88,  unit:'bottles', lowAt:20 },
    { id:'inv_4', productId:'prod_4', label:'3-Gal RO — Stock',    qty:175, unit:'bottles', lowAt:30  },
    { id:'inv_5', productId:'prod_7', label:'40 lb Ice Bags',       qty:240, unit:'bags',    lowAt:30  },
    { id:'inv_6', productId:'prod_8', label:'5-Gal Jugs (empty)',   qty:62,  unit:'jugs',    lowAt:10  },
    { id:'inv_7', productId:'prod_9', label:'3-Gal Jugs (empty)',   qty:44,  unit:'jugs',    lowAt:10  },
    { id:'inv_8', productId:'prod_5', label:'Standard Dispensers',  qty:12,  unit:'units',   lowAt:3   },
    { id:'inv_9', productId:'prod_6', label:'Premium Dispensers',   qty:7,   unit:'units',   lowAt:2   },
  ],

  settings: {
    businessName: 'Waterboy Delivery',
    phone: '(916) 555-0199',
    email: 'info@waterboydelivery.com',
    address: '9210 Laguna Main St, Elk Grove, CA 95758',
    deliveryFee: 299,
    freeDeliveryThreshold: 3000,
    loyaltyPointsPerDollar: 2,
    loyaltyRedeemRate: 100, // 100 pts = $1
    taxRate: 0,
    deliveryWindowStart: '9:00 AM',
    deliveryWindowEnd: '6:00 PM',
    seasonalTheme: 'summer',
    maintenanceMode: false,
    newOrderNotifications: true,
  },
};

// ============================================================
// SEED INITIALIZER
// ============================================================
function seedData() {
  if (Store.get(WB.KEYS.seeded)) return;

  Store.set(WB.KEYS.products,   SEED.products);
  Store.set(WB.KEYS.zones,      SEED.zones);
  Store.set(WB.KEYS.drivers,    SEED.drivers);
  Store.set(WB.KEYS.promos,     SEED.promos);
  Store.set(WB.KEYS.customers,  SEED.customers);
  Store.set(WB.KEYS.orders,     SEED.buildOrders());
  Store.set(WB.KEYS.notifications, SEED.notifications);
  Store.set(WB.KEYS.inventory,  SEED.inventory);
  Store.set(WB.KEYS.settings,   SEED.settings);
  Store.set(WB.KEYS.pickups,    []);

  // Pre-block all Sundays for the next 6 months
  const blockedSundays = [];
  const sun = new Date(); sun.setHours(0,0,0,0);
  while (sun.getDay() !== 0) sun.setDate(sun.getDate() + 1);
  for (let i = 0; i < 27; i++) {
    blockedSundays.push(sun.toISOString().slice(0,10));
    sun.setDate(sun.getDate() + 7);
  }
  Store.set(WB.KEYS.blockedDates, blockedSundays);
  Store.set(WB.KEYS.seeded,     true);
}

// ============================================================
// AUTH
// ============================================================
const Auth = {
  login(role, email, password) {
    if (role === 'customer') {
      const custs = Store.getList(WB.KEYS.customers);
      const cust = custs.find(c => c.email === email && c.password === password);
      if (!cust) return null;
      Store.set(WB.KEYS.currentUser, { role:'customer', id: cust.id, email: cust.email, name: cust.name });
      return cust;
    }
    if (role === 'driver') {
      const drvs = Store.getList(WB.KEYS.drivers);
      const drv = drvs.find(d => d.email === email && d.password === password);
      if (!drv) return null;
      Store.set(WB.KEYS.currentUser, { role:'driver', id: drv.id, email: drv.email, name: drv.name });
      return drv;
    }
    if (role === 'admin') {
      if (email === WB.CREDS.admin.email && password === WB.CREDS.admin.password) {
        Store.set(WB.KEYS.currentUser, { role:'admin', id:'admin_1', email, name:'Admin' });
        return { id:'admin_1', email, name:'Admin', role:'admin' };
      }
      return null;
    }
    return null;
  },

  logout() {
    Store.set(WB.KEYS.currentUser, null);
  },

  current() {
    return Store.get(WB.KEYS.currentUser);
  },

  requireRole(role) {
    const user = Auth.current();
    if (!user || user.role !== role) {
      window.location.href = 'index.html';
      return null;
    }
    return user;
  },
};

// ============================================================
// TOAST SYSTEM
// ============================================================
const Toast = {
  _container: null,

  init() {
    if (this._container) return;
    this._container = document.getElementById('toast-container');
    if (!this._container) {
      this._container = document.createElement('div');
      this._container.id = 'toast-container';
      document.body.appendChild(this._container);
    }
  },

  show(type = 'info', title = '', msg = '', duration = 3800) {
    this.init();
    const icons = {
      success: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
      error:   `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
      warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      info:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
    };

    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `
      <div class="toast-icon">${icons[type] || icons.info}</div>
      <div class="toast-body">
        <div class="toast-title">${title}</div>
        ${msg ? `<div class="toast-msg">${msg}</div>` : ''}
      </div>
      <button class="toast-close" aria-label="Close">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>`;

    this._container.appendChild(t);
    requestAnimationFrame(() => { requestAnimationFrame(() => { t.classList.add('show'); }); });

    const dismiss = () => {
      t.classList.add('hiding');
      setTimeout(() => t.remove(), 350);
    };

    t.querySelector('.toast-close').addEventListener('click', dismiss);
    setTimeout(dismiss, duration);
  },

  success(title, msg, dur) { this.show('success', title, msg, dur); },
  error(title, msg, dur)   { this.show('error', title, msg, dur); },
  warning(title, msg, dur) { this.show('warning', title, msg, dur); },
  info(title, msg, dur)    { this.show('info', title, msg, dur); },
};

// ============================================================
// MODAL HELPER
// ============================================================
const Modal = {
  open(overlayId) {
    const el = document.getElementById(overlayId);
    if (!el) return;
    el.classList.add('open');
    document.body.style.overflow = 'hidden';
  },
  close(overlayId) {
    const el = document.getElementById(overlayId);
    if (!el) return;
    el.classList.remove('open');
    document.body.style.overflow = '';
  },
  init(overlayId) {
    const el = document.getElementById(overlayId);
    if (!el) return;
    el.addEventListener('click', e => {
      if (e.target === el) Modal.close(overlayId);
    });
    el.querySelectorAll('[data-close-modal]').forEach(btn => {
      btn.addEventListener('click', () => Modal.close(overlayId));
    });
  },
};

// ============================================================
// ORDER HELPERS
// ============================================================
const Orders = {
  getAll()      { return Store.getList(WB.KEYS.orders); },
  getById(id)   { return Store.findById(WB.KEYS.orders, id); },
  getForCustomer(custId) {
    return this.getAll().filter(o => o.customerId === custId).sort((a,b) => b.createdAt - a.createdAt);
  },
  getForDriver(drvId) {
    return this.getAll()
      .filter(o => o.driverId === drvId && o.status !== 'delivered' && o.status !== 'cancelled')
      .sort((a,b) => a.createdAt - b.createdAt);
  },
  getActiveToday() {
    const midnight = new Date(); midnight.setHours(0,0,0,0);
    return this.getAll().filter(o =>
      o.createdAt >= midnight.getTime() &&
      o.status !== 'cancelled'
    );
  },
  create(customerId, items, promoCode = null) {
    const cust = Store.findById(WB.KEYS.customers, customerId);
    if (!cust) return null;

    const products = Store.getList(WB.KEYS.products);
    let subtotal = 0;
    const lineItems = items.map(item => {
      const prod = products.find(p => p.id === item.productId);
      subtotal += prod.price * item.qty;
      return { productId: prod.id, productName: prod.name, qty: item.qty, price: prod.price };
    });

    const settings = Store.get(WB.KEYS.settings) || SEED.settings;
    const deliveryFee = subtotal >= settings.freeDeliveryThreshold ? 0 : settings.deliveryFee;
    let discount = 0;

    if (promoCode) {
      const promo = Store.getList(WB.KEYS.promos).find(p => p.code === promoCode && p.active);
      if (promo && subtotal >= promo.minOrder) {
        discount = promo.type === 'percent'
          ? Math.round(subtotal * promo.value / 100)
          : promo.value;
        Store.updateItem(WB.KEYS.promos, promo.id, { uses: promo.uses + 1 });
      }
    }

    const order = {
      id: uid('ord_'),
      customerId,
      customerName: cust.name,
      customerAddress: cust.address + ', ' + cust.city,
      driverId: null,
      items: lineItems,
      subtotal,
      deliveryFee,
      discount,
      total: subtotal + deliveryFee - discount,
      promoCode,
      status: 'pending',
      zone: cust.zone,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      scheduledFor: null,
      notes: '',
      rating: null,
    };

    Store.push(WB.KEYS.orders, order);

    // Award loyalty points
    const pts = Math.floor((order.total / 100) * (settings.loyaltyPointsPerDollar || 2));
    Store.updateItem(WB.KEYS.customers, customerId, {
      loyaltyPts: (cust.loyaltyPts || 0) + pts,
      totalOrders: (cust.totalOrders || 0) + 1,
      totalSpent: (cust.totalSpent || 0) + order.total,
    });

    return order;
  },

  updateStatus(orderId, newStatus) {
    return Store.updateItem(WB.KEYS.orders, orderId, { status: newStatus });
  },

  statusLabel(status) {
    return WB.STATUS_LABELS[status] || status;
  },

  statusBadgeClass(status) {
    const map = {
      pending:          'badge-yellow',
      confirmed:        'badge-blue',
      preparing:        'badge-cyan',
      out_for_delivery: 'badge badge-ghost',
      delivered:        'badge-green',
      cancelled:        'badge-red',
    };
    return map[status] || 'badge-ghost';
  },
};

// ============================================================
// CART
// ============================================================
const Cart = {
  get()       { return Store.get(WB.KEYS.cartKey) || []; },
  save(items) { Store.set(WB.KEYS.cartKey, items); },
  count()     { return this.get().reduce((sum, i) => sum + i.qty, 0); },
  total()     { return this.get().reduce((sum, i) => sum + i.price * i.qty, 0); },
  add(productId, qty = 1) {
    const items = this.get();
    const products = Store.getList(WB.KEYS.products);
    const prod = products.find(p => p.id === productId);
    if (!prod) return;
    const existing = items.find(i => i.productId === productId);
    if (existing) { existing.qty += qty; }
    else { items.push({ productId, productName: prod.name, qty, price: prod.price }); }
    this.save(items);
  },
  remove(productId) {
    this.save(this.get().filter(i => i.productId !== productId));
  },
  setQty(productId, qty) {
    if (qty <= 0) { this.remove(productId); return; }
    const items = this.get();
    const item = items.find(i => i.productId === productId);
    if (item) { item.qty = qty; this.save(items); }
  },
  clear() { Store.set(WB.KEYS.cartKey, []); },
};

// ============================================================
// NOTIFICATIONS
// ============================================================
const Notifs = {
  getForUser(userId) {
    return Store.getList(WB.KEYS.notifications)
      .filter(n => n.userId === userId)
      .sort((a,b) => b.createdAt - a.createdAt);
  },
  unreadCount(userId) {
    return this.getForUser(userId).filter(n => !n.read).length;
  },
  markRead(notifId) {
    Store.updateItem(WB.KEYS.notifications, notifId, { read: true });
  },
  markAllRead(userId) {
    const all = Store.getList(WB.KEYS.notifications);
    all.forEach(n => { if (n.userId === userId) n.read = true; });
    Store.set(WB.KEYS.notifications, all);
  },
  push(userId, type, title, body, orderId = null) {
    Store.push(WB.KEYS.notifications, {
      id: uid('notif_'),
      userId, type, title, body, orderId,
      read: false,
      createdAt: Date.now(),
    });
  },
};

// ============================================================
// PROMO VALIDATOR
// ============================================================
function validatePromo(code, subtotal) {
  const promos = Store.getList(WB.KEYS.promos);
  const promo = promos.find(p => p.code.toUpperCase() === code.toUpperCase() && p.active);
  if (!promo)                              return { ok:false, msg:'Invalid promo code.' };
  if (subtotal < promo.minOrder)           return { ok:false, msg:`Min order ${fmtMoney(promo.minOrder)} required.` };
  if (promo.uses >= promo.maxUses)         return { ok:false, msg:'Promo code limit reached.' };
  if (promo.expires < Date.now())          return { ok:false, msg:'Promo code has expired.' };
  const discount = promo.type === 'percent'
    ? Math.round(subtotal * promo.value / 100)
    : promo.value;
  return { ok:true, promo, discount, label: promo.type === 'percent' ? `-${promo.value}%` : `-${fmtMoney(promo.value)}` };
}

// ============================================================
// STATS / ANALYTICS
// ============================================================
const Analytics = {
  summary() {
    const orders = Orders.getAll();
    const delivered = orders.filter(o => o.status === 'delivered');
    const active = orders.filter(o => !['delivered','cancelled'].includes(o.status));
    const revenue = delivered.reduce((s, o) => s + o.total, 0);
    const customers = Store.getList(WB.KEYS.customers).length;
    const todayDelivered = Orders.getActiveToday().filter(o => o.status === 'delivered');

    return {
      totalRevenue: revenue,
      totalOrders: orders.length,
      deliveredOrders: delivered.length,
      activeOrders: active.length,
      totalCustomers: customers,
      todayDeliveries: todayDelivered.length,
      avgOrderValue: delivered.length ? Math.round(revenue / delivered.length) : 0,
    };
  },

  revenueByDay(days = 7) {
    const orders = Orders.getAll().filter(o => o.status === 'delivered');
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const start = daysAgo(i); const end = daysAgo(i - 1);
      const day = orders.filter(o => o.createdAt >= start && o.createdAt < end);
      const d = new Date(start);
      result.push({
        label: d.toLocaleDateString('en-US', { weekday:'short' }),
        revenue: day.reduce((s, o) => s + o.total, 0),
        count: day.length,
      });
    }
    return result;
  },
};

// ============================================================
// INIT
// ============================================================
seedData();
