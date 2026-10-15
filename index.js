'use strict';

const fs = require('fs');
const path = require('path');
const TelegramBotModule = require('node-telegram-bot-api');
const TelegramBot = TelegramBotModule.TelegramBot || TelegramBotModule;

// ==========================================
// 1. CONFIGURATION (यहाँ अपनी डिटेल्स डालें)
// ==========================================
const CONFIG = {
  BOT_TOKEN: '8976317241:AAHMNAKLK6u8SEPTFEhLDzJ99zGAg9BYNvw', // BotFather से मिला टोकन
  ADMIN_ID: 7387637559,                 // आपकी न्यूमेरिकल Telegram ID
  CHANNEL_ID: '-100XXXXXXXXXX',         // चैनल की ID (जैसे -1003421461954)
  CHANNEL_LINK: 'https://t.me/RohitCoderOfficial', // चैनल की लिंक
  FAMGATEWAY_API_KEY: 'fam_0e3e071d033f916d2d1a8106be4d8f8d759a9ee0',   // FamGateway API Key
  BRAND_NAME: 'KAKAROT STORE',
  SUPPORT_WHATSAPP: 'https://wa.me/message/IMKKMOIZIVNWO1',
  SUPPORT_TELEGRAM: 'https://t.me/rohitxpapaji'
};

const bot = new TelegramBot(CONFIG.BOT_TOKEN, { polling: true });

// फ़ाइल पाथ्स
const USERS_FILE = path.join(__dirname, 'users.json');
const ORDERS_FILE = path.join(__dirname, 'orders.json');
const PRODUCTS_FILE = path.join(__dirname, 'products.json');

// स्क्रीनशॉट के अनुसार 9 प्रोडक्ट्स ⚡ इमोजी और प्राइसेस के साथ
const DEFAULT_PRODUCTS = {
  all: [
    { id: 'bind_gmail_unbind', name: '⚡ Bind GMail & Unbind', price: 400, delivery: 'Digital Service' },
    { id: 'double_re_subscribe', name: '⚡ Double Re-Subscribe', price: 1200, delivery: 'Digital Service' },
    { id: 'ban_acc_login', name: '⚡ Ban Acc Login', price: 400, delivery: 'Digital Service' },
    { id: '30_days_ban_file', name: '⚡ 30 DAYS BAN FILE', price: 200, delivery: 'Digital Service' },
    { id: 'unbind_glitch_file', name: '⚡ UNBIND Glitch FILE', price: 500, delivery: 'Digital Service' },
    { id: 'access_token_security_code', name: '⚡ Access token Security Code', price: 200, delivery: 'Digital Service' },
    { id: 'black_list_gmail', name: '⚡ Black-list Gmail', price: 400, delivery: 'Digital Service' },
    { id: 'main_id_noon_root_panel', name: '⚡ MAIN ID NOON ROOT PANEL', price: 100, delivery: 'Digital Service' },
    { id: 'instagram_username_ban_file', name: '⚡ INSTAGRAM USERNAME BAN FILE', price: 99, delivery: 'Digital Service' }
  ]
};

// ==========================================
// 2. FILE HELPERS
// ==========================================
function ensureFile(file, value) {
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify(value, null, 2), 'utf8');
  }
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    return fallback;
  }
}

function writeJson(file, value) {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(value, null, 2), 'utf8');
  fs.renameSync(temp, file);
}

ensureFile(USERS_FILE, {});
ensureFile(ORDERS_FILE, {});
writeJson(PRODUCTS_FILE, DEFAULT_PRODUCTS);

let users = readJson(USERS_FILE, {});
let orders = readJson(ORDERS_FILE, {});
let products = DEFAULT_PRODUCTS;
const paymentTimers = new Map();

function saveUsers() { writeJson(USERS_FILE, users); }
function saveOrders() { writeJson(ORDERS_FILE, orders); }
function now() { return new Date().toISOString(); }

function isAdmin(userId) {
  return Number(userId) === Number(CONFIG.ADMIN_ID);
}

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function button(text, callback_data) { return { text, callback_data }; }
function keyboard(rows) { return { inline_keyboard: rows }; }

