/**
 * lt-messages.js — Shared UI messages, empty states, and module constants
 *
 * Usage in any page:
 *   el.innerHTML = emptyState(...GH_EMPTY.accounts);
 *   el.innerHTML = emptyState(...GH_EMPTY.custom('📦', 'No items', 'Add one to get started'));
 *
 * GH_EMPTY entries: [icon, title, subtitle, actionHtml]
 * actionHtml is optional — pass '' if no action needed.
 */

/**
 * emptyState — renders a centred empty-state card.
 * Usage: el.innerHTML = emptyState(...GH_EMPTY.books);
 *        el.innerHTML = emptyState('📦', 'Nothing here', 'Add one to get started', '');
 */
window.emptyState = function(icon, title, subtitle = '', actionHtml = '') {
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;text-align:center;color:var(--text3)">
    <div style="font-size:40px;margin-bottom:12px">${icon}</div>
    <div style="font-size:16px;font-weight:600;color:var(--text2);margin-bottom:6px">${title}</div>
    ${subtitle ? `<div style="font-size:13px;max-width:300px;margin-bottom:${actionHtml ? '20px' : '0'}">${subtitle}</div>` : ''}
    ${actionHtml || ''}
  </div>`;
};

/**
 * errorState — renders an error card with optional retry.
 * Usage: el.innerHTML = errorState('Failed to load', 'loadBooks()');
 *        el.innerHTML = errorState(e.message, '');
 */
window.errorState = function(message = 'Something went wrong', retryFn = '') {
  const retryBtn = retryFn
    ? `<button class="btn" style="margin-top:12px;font-size:13px" onclick="${retryFn}">↺ Retry</button>`
    : '';
  return `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px 24px;text-align:center;color:var(--text3)">
    <div style="font-size:32px;margin-bottom:12px">⚠️</div>
    <div style="font-size:14px;color:var(--red);font-weight:500;margin-bottom:4px">Failed to load</div>
    <div style="font-size:12px;max-width:320px;word-break:break-word">${message}</div>
    ${retryBtn}
  </div>`;
};

window.GH_EMPTY = {

  // ── Helper: one-off custom empty state ──────────────────────
  custom: (icon, title, sub='', action='') => [icon, title, sub, action],

  // ── Finance ─────────────────────────────────────────────────
  accounts: [
    '🏦', 'No accounts yet',
    'Add your first account to track balances and net worth.',
    '<button class="btn btn-primary" style="font-size:13px;padding:7px 18px" onclick="openAccountDrawer()">+ Add Account</button>'
  ],
  transactions: [
    '💳', 'No transactions yet',
    'Import a bank statement or add a transaction manually.',
    '<button class="btn btn-primary" style="font-size:13px;padding:7px 18px" onclick="openTxDrawer()">+ Add Transaction</button>'
  ],
  giftCards: [
    '🎁', 'No gift cards yet',
    'Track your gift card balances so you never let one expire.',
    '<button class="btn btn-primary" style="font-size:13px;padding:7px 18px" onclick="openGcDrawer()">+ Add Gift Card</button>'
  ],
  holdings: [
    '📈', 'No holdings yet',
    'Import a brokerage statement to see your portfolio here.',
    ''
  ],
  netWorth: [
    '💰', 'No net worth data yet',
    'Add accounts and import statements to calculate your net worth.',
    ''
  ],
  budgets: [
    '📊', 'No budgets set',
    'Create a budget to track your spending by category.',
    '<button class="btn btn-primary" style="font-size:13px;padding:7px 18px" onclick="openBudgetDrawer()">+ Add Budget</button>'
  ],

  // ── HSA ─────────────────────────────────────────────────────
  hsaExpenses: [
    '🏥', 'No expenses yet',
    'Add medical expenses to track what you can reimburse from your HSA.',
    ''
  ],
  hsaOtc: [
    '💊', 'No OTC items yet',
    'Track over-the-counter purchases eligible for HSA reimbursement.',
    ''
  ],
  hsaPlan: [
    '📋', 'No plan info yet',
    'Add your health plan details to track deductibles and out-of-pocket limits.',
    ''
  ],

  // ── Inventory ───────────────────────────────────────────────
  locations: [
    '🏠', 'No locations yet',
    'Add a home, room, or storage area to start organizing your inventory.',
    '<button class="btn btn-primary" style="font-size:13px;padding:7px 18px" onclick="openLocationDrawer()">+ Add Location</button>'
  ],
  containers: [
    '📦', 'Nothing here yet',
    'Add containers or items to this location.',
    ''
  ],
  items: [
    '🔍', 'No items found',
    'Try a different filter or add a new item.',
    ''
  ],
  unassigned: [
    '📦', 'No unassigned items',
    'All items are organized into locations.',
    ''
  ],

  // ── Medical ─────────────────────────────────────────────────
  medications: [
    '💊', 'No medications yet',
    'Track your current and past medications here.',
    ''
  ],
  conditions: [
    '🏥', 'No conditions recorded',
    'Add health conditions to keep your medical history organized.',
    ''
  ],
  visits: [
    '📅', 'No visits recorded',
    'Log doctor visits, appointments, and procedures.',
    ''
  ],
  physicians: [
    '👨‍⚕️', 'No doctors added',
    'Add your physicians and specialists for easy reference.',
    ''
  ],

  // ── Todos ───────────────────────────────────────────────────
  todos: [
    '🎉', 'All clear',
    'No open to-dos. Tap + to add one.',
    ''
  ],
  todosEmpty: [
    '✅', 'Nothing completed yet',
    'Completed items from the last 7 days will appear here.',
    ''
  ],

  // ── Daily Log ───────────────────────────────────────────────
  logEntries: [
    '📋', 'No entries yet',
    'Tap + to add your first log entry.',
    ''
  ],

  // ── Career ──────────────────────────────────────────────────
  certs: [
    '🎓', 'No certifications yet',
    'Track your certifications, licenses, and their expiry dates.',
    ''
  ],
  jobs: [
    '💼', 'No work history yet',
    'Add your employment history here.',
    ''
  ],
  skills: [
    '⚡', 'No skills added yet',
    'Track your technical and professional skills.',
    ''
  ],
  education: [
    '🎓', 'No education records',
    'Add your degrees, courses, and training.',
    ''
  ],
  goals: [
    '🎯', 'No goals yet',
    'Tap + to set your first career goal.',
    ''
  ],

  // ── Property ────────────────────────────────────────────────
  properties: [
    '🏠', 'No properties yet',
    'Add your home, rental, or other real estate.',
    ''
  ],
  vehicles: [
    '🚗', 'No vehicles yet',
    'Track your vehicles, registration, and service history.',
    ''
  ],
  maintenance: [
    '🔧', 'No maintenance records',
    'Log repairs and maintenance to track costs over time.',
    ''
  ],

  // ── Documents ───────────────────────────────────────────────
  documents: [
    '📄', 'No documents yet',
    'Store important documents like tax records, insurance, and warranties.',
    ''
  ],

  // ── Books ───────────────────────────────────────────────────
  books: [
    '📚', 'No books here',
    'Add books to your reading list.',
    ''
  ],

  // ── Resources ───────────────────────────────────────────────
  resources: [
    '🔗', 'No resources yet',
    'Save useful websites, files, and references.',
    '<button class="btn btn-primary" style="font-size:13px;padding:7px 18px" onclick="openResourceDrawer()">+ Add Resource</button>'
  ],

  // ── Kids ────────────────────────────────────────────────────
  kids: [
    '👦', 'No children added yet',
    'Tap + to add a child profile.',
    ''
  ],
  activities: [
    '🏅', 'No activities yet',
    'Track sports, music, and other activities.',
    ''
  ],
  notes: [
    '📝', 'No notes yet',
    'Add medical, school, or milestone notes.',
    ''
  ],

  // ── Settings ────────────────────────────────────────────────
  family: [
    '👨‍👩‍👧‍👦', 'No family members yet',
    'Add family members to associate data with each person.',
    ''
  ],
  contacts: [
    '📇', 'No contacts yet',
    'Add doctors, vendors, and other contacts.',
    ''
  ],
  tags: [
    '🏷️', 'No tags yet',
    'Tags are created automatically when you use them.',
    ''
  ],
};
