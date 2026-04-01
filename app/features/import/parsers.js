/**
 * Bank statement parsers — auto-detect format and normalize to common shape
 *
 * Common output shape per row:
 *   { date, postDate, description, amount, balance, category, type, memo }
 *   amount: negative = outflow (purchase/debit), positive = inflow (deposit/credit)
 *
 * Common holdings shape (brokerage):
 *   { symbol, name, assetType, shares, price, costBasis, marketValue }
 */

const { parse: parseCsv } = require('csv-parse/sync');

// ── Helpers ────────────────────────────────────────────────────

function parseDate(s) {
  if (!s) return null;
  s = s.trim();
  // MM/DD/YYYY
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
  // YYYY-MM-DD
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return s;
  // MM/DD/YY
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (m) {
    const yr = parseInt(m[3]) > 50 ? '19'+m[3] : '20'+m[3];
    return `${yr}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
  }
  return null;
}

function parseAmount(s) {
  if (s === null || s === undefined || s === '') return null;
  s = String(s).trim().replace(/[$,\s]/g, '');
  if (s === '' || s === '-' || s === '--') return null;
  return parseFloat(s);
}

function csvRows(text, skipRows = 0) {
  const lines = text.split('\n');
  const data  = lines.slice(skipRows).join('\n');
  try {
    return parseCsv(data, {
      columns: true, skip_empty_lines: true,
      trim: true, relax_column_count: true,
      relax_quotes: true, skip_records_with_empty_values: false
    });
  } catch { return []; }
}

function lastFour(s) {
  if (!s) return null;
  const digits = s.replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : null;
}

function detectStatementDate(rows, dateField) {
  // Use the latest date in the file as the statement date
  let latest = null;
  for (const r of rows) {
    const d = parseDate(r[dateField]);
    if (d && (!latest || d > latest)) latest = d;
  }
  return latest;
}

// ── Format Detection ───────────────────────────────────────────

function detectFormat(headers, rawText) {
  const h = headers.map(s => s.toLowerCase().trim());
  const joined = h.join('|');
  const raw = rawText.toLowerCase();

  if (joined.includes('transaction date') && joined.includes('post date') && joined.includes('memo'))
    return 'chase';
  if (joined.includes('transaction date') && joined.includes('transaction amount') && joined.includes('transaction type') && joined.includes('transaction description'))
    return 'navyfed';
  if (raw.includes('schwab bank') ||
      (joined.includes('type') && joined.includes('withdrawal') && joined.includes('deposit') && joined.includes('runningbalance')) ||
      (joined.includes('checknumber') && joined.includes('withdrawal') && joined.includes('deposit')))
    return 'schwab_checking';
  if (raw.includes('transactions for account') || (joined.includes('action') && joined.includes('symbol') && joined.includes('fees & comm')))
    return 'schwab_brokerage';
  if (raw.includes('positions for account') || (joined.includes('symbol') && joined.includes('qty') && joined.includes('mkt val')))
    return 'schwab_positions';
  if (joined.includes('trade date') && joined.includes('settlement date') && joined.includes('net amount') && joined.includes('investment name'))
    return 'vanguard_brokerage';
  if (raw.includes('thrift savings') || (joined.includes('fund') && joined.includes('share price') && joined.includes('shares/unit')))
    return 'tsp';
  if (joined.includes('date') && joined.includes('description') && joined.includes('amount') && joined.includes('running bal'))
    return 'bofa';
  // Capital One: Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit
  if (joined.includes('transaction date') && joined.includes('posted date') && joined.includes('card no'))
    return 'capital_one';
  // USAA: Date, Description, Original Description, Category, Amount, Status
  if (joined.includes('original description') && joined.includes('status') && joined.includes('amount'))
    return 'usaa';
  // Wells Fargo: no standard header, or minimal "Date","Amount","*","*","Description"
  if (raw.includes('wells fargo') || (h.length >= 5 && joined.includes('date') && !joined.includes('description') && !joined.includes('post')))
    return 'wells_fargo';
  if (joined.includes('date') && joined.includes('description') && (joined.includes('debit') || joined.includes('credit')))
    return 'generic_split';
  return 'generic';
}

// ── Chase (checking + credit card) ────────────────────────────
// Headers: Transaction Date, Post Date, Description, Category, Type, Amount, Memo

function parseChase(rows) {
  return rows.map(r => {
    const amt = parseAmount(r['Amount'] || r['amount']);
    return {
      date:        parseDate(r['Transaction Date'] || r['transaction date']),
      postDate:    parseDate(r['Post Date'] || r['post date']),
      description: (r['Description'] || r['description'] || '').trim(),
      amount:      amt,            // Chase: negative = debit, positive = credit ✓
      balance:     null,
      category:    r['Category'] || r['category'] || null,
      type:        (r['Type'] || r['type'] || '').toLowerCase(),
      memo:        r['Memo'] || r['memo'] || null,
    };
  }).filter(r => r.date && r.amount !== null);
}

// ── Bank of America ────────────────────────────────────────────
// Headers: Date, Description, Amount, Running Bal.

function parseBofa(rows) {
  return rows.map(r => {
    const amt = parseAmount(r['Amount'] || r['amount']);
    return {
      date:        parseDate(r['Date'] || r['date']),
      postDate:    null,
      description: (r['Description'] || r['description'] || '').trim(),
      amount:      amt,            // BofA: negative = debit ✓
      balance:     parseAmount(r['Running Bal.'] || r['Running Balance'] || null),
      category:    null,
      type:        null,
      memo:        null,
    };
  }).filter(r => r.date && r.amount !== null);
}

// ── Navy Federal ───────────────────────────────────────────────
// Headers: Transaction Date, Transaction Amount, Transaction Type, Transaction Description

function parseNavyFed(rows) {
  return rows.map(r => {
    const amt = parseAmount(r['Transaction Amount'] || r['transaction amount']);
    return {
      date:        parseDate(r['Transaction Date'] || r['transaction date']),
      postDate:    null,
      description: (r['Transaction Description'] || r['transaction description'] || '').trim(),
      amount:      amt,            // NavyFed: negative = debit ✓
      balance:     null,
      category:    null,
      type:        (r['Transaction Type'] || r['transaction type'] || '').toLowerCase(),
      memo:        null,
    };
  }).filter(r => r.date && r.amount !== null);
}


function classifySchawbCheckingType(typeVal, statusVal) {
  const t = typeVal.toLowerCase().trim();
  const s = statusVal.toLowerCase().trim();
  if (t.includes('transfer') || t.includes('journal') || t.includes('wire')) return 'transfer';
  if (t.includes('payment') || t.includes('autopay') || t.includes('bill pay')) return 'payment';
  if (t.includes('fee') || t.includes('charge') || t.includes('service charge')) return 'fee';
  if (t.includes('interest') || t.includes('int ')) return 'interest';
  if (t.includes('dividend') || t.includes('div ')) return 'dividend';
  if (t.includes('deposit') || t.includes('credit') || t.includes('direct dep')) return 'deposit';
  if (t.includes('withdrawal') || t.includes('debit') || t.includes('atm') || t.includes('check')) return 'withdrawal';
  // ACH can be either — classify by amount sign (done later by consumer, default to transaction)
  return 'transaction';
}

// ── Schwab Positions (Holdings Snapshot) ──────────────────────
// Format: TSV export from Schwab "Positions" tab
// Row 0: "Positions for account X as of DATE"
// Row 1: blank
// Row 2+: Symbol, Description, Qty (Quantity), Price, Cost/Share, Cost Basis,
//          Price Chng $, Mkt Val (Market Value), ..., Asset Type
//
// This is a holdings snapshot — no transactions. Returns positions[] only.

function parseSchwabPositions(text) {
  const lines = text.split(/\r?\n/);

  // Find the header row (contains Symbol and Qty)
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const low = lines[i].toLowerCase();
    if (low.includes('symbol') && (low.includes('qty') || low.includes('quantity'))) {
      headerIdx = i;
      break;
    }
  }
  if (headerIdx < 0) return { transactions: [], positions: [] };

  // Detect separator (TSV or CSV)
  const sep = lines[headerIdx].includes('\t') ? '\t' : ',';
  const headers = lines[headerIdx].split(sep).map(h => h.trim().replace(/^"|"$/g, ''));

  // Column index helpers — match on partial name (handles parenthetical variants)
  const col = (partial) => {
    const idx = headers.findIndex(h => h.toLowerCase().includes(partial.toLowerCase()));
    return idx >= 0 ? idx : -1;
  };

  const iSym   = col('symbol');
  const iDesc  = col('description');
  const iQty   = col('qty');        // "Qty (Quantity)"
  const iPrice = col('price');      // "Price"
  const iCost  = col('cost/share'); // "Cost/Share"
  const iBasis = col('cost basis'); // "Cost Basis"
  const iMktV  = col('mkt val');    // "Mkt Val (Market Value)"
  const iAsset = col('asset type'); // "Asset Type"

  // Parse data rows using csv-parse to handle quoted commas (e.g. "$22,927.02")
  const positions = [];
  try {
    const dataSection = lines.slice(headerIdx).join('\n');
    const dataRows = parseCsv(dataSection, {
      columns: true, skip_empty_lines: true, trim: true,
      relax_column_count: true, relax_quotes: true
    });
    for (const r of dataRows) {
      // parseCsv uses the header row as keys — match by partial name
      const getCell = (partial) => {
        const key = Object.keys(r).find(k => k.toLowerCase().includes(partial.toLowerCase()));
        return key ? (r[key] || '').trim() : '';
      };
      const sym = getCell('symbol');
      if (!sym || sym.toLowerCase() === 'symbol' || sym.toLowerCase() === 'account total') continue;
      if (sym.startsWith('~$') || sym.toLowerCase().includes('cash')) continue;

      const parseNum = (partial) => {
        const v = getCell(partial).replace(/[$,%]/g, '').replace(/,/g, '');
        const n = parseFloat(v);
        return isNaN(n) ? null : n;
      };

      const qty    = parseNum('qty');
      if (!qty) continue;

      const price  = parseNum('price');
      const cost   = parseNum('cost/share');
      const basis  = parseNum('cost basis');
      const mktVal = parseNum('mkt val');
      const asset  = getCell('asset type');
      const desc   = getCell('description');

      positions.push({
        symbol:         sym,
        name:           desc,
        assetType:      classifySchawbAsset(asset),
        shares:         qty,
        price:          price,
        costBasis:      cost,
        totalCostBasis: basis,
        marketValue:    mktVal || (qty && price ? qty * price : null),
      });
    }
  } catch(e) {
    // fallback: return empty positions rather than crashing
    console.error('parseSchwabPositions error:', e.message);
  }

  return { transactions: [], positions };
}

// ── Schwab Checking ────────────────────────────────────────────
// Headers: Date, Type, Check #, Description, Withdrawal (-), Deposit (+), RunningBalance
// Note: file may have a header row "Transactions for account..." to skip

function parseSchawbChecking(rows) {
  return rows.map(r => {
    // Handle all known Schwab checking export variants:
    // Old:    Withdrawal (-), Deposit (+)
    // New:    Withdrawal, Deposit
    // Also:   CheckNumber vs Check #
    const wd  = parseAmount(
      r['Withdrawal (-)'] || r['Withdrawal (- )'] ||
      r['Withdrawal']     || r['withdrawal']       || null
    );
    const dep = parseAmount(
      r['Deposit (+)']    || r['Deposit (+ )']     ||
      r['Deposit']        || r['deposit']           || null
    );

    let amt = null;
    if (dep !== null && dep !== 0) amt = Math.abs(dep);
    else if (wd !== null && wd !== 0) amt = -Math.abs(wd);
    else if (parseAmount(r['Amount'] || null) !== null) amt = parseAmount(r['Amount']);

    const desc = (
      r['Description'] || r['description'] || ''
    ).trim();

    // Include check number in description if present
    const checkNo = r['CheckNumber'] || r['Check #'] || r['Check#'] || '';
    const fullDesc = checkNo ? `${desc} (Check ${checkNo})`.trim() : desc;

    return {
      date:        parseDate(r['Date'] || r['date']),
      postDate:    null,
      description: fullDesc || desc,
      amount:      amt,
      balance:     parseAmount(r['RunningBalance'] || r['Running Balance'] || null),
      category:    null,
      type:        classifySchawbCheckingType(r['Type'] || r['type'] || '', r['Status'] || ''),
      memo:        null,
    };
  }).filter(r => r.date && r.amount !== null);
}

// ── Schwab Brokerage ───────────────────────────────────────────
// File has 2 junk header rows, then "Transactions" section
// Headers: Date, Action, Symbol, Description, Quantity, Price, Fees & Comm, Amount
// May also have a "Positions" section at the bottom

function parseSchawbBrokerage(text) {
  const lines = text.split('\n');

  // Find the transactions header line
  let txnStart = -1, posStart = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^"?Date"?,"?Action"?/i)) txnStart = i;
    if (lines[i].match(/^"?Symbol"?,"?Description"?,"?Quantity"?/i)) posStart = i;
  }

  const txns = [];
  if (txnStart >= 0) {
    const section = lines.slice(txnStart).join('\n');
    let rows;
    try {
      rows = parseCsv(section, { columns:true, skip_empty_lines:true, trim:true, relax_column_count:true, relax_quotes:true });
    } catch { rows = []; }

    for (const r of rows) {
      const d = parseDate(r['Date'] || r['date']);
      if (!d) continue;
      const amt = parseAmount(r['Amount'] || r['amount']);
      if (amt === null) continue;
      txns.push({
        date:        d,
        postDate:    null,
        description: [r['Action'], r['Description'], r['Symbol']].filter(Boolean).join(' — ').trim(),
        amount:      amt,
        balance:     null,
        category:    r['Action'] || null,
        type:        classifySchawbAction(r['Action'] || ''),
        memo:        r['Symbol'] ? `Symbol: ${r['Symbol']}` : null,
        symbol:      r['Symbol'] || null,
        shares:      parseAmount(r['Quantity'] || null),
        price:       parseAmount(r['Price'] || null),
      });
    }
  }

  // Parse positions section
  const positions = [];
  if (posStart >= 0) {
    const section = lines.slice(posStart).join('\n');
    let rows;
    try {
      rows = parseCsv(section, { columns:true, skip_empty_lines:true, trim:true, relax_column_count:true, relax_quotes:true });
    } catch { rows = []; }

    for (const r of rows) {
      const sym = r['Symbol'] || r['symbol'];
      if (!sym || sym.toLowerCase() === 'symbol') continue;
      const shares = parseAmount(r['Quantity'] || r['Shares'] || null);
      const price  = parseAmount(r['Price']    || null);
      const cost   = parseAmount(r['Cost Basis Per Share'] || r['Avg Cost Per Share'] || null);
      const mktVal = parseAmount(r['Market Value'] || null);
      if (!shares) continue;
      positions.push({
        symbol:      sym.trim(),
        name:        (r['Description'] || r['Security Description'] || '').trim(),
        assetType:   classifySchawbAsset(r['Type'] || r['Security Type'] || ''),
        shares, price, costBasis: cost,
        marketValue: mktVal || (shares && price ? shares * price : null),
      });
    }
  }

  return { transactions: txns, positions };
}

function classifySchawbAction(action) {
  const a = action.toLowerCase();
  if (a.includes('buy') || a.includes('reinvest')) return 'transfer';
  if (a.includes('sell')) return 'transfer';
  if (a.includes('dividend') || a.includes('interest')) return 'dividend';
  if (a.includes('transfer') || a.includes('journal') || a.includes('wire')) return 'transfer';
  if (a.includes('fee') || a.includes('charge')) return 'fee';
  return 'transaction';
}

function classifySchawbAsset(type) {
  const t = type.toLowerCase();
  if (t.includes('etf')) return 'etf';
  if (t.includes('mutual') || t.includes('fund')) return 'mutual_fund';
  if (t.includes('equity') || t.includes('stock')) return 'stock';
  return 'stock';
}

// ── Vanguard Brokerage ─────────────────────────────────────────
// Headers: Trade Date, Settlement Date, Transaction Type, Transaction Description,
//          Investment Name, Symbol, Shares, Share Price, Principal Amount,
//          Commission Fees, Net Amount, Accrued Interest, Account Type

function parseVanguard(text) {
  // Vanguard may have account info rows at top — skip until we hit the header
  const lines = text.split('\n');
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/Trade Date/i) && lines[i].match(/Transaction Type/i)) {
      headerIdx = i; break;
    }
  }
  const section = headerIdx >= 0 ? lines.slice(headerIdx).join('\n') : text;
  let rows;
  try {
    rows = parseCsv(section, { columns:true, skip_empty_lines:true, trim:true, relax_column_count:true, relax_quotes:true });
  } catch { rows = []; }

  const txns = [];
  const posMap = {};

  for (const r of rows) {
    const d = parseDate(r['Trade Date'] || r['trade date'] || r['Settlement Date']);
    if (!d) continue;
    const amt = parseAmount(r['Net Amount'] || r['Principal Amount'] || null);
    if (amt === null) continue;

    const sym     = (r['Symbol'] || '').trim();
    const shares  = parseAmount(r['Shares'] || null);
    const price   = parseAmount(r['Share Price'] || null);

    txns.push({
      date:        d,
      postDate:    parseDate(r['Settlement Date'] || null),
      description: (r['Transaction Description'] || r['Investment Name'] || '').trim(),
      amount:      amt,
      balance:     null,
      category:    r['Transaction Type'] || null,
      type:        classifyVanguardTxn(r['Transaction Type'] || ''),
      memo:        sym ? `Symbol: ${sym}` : null,
      symbol:      sym || null,
      shares,
      price,
    });

    // Build positions from buy/sell history (aggregate)
    if (sym && shares) {
      if (!posMap[sym]) posMap[sym] = { symbol:sym, name: r['Investment Name'] || '', shares:0, totalCost:0, price:null };
      const isBuy  = (r['Transaction Type'] || '').toLowerCase().includes('buy') ||
                     (r['Transaction Type'] || '').toLowerCase().includes('purchase') ||
                     (r['Transaction Type'] || '').toLowerCase().includes('reinvest');
      const isSell = (r['Transaction Type'] || '').toLowerCase().includes('sell') ||
                     (r['Transaction Type'] || '').toLowerCase().includes('redemption');
      if (isBuy)  { posMap[sym].shares += shares; posMap[sym].totalCost += Math.abs(amt); }
      if (isSell) { posMap[sym].shares -= shares; }
      posMap[sym].price = price;
    }
  }

  const positions = Object.values(posMap)
    .filter(p => p.shares > 0.0001)
    .map(p => ({
      symbol:      p.symbol,
      name:        p.name,
      assetType:   p.name.toLowerCase().includes('etf') ? 'etf' : 'mutual_fund',
      shares:      p.shares,
      price:       p.price,
      costBasis:   p.shares > 0 ? p.totalCost / p.shares : null,
      marketValue: p.price && p.shares ? p.price * p.shares : null,
    }));

  return { transactions: txns, positions };
}

function classifyVanguardTxn(type) {
  const t = type.toLowerCase();
  if (t.includes('buy') || t.includes('sell') || t.includes('reinvest') || t.includes('redemption') || t.includes('purchase')) return 'transfer';
  if (t.includes('dividend') || t.includes('interest')) return 'dividend';
  if (t.includes('transfer') || t.includes('exchange')) return 'transfer';
  return 'transaction';
}

// ── TSP ────────────────────────────────────────────────────────
// Headers: Date, Transaction Type, Amount, Share Price, Shares/Units
// Fund balance rows: Fund, Balance, Share Price, Shares

function parseTSP(text) {
  const lines = text.split('\n');
  const txns = [];
  const positions = [];

  // Try to find balance/holdings section (fund name + balance rows)
  const fundPattern = /^(G Fund|F Fund|C Fund|S Fund|I Fund|L Income|L 20\d\d)/i;
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^"?Date"?.*"?Transaction/i)) { headerIdx = i; break; }
  }

  if (headerIdx >= 0) {
    const section = lines.slice(headerIdx).join('\n');
    let rows;
    try {
      rows = parseCsv(section, { columns:true, skip_empty_lines:true, trim:true, relax_column_count:true, relax_quotes:true });
    } catch { rows = []; }
    for (const r of rows) {
      const d = parseDate(r['Date'] || r['date']);
      if (!d) continue;
      const amt = parseAmount(r['Amount'] || r['amount']);
      if (amt === null) continue;
      txns.push({
        date: d, postDate: null,
        description: (r['Transaction Type'] || r['Fund'] || 'TSP').trim(),
        amount: amt,
        balance: null,
        category: null,
        type: classifyTSPTxn(r['Transaction Type'] || ''),
        memo: null,
        symbol: r['Fund'] || null,
        shares: parseAmount(r['Shares/Units'] || r['Shares'] || null),
        price:  parseAmount(r['Share Price'] || null),
      });
    }
  }

  // Parse fund holdings rows
  for (const line of lines) {
    const m = line.match(fundPattern);
    if (m) {
      const cols = line.split(',').map(s => s.replace(/"/g,'').trim());
      const fundName = cols[0];
      const balance  = parseAmount(cols[1]);
      const price    = parseAmount(cols[2]);
      const shares   = parseAmount(cols[3]);
      if (balance !== null) {
        positions.push({
          symbol:      fundName,
          name:        tspFundName(fundName),
          assetType:   'tsp_fund',
          shares:      shares || (price && balance ? balance / price : null),
          price,
          costBasis:   null,
          marketValue: balance,
        });
      }
    }
  }

  return { transactions: txns, positions };
}

function tspFundName(sym) {
  const map = {
    'G Fund': 'Government Securities Investment Fund',
    'F Fund': 'Fixed Income Index Investment Fund',
    'C Fund': 'Common Stock Index Investment Fund',
    'S Fund': 'Small Cap Stock Index Investment Fund',
    'I Fund': 'International Stock Index Investment Fund',
    'L Income': 'Lifecycle Income Fund',
  };
  for (const [k,v] of Object.entries(map)) {
    if (sym.toUpperCase().startsWith(k.toUpperCase())) return v;
  }
  return sym;
}

function classifyTSPTxn(type) {
  const t = type.toLowerCase();
  if (t.includes('contribution') || t.includes('match')) return 'deposit';
  if (t.includes('withdrawal')) return 'withdrawal';
  if (t.includes('interfund') || t.includes('transfer')) return 'transfer';
  return 'transaction';
}

// ── Generic split debit/credit ─────────────────────────────────
function parseGenericSplit(rows) {
  return rows.map(r => {
    const keys = Object.keys(r).map(k => k.toLowerCase());
    const getVal = (...names) => {
      for (const n of names) {
        const key = Object.keys(r).find(k => k.toLowerCase() === n);
        if (key && r[key] !== undefined) return r[key];
      }
      return null;
    };
    const debit  = parseAmount(getVal('debit','withdrawal','charge'));
    const credit = parseAmount(getVal('credit','deposit','payment'));
    let amt = null;
    if (credit !== null && credit !== 0) amt = Math.abs(credit);
    else if (debit !== null && debit !== 0) amt = -Math.abs(debit);
    return {
      date:        parseDate(getVal('date','transaction date','posted date')),
      postDate:    parseDate(getVal('post date','posted date','settlement date')),
      description: (getVal('description','memo','payee','transaction description') || '').trim(),
      amount:      amt,
      balance:     parseAmount(getVal('balance','running balance','running bal')),
      category:    getVal('category') || null,
      type:        null,
      memo:        null,
    };
  }).filter(r => r.date && r.amount !== null);
}

// ── Generic single amount ──────────────────────────────────────
function parseGeneric(rows) {
  return rows.map(r => {
    const keys = Object.keys(r);
    const getVal = (...names) => {
      for (const n of names) {
        const key = keys.find(k => k.toLowerCase() === n.toLowerCase());
        if (key) return r[key];
      }
      return null;
    };
    return {
      date:        parseDate(getVal('date','transaction date','Date','Transaction Date')),
      postDate:    null,
      description: (getVal('description','Description','memo','Memo','payee','Payee') || '').trim(),
      amount:      parseAmount(getVal('amount','Amount','net amount','Net Amount')),
      balance:     parseAmount(getVal('balance','Balance','running balance') || null),
      category:    getVal('category','Category') || null,
      type:        null,
      memo:        null,
    };
  }).filter(r => r.date && r.amount !== null);
}

// ── Citi / Discover (credit cards) ────────────────────────────
// Citi: Date, Description, Debit, Credit
// Discover: Trans. Date, Post Date, Description, Amount, Category

function parseCiti(rows) {
  return rows.map(r => {
    const debit  = parseAmount(r['Debit'] || r['debit'] || null);
    const credit = parseAmount(r['Credit'] || r['credit'] || null);
    let amt = null;
    if (debit  !== null && debit  !== 0) amt = -Math.abs(debit);
    if (credit !== null && credit !== 0) amt = Math.abs(credit);
    return {
      date:        parseDate(r['Date'] || r['date']),
      postDate:    null,
      description: (r['Description'] || r['description'] || '').trim(),
      amount:      amt,
      balance:     null,
      category:    null,
      type:        null,
      memo:        null,
    };
  }).filter(r => r.date && r.amount !== null);
}

function parseDiscover(rows) {
  return rows.map(r => {
    const amt = parseAmount(r['Amount'] || r['amount'] || null);
    // Discover: positive = charge, we flip to negative for consistency
    return {
      date:        parseDate(r['Trans. Date'] || r['Trans Date'] || r['date']),
      postDate:    parseDate(r['Post Date'] || r['post date'] || null),
      description: (r['Description'] || r['description'] || '').trim(),
      amount:      amt !== null ? -amt : null,
      balance:     null,
      category:    r['Category'] || r['category'] || null,
      type:        null,
      memo:        null,
    };
  }).filter(r => r.date && r.amount !== null);
}

// ── Wells Fargo (checking / savings / credit card) ─────────────
// Headers: Date, Amount, *, *, Description
// No header row in some exports — positional CSV

function parseWellsFargo(rows) {
  return rows.map(r => {
    // WF CSV: "MM/DD/YYYY","amount","","","description"
    const keys = Object.keys(r);
    const date = parseDate(r[keys[0]] || r['Date'] || r['date']);
    const rawAmt = r[keys[1]] !== undefined ? r[keys[1]] : (r['Amount'] || r['amount']);
    const amt = parseAmount(rawAmt);
    const desc = (r[keys[4]] || r['Description'] || r['description'] || r[keys[2]] || '').trim();
    return { date, description: desc, amount: amt, balance: null, postDate: null, category: null, type: null, memo: null };
  }).filter(r => r.date && r.amount !== null);
}

// ── Capital One ───────────────────────────────────────────────
// Headers: Transaction Date, Posted Date, Card No., Description, Category, Debit, Credit

function parseCapitalOne(rows) {
  return rows.map(r => {
    const debit  = parseAmount(r['Debit']  || r['debit']  || null);
    const credit = parseAmount(r['Credit'] || r['credit'] || null);
    let amt = null;
    if (debit  != null && debit  !== 0) amt = -Math.abs(debit);
    if (credit != null && credit !== 0) amt = Math.abs(credit);
    return {
      date:        parseDate(r['Transaction Date'] || r['transaction date']),
      postDate:    parseDate(r['Posted Date'] || r['posted date'] || null),
      description: (r['Description'] || r['description'] || '').trim(),
      amount:      amt,
      balance:     null,
      category:    r['Category'] || r['category'] || null,
      type:        null,
      memo:        null,
    };
  }).filter(r => r.date && r.amount !== null);
}

// ── USAA (checking / savings) ─────────────────────────────────
// Headers: Date, Description, Original Description, Category, Amount, Status

function parseUSAA(rows) {
  return rows.map(r => {
    const amt = parseAmount(r['Amount'] || r['amount'] || null);
    return {
      date:        parseDate(r['Date'] || r['date']),
      description: (r['Description'] || r['description'] || r['Original Description'] || '').trim(),
      amount:      amt,
      balance:     null,
      postDate:    null,
      category:    r['Category'] || r['category'] || null,
      type:        null,
      memo:        null,
    };
  }).filter(r => r.date && r.amount !== null);
}

// ── Main export ────────────────────────────────────────────────

/**
 * Parse a file buffer/string
 * Returns: { format, transactions, positions, statementDate, lastFour, error }
 */
function parseFile(content, filename) {
  const ext = (filename || '').toLowerCase().split('.').pop();
  let text = content;

  // Excel handled separately upstream (converted to CSV before calling this)
  if (typeof content !== 'string') {
    return { format: 'unknown', transactions: [], positions: [], error: 'Expected string content' };
  }

  // Detect format from first few lines
  const firstLines = text.split('\n').slice(0, 5).join('\n').toLowerCase();
  const isSchawbBrokerage = firstLines.includes('transactions for account') ||
    text.split('\n').some((l,i) => i < 5 && l.match(/^"?Date"?,"?Action"?,"?Symbol"?/i));
  const isVanguard = text.split('\n').some((l,i) => i < 20 && l.match(/Trade Date.*Transaction Type/i));
  const isTSP = firstLines.includes('thrift savings') || firstLines.includes('tsp') ||
    text.split('\n').some(l => l.match(/G Fund|C Fund|S Fund|F Fund|I Fund/));

  if (isSchawbBrokerage) {
    const result = parseSchawbBrokerage(text);
    return {
      format: 'schwab_brokerage',
      transactions: result.transactions,
      positions: result.positions,
      statementDate: detectStatementDate(result.transactions, 'date'),
    };
  }

  if (isVanguard) {
    const result = parseVanguard(text);
    return {
      format: 'vanguard_brokerage',
      transactions: result.transactions,
      positions: result.positions,
      statementDate: detectStatementDate(result.transactions, 'date'),
    };
  }

  if (isTSP) {
    const result = parseTSP(text);
    return {
      format: 'tsp',
      transactions: result.transactions,
      positions: result.positions,
      statementDate: detectStatementDate(result.transactions, 'date'),
    };
  }

  // CSV with headers — detect format from column names
  let rows = [];
  let skipRows = 0;
  // Some banks have junk rows before headers — find the header row
  const lines = text.split('\n');
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    if (lines[i].match(/date|description|amount|transaction/i)) {
      skipRows = i; break;
    }
  }
  rows = csvRows(text, skipRows);
  if (!rows.length) return { format:'unknown', transactions:[], positions:[], error:'No parseable rows' };

  const headers = Object.keys(rows[0]);
  const format  = detectFormat(headers, text);

  let transactions = [];
  let positions = [];
  switch(format) {
    case 'chase':          transactions = parseChase(rows);       break;
    case 'bofa':           transactions = parseBofa(rows);        break;
    case 'navyfed':        transactions = parseNavyFed(rows);     break;
    case 'schwab_checking':transactions = parseSchawbChecking(rows); break;
    case 'schwab_positions': {
      const posResult = parseSchwabPositions(text);
      transactions = posResult.transactions;
      positions    = posResult.positions;
      break;
    }
    case 'capital_one':    transactions = parseCapitalOne(rows);  break;
    case 'usaa':           transactions = parseUSAA(rows);        break;
    case 'wells_fargo':    transactions = parseWellsFargo(rows);  break;
    case 'generic_split':
      if (headers.some(h => h.toLowerCase().includes('debit') && headers.some(h2 => h2.toLowerCase().includes('credit'))))
        transactions = parseCiti(rows);
      else
        transactions = parseGenericSplit(rows);
      break;
    default:
      // Check for Discover
      if (headers.some(h => h.toLowerCase().includes('trans. date') || h.toLowerCase().includes('trans date')))
        transactions = parseDiscover(rows);
      else
        transactions = parseGeneric(rows);
  }

  return {
    format,
    transactions,
    positions,
    statementDate: detectStatementDate(transactions, 'date'),
    lastFour: null,
  };
}

module.exports = { parseFile, parseDate, parseAmount, lastFour };