function generateOrderId() {
  return `ORD-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// यूज़र का नाम Telegram प्रोफ़ाइल से स्वतः उठाएगा
function getUser(userId, chatId, telegramUser) {
  const key = String(userId);
  const fullName = [telegramUser?.first_name, telegramUser?.last_name].filter(Boolean).join(' ') || telegramUser?.username || 'User';

  if (!users[key]) {
    users[key] = {
      userId: Number(userId),
      chatId: Number(chatId),
      name: fullName,
      username: telegramUser?.username || '',
      balance: 0,
      phone: '',
      awaiting: null,
      screenMessageId: null,
      createdAt: now()
    };
  } else {
    users[key].chatId = Number(chatId);
    users[key].name = fullName;
    users[key].username = telegramUser?.username || users[key].username;
  }
  saveUsers();
  return users[key];
}

async function safeDelete(chatId, messageId) {
  if (!messageId) return;
  try { await bot.deleteMessage(chatId, messageId); } catch (_) {}
}

async function clearScreen(user) {
  if (!user || !user.screenMessageId) return;
  await safeDelete(user.chatId, user.screenMessageId);
  user.screenMessageId = null;
  saveUsers();
}

async function replaceMessage(user, text, options = {}) {
  await clearScreen(user);
  const sent = await bot.sendMessage(user.chatId, text, options);
  user.screenMessageId = sent.message_id;
  saveUsers();
  return sent;
}

// चैनल जॉइन चेक
async function memberCheck(userId) {
  if (!CONFIG.CHANNEL_ID) return true;
  try {
    const member = await bot.getChatMember(String(CONFIG.CHANNEL_ID), userId);
    return ['creator', 'administrator', 'member'].includes(member.status);
  } catch (error) {
    return true; // अगर बॉट चैनल में एडमिन न हो तो एरर से बचने के लिए
  }
}

async function showJoin(user) {
  return replaceMessage(
    user,
    `<b>🔥 ${escapeHtml(CONFIG.BRAND_NAME)}</b>\n\n<b>🔒 CHANNEL ACCESS REQUIRED</b>\n\nहमारे ऑफिशियल चैनल को जॉइन करें ताकि आप स्टोर इस्तेमाल कर सकें।`,
    {
      parse_mode: 'HTML',
      reply_markup: keyboard([
        [{ text: '📢 JOIN OFFICIAL CHANNEL', url: CONFIG.CHANNEL_LINK }],
        [button("✅ I'VE JOINED", 'check_join')]
      ])
    }
  );
}

// ==========================================
// 3. UI VIEWS
// ==========================================

// मुख्य होम मेनू (वेलकम स्क्रीन)
async function showStore(user) {
  user.awaiting = null;
  saveUsers();

  const text = 
`👋 <b>Welcome, <i>${escapeHtml(user.name)}!</i></b>

🛍️ <b>Digital Store</b>
💰 <b>Balance: ₹${user.balance || 0}</b>

✨ <b>Choose an option below:</b>`;

  return replaceMessage(user, text, {
    parse_mode: 'HTML',
    reply_markup: keyboard([
      [button('Products', 'menu_products'), button('My Orders', 'menu_orders')],
      [button('Deposit History', 'menu_deposits')],
      [button('Add Balance', 'menu_add_balance'), button('Support', 'menu_support')]
    ])
  });
}

// सपोर्ट सेंटर मेनू (WhatsApp और Telegram)
async function showSupport(user) {
  return replaceMessage(
    user,
    `📊 <b>Support Center</b>\n\nChoose a support option below.`,
    {
      parse_mode: 'HTML',
      reply_markup: keyboard([
        [{ text: '💬 WhatsApp Support ↗', url: CONFIG.SUPPORT_WHATSAPP }],
        [{ text: '✈️ Telegram Support ↗', url: CONFIG.SUPPORT_TELEGRAM }],
        [button('« Back', 'home')]
      ])
    }
  );
}

// सभी प्रोडक्ट्स (⚡ इमोजी और प्राइसेस के साथ)
async function showProducts(user) {
  const rows = DEFAULT_PRODUCTS.all.map(item => [
    button(`${item.name} • ₹${item.price}`, `buy:${item.id}`)
  ]);
  rows.push([button('Back', 'home')]);

  return replaceMessage(
    user,
    `⚡ <b>All Products</b>\n\nSelect a product to view details.`,
    {
      parse_mode: 'HTML',
      reply_markup: keyboard(rows)
    }
  );
}

// ==========================================
// 4. GATEWAY & PAYMENTS (FamGateway)
// ==========================================
async function gatewayCreate(amount, user) {
  const url = `https://famgateway.in/api/qr.php?api_key=${encodeURIComponent(CONFIG.FAMGATEWAY_API_KEY)}&amount=${encodeURIComponent(amount)}&customer_name=${encodeURIComponent(user.name)}&customer_phone=${encodeURIComponent(user.phone || '9999999999')}`;

  const res = await fetch(url);
  const data = await res.json();
  if (data.status !== 'success') throw new Error(data.message || 'Payment creation failed');
  return data.data;
}

