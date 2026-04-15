/**
 * public/js/quick-capture.js
 * Global quick capture modal — accessible everywhere via FAB or Cmd+Shift+N.
 * Saves to Daily Log /quick endpoint.
 */
(function() {
  'use strict';

  const CATS = ['General','Follow-up','Idea','Task','Note','Medical','Finance','Home'];
  let _modal = null, _textarea = null;

  function build() {
    if (_modal) return;
    const savedCat = localStorage.getItem('gh_qc_category') || 'General';
    _modal = document.createElement('div');
    _modal.style.cssText = 'position:fixed;inset:0;z-index:9998;background:rgba(0,0,0,.55);display:none;align-items:flex-end;justify-content:center';
    _modal.innerHTML = `
      <div style="width:min(520px,100%);background:var(--bg2);border-radius:var(--r-xl) var(--r-xl) 0 0;padding:20px;padding-bottom:max(20px,env(safe-area-inset-bottom));box-shadow:0 -8px 32px rgba(0,0,0,.2)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
          <span style="font-size:16px;font-weight:700;color:var(--text)">✏️ Quick Capture</span>
          <button onclick="window.GH_QuickCapture.close()" style="background:none;border:none;color:var(--text3);font-size:20px;cursor:pointer;padding:0;line-height:1">✕</button>
        </div>
        <textarea id="ghQcText" placeholder="What's on your mind?" style="width:100%;min-height:80px;max-height:200px;resize:vertical;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:10px;font-size:15px;color:var(--text);font-family:var(--sans);outline:none;box-sizing:border-box" rows="3"></textarea>
        <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap" id="ghQcCats">
          ${CATS.map(cat => `<button class="filter-chip ${cat===savedCat?'active':''}" onclick="selectCat(this,'${cat}')" style="font-size:12px;padding:3px 10px">${cat}</button>`).join('')}
        </div>
        <div style="display:flex;gap:8px;margin-top:14px;align-items:center">
          <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text2);cursor:pointer">
            <input type="checkbox" id="ghQcFollowUp" style="accent-color:var(--accent)"> Follow-up
          </label>
          <input type="date" id="ghQcDate" style="display:none;background:var(--bg3);border:1px solid var(--border);border-radius:var(--r);padding:4px 8px;font-size:13px;color:var(--text)">
          <button id="ghQcSave" onclick="saveQC()" style="margin-left:auto;padding:10px 20px;background:var(--accent);border:none;border-radius:var(--r);color:#fff;font-weight:700;font-size:14px;cursor:pointer">Save ↵</button>
        </div>
      </div>`;
    _modal.addEventListener('mousedown', e => { if (e.target === _modal) close(); });
    document.body.appendChild(_modal);
    _textarea = document.getElementById('ghQcText');

    document.getElementById('ghQcFollowUp').addEventListener('change', function() {
      document.getElementById('ghQcDate').style.display = this.checked ? 'block' : 'none';
    });
    _textarea.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); saveQC(); }
      if (e.key === 'Escape') close();
    });
  }

  window.selectCat = function(btn, cat) {
    document.querySelectorAll('#ghQcCats .filter-chip').forEach(b => b.classList.toggle('active', b === btn));
    localStorage.setItem('gh_qc_category', cat);
  };

  async function saveQC() {
    const content = _textarea?.value.trim();
    if (!content) { _textarea?.focus(); return; }
    const cat = localStorage.getItem('gh_qc_category') || 'General';
    const followUp = document.getElementById('ghQcFollowUp')?.checked || false;
    const followDate = document.getElementById('ghQcDate')?.value || null;
    const btn = document.getElementById('ghQcSave');
    if (btn) { btn.textContent = 'Saving…'; btn.disabled = true; }
    try {
      await window.api('POST', '/daily-log/quick', { content, category: cat, follow_up_needed: followUp, follow_up_date: followDate });
      window.toast?.('Captured!', 'ok');
      close();
    } catch(e) {
      window.toast?.(e.message, 'err');
      if (btn) { btn.textContent = 'Save ↵'; btn.disabled = false; }
    }
  }

  function open() {
    build();
    _modal.style.display = 'flex';
    setTimeout(() => { _textarea?.focus(); _textarea && (_textarea.value = ''); }, 100);
  }
  function close() {
    if (_modal) _modal.style.display = 'none';
  }

  // Keyboard shortcut Cmd+Shift+N
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') { e.preventDefault(); open(); }
  });

  window.GH_QuickCapture = { open, close };
})();
