/* Purse currency artwork.
   Stylised notes and coins that echo Indian currency (colours, layout, security-feature
   look) without reproducing protected elements: no portrait, national emblem,
   "Reserve Bank of India" wording, governor signature, serial numbers or real motifs.
   Every note carries "PURSE · NOT CURRENCY" microtext. */
(function (root) {
  var NOTE = {
    500: { base: '#CFCEBF', dark: '#A9A895', light: '#E4E3D6', ink: '#4A5043', val1: '#3E8A3A', val2: '#2C6E86', thread1: '#2F6B3E', thread2: '#2D5F86', words: 'FIVE HUNDRED', dev: '५००', bleed: 5, dots: 0, mark: 'circle' },
    200: { base: '#F5C27D', dark: '#E79B52', light: '#FADDB0', ink: '#87451A', val1: '#2E8A52', val2: '#2A6E8E', thread1: '#2E7A4E', thread2: '#2B6390', words: 'TWO HUNDRED', dev: '२००', bleed: 4, dots: 2, mark: 'square' },
    100: { base: '#BDB1E0', dark: '#9D8ECC', light: '#DAD3EE', ink: '#40357A', val1: '#40357A', val2: '#5C4FA0', thread1: '#2F3F7A', thread2: '#2E6A8A', words: 'ONE HUNDRED', dev: '१००', bleed: 4, dots: 0, mark: 'triangle' },
    50:  { base: '#A6DCDF', dark: '#7EC4CA', light: '#D1EEF0', ink: '#1C646C', val1: '#1C646C', val2: '#1C646C', thread1: '#1F5A60', thread2: '#1F5A60', words: 'FIFTY', dev: '५०', bleed: 0, dots: 0, mark: '' },
    20:  { base: '#DAE291', dark: '#BECB6A', light: '#EEF2C2', ink: '#56651A', val1: '#56651A', val2: '#56651A', thread1: '#4A5A1A', thread2: '#4A5A1A', words: 'TWENTY', dev: '२०', bleed: 0, dots: 0, mark: '' },
    10:  { base: '#C7A083', dark: '#AA8063', light: '#E0C8B4', ink: '#583824', val1: '#583824', val2: '#583824', thread1: '#4A2F1F', thread2: '#4A2F1F', words: 'TEN', dev: '१०', bleed: 0, dots: 0, mark: '' }
  };
  var uid = 0;

  function spiro(cx, cy, size, R, r, d, turns, rot) {
    var pts = [], steps = 160 * turns, k = (R - r) / r, scale = size / (R - r + d);
    for (var i = 0; i <= steps; i++) {
      var t = (i / 160) * Math.PI * 2;
      var x = (R - r) * Math.cos(t) + d * Math.cos(k * t);
      var y = (R - r) * Math.sin(t) - d * Math.sin(k * t);
      var a = rot || 0, xr = x * Math.cos(a) - y * Math.sin(a), yr = x * Math.sin(a) + y * Math.cos(a);
      pts.push((cx + xr * scale).toFixed(2) + ' ' + (cy + yr * scale).toFixed(2));
    }
    return 'M' + pts.join('L');
  }
  function waves(n, w, h, amp, freq, phase0) {
    var out = '';
    for (var j = 0; j < n; j++) {
      var y0 = (h / (n + 1)) * (j + 1), d = '';
      for (var x = 0; x <= w; x += 4) {
        var y = y0 + amp * Math.sin((x / w) * Math.PI * 2 * freq + phase0 + j * 0.55);
        d += (x ? 'L' : 'M') + x + ' ' + y.toFixed(2);
      }
      out += '<path d="' + d + '"/>';
    }
    return out;
  }

  function lotus(cx, cy, k, col, op) {
    // line-art lotus: 7 outer petals, 5 inner, base leaves, with vein lines
    var g = '<g fill="none" stroke="' + col + '" stroke-opacity="' + op + '" stroke-width=".45" stroke-linejoin="round">';
    function petal(ang, len, wid) {
      var a = ang * Math.PI / 180, tx = cx + Math.sin(a) * len * k, ty = cy - Math.cos(a) * len * k;
      var px = Math.cos(a) * wid * k, py = Math.sin(a) * wid * k;
      var mx = cx + Math.sin(a) * len * .5 * k, my = cy - Math.cos(a) * len * .5 * k;
      var d = 'M' + cx + ' ' + cy + 'Q' + (mx + px).toFixed(1) + ' ' + (my + py).toFixed(1) + ' ' + tx.toFixed(1) + ' ' + ty.toFixed(1) +
              'Q' + (mx - px).toFixed(1) + ' ' + (my - py).toFixed(1) + ' ' + cx + ' ' + cy;
      var v = '';
      for (var i = 1; i <= 3; i++) { var f = i / 4; v += 'M' + cx + ' ' + cy + 'L' + (cx + Math.sin(a + (i - 2) * .06) * len * .85 * k).toFixed(1) + ' ' + (cy - Math.cos(a + (i - 2) * .06) * len * .85 * k).toFixed(1); }
      return '<path d="' + d + '"/><path d="' + v + '" stroke-opacity="' + (op * .6) + '" stroke-width=".3"/>';
    }
    [-78, -52, -26, 0, 26, 52, 78].forEach(function (a) { g += petal(a, 30, 8); });
    [-40, -20, 0, 20, 40].forEach(function (a) { g += petal(a, 22, 6); });
    g += '<path d="M' + (cx - 34 * k) + ' ' + (cy + 4 * k) + 'Q' + cx + ' ' + (cy + 16 * k) + ' ' + (cx + 34 * k) + ' ' + (cy + 4 * k) + '"/>';
    g += '<path d="M' + (cx - 26 * k) + ' ' + (cy + 9 * k) + 'Q' + cx + ' ' + (cy + 22 * k) + ' ' + (cx + 26 * k) + ' ' + (cy + 9 * k) + '"/>';
    g += '<path d="M' + cx + ' ' + (cy + 12 * k) + 'Q' + (cx + 3 * k) + ' ' + (cy + 24 * k) + ' ' + (cx - 2 * k) + ' ' + (cy + 34 * k) + '"/>';
    return g + '</g>';
  }
  function chain(x0, x1, y, col, op, step) {
    // decorative border band: alternating lozenges and dots
    var g = '<g fill="none" stroke="' + col + '" stroke-opacity="' + op + '" stroke-width=".4">';
    for (var x = x0; x < x1; x += step) {
      g += '<path d="M' + x + ' ' + y + 'l' + step / 2 + ' -2.2l' + step / 2 + ' 2.2l-' + step / 2 + ' 2.2z"/>';
      g += '<circle cx="' + (x + step / 2) + '" cy="' + y + '" r=".55" fill="' + col + '" fill-opacity="' + op + '"/>';
    }
    return g + '</g>';
  }
  function micro(text, n) { var s = ''; for (var i = 0; i < n; i++) s += text; return s; }

  function noteSVG(v) {
    var c = NOTE[v], id = 'n' + (++uid), W = 330, H = 146;
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" font-family="Manrope, system-ui, sans-serif">';
    s += '<defs>' +
      '<linearGradient id="' + id + 'bg" x1="0" x2="1">' +
        '<stop offset="0" stop-color="' + c.dark + '"/><stop offset=".16" stop-color="' + c.base + '"/>' +
        '<stop offset=".52" stop-color="' + c.base + '"/><stop offset=".57" stop-color="' + c.light + '"/>' +
        '<stop offset=".9" stop-color="' + c.light + '"/><stop offset="1" stop-color="' + c.base + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'ovi" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + c.val1 + '"/><stop offset=".55" stop-color="' + c.val1 + '"/><stop offset="1" stop-color="' + c.val2 + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'thr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + c.thread1 + '"/><stop offset="1" stop-color="' + c.thread2 + '"/></linearGradient>' +
      '<radialGradient id="' + id + 'wm" cx=".5" cy=".5" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      '<filter id="' + id + 'tx" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="' + v + '"/><feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .07 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>' +
      '<clipPath id="' + id + 'clip"><rect width="' + W + '" height="' + H + '" rx="6"/></clipPath>' +
      '</defs><g clip-path="url(#' + id + 'clip)">';
    // paper
    s += '<rect width="' + W + '" height="' + H + '" fill="url(#' + id + 'bg)"/>';
    // guilloche field (two crossing families)
    s += '<g fill="none" stroke="' + c.ink + '" stroke-opacity=".11" stroke-width=".45">' + waves(22, W, H, 5, 3, 0) + '</g>';
    s += '<g fill="none" stroke="' + c.ink + '" stroke-opacity=".07" stroke-width=".4">' + waves(16, W, H, 9, 1.5, 1.7) + '</g>';
    // left darker panel shape (like the coloured band on real notes)
    s += '<path d="M0 0H118C104 30 132 60 112 90C100 112 120 130 118 146H0Z" fill="' + c.dark + '" fill-opacity=".35"/>';
    s += '<clipPath id="' + id + 'lp"><path d="M0 0H118C104 30 132 60 112 90C100 112 120 130 118 146H0Z"/></clipPath>';
    var hatch = '';
    for (var hx = -150; hx < 130; hx += 2.2) hatch += 'M' + hx + ' 146L' + (hx + 146) + ' 0';
    s += '<path d="' + hatch + '" clip-path="url(#' + id + 'lp)" stroke="' + c.ink + '" stroke-opacity=".07" stroke-width=".35"/>';
    // faint lotus artwork behind the value side (decorative, like a reverse-side motif)
    s += lotus(278, 88, 1.25, c.ink, .16);
    // border bands
    s += chain(14, W - 14, 11, c.ink, .3, 6) + chain(14, W - 14, H - 11.5, c.ink, .3, 6);
    // fine-line band beside the thread
    var band = '';
    for (var by = 4; by < H - 4; by += 1.6) band += 'M195 ' + by + 'h6';
    s += '<path d="' + band + '" stroke="' + c.ink + '" stroke-opacity=".16" stroke-width=".35"/>';
    for (var dy = 8; dy < H - 6; dy += 5) s += '<circle cx="181" cy="' + dy + '" r=".7" fill="' + c.ink + '" fill-opacity=".3"/>';
    // frame
    s += '<rect x="5" y="5" width="' + (W - 10) + '" height="' + (H - 10) + '" rx="3" fill="none" stroke="' + c.ink + '" stroke-opacity=".22" stroke-width=".8"/>';
    s += '<rect x="8" y="8" width="' + (W - 16) + '" height="' + (H - 16) + '" rx="2" fill="none" stroke="' + c.ink + '" stroke-opacity=".12" stroke-width=".5" stroke-dasharray="1.5 1.5"/>';
    // corner rosettes
    [[14, 14], [W - 14, 14], [14, H - 14], [W - 14, H - 14]].forEach(function (p) {
      s += '<path d="' + spiro(p[0], p[1], 9, 7, 4, 3, 4, 0) + '" fill="none" stroke="' + c.ink + '" stroke-opacity=".28" stroke-width=".35"/>';
    });
    // big central rosette (spirograph, two layers)
    var rx = 112, ry = 72;
    s += '<circle cx="' + rx + '" cy="' + ry + '" r="40" fill="' + c.light + '" fill-opacity=".35"/>';
    for (var L = 0; L < 4; L++) s += '<path d="' + spiro(rx, ry, 38 - L * 1.2, 12, 5, 3.6, 5, L * 0.13) + '" fill="none" stroke="' + c.ink + '" stroke-opacity="' + (.34 - L * .05) + '" stroke-width=".32"/>';
    for (var M = 0; M < 3; M++) s += '<path d="' + spiro(rx, ry, 25 - M, 10, 3, 2.2, 3, M * 0.21) + '" fill="none" stroke="' + c.ink + '" stroke-opacity=".3" stroke-width=".3"/>';
    s += '<circle cx="' + rx + '" cy="' + ry + '" r="14" fill="' + c.base + '" stroke="' + c.ink + '" stroke-opacity=".35" stroke-width=".6"/>';
    s += '<text x="' + rx + '" y="' + (ry + 6) + '" text-anchor="middle" font-size="17" font-weight="800" fill="' + c.ink + '" fill-opacity=".75">₹</text>';
    // ring of microtext around rosette
    s += '<path id="' + id + 'ring" d="M ' + (rx - 44) + ' ' + ry + ' a 44 44 0 1 1 88 0 a 44 44 0 1 1 -88 0" fill="none"/>';
    s += '<text font-size="3.4" font-weight="700" letter-spacing=".6" fill="' + c.ink + '" fill-opacity=".45"><textPath href="#' + id + 'ring">' + micro('PURSE · ' + c.words + ' · ', 4) + '</textPath></text>';
    // vertical numeral, left
    s += '<text transform="translate(34 ' + (H / 2) + ') rotate(-90)" text-anchor="middle" font-size="30" font-weight="800" fill="' + c.ink + '" fill-opacity=".62" letter-spacing="-.5">₹' + v + '</text>';
    // Devanagari numeral near rosette
     s += '<text x="' + (rx + 46) + '" y="' + (H - 30) + '" font-size="10" font-weight="700" fill="' + c.ink + '" fill-opacity=".6">₹' + c.dev + '</text>';
    // top microtext bars (stand-ins for issuer text, carry no words)
    s += '<rect x="58" y="14" width="96" height="5" rx="1" fill="' + c.ink + '" fill-opacity=".45"/>';
    s += '<text x="58" y="25" font-size="3.2" font-weight="700" letter-spacing=".4" fill="' + c.ink + '" fill-opacity=".5" textLength="96" lengthAdjust="spacingAndGlyphs">' + micro('PURSE·NOT CURRENCY·', 3) + '</text>';
    s += '<rect x="214" y="14" width="96" height="5" rx="1" fill="' + c.ink + '" fill-opacity=".45"/>';
    s += '<text x="214" y="25" font-size="3.2" font-weight="700" letter-spacing=".4" fill="' + c.ink + '" fill-opacity=".5" textLength="96" lengthAdjust="spacingAndGlyphs">' + micro('DAILY LIMIT·', 5) + '</text>';
    // windowed security thread with colour shift and microtext
    s += '<g>';
    for (var y = -2; y < H; y += 15) s += '<rect x="186" y="' + y + '" width="6" height="9" rx="1" fill="url(#' + id + 'thr)"/>';
    s += '<text transform="translate(190.6 ' + (H - 6) + ') rotate(-90)" font-size="3.6" font-weight="800" letter-spacing=".8" fill="#fff" fill-opacity=".55">' + micro('PURSE ', 12) + '</text></g>';
    // watermark window: faint electrotype numeral and monogram
    s += '<rect x="204" y="30" width="58" height="64" rx="4" fill="url(#' + id + 'wm)"/>';
    s += '<text x="233" y="74" text-anchor="middle" font-size="40" font-family="Instrument Serif, Georgia, serif" font-style="italic" fill="' + c.ink + '" fill-opacity=".09">P</text>';
    s += '<text x="233" y="89" text-anchor="middle" font-size="8" font-weight="800" fill="#fff" fill-opacity=".6">' + v + '</text>';
    // see-through register style half symbol
    // denomination in words + small box (stand-in for the number panel, no digits)
    s += '<text x="40" y="' + (H - 18) + '" font-size="5" font-weight="800" letter-spacing="1.4" fill="' + c.ink + '" fill-opacity=".55">' + c.words + ' · RUPEES</text>';
    var lat = '';
    for (var lx = 40; lx < 84; lx += 1.3) lat += 'M' + lx.toFixed(1) + ' ' + (H - 35) + 'v9';
    s += '<path d="' + lat + '" stroke="' + c.ink + '" stroke-opacity=".32" stroke-width=".5"/>';
    s += '<text x="62" y="' + (H - 27.6) + '" text-anchor="middle" font-size="8" font-weight="800" fill="' + c.base + '" fill-opacity=".55" letter-spacing="1">' + v + '</text>';
    // big value with colour-shift ink
    s += '<text x="' + (W - 16) + '" y="' + (H - 18) + '" text-anchor="end" font-size="38" font-weight="800" letter-spacing="-1" fill="url(#' + id + 'ovi)" stroke="' + c.ink + '" stroke-opacity=".15" stroke-width=".4">₹' + v + '</text>';
    s += '<text x="' + (W - 16) + '" y="' + (H - 13.5) + '" text-anchor="end" font-size="2.6" font-weight="700" letter-spacing=".3" fill="' + c.ink + '" fill-opacity=".45">' + micro('PURSE₹' + v + ' ', 8) + '</text>';
    // bleed lines (angled groups) on both edges
    for (var b = 0; b < c.bleed; b++) {
      var yy = 52 + b * 6;
      s += '<line x1="0" y1="' + yy + '" x2="12" y2="' + (yy - 5) + '" stroke="' + c.ink + '" stroke-opacity=".7" stroke-width="1.2"/>';
      s += '<line x1="' + W + '" y1="' + yy + '" x2="' + (W - 12) + '" y2="' + (yy - 5) + '" stroke="' + c.ink + '" stroke-opacity=".7" stroke-width="1.2"/>';
    }
    for (var d = 0; d < c.dots; d++) {
      s += '<circle cx="6" cy="' + (90 + d * 7) + '" r="1.8" fill="' + c.ink + '" fill-opacity=".7"/><circle cx="' + (W - 6) + '" cy="' + (90 + d * 7) + '" r="1.8" fill="' + c.ink + '" fill-opacity=".7"/>';
    }
    // small corner numeral (top right), readable when the note stands in a wallet
    s += '<text x="' + (W - 14) + '" y="38" text-anchor="end" font-size="13" font-weight="800" fill="' + c.ink + '" fill-opacity=".75" letter-spacing="-.3">' + v + '</text>';
    // tactile mark
    if (c.mark === 'circle') s += '<circle cx="' + (W - 24) + '" cy="56" r="4" fill="none" stroke="' + c.ink + '" stroke-opacity=".55" stroke-width="1.4"/>';
    if (c.mark === 'square') s += '<rect x="' + (W - 28) + '" y="52" width="8" height="8" fill="none" stroke="' + c.ink + '" stroke-opacity=".55" stroke-width="1.4"/>';
    if (c.mark === 'triangle') s += '<path d="M' + (W - 28) + ' 60l4-8 4 8z" fill="none" stroke="' + c.ink + '" stroke-opacity=".55" stroke-width="1.4"/>';
    // footer microtext line
    s += '<text x="' + (W / 2) + '" y="' + (H - 5.6) + '" text-anchor="middle" font-size="3" font-weight="700" letter-spacing=".5" fill="' + c.ink + '" fill-opacity=".45">' + micro('PURSE · NOT CURRENCY · ', 5) + '</text>';
    // paper fibres + sheen
    s += '<rect width="' + W + '" height="' + H + '" fill="#000" filter="url(#' + id + 'tx)"/>';
    s += '<rect width="' + W + '" height="' + H + '" fill="#fff" fill-opacity=".08"/>';
    s += '</g></svg>';
    return s;
  }

  var COIN = {
    1:  { metal: 'steel', size: 'sm' },
    2:  { metal: 'steel', size: 'md' },
    5:  { metal: 'brass', size: 'md' },
    10: { metal: 'bi', size: 'lg' }
  };
  var METAL = {
    steel: ['#FAFAF7', '#D2D0CA', '#9C9A93', '#6E6C66'],
    brass: ['#FBEAB5', '#D9B465', '#A07E36', '#6E5520']
  };
  function sprig(side, col) {
    var sx = side < 0 ? -1 : 1, s = '<g transform="translate(50 54) scale(' + sx + ' 1)" fill="' + col + '">';
    s += '<path d="M22 14 C 26 2, 24 -12, 16 -22" fill="none" stroke="' + col + '" stroke-width="1.2"/>';
    for (var i = 0; i < 6; i++) {
      var t = i / 6, x = 22 + 4 * Math.sin(t * 2.6) - t * 8, y = 12 - t * 34;
      s += '<ellipse cx="' + (x + 3).toFixed(1) + '" cy="' + y.toFixed(1) + '" rx="3.2" ry="1.4" transform="rotate(-40 ' + (x + 3).toFixed(1) + ' ' + y.toFixed(1) + ')"/>';
      s += '<ellipse cx="' + (x - 2).toFixed(1) + '" cy="' + (y + 1).toFixed(1) + '" rx="3" ry="1.3" transform="rotate(30 ' + (x - 2).toFixed(1) + ' ' + (y + 1).toFixed(1) + ')"/>';
    }
    return s + '</g>';
  }
  function coinSVG(v) {
    var c = COIN[v], id = 'c' + (++uid);
    var outer = c.metal === 'bi' ? METAL.brass : METAL[c.metal];
    var inner = c.metal === 'bi' ? METAL.steel : METAL[c.metal];
    var ink = c.metal === 'brass' || c.metal === 'bi' ? '#5A4416' : '#55534D';
    var s = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" font-family="Manrope, system-ui, sans-serif"><defs>' +
      '<radialGradient id="' + id + 'o" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="' + outer[0] + '"/><stop offset=".45" stop-color="' + outer[1] + '"/><stop offset=".85" stop-color="' + outer[2] + '"/><stop offset="1" stop-color="' + outer[3] + '"/></radialGradient>' +
      '<radialGradient id="' + id + 'i" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="' + inner[0] + '"/><stop offset=".5" stop-color="' + inner[1] + '"/><stop offset="1" stop-color="' + inner[2] + '"/></radialGradient>' +
      '<linearGradient id="' + id + 'sh" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".45" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient>' +
      '</defs>';
    s += '<circle cx="50" cy="50" r="49" fill="url(#' + id + 'o)"/>';
    // reeded edge ring
    for (var i = 0; i < 90; i++) {
      var a = i / 90 * Math.PI * 2;
      s += '<line x1="' + (50 + 46.5 * Math.cos(a)).toFixed(2) + '" y1="' + (50 + 46.5 * Math.sin(a)).toFixed(2) + '" x2="' + (50 + 49 * Math.cos(a)).toFixed(2) + '" y2="' + (50 + 49 * Math.sin(a)).toFixed(2) + '" stroke="' + outer[3] + '" stroke-opacity=".5" stroke-width=".9"/>';
    }
    // beaded rim
    for (var j = 0; j < 60; j++) {
      var b = j / 60 * Math.PI * 2;
      s += '<circle cx="' + (50 + 43 * Math.cos(b)).toFixed(2) + '" cy="' + (50 + 43 * Math.sin(b)).toFixed(2) + '" r=".9" fill="' + outer[3] + '" fill-opacity=".45"/>';
    }
    if (c.metal === 'bi') {
      // ten rays on the outer ring
      for (var r = 0; r < 10; r++) {
        var ang = r / 10 * Math.PI * 2 - Math.PI / 2;
        s += '<line x1="' + (50 + 30 * Math.cos(ang)).toFixed(2) + '" y1="' + (50 + 30 * Math.sin(ang)).toFixed(2) + '" x2="' + (50 + 40 * Math.cos(ang)).toFixed(2) + '" y2="' + (50 + 40 * Math.sin(ang)).toFixed(2) + '" stroke="' + outer[3] + '" stroke-opacity=".55" stroke-width="1.4" stroke-linecap="round"/>';
      }
      s += '<circle cx="50" cy="50" r="29" fill="url(#' + id + 'i)" stroke="' + METAL.steel[3] + '" stroke-opacity=".45" stroke-width=".8"/>';
      s += '<text x="50" y="44" text-anchor="middle" font-size="13" font-weight="800" fill="#55534D">₹</text>';
      s += '<text x="50" y="64" text-anchor="middle" font-size="20" font-weight="800" fill="#55534D" letter-spacing="-.5">10</text>';
      s += '<text x="50" y="74" text-anchor="middle" font-size="4.5" font-weight="700" fill="#55534D" fill-opacity=".7">2026</text>';
    } else {
      s += '<circle cx="50" cy="50" r="40" fill="url(#' + id + 'i)" fill-opacity=".6"/>';
      s += sprig(-1, ink) + sprig(1, ink);
      s += '<text x="50" y="38" text-anchor="middle" font-size="14" font-weight="800" fill="' + ink + '">₹</text>';
      s += '<text x="50" y="66" text-anchor="middle" font-size="30" font-weight="800" fill="' + ink + '">' + v + '</text>';
      s += '<text x="50" y="80" text-anchor="middle" font-size="5" font-weight="700" fill="' + ink + '" fill-opacity=".75">2026</text>';
    }
    var rimR = c.metal === 'bi' ? 35 : 37.5, lc = c.metal === 'bi' ? METAL.brass[3] : ink;
    s += '<path id="' + id + 'top" d="M ' + (50 - rimR) + ' 50 A ' + rimR + ' ' + rimR + ' 0 0 1 ' + (50 + rimR) + ' 50" fill="none"/>';
    s += '<path id="' + id + 'bot" d="M ' + (50 - rimR - 3.5) + ' 50 A ' + (rimR + 3.5) + ' ' + (rimR + 3.5) + ' 0 0 0 ' + (50 + rimR + 3.5) + ' 50" fill="none"/>';
    if (c.metal !== 'bi') {
      s += '<text font-size="5.2" font-weight="800" letter-spacing="1.2" fill="' + lc + '" fill-opacity=".7"><textPath href="#' + id + 'top" startOffset="50%" text-anchor="middle">रुपये</textPath></text>';
      s += '<text font-size="4.6" font-weight="800" letter-spacing="1.6" fill="' + lc + '" fill-opacity=".7"><textPath href="#' + id + 'bot" startOffset="50%" text-anchor="middle">RUPEES</textPath></text>';
    } else {
      s += '<text font-size="4.4" font-weight="800" letter-spacing="1.2" fill="' + lc + '" fill-opacity=".75"><textPath href="#' + id + 'bot" startOffset="50%" text-anchor="middle">RUPEES · रुपये</textPath></text>';
    }
    s += '<circle cx="50" cy="50" r="49" fill="url(#' + id + 'sh)"/>';
    return s + '</svg>';
  }

  // Each design is rendered once and reused as an image (fast to animate, ids stay scoped).
  var cache = {};
  function url(kind, v) {
    var key = kind + v;
    if (!cache[key]) {
      var svg = (kind === 'n' ? noteSVG(v) : coinSVG(v)).replace(/font-family="[^"]*"/, 'font-family="-apple-system, system-ui, Helvetica, Arial, sans-serif"');
      try { cache[key] = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })); }
      catch (e) { cache[key] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
    }
    return cache[key];
  }
  root.PurseCurrency = { noteSVG: noteSVG, coinSVG: coinSVG, noteURL: function (v) { return url('n', v); }, coinURL: function (v) { return url('c', v); }, NOTE: NOTE, COIN: COIN };
})(window);