async function gatewayVerify(orderId) {
  const url = `https://famgateway.in/api/verify-order.php?api_key=${encodeURIComponent(CONFIG.FAMGATEWAY_API_KEY)}&order_id=${encodeURIComponent(orderId)}`;
  const res = await fetch(url);
  return res.json();
}

function startPaymentPolling(order) {
  const timer = setInterval(async () => {
    try {
      const res = await gatewayVerify(order.gatewayOrderId);
      const status = (res?.data?.payment_status || res?.status || '').toLowerCase();
      if (['paid', 'success', 'completed'].includes(status)) {
        clearInterval(timer);
        paymentTimers.delete(order.orderId);
        order.status = 'PAID';
        saveOrders();

        const user = users[String(order.userId)];
        if (user) {
          user.balance = (Number(user.balance) || 0) + Number(order.amount);
          saveUsers();
          await bot.sendMessage(user.chatId, `✅ <b>Payment Successful!</b>\n\n₹${order.amount} आपके वॉलेट में जुड़ चुके हैं।`, { parse_mode: 'HTML' });
          showStore(user);
        }
      }
    } catch (_) {}
  }, 5000);

  paymentTimers.set(order.orderId, timer);
}

// ==========================================
// 5. EVENT HANDLERS
// ==========================================
bot.on('callback_query', async query => {
  const data = query.data;
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const user = getUser(userId, chatId, query.from);

  await bot.answerCallbackQuery(query.id).catch(() => {});

  if (data === 'check_join' || data === 'home') {
    const joined = await memberCheck(userId);
    return joined ? showStore(user) : showJoin(user);
  }

  if (data === 'menu_products') return showProducts(user);
  if (data === 'menu_support') return showSupport(user);

  if (data === 'menu_add_balance') {
    user.awaiting = 'amount';
    saveUsers();
    return replaceMessage(
      user,
      `💰 <b>ENTER YOUR DEPOSIT AMOUNT</b>\n━━━━━━━━━━━━━━━━━━━\n\n🔹 Minimum Deposit: <b>₹1</b>\n\n🔹 Enter the amount you want to add.\n━━━━━━━━━━━━━━━━━━━\n\n💡 <i>Example:</i> 100`,
      {
        parse_mode: 'HTML',
        reply_markup: keyboard([[button('« Back', 'home')]])
      }
    );
  }

  if (data.startsWith('buy:')) {
    const prodId = data.replace('buy:', '');
    const product = DEFAULT_PRODUCTS.all.find(p => p.id === prodId);
    if (!product) return showStore(user);

    if (Number(user.balance) >= product.price) {
      user.balance -= product.price;
      const orderId = generateOrderId();
      orders[orderId] = {
        orderId,
        userId: user.userId,
        productName: product.name,
        amount: product.price,
        status: 'PAID',
        createdAt: now()
      };
      saveOrders();
      saveUsers();

      return replaceMessage(user, `🎉 <b>Purchase Successful!</b>\n\n<b>Item:</b> ${escapeHtml(product.name)}\n<b>Paid:</b> ₹${product.price}\n<b>Remaining Balance:</b> ₹${user.balance}\n\nडिटेल्स के लिए सपोर्ट पर संपर्क करें।`, {
        parse_mode: 'HTML',
        reply_markup: keyboard([[button('« Back to Store', 'home')]])
      });
    } else {
      return replaceMessage(user, `❌ <b>Insufficient Balance!</b>\n\nकीमत: ₹${product.price}\nआपका बैलेंस: ₹${user.balance || 0}\n\nकृपया पहले 'Add Balance' करें।`, {
        parse_mode: 'HTML',
        reply_markup: keyboard([
          [button('➕ Add Balance', 'menu_add_balance')],
          [button('« Back', 'menu_products')]
        ])
      });
    }
  }

  if (data === 'menu_orders') {
    const myOrders = Object.values(orders).filter(o => Number(o.userId) === Number(userId));
    if (!myOrders.length) {
      return replaceMessage(user, `📁 <b>My Orders</b>\n\nआपने अभी तक कोई आर्डर नहीं किया है।`, {
        parse_mode: 'HTML',
        reply_markup: keyboard([[button('« Back', 'home')]])
      });
    }
    let text = `📁 <b>My Orders</b>\n\n`;
    for (const ord of myOrders.slice(-5).reverse()) {
      text += `• ${ord.productName} — ₹${ord.amount} (${ord.status})\n`;
    }
    return replaceMessage(user, text, {
      parse_mode: 'HTML',
      reply_markup: keyboard([[button('« Back', 'home')]])
    });
  }

  if (data === 'menu_deposits') {
    const myDeposits = Object.values(orders).filter(o => Number(o.userId) === Number(userId) && o.gatewayOrderId);
    if (!myDeposits.length) {
      return replaceMessage(user, `💳 <b>Deposit History</b>\n\nकोई डिपॉजिट रिकॉर्ड नहीं मिला।`, {
        parse_mode: 'HTML',
        reply_markup: keyboard([[button('« Back', 'home')]])
      });
    }
    let text = `💳 <b>Deposit History</b>\n\n`;
    for (const dep of myDeposits.slice(-5).reverse()) {
      text += `• Added ₹${dep.amount} — ${dep.status}\n`;
    }
    return replaceMessage(user, text, {
      parse_mode: 'HTML',
      reply_markup: keyboard([[button('« Back', 'home')]])
    });
  }
});

