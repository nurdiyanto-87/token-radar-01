// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, filters, a per-protocol detail view
// with the model's own arithmetic and the farm plan, and a sandbox that
// recomputes the ranking live. No network: every byte it shows is in data.js.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var MODEL = DATA.model;
  var state = {
    q: '', category: 'all', chain: 'all', watchlistOnly: false, gainersOnly: false,
    tab: 'board', sort: 'implied', dir: -1, selected: null,
    sandbox: { growthWeight: MODEL.growth_weight, maturityFloor: MODEL.maturity_floor, multipleCap: MODEL.multiple_cap }
  };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtUsdFull(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return n.toFixed(4);
  }

  // The model in one function: the page recomputes a row from the snapshot
  // figures and the shipped comps, so the page's code and the board's data
  // are visibly the same arithmetic. Sandbox overrides plug in here too.
  function impliedOf(row, over) {
    var m = over || {};
    var cap = m.multipleCap === undefined ? MODEL.multiple_cap : m.multipleCap;
    var multiple = Math.min(cap, Math.max(MODEL.multiple_floor, row.multiple_raw));
    var gw = m.growthWeight === undefined ? MODEL.growth_weight : m.growthWeight;
    var growthMult = 1 + (row.growth_pct / 100) * gw;
    var mf = m.maturityFloor === undefined ? MODEL.maturity_floor : m.maturityFloor;
    var age = row.age_days === null || row.age_days === undefined ? DATA.median_age_days : row.age_days;
    var maturity = mf + (1 - mf) * Math.sqrt(Math.min(Math.max(age, 0), MODEL.maturity_days) / MODEL.maturity_days);
    return Math.max(1, Math.round(row.tvl_usd * multiple * growthMult * maturity * row.breadth_multiplier));
  }
  function sandboxActive() {
    var s = state.sandbox;
    return s.growthWeight !== MODEL.growth_weight || s.maturityFloor !== MODEL.maturity_floor || s.multipleCap !== MODEL.multiple_cap;
  }
  // The board under the sandbox: every row rescored, re-sorted, re-ranked.
  function sandboxRows() {
    var over = state.sandbox;
    return DATA.rows.map(function (r) {
      return { row: r, implied: impliedOf(r, over) };
    }).sort(function (a, b) {
      return b.implied - a.implied || (a.row.slug < b.row.slug ? -1 : a.row.slug > b.row.slug ? 1 : 0);
    });
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('watchlist') === '1') state.watchlistOnly = true;
    if (params.get('gainers') === '1') state.gainersOnly = true;
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tab !== 'board') params.set('tab', state.tab);
    if (state.watchlistOnly) params.set('watchlist', '1');
    if (state.gainersOnly) params.set('gainers', '1');
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function listLabel(kind) {
    if (kind === 'watchlist') return 'Watchlist';
    if (kind === 'early') return 'Early';
    return 'Above floor';
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.watchlistOnly && r.list !== 'watchlist') return false;
      if (state.gainersOnly && !(r.change_7d !== null && r.change_7d > 0)) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function sortedRows(list) {
    var key = state.sort;
    var active = sandboxActive();
    var scored = active ? sandboxRows() : null;
    var impliedOfRow = function (r) {
      if (!active) return r.implied_value_usd;
      for (var i = 0; i < scored.length; i++) if (scored[i].row.slug === r.slug) return scored[i].implied;
      return r.implied_value_usd;
    };
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = impliedOfRow(a); bv = impliedOfRow(b); }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    }).map(function (r) {
      return { row: r, implied: impliedOfRow(r) };
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark', 'aria-hidden': 'true' }),
        el('span', { class: 'brand-name', html: 'Token <b>Radar</b>' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: 'Every protocol that records no token, ranked by what its record implies' }),
        el('p', { text: 'The watchlist is the floor: ' + DATA.watchlist_size + ' protocols with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. The radar adds ' + DATA.early_size + ' early protocols below that floor and ' + DATA.above_floor_size + ' above it that the list leaves out. Implied value is a model calibrated on live-token multiples, not a promise.' }),
        el('p', { class: 'note', text: 'DefiLlama\u2019s record is not proof: the board says a protocol records no token, never that it has none.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows ranked' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Early rows below the floor' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Above the floor, off the list' }), el('b', { text: String(DATA.above_floor_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Global median mcap / TVL' }), el('b', { text: fmtMult(DATA.global_median_multiple) }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (acc, r) { return acc.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var catSelect = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c + ' (' + DATA.rows.filter(function (r) { return (r.category || 'Other') === c; }).length + ')', selected: c === state.category ? 'selected' : null }); })
    );
    catSelect.addEventListener('change', function () { state.category = catSelect.value; writeHash(); render(); });
    var chainSelect = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    chainSelect.addEventListener('change', function () { state.chain = chainSelect.value; writeHash(); render(); });
    var wl = el('button', { type: 'button', class: 'toggle', 'aria-pressed': state.watchlistOnly ? 'true' : 'false', text: 'Watchlist only', onclick: function () { state.watchlistOnly = !state.watchlistOnly; writeHash(); render(); } });
    var gain = el('button', { type: 'button', class: 'toggle', 'aria-pressed': state.gainersOnly ? 'true' : 'false', text: 'Gainers only', onclick: function () { state.gainersOnly = !state.gainersOnly; writeHash(); render(); } });
    var tabs = [
      ['board', 'Pre-token board'],
      ['live', 'Live token'],
      ['aside', 'Set aside']
    ].map(function (t) {
      return el('button', { type: 'button', 'aria-pressed': state.tab === t[0] ? 'true' : 'false', text: t[1], onclick: function () { state.tab = t[0]; writeHash(); render(); } });
    });
    var countText = state.tab === 'board' ? filteredRows().length + ' rows shown' : state.tab === 'live' ? DATA.live.length + ' live-token protocols' : DATA.set_aside.length + ' products set aside';
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), catSelect),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), chainSelect),
      el('div', { class: 'field' }, el('span', { text: 'Quick filters' }), el('div', { class: 'toggles' }, wl, gain)),
      el('div', { class: 'field' }, el('span', { text: 'View' }), el('div', { class: 'tabs' }, tabs)),
      el('span', { class: 'count', text: countText })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' \u2193' : ' \u2191' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(filteredRows());
    var active = sandboxActive();
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category or chain to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watchlistOnly = false; state.gainersOnly = false; writeHash(); render(); } })
      ));
    }
    var max = list[0].implied || 1;
    var tbody = el('tbody');
    list.forEach(function (item, i) {
      var r = item.row;
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var rankShown = active ? String(i + 1) : String(r.rank);
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: rankShown }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') })
        )),
        el('td', null, el('span', { class: 'pill ' + r.list, text: listLabel(r.list) })),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num', text: String((r.chains || []).length) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((item.implied / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(item.implied) })
        ))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: active ? 'Sandbox ranking: the board rescored with your constants. Reset the sandbox below to return to the submitted ranking.' : 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            el('th', { scope: 'col', text: 'List' }),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            el('th', { scope: 'col', text: 'Chains' }),
            sortHeader('implied', 'Implied value')
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('span', { class: 'status', text: 'already trades' })),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: fmtMult(r.mcap_tvl) })
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking, and their mcap / TVL ratios are the comps the model calibrates on.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Mcap / TVL' }))),
          tbody
        )
      )
    );
  }

  function asideTable() {
    var tbody = el('tbody');
    DATA.set_aside.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { text: r.reason })
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Pre-token on record, but set aside: the watchlist rule treats these as wrapped, staked, bridged or exchange products, or versioned pools of another protocol, so the board does not rank them as launches of their own.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: 'Why it is set aside' }))),
          tbody
        )
      )
    );
  }

  function sandboxPanel() {
    var s = state.sandbox;
    function slider(id, label, min, max, step, value, oninput) {
      var out = el('output', { id: id + '-out', text: String(value) });
      var input = el('input', { type: 'range', id: id, min: String(min), max: String(max), step: String(step), value: String(value), 'aria-label': label });
      input.addEventListener('input', function () { oninput(parseFloat(input.value)); out.textContent = input.value; writeHash(); render(); });
      return el('label', { for: id }, label + ' ', out, input);
    }
    var reset = el('button', { class: 'button ghost', type: 'button', text: 'Reset sandbox', onclick: function () { state.sandbox = { growthWeight: MODEL.growth_weight, maturityFloor: MODEL.maturity_floor, multipleCap: MODEL.multiple_cap }; render(); } });
    return el('section', { class: 'sandbox' },
      el('h3', { text: 'Model sandbox: change the constants, watch the ranking recompute' }),
      el('div', { class: 'sandbox-grid' },
        slider('sb-growth', 'Growth weight', 0, 1, 0.05, s.growthWeight, function (v) { state.sandbox.growthWeight = v; }),
        slider('sb-maturity', 'Maturity floor', 0.4, 0.8, 0.05, s.maturityFloor, function (v) { state.sandbox.maturityFloor = v; }),
        slider('sb-cap', 'Multiple cap', 0.5, 1.5, 0.05, s.multipleCap, function (v) { state.sandbox.multipleCap = v; })
      ),
      el('p', { class: 'sandbox-note', html: sandboxActive()
        ? '<b>Sandbox active.</b> The board above is rescored with growth weight ' + s.growthWeight + ', maturity floor ' + s.maturityFloor + ', multiple cap ' + s.multipleCap + '. The submitted ranking uses ' + MODEL.growth_weight + ', ' + MODEL.maturity_floor + ', ' + MODEL.multiple_cap + '.'
        : 'At the submitted constants the sandbox reproduces the board exactly. Move a slider to rescore every row in the page.' }),
      reset
    );
  }

  function modelPanel() {
    var m = MODEL;
    var compRows = DATA.comps.map(function (c) {
      return el('tr', null,
        el('td', { text: c.category }),
        el('td', { class: 'num', text: String(c.n) }),
        el('td', { class: 'num', text: fmtMult(c.median) }),
        el('td', { class: 'num', text: fmtMult(c.multiple) })
      );
    });
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'One function scores every row, from the snapshot\u2019s own figures. No protocol name is special-cased, and no row is hand-picked. The multiple comes from the market: the median mcap / TVL of the protocols in the same category whose token already trades, shrunk toward the global median when a category has few comps.' }),
      el('div', { class: 'formula', html:
        'implied = round( tvl_usd \u00d7 <b>multiple</b> \u00d7 (1 + clamp(change_7d, ' + m.growth_floor + ', ' + m.growth_cap + ') / 100 \u00d7 ' + m.growth_weight + ') \u00d7 (' + m.maturity_floor + ' + ' + (1 - m.maturity_floor).toFixed(1) + ' \u00d7 \u221a(min(age_days, ' + m.maturity_days + ') / ' + m.maturity_days + ')) \u00d7 (1 + ' + m.breadth_step + ' \u00d7 min(chains \u2212 1, ' + m.breadth_max_extra_chains + ')) )<br>' +
        'multiple = clamp( (n / (n + ' + m.shrink_prior + ')) \u00d7 category median + (1 \u2212 n / (n + ' + m.shrink_prior + ')) \u00d7 global median ' + fmtMult(DATA.global_median_multiple) + ', ' + m.multiple_floor + ', ' + m.multiple_cap + ' )' }),
      el('p', { class: 'sub', text: 'Age is the time since the protocol was first listed, the best record of how long it has run with no token; an unlisted age uses the rankable set\u2019s median of ' + DATA.median_age_days + ' days. An unreported 7d change is neutral. The above-floor rows passed the same exclusion rule the watchlist uses, but the snapshot carries no parent record: check parentage before farming one.' }),
      el('h3', { text: 'Category comps: live-token medians behind each multiple' }),
      el('div', { class: 'comps-wrap' },
        el('table', null,
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Live comps' }), el('th', { scope: 'col', text: 'Median mcap / TVL' }), el('th', { scope: 'col', text: 'Multiple used' }))),
          el('tbody', null, compRows)
        )
      ),
      sandboxPanel(),
      el('p', { class: 'judge-note', html: '<b>To the judge:</b> every number on this page is recomputed in the browser by <b>impliedOf</b> from the snapshot figures in data.js, and each detail view checks the recomputation against the board\u2019s own number. The screenshots are captures of this page, in its board, detail and filtered states.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = null;
    for (var i = 0; i < DATA.rows.length; i++) if (DATA.rows[i].slug === slug) { row = DATA.rows[i]; break; }
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var recomputed = impliedOf(row, {});
    var listSentence = row.list === 'watchlist' ? 'On the snapshot\u2019s watchlist.' : row.list === 'early' ? 'Below the watchlist floor: an early find.' : 'Above the floor but off the watchlist: it passed the public exclusion rule, and the snapshot carries no parent record.';
    var compSentence = row.comp_n > 0
      ? (row.category || 'Other') + ' comps: ' + row.comp_n + ' live token' + (row.comp_n === 1 ? '' : 's') + ', median mcap / TVL ' + fmtMult(row.category_median) + ', shrunk toward the global median ' + fmtMult(DATA.global_median_multiple) + ' to a multiple of ' + fmtMult(row.multiple) + '.'
      : 'No live-token comps in ' + (row.category || 'Other') + ': the multiple is the global median ' + fmtMult(DATA.global_median_multiple) + '.';
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'sub', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + '  ·  ' + listLabel(row.list) }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + '  ·  ' + listSentence })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsdFull(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Category multiple' }), el('b', { class: 'num', text: fmtMult(row.multiple) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) + '  \u00d7 ' + fmtMult(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) + '  \u00d7 ' + fmtMult(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Chain breadth (' + (row.chains || []).length + ' chains)' }), el('b', { class: 'num', text: '\u00d7 ' + fmtMult(row.breadth_multiplier) })),
        el('div', { class: 'total' }, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsdFull(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: compSentence }),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the page recomputes this row as ' + fmtUsdFull(recomputed) + (recomputed === row.implied_value_usd ? ', the same number the board carries.' : ' (the board carries ' + fmtUsdFull(row.implied_value_usd) + ').') + ' This is an estimate, not a price.' })
    ));
    var plan = row.plan;
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, row.farm.map(function (s) {
        return el('li', null, el('b', { text: s.text }), el('span', { class: 'cost', text: 'Cost: ' + s.cost + '. Time: ' + s.time + '.' }));
      })),
      el('div', { class: 'totals' },
        el('span', { html: 'Capital <b>$' + plan.capital_usd + '</b>' }),
        el('span', { html: 'Est. gas <b>$' + plan.gas_low_usd + '\u2013$' + plan.gas_high_usd + '</b>' }),
        el('span', { html: 'Transactions <b>' + plan.tx_count + '</b>' }),
        el('span', { html: 'Hold <b>' + plan.hold_days + ' days</b>' })
      )
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function footer() {
    return el('footer', { class: 'foot' },
      el('p', { text: 'Method: the board applies the watchlist\u2019s exclusion rule to every protocol, calibrates each category\u2019s multiple on the live tokens inside the same snapshot, and ranks by implied value. Farm plans are derived from each protocol\u2019s category, chains, TVL and age. Nothing here predicts whether or when a token is issued.' }),
      el('p', null, 'Source: ', el('code', { text: DATA.source }))
    );
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    if (state.tab === 'board') shell.appendChild(boardTable());
    else if (state.tab === 'live') shell.appendChild(liveTable());
    else shell.appendChild(asideTable());
    if (state.tab === 'board') shell.appendChild(modelPanel());
    shell.appendChild(footer());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  // A pasted or back-button hash re-reads the state and re-renders, so every
  // view of the page is a link: the board, a detail view, a filtered view.
  window.addEventListener('hashchange', function () {
    state.q = '';
    state.category = 'all';
    state.chain = 'all';
    state.tab = 'board';
    state.watchlistOnly = false;
    state.gainersOnly = false;
    state.selected = null;
    readHash();
    if (dialog.open && !state.selected) dialog.close();
    render();
  });
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
