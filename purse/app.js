/* Purse: a daily cash limit you can see.
   No money is held here. The balance is a limit the user sets; payments happen in their UPI app. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var C = window.PurseCurrency;
  var ANDROID = /Android/i.test(navigator.userAgent);
  var IOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  var DENOMS = [500, 200, 100, 50, 20, 10, 5, 2, 1];

  /* ================= payment apps =================
     personal: how to hand off to a personal UPI ID. 'direct' opens the app with the payment filled in
     (CRED accepted this in testing); 'copy' copies the UPI ID and opens the app (Google Pay and PhonePe
     refused direct links to personal IDs). Confirmed results override these per app. */
  var APPS = {
    cred:    { name: 'CRED',       short: 'CRED',    glyph: 'C',     pay: 'credpay://upi/pay', open: 'credpay://', pkg: 'com.dreamplug.androidapp', personal: 'direct', card: 'linear-gradient(90deg,#2A2A2E,#0E0E10)', cardInk: '#F4F0E8', cardLabel: 'CRED' },
    gpay:    { name: 'Google Pay', short: 'GPay',    glyph: 'G',     pay: 'tez://upi/pay',     open: 'gpay://',    pkg: 'com.google.android.apps.nbu.paisa.user', personal: 'copy', card: '#FFFFFF', cardInk: '#1A73E8', cardLabel: 'G Pay' },
    phonepe: { name: 'PhonePe',    short: 'PhonePe', glyph: 'Pe',    pay: 'phonepe://pay',     open: 'phonepe://', pkg: 'com.phonepe.app', personal: 'copy', card: '#5F259F', cardInk: '#FFFFFF', cardLabel: 'PhonePe' },
    paytm:   { name: 'Paytm',      short: 'Paytm',   glyph: 'Paytm', pay: 'paytmmp://upi/pay', open: 'paytmmp://', pkg: 'net.one97.paytm', personal: 'direct', card: 'linear-gradient(90deg,#E9F7FD,#FFFFFF)', cardInk: '#00A8E8', cardLabel: 'Paytm' }
  };
  var APP_IDS = ['cred', 'gpay', 'phonepe', 'paytm'];

  /* ================= UPI parsing ================= */
  function safeDecode(s) { try { return decodeURIComponent(String(s).replace(/\+/g, ' ')); } catch (e) { return String(s); } }
  function parseTlv(s) {
    var out = [], i = 0;
    while (i + 4 <= s.length) {
      var tag = s.slice(i, i + 2), len = parseInt(s.slice(i + 2, i + 4), 10);
      if (isNaN(len)) return null;
      var val = s.slice(i + 4, i + 4 + len);
      if (val.length < len) return null;
      out.push([tag, val]); i += 4 + len;
    }
    return out;
  }
  var VPA_RE = /^[\w.\-]{2,}@[a-z][\w.\-]*$/i;
  function parseQr(text) {
    var raw = String(text || '').trim();
    if (!raw) return null;
    var m = raw.match(/^upi:\/\/([a-z]+)\/?\?(.*)$/i);
    if (m) {
      var parts = m[2].split('&').filter(Boolean).map(function (p) {
        var i = p.indexOf('=');
        return i < 0 ? { k: p, v: '', raw: p } : { k: p.slice(0, i), v: p.slice(i + 1), raw: p };
      });
      var get = function (k) { for (var i = 0; i < parts.length; i++) if (parts[i].k.toLowerCase() === k) return safeDecode(parts[i].v); return ''; };
      return { format: 'upi', raw: raw, parts: parts, pa: get('pa'), pn: get('pn'), mc: get('mc'), am: get('am'), tr: get('tr'), signed: !!get('sign') };
    }
    if (/^0002\d\d/.test(raw)) {
      var top = parseTlv(raw);
      if (top) {
        var q = { format: 'emv', raw: raw, parts: [], pa: '', pn: '', mc: '', am: '', tr: '', signed: false };
        top.forEach(function (t) {
          var n = parseInt(t[0], 10);
          if (n >= 26 && n <= 51 && !q.pa) (parseTlv(t[1]) || []).forEach(function (st) { if (!q.pa && VPA_RE.test(st[1])) q.pa = st[1]; });
          if (t[0] === '52') q.mc = t[1];
          if (t[0] === '54') q.am = t[1];
          if (t[0] === '59') q.pn = t[1];
        });
        return q;
      }
    }
    if (VPA_RE.test(raw)) return { format: 'vpa', raw: raw, parts: [], pa: raw, pn: '', mc: '', am: '', tr: '', signed: false };
    return { format: 'other', raw: raw, parts: [], pa: '', pn: '', mc: '', am: '', tr: '', signed: false };
  }
  function guessKind(qr) {
    if (!qr) return 'personal';
    if (qr.format === 'emv') return 'shop';
    if ((qr.mc && !/^0+$/.test(qr.mc)) || qr.signed || qr.tr) return 'shop';
    return 'personal';
  }
  function encVpa(s) { return encodeURIComponent(s).replace(/%40/g, '@'); }
  function buildQuery(qr, amount, name) {
    var amt = amount > 0 ? amount.toFixed(2) : '';
    if (qr.format === 'upi') {
      var list = [], hasCu = false, keptAm = false, hasPn = false;
      qr.parts.forEach(function (p) {
        var k = p.k.toLowerCase();
        if (k === 'am' && amt) { if ((parseFloat(safeDecode(p.v)) || 0).toFixed(2) !== amt) return; keptAm = true; }
        if (k === 'cu') hasCu = true;
        if (k === 'pn') hasPn = true;
        list.push(p);
      });
      var add = [];
      if (!hasPn && name && !qr.signed) add.push('pn=' + encodeURIComponent(name));
      if (amt && !keptAm) add.push('am=' + amt);
      if (!hasCu) add.push('cu=INR');
      var signAt = -1;
      list.forEach(function (p, i) { if (p.k.toLowerCase() === 'sign') signAt = i; });
      var raws = list.map(function (p) { return p.raw; });
      if (signAt >= 0) raws.splice.apply(raws, [signAt, 0].concat(add)); else raws = raws.concat(add);
      return raws.join('&');
    }
    var pn = qr.pn || name || '';
    var out = ['pa=' + encVpa(qr.pa)];
    if (pn) out.push('pn=' + encodeURIComponent(pn));
    if (qr.mc) out.push('mc=' + encodeURIComponent(qr.mc));
    if (amt) out.push('am=' + amt);
    out.push('cu=INR');
    return out.join('&');
  }
  function payLink(app, query) {
    if (ANDROID) return app.pkg ? 'intent://pay?' + query + '#Intent;scheme=upi;package=' + app.pkg + ';end' : 'upi://pay?' + query;
    return app.pay + '?' + query;
  }
  function openLink(app) {
    if (ANDROID) return app.pkg ? 'intent://#Intent;package=' + app.pkg + ';end' : '';
    return app.open;
  }

  /* ================= money helpers ================= */
  function breakdown(amount) {
    var r = Math.max(0, Math.round(amount)), out = [];
    DENOMS.forEach(function (d) { while (r >= d) { out.push(d); r -= d; } });
    return out;
  }
  function fmt(n) { return '₹' + Math.round(n).toLocaleString('en-IN'); }
  function plus(list) { return list.map(function (v) { return '₹' + v; }).join(' + '); }
  var ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  var TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function w99(n) { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''); }
  function w999(n) { var h = Math.floor(n / 100), r = n % 100; return (h ? ONES[h] + ' Hundred' + (r ? ' ' : '') : '') + (r ? w99(r) : ''); }
  function words(n) {
    n = Math.round(n); if (n <= 0) return '';
    var parts = [], lk = Math.floor(n / 100000), th = Math.floor(n / 1000) % 100, rest = n % 1000;
    if (lk) parts.push(w99(lk) + ' Lakh'); if (th) parts.push(w99(th) + ' Thousand'); if (rest) parts.push(w999(rest));
    return parts.join(' ') + (n === 1 ? ' Rupee' : ' Rupees');
  }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function timeStr(iso) { return new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }); }
  function initials(name, id) {
    var s = (name || '').trim();
    if (s) { var w = s.split(/\s+/); return ((w[0][0] || '') + (w.length > 1 ? w[w.length - 1][0] : '')).toUpperCase(); }
    return (id || '?').slice(0, 2).toUpperCase();
  }

  /* ================= state ================= */
  var KEY = 'purse-v1';
  var st = { setup: false, limit: 500, mode: 'reset', day: '', balance: 0, log: [], tries: [], usual: 'cred', remind: true, remindSeen: '', anim: true, noInstall: false, pending: null };
  try { var sv = JSON.parse(localStorage.getItem(KEY) || 'null'); if (sv) for (var k in st) if (sv[k] !== undefined) st[k] = sv[k]; } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  function rollover() {
    if (!st.setup) return false;
    var today = dayKey();
    if (st.day === today) return false;
    st.balance = st.mode === 'carry' ? st.balance + st.limit : st.limit;
    st.day = today; st.pending = null; save();
    return true;
  }
  function todays() { var t = dayKey(); return st.log.filter(function (e) { return e.day === t; }); }
  function spentToday() { return todays().reduce(function (s, e) { return s + e.amount; }, 0); }

  /* ================= small UI helpers ================= */
  var toastEl = null, toastT;
  function toast(text, ms) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.textContent = text; toastEl.hidden = false;
    toastEl.style.animation = 'none'; void toastEl.offsetWidth; toastEl.style.animation = '';
    clearTimeout(toastT); toastT = setTimeout(function () { toastEl.hidden = true; }, ms || 2600);
  }
  function appIcon(id) {
    var s = document.createElement('span'); s.className = 'ai ' + id; s.setAttribute('aria-hidden', 'true'); s.textContent = APPS[id].glyph; return s;
  }
  function copySync(text) {
    var ok = false;
    try {
      var t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;top:0;opacity:0';
      document.body.appendChild(t); t.select(); t.setSelectionRange(0, text.length);
      ok = document.execCommand('copy'); document.body.removeChild(t);
    } catch (e) {}
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).catch(function () {}); ok = true; }
    return ok;
  }
  function applyMotion() { document.body.classList.toggle('still', !st.anim); }

  /* ================= wallet (open bifold) ================= */
  function makeWallet(host) {
    host.innerHTML = '';
    var w = document.createElement('div'); w.className = 'w3';
    w.innerHTML =
      '<div class="w3-scene">' +
        '<div class="w3-shell leather"></div><div class="w3-lining"></div><div class="w3-stand"></div>' +
        '<div class="w3-front w3-left leather"></div>' +
        '<div class="w3-front w3-right leather"><div class="w3-coins"></div><div class="w3-flap leather"><i></i></div></div>' +
        '<div class="w3-fold"></div><div class="w3-out"></div>' +
      '</div>';
    host.appendChild(w);
    var stand = w.querySelector('.w3-stand'), left = w.querySelector('.w3-left'), coinsBox = w.querySelector('.w3-coins'), out = w.querySelector('.w3-out');
    var outMap = {};

    function noteEl(v, wpx) {
      var d = document.createElement('div'); d.className = 'note'; d.style.setProperty('--w', (wpx || 224) + 'px');
      var img = new Image(); img.alt = ''; img.src = C.noteURL(v); img.decoding = 'async'; d.appendChild(img); return d;
    }
    function coinEl(v, s) {
      var d = document.createElement('div'); d.className = 'coin k' + v; d.style.setProperty('--s', (s || 36) + 'px');
      var img = new Image(); img.alt = ''; img.src = C.coinURL(v); d.appendChild(img); return d;
    }
    function setCards() {
      left.querySelectorAll('.w3-card,.w3-slot').forEach(function (e) { e.remove(); });
      var order = [st.usual].concat(APP_IDS.filter(function (id) { return id !== st.usual; }));
      order.forEach(function (id, i) {
        var a = APPS[id], c = document.createElement('div');
        c.className = 'w3-card'; c.dataset.app = id;
        c.style.cssText = 'top:' + (12 + i * 25) + 'px;left:' + (14 + i * 3) + 'px;background:' + a.card + ';color:' + a.cardInk + ';z-index:' + (1 + i * 2);
        c.innerHTML = '<b></b>'; c.firstChild.textContent = a.cardLabel;
        var s = document.createElement('div'); s.className = 'w3-slot leather';
        s.style.cssText = 'top:' + (29 + i * 25) + 'px;left:' + (8 + i * 3) + 'px;z-index:' + (2 + i * 2);
        left.appendChild(c); left.appendChild(s);
      });
    }
    function setStanding(amount) {
      stand.innerHTML = ''; coinsBox.innerHTML = '';
      var all = breakdown(amount), notes = all.filter(function (v) { return v >= 10; }), coins = all.filter(function (v) { return v < 10; });
      if (amount < 0) { var iou = document.createElement('div'); iou.className = 'w3-iou'; iou.textContent = fmt(-amount) + ' over today'; stand.appendChild(iou); }
      else if (!all.length) { var e = document.createElement('div'); e.className = 'w3-empty'; e.textContent = 'Empty'; stand.appendChild(e); }
      var shown = notes.slice(0, 7), n = shown.length;
      var step = n > 1 ? Math.min(31, 100 / (n - 1)) : 0, lift = n > 1 ? Math.min(9, 30 / (n - 1)) : 0;
      shown.forEach(function (v, i) {
        var k = n - 1 - i, el = noteEl(v, 224);
        el.style.top = (92 - k * lift) + 'px'; el.style.left = (14 + k * step) + 'px';
        el.style.transform = 'rotate(' + (k % 2 ? .7 : -.5) + 'deg)'; el.style.zIndex = 2 + i;
        stand.appendChild(el);
      });
      coins.slice(0, 4).forEach(function (v, i) {
        var el = coinEl(v, v === 10 ? 40 : v === 1 ? 31 : 35);
        el.style.left = (6 + i * 26) + 'px'; el.style.top = (i % 2 ? 4 : -2) + 'px'; el.style.transform = 'rotate(' + (i * 17 - 10) + 'deg)';
        coinsBox.appendChild(el);
      });
    }
    function setOut(amount, animate) {
      var all = breakdown(amount), notes = all.filter(function (v) { return v >= 10; }).slice(0, 6), coins = all.filter(function (v) { return v < 10; }).slice(0, 4);
      var want = {}, seen = {};
      function key(kind, v) { var b = kind + v; seen[b] = (seen[b] || 0) + 1; return b + '#' + seen[b]; }
      var m = notes.length, NW = m <= 2 ? 232 : m <= 4 ? 214 : 196, xL = 12, xR = 328 - NW;
      notes.forEach(function (v, i) {
        var c = i - (m - 1) / 2;
        want[key('n', v)] = { kind: 'n', v: v, w: NW, x: (m === 1 ? (340 - NW) / 2 : xL + i * ((xR - xL) / (m - 1))), y: -96 + Math.abs(c) * 7, r: m > 1 ? c * (22 / (m - 1)) : -3, z: 30 + i };
      });
      coins.forEach(function (v, j) {
        want[key('c', v)] = { kind: 'c', v: v, x: 228 + j * 30, y: 2 + (j % 2) * 14 - (m ? 0 : 70), r: j * 14 - 8, z: 50 + j };
      });
      Object.keys(outMap).forEach(function (k) {
        if (want[k]) return;
        var el = outMap[k]; delete outMap[k];
        el.classList.remove('enter'); el.classList.add('leave');
        setTimeout(function () { el.remove(); }, 450);
      });
      var order = 0;
      Object.keys(want).forEach(function (k) {
        var p = want[k], el = outMap[k];
        if (!el) {
          el = p.kind === 'n' ? noteEl(p.v, p.w) : coinEl(p.v, p.v === 10 ? 50 : p.v === 1 ? 40 : 44);
          el.style.setProperty('--sx', p.kind === 'n' ? '80px' : '230px');
          if (animate) { el.classList.add('enter'); el.style.setProperty('--d', (order++ * 70) + 'ms'); }
          out.appendChild(el); outMap[k] = el;
        }
        if (p.w) el.style.setProperty('--w', p.w + 'px');
        el.style.setProperty('--x', p.x + 'px'); el.style.setProperty('--y', p.y + 'px'); el.style.setProperty('--r', p.r + 'deg'); el.style.zIndex = p.z;
      });
    }
    function flyAway() {
      Object.keys(outMap).forEach(function (k, i) { var el = outMap[k]; el.classList.remove('enter'); el.style.transitionDelay = (i * 60) + 'ms'; el.classList.add('away'); });
      var old = outMap; outMap = {};
      setTimeout(function () { Object.keys(old).forEach(function (k) { old[k].remove(); }); }, 1300);
    }
    function pullCard(id) {
      left.querySelectorAll('.w3-card').forEach(function (c) { c.classList.toggle('pulled', c.dataset.app === id); });
    }
    function riffle() {
      $$('.note', stand).forEach(function (el, i, arr) {
        el.classList.remove('flip'); void el.offsetWidth;
        el.style.setProperty('--d', ((arr.length - 1 - i) * 140) + 'ms'); el.classList.add('flip');
      });
    }
    setCards();
    return { el: w, setStanding: setStanding, setOut: setOut, flyAway: flyAway, pullCard: pullCard, riffle: riffle, setCards: setCards, clearOut: function () { setOut(0, false); } };
  }
  function fit(stage, box, bw, bh) {
    var sw = stage.clientWidth, sh = stage.clientHeight;
    if (!sw || !sh) return;
    var s = Math.min(1.2, sw / bw, sh / bh);
    box.style.transform = 'scale(' + s.toFixed(3) + ')';
    box.style.margin = ((bh * s - bh) / 2) + 'px ' + ((bw * s - bw) / 2) + 'px';
  }

  /* ================= screens ================= */
  var screen = '';
  function show(name) {
    screen = name;
    ['setup', 'home', 'pay', 'history', 'settings'].forEach(function (s) { $(s).hidden = s !== name; });
    if (name === 'home') renderHome();
    if (name === 'pay') renderPay(false);
    if (name === 'history') renderHistory();
    if (name === 'settings') renderSettings();
    requestAnimationFrame(fitAll);
  }
  function go(name) {
    if (name === screen) return;
    try { history.pushState({ s: name }, ''); } catch (e) {}
    show(name);
  }
  window.addEventListener('popstate', function (e) {
    if (!$('cam').hidden) { stopCam(); if (e.state && e.state.s === screen) return; }
    if (sheetOpen) closeSheet();
    if (!$('count').hidden) { $('count').hidden = true; }
    var s = (e.state && e.state.s) || (st.setup ? 'home' : 'setup');
    if (s === 'pay' && !qr) s = 'home';
    show(s);
  });
  $$('[data-go]').forEach(function (b) { b.addEventListener('click', function () { var t = b.getAttribute('data-go'); if (t === 'home' && history.state && history.state.s !== 'home') history.back(); else go(t); }); });
  function fitAll() {
    if (screen === 'home') fit($('homeStage'), $('walletBtn'), 340, 300);
    if (screen === 'pay') fit($('payStage'), $('payWallet'), 340, 262);
    if (!$('count').hidden) fit($('countStage'), $('countWallet'), 340, 300);
  }
  window.addEventListener('resize', fitAll);

  /* ================= setup ================= */
  var draftLimit = st.limit, draftMode = st.mode;
  function renderSetup() {
    $('setupAmt').textContent = draftLimit.toLocaleString('en-IN');
    $('loadBtn').textContent = 'Load ' + fmt(draftLimit);
    $$('#setup [data-limit]').forEach(function (b) { b.setAttribute('aria-pressed', +b.dataset.limit === draftLimit ? 'true' : 'false'); });
    $$('#setup [data-mode]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.mode === draftMode ? 'true' : 'false'); });
  }
  $$('#setup [data-limit]').forEach(function (b) { b.addEventListener('click', function () { draftLimit = +b.dataset.limit; renderSetup(); }); });
  $$('#setup [data-step]').forEach(function (b) { b.addEventListener('click', function () { draftLimit = Math.min(100000, Math.max(50, draftLimit + +b.dataset.step)); renderSetup(); }); });
  $$('#setup [data-mode]').forEach(function (b) { b.addEventListener('click', function () { draftMode = b.dataset.mode; renderSetup(); }); });
  $('loadBtn').addEventListener('click', function () {
    st.setup = true; st.limit = draftLimit; st.mode = draftMode; st.balance = draftLimit; st.day = dayKey(); save();
    try { history.replaceState({ s: 'home' }, ''); } catch (e) {}
    show('home'); setOpen(true);
    toast(fmt(draftLimit) + ' loaded for today');
  });

  /* ================= home ================= */
  var homeW = makeWallet($('homeWallet')), isOpen = false;
  function setOpen(v) {
    isOpen = v;
    $('walletBtn').classList.toggle('open', v);
    $('walletBtn').setAttribute('aria-expanded', v ? 'true' : 'false');
    $('walletBtn').setAttribute('aria-label', v ? 'Close purse. ' + fmt(Math.max(0, st.balance)) + ' inside' : 'Open purse');
    $('homeHint').textContent = v ? 'Tap the purse to close' : 'Tap to open';
    $('homeHint').hidden = v;
    $('limitBox').hidden = !v;
    if (v) renderLimit(); else $('limFill').style.width = '0';
    requestAnimationFrame(fitAll);
  }
  $('walletBtn').addEventListener('click', function () { setOpen(!isOpen); });
  function renderLimit() {
    var lim = st.limit, bal = st.balance, spent = spentToday(), over = bal < 0;
    var box = $('limitBox');
    box.classList.toggle('over', over);
    box.classList.toggle('low', !over && lim > 0 && bal / lim < .2);
    $('limLeft').textContent = over ? fmt(-bal) : fmt(bal);
    $('limWord').textContent = over ? ' over' : ' left';
    $('limOf').textContent = 'of ' + fmt(lim) + ' today';
    $('limSpent').textContent = 'Spent ' + fmt(spent) + ' · ' + todays().length + ' payment' + (todays().length === 1 ? '' : 's');
    var pct = over ? 100 : lim ? Math.max(0, Math.min(100, bal / lim * 100)) : 0;
    var bar = $('limBar'); bar.setAttribute('aria-valuemax', lim); bar.setAttribute('aria-valuenow', Math.max(0, bal));
    bar.setAttribute('aria-label', over ? fmt(-bal) + ' over your ' + fmt(lim) + ' limit' : fmt(bal) + ' left of ' + fmt(lim));
    requestAnimationFrame(function () { $('limFill').style.width = pct + '%'; });
  }
  function renderHome() {
    rollover();
    $('today').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
    homeW.setCards(); homeW.setStanding(st.balance);
    if (isOpen) renderLimit();
    var late = new Date().getHours() >= 21;
    $('remindBanner').hidden = !(st.remind && late && st.remindSeen !== dayKey());
    var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
    $('homeFine').innerHTML = (IOS && !standalone && !st.noInstall)
      ? 'Install: tap <b>•••</b> → <b>Share</b> → <b>Add to Home Screen</b>'
      : 'No money is held in Purse. It’s your daily limit.';
  }
  $('remindX').addEventListener('click', function () { st.remindSeen = dayKey(); save(); renderHome(); });
  $('remindAdd').addEventListener('click', function () { st.remindSeen = dayKey(); save(); renderHome(); openEntry(null); });
  $('homeFine').addEventListener('click', function () { if (/Install/.test(this.textContent)) { st.noInstall = true; save(); renderHome(); } });

  /* count */
  var countW = makeWallet($('countWallet'));
  $('countBtn').addEventListener('click', openCount);
  function openCount() {
    var bal = st.balance, all = breakdown(bal);
    $('count').hidden = false;
    countW.setCards(); countW.setStanding(bal);
    $('countSub').textContent = bal < 0 ? fmt(-bal) + ' over your limit' : 'of ' + fmt(st.limit) + (all.length ? ' · ' + plus(all.slice(0, 8)) + (all.length > 8 ? ' …' : '') : '');
    var spent = spentToday();
    $('countSpent').textContent = fmt(spent) + ' · ' + todays().length + ' payment' + (todays().length === 1 ? '' : 's');
    $('countBar').className = spent > st.limit ? 'over' : '';
    $('countBar').style.width = '0';
    requestAnimationFrame(function () {
      fitAll();
      $('countBar').style.width = Math.min(100, st.limit ? spent / st.limit * 100 : 0) + '%';
      countW.riffle();
    });
    var t0 = performance.now(), dur = st.anim ? 900 : 1;
    (function tick(now) {
      var p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      $('countVal').textContent = Math.round(Math.max(0, bal) * e).toLocaleString('en-IN');
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
    $('countClose').focus({ preventScroll: true });
  }
  $('count').addEventListener('click', function () { $('count').hidden = true; try { $('countBtn').focus({ preventScroll: true }); } catch (e) {} });

  /* ================= scanning ================= */
  var qr = null, typedName = '';
  var detector = null, work = document.createElement('canvas'), wctx = work.getContext('2d', { willReadFrequently: true });
  function readerReady() {
    if (window.jsQR) return true;
    if ('BarcodeDetector' in window) { try { detector = detector || new window.BarcodeDetector({ formats: ['qr_code'] }); return true; } catch (e) {} }
    return false;
  }
  function decode(both) {
    if (window.jsQR) {
      var d = wctx.getImageData(0, 0, work.width, work.height);
      var r = window.jsQR(d.data, d.width, d.height, { inversionAttempts: both ? 'attemptBoth' : 'dontInvert' });
      return Promise.resolve(r ? r.data : '');
    }
    if (detector) return detector.detect(work).then(function (a) { return a.length ? a[0].rawValue : ''; }, function () { return ''; });
    return Promise.resolve('');
  }
  var stream = null, scanning = false;
  function stopCam() { scanning = false; if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); stream = null; $('cam').hidden = true; }
  function closeCam() { if (history.state && history.state.cam) history.back(); else stopCam(); }
  function camMsg(t) { $('camMsg').textContent = t; }
  $('scanBtn').addEventListener('click', function () {
    $('cam').hidden = false; camMsg('Point at any UPI QR');
    try { history.pushState({ s: screen, cam: 1 }, ''); } catch (e) {}
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { camMsg('Camera isn’t available here. Use Photo or UPI ID.'); return; }
    // Ask for a sharp picture: iPhone hands web pages 640x480 unless asked for more.
    navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false }).then(function (s) {
      if ($('cam').hidden) { s.getTracks().forEach(function (t) { t.stop(); }); return; }
      stream = s; var v = $('video'); v.srcObject = s; v.play().catch(function () {});
      try { s.getVideoTracks()[0].applyConstraints({ advanced: [{ focusMode: 'continuous' }] }).catch(function () {}); } catch (e) {}
      scanning = true;
      var last = 0, busy = false, n = 0, lastBad = '';
      (function tick(now) {
        if (!scanning) return;
        if (!readerReady()) camMsg('Loading the scanner…');
        else if (!busy && v.readyState >= 2 && now - last > 90 && v.videoWidth) {
          last = now; busy = true; n++;
          var vw = v.videoWidth, vh = v.videoHeight;
          if (n % 3) {
            // most frames: zoom into the middle, where the gold frame is
            var side = Math.min(vw, vh) * (n % 3 === 1 ? .62 : .85), sx = (vw - side) / 2, sy = (vh - side) / 2, out = Math.min(800, side);
            work.width = work.height = Math.round(out);
            wctx.drawImage(v, sx, sy, side, side, 0, 0, work.width, work.height);
          } else {
            var sc = Math.min(1, 960 / Math.max(vw, vh));
            work.width = Math.round(vw * sc); work.height = Math.round(vh * sc);
            wctx.drawImage(v, 0, 0, work.width, work.height);
          }
          decode(n % 6 === 0).then(function (t) {
            busy = false;
            if (!t || !scanning) return;
            var err = useText(t, '');
            if (err && err !== lastBad) { lastBad = err; if (navigator.vibrate) navigator.vibrate(15); }
          });
        }
        requestAnimationFrame(tick);
      })(0);
    }).catch(function () { camMsg('Camera is blocked. Allow it in Settings, or use Photo or UPI ID.'); });
  });
  $('camClose').addEventListener('click', closeCam);
  $('photo').addEventListener('change', function (e) {
    var file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    if (!readerReady()) { camMsg('The scanner is still loading. Try again in a moment.'); return; }
    var url = URL.createObjectURL(file), img = new Image();
    img.onload = function () {
      var sizes = [1400, 900, 500], i = 0;
      (function attempt() {
        if (i >= sizes.length) { URL.revokeObjectURL(url); camMsg('No QR found in that photo.'); return; }
        var sc = Math.min(1, sizes[i] / Math.max(img.width, img.height));
        work.width = Math.max(1, Math.round(img.width * sc)); work.height = Math.max(1, Math.round(img.height * sc));
        wctx.drawImage(img, 0, 0, work.width, work.height); i++;
        decode(true).then(function (t) { if (t) { URL.revokeObjectURL(url); useText(t, ''); } else attempt(); });
      })();
    };
    img.onerror = function () { URL.revokeObjectURL(url); camMsg('That file isn’t a picture.'); };
    img.src = url;
  });
  $('typeId').addEventListener('click', function () {
    stopCam();
    openSheet('t-id', function (sh) {
      setTimeout(function () { sh.querySelector('#vpa').focus(); }, 280);
      sh.querySelector('#idForm').addEventListener('submit', function (e) {
        e.preventDefault();
        var err = useText(sh.querySelector('#vpa').value, sh.querySelector('#pname').value.trim());
        if (err) { sh.querySelector('#vpaErr').textContent = err; sh.querySelector('#vpa').focus(); }
      });
    });
  });
  function useText(text, name) {
    var p = parseQr(text);
    var err = !p ? 'Enter a UPI ID.' : p.format === 'other' ? (/^https?:/i.test(p.raw) ? 'That QR is a web link, not a UPI code.' : 'That isn’t a UPI QR or UPI ID.') : !p.pa ? 'That QR has no UPI ID in it.' : '';
    if (err) { if (!$('cam').hidden && !sheetOpen) camMsg(err); return err; }
    if (p.format === 'vpa') { p = parseQr('upi://pay?pa=' + encVpa(p.pa)); p.typed = true; }
    qr = p; typedName = name || '';
    amount = p.am ? Math.round(parseFloat(p.am)) || 0 : 0;
    var fromCam = history.state && history.state.cam;
    closeSheet(true); stopCam();
    if (navigator.vibrate) navigator.vibrate(25);
    if (fromCam) { try { history.replaceState({ s: 'pay' }, ''); } catch (e) {} show('pay'); }
    else go('pay');
    return '';
  }

  /* ================= pay ================= */
  var payW = makeWallet($('payWallet')), amount = 0;
  function payeeName() { return (qr && qr.pn) || typedName || ''; }
  function kind() { return guessKind(qr); }
  function query() { return buildQuery(qr, amount, typedName); }
  function methodFor(id) {
    if (kind() !== 'personal') return 'direct';
    var tries = st.tries.filter(function (t) { return t.app === id && t.kind === 'personal' && t.method === 'direct'; });
    if (tries.some(function (t) { return t.outcome === 'paid'; })) return 'direct';
    if (tries.length) return 'copy';
    return APPS[id].personal;
  }
  function worked(id) { return st.tries.some(function (t) { return t.app === id && t.outcome === 'paid' && t.kind === kind(); }); }
  function hrefFor(id) { return methodFor(id) === 'copy' ? openLink(APPS[id]) : payLink(APPS[id], query()); }

  function renderPay(animate) {
    if (!qr) return;
    var nm = payeeName(), k = kind();
    $('pAv').textContent = initials(nm, qr.pa);
    $('pName').textContent = nm || qr.pa;
    $('pId').textContent = nm ? qr.pa : (qr.typed ? 'UPI ID' : 'No name in the QR');
    $('pKind').textContent = k === 'shop' ? 'Shop' : 'Personal';
    $('pKind').className = 'badge' + (k === 'shop' ? ' shop' : '');
    var v = $('amtVal');
    v.textContent = amount ? amount.toLocaleString('en-IN') : '0';
    v.classList.toggle('empty', !amount);
    var left = st.balance - amount, sub = $('amtSub');
    if (!amount) sub.textContent = (qr.am ? 'The QR asked for ' + fmt(parseFloat(qr.am)) : 'Type the amount') + ' · ' + fmt(Math.max(0, st.balance)) + ' in your purse';
    else {
      var parts = breakdown(amount);
      sub.innerHTML = '';
      sub.appendChild(document.createTextNode((parts.length > 6 ? plus(parts.slice(0, 5)) + ' …' : plus(parts)) + ' · '));
      var b = document.createElement('b');
      if (left >= 0) b.textContent = fmt(left) + ' left after this'; else { b.className = 'over'; b.textContent = fmt(-left) + ' over'; }
      sub.appendChild(b);
    }
    payW.setCards(); payW.pullCard(null);
    payW.setStanding(Math.max(0, st.balance - amount));
    payW.setOut(amount, animate !== false && st.anim);
    // primary + others
    var has = amount > 0, p = $('primary'), u = st.usual;
    p.setAttribute('aria-disabled', has ? 'false' : 'true');
    if (has) p.href = hrefFor(u); else p.removeAttribute('href');
    var icon = $('primaryIcon'); icon.className = 'ai ' + u; icon.textContent = APPS[u].glyph;
    $('primaryLabel').textContent = has ? 'Pay ' + fmt(amount) : 'Enter amount';
    $('primarySub').textContent = (methodFor(u) === 'copy' ? 'Copy ID & open ' : 'with ') + APPS[u].name + (worked(u) ? ' · worked' : '');
    var box = $('others');
    $$('.other', box).forEach(function (e) { e.remove(); });
    APP_IDS.filter(function (id) { return id !== u; }).forEach(function (id) {
      var a = document.createElement('a'); a.className = 'other'; a.setAttribute('role', 'button');
      a.appendChild(appIcon(id));
      var s = document.createElement('small'); s.textContent = APPS[id].short; a.appendChild(s);
      if (worked(id)) { var dot = document.createElement('span'); dot.className = 'ok-dot'; a.appendChild(dot); }
      if (has) a.href = hrefFor(id);
      a.setAttribute('aria-label', (methodFor(id) === 'copy' ? 'Copy UPI ID and open ' : 'Pay with ') + APPS[id].name);
      a.addEventListener('click', function (e) { onPay(id, e); });
      box.appendChild(a);
    });
  }
  function bump() { var v = $('amtVal'); v.classList.remove('shake'); void v.offsetWidth; v.classList.add('shake'); }
  function press(k) {
    var s = amount ? String(amount) : '';
    if (k === 'del') s = s.slice(0, -1);
    else if (k === 'clear') s = '';
    else { if ((s + k).replace(/^0+/, '').length > 6) return bump(); s = (s + k).replace(/^0+/, ''); }
    amount = parseInt(s || '0', 10);
    renderPay(true);
  }
  $$('#keypad [data-k]').forEach(function (b) {
    var hold = null, cleared = false;
    b.addEventListener('click', function () { if (cleared) { cleared = false; return; } press(b.dataset.k); });
    if (b.dataset.k === 'del') {
      b.addEventListener('pointerdown', function () { cleared = false; hold = setTimeout(function () { press('clear'); cleared = true; }, 550); });
      ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) { b.addEventListener(ev, function () { clearTimeout(hold); }); });
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { if (!$('cam').hidden) closeCam(); else if (sheetOpen) closeSheet(); else if (!$('count').hidden) $('count').hidden = true; return; }
    if (screen !== 'pay' || sheetOpen || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); press(e.key); }
    else if (e.key === 'Backspace') { e.preventDefault(); press('del'); }
  });
  $('payBack').addEventListener('click', function () { if (history.state && history.state.s === 'pay') history.back(); else go('home'); });
  $('primary').addEventListener('click', function (e) { onPay(st.usual, e); });

  function onPay(id, e) {
    if (!amount) { e.preventDefault(); bump(); toast('Type the amount first'); return; }
    if (amount > st.balance) { e.preventDefault(); openWarn(id); return; }
    handoff(id);
  }
  function handoff(id) {
    var m = methodFor(id);
    if (m === 'copy') { copySync(qr.pa); toast('UPI ID copied. Paste it in ' + APPS[id].name + ' and pay ' + fmt(amount), 4200); }
    payW.pullCard(id);
    st.pending = { app: id, method: m, amount: amount, pa: qr.pa, name: payeeName(), kind: kind(), at: new Date().toISOString() };
    save();
    armReturn();
  }
  function openWarn(id) {
    var bal = Math.max(0, st.balance), over = amount - bal;
    openSheet('t-warn', function (sh) {
      var notes = breakdown(bal).slice(0, 3), box = sh.querySelector('#warnNotes');
      notes.forEach(function (v, i) {
        var d = document.createElement('div'); d.className = v >= 10 ? 'note' : 'coin k' + v;
        if (v >= 10) d.style.cssText = '--w:150px;left:calc(50% - 75px + ' + ((i - (notes.length - 1) / 2) * 46) + 'px);transform:rotate(' + ((i - 1) * 7) + 'deg)';
        else d.style.cssText = '--s:44px;left:calc(50% - 22px + ' + ((i - 1) * 50) + 'px);top:20px';
        var img = new Image(); img.alt = ''; img.src = v >= 10 ? C.noteURL(v) : C.coinURL(v); d.appendChild(img); box.appendChild(d);
      });
      if (!notes.length) box.innerHTML = '<p class="w3-empty" style="position:static;padding-top:30px">Your purse is empty</p>';
      sh.querySelector('#warnTitle').textContent = bal ? 'Only ' + fmt(bal) + ' left today' : 'Your purse is empty';
      sh.querySelector('#warnLead').innerHTML = '';
      sh.querySelector('#warnLead').append('This payment is ' + fmt(amount) + ', so you’d go ', Object.assign(document.createElement('b'), { textContent: fmt(over) + ' over', style: 'color:var(--bad)' }), ' your limit' + (st.mode === 'carry' ? '. Tomorrow’s purse starts ' + fmt(over) + ' short.' : '.'));
      sh.querySelector('#warnChange').addEventListener('click', function () { closeSheet(); });
      var go2 = sh.querySelector('#warnGo');
      go2.textContent = 'Pay anyway with ' + APPS[id].name;
      go2.href = hrefFor(id);
      go2.addEventListener('click', function () { closeSheet(true); handoff(id); });
    });
  }

  /* return from the UPI app -> confirm */
  var wentAway = false, stayT;
  function armReturn() {
    wentAway = false; clearTimeout(stayT);
    stayT = setTimeout(function () { if (st.pending && !wentAway && document.visibilityState === 'visible' && !sheetOpen) askConfirm(true); }, 4500);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') { wentAway = true; return; }
    if (rollover() && screen === 'home') renderHome();
    if (st.pending && wentAway && !sheetOpen) setTimeout(function () { askConfirm(false); }, 350);
  });
  function askConfirm(stayed) {
    var p = st.pending; if (!p) return;
    openSheet('t-confirm', function (sh) {
      sh.querySelector('#cTitle').textContent = 'Did ' + fmt(p.amount) + ' reach ' + (p.name || p.pa) + '?';
      sh.querySelector('#cLead').textContent = (stayed ? 'It looks like ' + APPS[p.app].name + ' may not have opened. ' : 'Paid with ' + APPS[p.app].name + ' at ' + timeStr(p.at) + '. ') + 'Only you can see whether it went through.';
      $$('[data-o]', sh).forEach(function (b) {
        b.addEventListener('click', function () { resolve(b.dataset.o); });
      });
    }, true);
  }
  function resolve(o) {
    var p = st.pending; if (!p) return;
    st.tries.push({ app: p.app, kind: p.kind, method: p.method, outcome: o === 'paid' ? 'paid' : o, at: p.at });
    st.tries = st.tries.slice(-200);
    closeSheet(true);
    if (o === 'paid') {
      st.log.unshift({ id: Date.now().toString(36), day: dayKey(), at: p.at, name: p.name, pa: p.pa, amount: p.amount, app: p.app, kind: p.kind, source: 'purse' });
      st.balance -= p.amount; st.pending = null; save();
      payW.flyAway();
      toast('Paid ' + fmt(p.amount) + ' · ' + (st.balance >= 0 ? fmt(st.balance) + ' left' : fmt(-st.balance) + ' over'), 3000);
      setTimeout(function () { qr = null; amount = 0; if (history.state && history.state.s === 'pay') history.back(); else show('home'); setTimeout(function () { setOpen(true); }, 60); }, st.anim ? 1100 : 50);
    } else {
      st.pending = null; save();
      payW.pullCard(null);
      if (o === 'notpaid') {
        payW.setOut(0, true);
        setTimeout(function () { renderPay(true); }, st.anim ? 500 : 0);
        if (p.method === 'direct' && p.kind === 'personal' && APPS[p.app].open && !worked(p.app)) toast('Next time ' + APPS[p.app].name + ' will copy the UPI ID instead', 3400);
        else toast('Notes are back in your purse');
      } else toast('Pick another app below');
    }
  }

  /* ================= history ================= */
  function renderHistory() {
    rollover();
    var spent = spentToday();
    $('hSpent').textContent = fmt(spent);
    $('hLeft').textContent = st.balance >= 0 ? fmt(st.balance) : '−' + fmt(-st.balance);
    var list = $('hList'); list.innerHTML = '';
    if (!st.log.length) { list.innerHTML = '<p class="empty">No payments yet. Scan a QR to pay with your purse.</p>'; return; }
    var lastDay = '';
    st.log.slice(0, 200).forEach(function (e) {
      if (e.day !== lastDay) {
        lastDay = e.day;
        var h = document.createElement('p'); h.className = 'label day';
        h.textContent = e.day === dayKey() ? 'Today' : new Date(e.day + 'T12:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
        list.appendChild(h);
      }
      var b = document.createElement('button'); b.type = 'button'; b.className = 'row';
      b.innerHTML = '<span class="av"></span><span class="t"><b></b><small></small></span><span class="a"><span></span><small></small></span>';
      b.querySelector('.av').textContent = initials(e.name, e.pa || e.name);
      b.querySelector('.t b').textContent = e.name || e.pa || 'Payment';
      b.querySelector('.t small').textContent = timeStr(e.at) + ' · ' + (e.source === 'manual' ? 'added by hand' : APPS[e.app] ? APPS[e.app].name : '');
      b.querySelector('.a span').textContent = fmt(e.amount);
      var parts = breakdown(e.amount);
      b.querySelector('.a small').textContent = parts.length > 4 ? plus(parts.slice(0, 3)) + ' …' : plus(parts);
      b.setAttribute('aria-label', (e.name || e.pa) + ', ' + fmt(e.amount) + ', ' + timeStr(e.at) + '. Edit or undo');
      b.addEventListener('click', function () { openEntry(e); });
      list.appendChild(b);
    });
  }
  $('addOutside').addEventListener('click', function () { openEntry(null); });
  function openEntry(entry) {
    openSheet('t-entry', function (sh) {
      var name = sh.querySelector('#eName'), amt = sh.querySelector('#eAmt'), err = sh.querySelector('#eErr');
      if (entry) {
        sh.querySelector('#eTitle').textContent = 'Fix this payment';
        sh.querySelector('#eLead').textContent = entry.day === dayKey() ? 'Changes come out of, or go back into, today’s purse.' : 'This was on an earlier day, so today’s purse won’t change.';
        name.value = entry.name || entry.pa || ''; amt.value = entry.amount;
        sh.querySelector('#eSave').textContent = 'Save';
        var del = sh.querySelector('#eDel'); del.hidden = false;
        del.textContent = entry.day === dayKey() ? 'Undo it. Put ' + fmt(entry.amount) + ' back' : 'Delete this payment';
        del.addEventListener('click', function () {
          st.log = st.log.filter(function (x) { return x !== entry; });
          if (entry.day === dayKey()) st.balance += entry.amount;
          save(); closeSheet(true); refresh(); toast('Undone');
        });
      } else setTimeout(function () { name.focus(); }, 280);
      amt.addEventListener('input', function () { amt.value = amt.value.replace(/[^\d]/g, '').slice(0, 6); });
      sh.querySelector('#eForm').addEventListener('submit', function (ev) {
        ev.preventDefault();
        var a = parseInt(amt.value, 10) || 0;
        if (a <= 0) { err.textContent = 'Enter an amount.'; amt.focus(); return; }
        if (entry) {
          if (entry.day === dayKey()) st.balance += entry.amount - a;
          entry.amount = a; entry.name = name.value.trim() || entry.name;
        } else {
          st.log.unshift({ id: Date.now().toString(36), day: dayKey(), at: new Date().toISOString(), name: name.value.trim() || 'Outside payment', pa: '', amount: a, app: '', kind: '', source: 'manual' });
          st.balance -= a;
        }
        save(); closeSheet(true); refresh();
        toast(entry ? 'Saved' : fmt(a) + ' taken out · ' + (st.balance >= 0 ? fmt(st.balance) + ' left' : fmt(-st.balance) + ' over'));
      });
    });
  }
  function refresh() { if (screen === 'history') renderHistory(); if (screen === 'home') renderHome(); }

  /* ================= settings ================= */
  function renderSettings() {
    $('sLimit').textContent = fmt(st.limit);
    $$('#settings [data-mode]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.mode === st.mode ? 'true' : 'false'); });
    var pick = $('usualPick'); pick.innerHTML = '';
    APP_IDS.forEach(function (id) {
      var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-pressed', id === st.usual ? 'true' : 'false');
      b.appendChild(appIcon(id)); b.appendChild(document.createTextNode(APPS[id].short));
      b.addEventListener('click', function () { st.usual = id; save(); renderSettings(); });
      pick.appendChild(b);
    });
    $('tRemind').setAttribute('aria-checked', st.remind ? 'true' : 'false');
    $('tAnim').setAttribute('aria-checked', st.anim ? 'true' : 'false');
  }
  $$('#settings [data-lim]').forEach(function (b) {
    b.addEventListener('click', function () {
      var n = Math.min(100000, Math.max(50, st.limit + +b.dataset.lim));
      st.balance += n - st.limit; st.limit = n; save(); renderSettings();
    });
  });
  $$('#settings [data-mode]').forEach(function (b) { b.addEventListener('click', function () { st.mode = b.dataset.mode; save(); renderSettings(); }); });
  $('tRemind').addEventListener('click', function () { st.remind = !st.remind; save(); renderSettings(); });
  $('tAnim').addEventListener('click', function () { st.anim = !st.anim; save(); applyMotion(); renderSettings(); });
  $('exportBtn').addEventListener('click', function () {
    var rows = ['Date\tTime\tPaid to\tUPI ID\tAmount\tApp\tHow'];
    st.log.forEach(function (e) { rows.push([e.day, timeStr(e.at), e.name || '', e.pa || '', e.amount, APPS[e.app] ? APPS[e.app].name : '', e.source === 'manual' ? 'added by hand' : 'through Purse'].join('\t')); });
    toast(copySync(rows.join('\n')) ? 'History copied. Paste it into a spreadsheet' : 'Couldn’t copy');
  });
  $('wipeBtn').addEventListener('click', function () {
    if (!confirm('Erase your limit and all history from this phone?')) return;
    try { localStorage.removeItem(KEY); } catch (e) {}
    location.reload();
  });

  /* ================= sheets ================= */
  var sheetOpen = null, lastFocus = null;
  function openSheet(tpl, onOpen, sticky) {
    closeSheet(true);
    lastFocus = document.activeElement;
    var host = $('sheets');
    host.innerHTML = '<div class="scrim"></div><div class="sheet" role="dialog" aria-modal="true"><div class="grip" aria-hidden="true"></div></div>';
    var sheet = host.querySelector('.sheet');
    sheet.appendChild($(tpl).content.cloneNode(true));
    var h = sheet.querySelector('h2'); if (h) { h.id = h.id || 'sh-' + tpl; sheet.setAttribute('aria-labelledby', h.id); }
    if (!sticky) host.querySelector('.scrim').addEventListener('click', function () { closeSheet(); });
    sheetOpen = tpl;
    if (onOpen) onOpen(sheet);
    if (tpl !== 't-id' && tpl !== 't-entry') { var f = sheet.querySelector('button, a[href]'); if (f) setTimeout(function () { f.focus({ preventScroll: true }); }, 60); }
  }
  function closeSheet(silent) {
    $('sheets').innerHTML = ''; sheetOpen = null;
    if (!silent && lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
  }

  /* ================= start ================= */
  applyMotion();
  rollover();
  if (!st.setup) { renderSetup(); try { history.replaceState({ s: 'setup' }, ''); } catch (e) {} show('setup'); }
  else { try { history.replaceState({ s: 'home' }, ''); } catch (e) {} show('home'); setOpen(false); }
  if (st.pending && st.setup) {
    // came back after the page was reloaded by the system while the UPI app was open
    var p = st.pending; qr = parseQr('upi://pay?pa=' + encVpa(p.pa) + (p.name ? '&pn=' + encodeURIComponent(p.name) : '')); amount = p.amount;
    try { history.pushState({ s: 'pay' }, ''); } catch (e) {}
    show('pay'); setTimeout(function () { askConfirm(false); }, 400);
  }
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  // test hook (used only by automated checks)
  window.__purse = { st: st, useText: useText, resolve: resolve, openCount: openCount };
})();