bot.on('message', async msg => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = (msg.text || '').trim();
  if (!text) return;

  const user = getUser(userId, chatId, msg.from);

  if (text === '/start') {
    const joined = await memberCheck(userId);
    return joined ? showStore(user) : showJoin(user);
  }

  if (user.awaiting === 'amount') {
    const amount = Number(text);
    if (!amount || amount < 1) {
      return bot.sendMessage(chatId, '❌ कृपया सही राशि दर्ज करें (कम से कम ₹1):');
    }

    user.depositAmount = amount;
    user.awaiting = 'phone';
    saveUsers();
    return bot.sendMessage(chatId, '📱 कृपया अपना 10 अंकों का मोबाइल नंबर दर्ज करें:');
  }

  if (user.awaiting === 'phone') {
    if (!/^[6-9]\d{9}$/.test(text)) {
      return bot.sendMessage(chatId, '❌ अमान्य मोबाइल नंबर! कृपया 10 अंकों का नंबर भेजें:');
    }

    user.phone = text;
    const amount = user.depositAmount;
    user.awaiting = null;
    saveUsers();

    try {
      const waitMsg = await bot.sendMessage(chatId, '⏳ पेमेंट QR कोड जनरेट हो रहा है...');
      const payData = await gatewayCreate(amount, user);
      await safeDelete(chatId, waitMsg.message_id);

      const orderId = generateOrderId();
      const order = {
        orderId,
        gatewayOrderId: payData.order_id,
        userId: user.userId,
        amount,
        status: 'PENDING',
        createdAt: now()
      };
      orders[orderId] = order;
      saveOrders();

      await clearScreen(user);
      const photoSent = await bot.sendPhoto(chatId, payData.qr_url, {
        caption: `💳 <b>PAYMENT DETAILS</b>\n\nAmount: <b>₹${amount}</b>\nOrder ID: <code>${orderId}</code>\n\nQR कोड स्कैन करके पे करें या नीचे Pay Online बटन दबाएँ।`,
        parse_mode: 'HTML',
        reply_markup: keyboard([
          [{ text: '💳 Pay Online', url: payData.checkout_url }],
          [button('« Cancel', 'home')]
        ])
      });
      user.screenMessageId = photoSent.message_id;
      saveUsers();

      startPaymentPolling(order);
    } catch (err) {
      bot.sendMessage(chatId, `❌ पेमेंट एरर: ${err.message}`);
    }
  }
});

bot.getMe().then(me => console.log(`🚀 ${CONFIG.BRAND_NAME} Bot is live: @${me.username}`));
