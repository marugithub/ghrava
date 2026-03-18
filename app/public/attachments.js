/**
 * attachments.js — Shared attachment UI component
 * Include on any page that needs attachment support:
 *   <script src="/attachments.js"></script>
 *
 * Provides:
 *   AttachmentManager.open(entityType, entityId, recordTitle)  — open drawer
 *   AttachmentManager.badge(entityType, entityId)              — returns badge HTML promise
 *   AttachmentManager.injectStyles()                           — call once on page load
 *
 * Requires: authToken global, shared.css loaded
 */

const AttachmentManager = (() => {
  'use strict';

  const API = '/api/v1/attachments';
  let _token = () => window.authToken || localStorage.getItem('lt_token') || '';

  // ── Inject drawer HTML + styles into document once ───────────
  function injectStyles() {
    if (document.getElementById('att-styles')) return;
    const style = document.createElement('style');
    style.id = 'att-styles';
    style.textContent = `
/* ── Attachment badge ─────────────────────────────────────── */
.att-badge {
  display: inline-flex; align-items: center; gap: 3px;
  font-family: var(--mono); font-size: 10px; font-weight: 600;
  color: var(--text3); cursor: pointer;
  padding: 2px 6px; border-radius: 4px;
  background: var(--bg4); border: 1px solid var(--border);
  transition: all .15s; white-space: nowrap;
}
.att-badge:hover { border-color: var(--border2); color: var(--text2); }
.att-badge.has-files { color: var(--accent); border-color: var(--accent-bd); background: var(--accent-bg); }
.att-badge svg { width: 12px; height: 12px; flex-shrink: 0; }

/* ── Attachment drawer ────────────────────────────────────── */
#attDrawer .att-drop-zone {
  border: 2px dashed var(--border2); border-radius: var(--r-lg);
  padding: 28px 20px; text-align: center;
  cursor: pointer; transition: all .2s;
  margin-bottom: 16px;
}
#attDrawer .att-drop-zone:hover,
#attDrawer .att-drop-zone.drag-over {
  border-color: var(--accent); background: var(--accent-bg);
}
#attDrawer .att-drop-zone-icon { font-size: 32px; margin-bottom: 8px; }
#attDrawer .att-drop-zone-label { font-size: 14px; font-weight: 600; color: var(--text2); }
#attDrawer .att-drop-zone-sub { font-size: 12px; color: var(--text3); margin-top: 4px; }

/* ── Attachment grid ─────────────────────────────────────── */
.att-grid {
  display: grid; grid-template-columns: repeat(3, 1fr);
  gap: 8px; margin-bottom: 12px;
}
.att-thumb {
  aspect-ratio: 1; border-radius: var(--r); overflow: hidden;
  border: 1px solid var(--border); position: relative;
  cursor: pointer; background: var(--bg3);
  display: flex; align-items: center; justify-content: center;
  transition: border-color .15s;
}
.att-thumb:hover { border-color: var(--border2); }
.att-thumb.primary-photo { border-color: var(--green); border-width: 2px; }
.att-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.att-thumb-icon { font-size: 28px; }
.att-thumb-del {
  position: absolute; top: 4px; right: 4px;
  width: 20px; height: 20px; border-radius: 50%;
  background: rgba(0,0,0,.7); color: #fff;
  font-size: 12px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; border: none; transition: background .15s;
  line-height: 1;
}
.att-thumb-del:hover { background: var(--red); }
.att-thumb-primary-btn {
  position: absolute; bottom: 4px; left: 4px;
  font-size: 9px; font-family: var(--mono); font-weight: 600;
  background: rgba(0,0,0,.7); color: #fff;
  padding: 1px 5px; border-radius: 3px; cursor: pointer;
  border: none; white-space: nowrap;
}
.att-thumb-primary-btn.is-primary { background: var(--green); }

/* ── Attachment file rows (non-images) ───────────────────── */
.att-file-row {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 0; border-bottom: 1px solid var(--border);
}
.att-file-row:last-child { border-bottom: none; }
.att-file-icon { font-size: 24px; flex-shrink: 0; }
.att-file-body { flex: 1; min-width: 0; }
.att-file-name {
  font-size: 13px; font-weight: 600; color: var(--text);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.att-file-meta { font-size: 11px; color: var(--text3); margin-top: 2px; }
.att-file-unc {
  font-size: 10px; font-family: var(--mono);
  color: var(--text3); margin-top: 2px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.att-file-link { color: var(--accent); text-decoration: none; }
.att-file-link:hover { text-decoration: underline; }
.att-mobile-note {
  font-size: 11px; color: var(--amber); margin-top: 4px;
  display: none;
}

/* ── Label input row ─────────────────────────────────────── */
.att-label-row {
  display: flex; gap: 8px; margin-bottom: 12px;
}
.att-label-row .form-input { flex: 1; font-size: 13px; padding: 8px 10px; }

/* ── Fullscreen image viewer ─────────────────────────────── */
#attViewer {
  position: fixed; inset: 0; z-index: 900;
  background: rgba(0,0,0,.92);
  display: none; align-items: center; justify-content: center;
  flex-direction: column;
}
#attViewer.open { display: flex; }
#attViewer img { max-width: 96vw; max-height: 86vh; object-fit: contain; border-radius: var(--r); }
#attViewerClose {
  position: absolute; top: 16px; right: 16px;
  background: rgba(255,255,255,.15); border: none; color: #fff;
  font-size: 22px; width: 40px; height: 40px; border-radius: 50%;
  cursor: pointer; display: flex; align-items: center; justify-content: center;
}
#attViewerCaption {
  color: rgba(255,255,255,.6); font-size: 12px;
  font-family: var(--mono); margin-top: 12px;
}
    `;
    document.head.appendChild(style);

    // Inject drawer HTML
    if (!document.getElementById('attDrawer')) {
      document.body.insertAdjacentHTML('beforeend', `
<div class="drawer-overlay" id="attDrawer">
  <div class="drawer">
    <div class="drawer-handle" id="attDrawerHandle"></div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div class="drawer-title" style="margin-bottom:0" id="attDrawerTitle">Attachments</div>
      <div style="display:flex;align-items:center;gap:10px">
        <span id="attDrawerCount" style="font-family:var(--mono);font-size:12px;color:var(--text3)"></span>
        <button id="attCloseBtn" style="background:none;border:none;color:var(--text3);font-size:22px;cursor:pointer;line-height:1;padding:0 2px" aria-label="Close">×</button>
      </div>
    </div>

    <!-- Drop zone / upload trigger -->
    <div class="att-drop-zone" id="attDropZone">
      <div class="att-drop-zone-icon">📎</div>
      <div class="att-drop-zone-label">Click to attach files</div>
      <div class="att-drop-zone-sub">Photos, PDFs, documents — up to 50 MB each</div>
    </div>
    <input type="file" id="attFileInput" multiple style="display:none">

    <!-- Label for upload -->
    <div class="att-label-row">
      <input class="form-input" id="attLabelInput" placeholder='Label (e.g. "Receipt", "Manual") — optional'>
    </div>

    <!-- Upload progress -->
    <div id="attUploadProgress" style="display:none;margin-bottom:12px">
      <div style="font-size:13px;color:var(--text2);margin-bottom:6px" id="attUploadMsg">Uploading…</div>
      <div style="height:4px;background:var(--bg4);border-radius:2px;overflow:hidden">
        <div id="attUploadBar" style="height:100%;background:var(--accent);width:0%;transition:width .3s;border-radius:2px"></div>
      </div>
    </div>

    <!-- Photos grid -->
    <div id="attPhotoGrid" class="att-grid" style="display:none"></div>

    <!-- File list -->
    <div id="attFileList"></div>

    <!-- Empty state -->
    <div id="attEmpty" style="text-align:center;padding:16px 0 8px;color:var(--text3);font-size:13px;display:none">
      No attachments yet
    </div>

    <div style="height:8px"></div>
  </div>
</div>

<!-- Fullscreen image viewer -->
<div id="attViewer">
  <button id="attViewerClose">✕</button>
  <img id="attViewerImg" src="" alt="">
  <div id="attViewerCaption"></div>
</div>
      `);

      // Wire up close on overlay click
      document.getElementById('attDrawer').addEventListener('click', e => {
        if (e.target === document.getElementById('attDrawer')) _closeDrawer();
      });
      document.getElementById('attDrawerHandle').addEventListener('click', _closeDrawer);
      document.getElementById('attCloseBtn').addEventListener('click', _closeDrawer);
      document.getElementById('attViewerClose').addEventListener('click', () => {
        document.getElementById('attViewer').classList.remove('open');
      });
      document.getElementById('attViewer').addEventListener('click', e => {
        if (e.target === document.getElementById('attViewer'))
          document.getElementById('attViewer').classList.remove('open');
      });
    }
  }

  // ── Internal state ──────────────────────────────────────────
  let _entityType = '';
  let _entityId   = '';
  let _title      = '';

  function _closeDrawer() {
    document.getElementById('attDrawer').classList.remove('open');
  }

  async function _apiCall(method, path, body) {
    const opts = {
      method,
      headers: { 'Authorization': `Bearer ${_token()}` },
    };
    if (body && !(body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    } else if (body) {
      opts.body = body;
    }
    const res = await fetch(API + path, opts);
    if (!res.ok) { const e = await res.json().catch(()=>({error:'Error'})); throw new Error(e.error||'Error'); }
    return res.json();
  }

  function _fileIcon(mime) {
    if (!mime) return '📄';
    if (mime.includes('pdf'))        return '📕';
    if (mime.includes('word'))       return '📝';
    if (mime.includes('excel') || mime.includes('spreadsheet')) return '📊';
    if (mime.includes('zip') || mime.includes('compress'))      return '🗜️';
    return '📄';
  }

  function _isMobile() {
    return /Android|iPhone|iPad/i.test(navigator.userAgent);
  }

  function _fmtSize(bytes) {
    if (!bytes) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024*1024) return (bytes/1024).toFixed(1) + ' KB';
    return (bytes/(1024*1024)).toFixed(1) + ' MB';
  }

  // ── Render attachments into the open drawer ─────────────────
  async function _render() {
    const grid     = document.getElementById('attPhotoGrid');
    const fileList = document.getElementById('attFileList');
    const empty    = document.getElementById('attEmpty');
    const count    = document.getElementById('attDrawerCount');

    grid.innerHTML = '';
    fileList.innerHTML = '';
    grid.style.display = 'none';

    let attachments = [];
    try {
      attachments = await _apiCall('GET', `/${_entityType}/${_entityId}`);
    } catch (e) {
      fileList.innerHTML = `<p style="color:var(--red);font-size:13px">${e.message}</p>`;
      return;
    }

    count.textContent = attachments.length ? `${attachments.length} file${attachments.length!==1?'s':''}` : '';
    empty.style.display = attachments.length ? 'none' : 'block';

    const images = attachments.filter(a => a.is_image);
    const docs   = attachments.filter(a => !a.is_image);

    // ── Images grid ──────────────────────────────────────────
    if (images.length) {
      grid.style.display = 'grid';
      grid.innerHTML = images.map(a => `
        <div class="att-thumb${a.is_primary_photo?' primary-photo':''}" data-id="${a.id}">
          <img src="${API}/thumb/${a.id}"
               alt="${a.label||a.original_filename}"
               onerror="this.style.display='none'"
               onclick="AttachmentManager._viewImage(${a.id},'${(a.label||a.original_filename).replace(/'/g,'\\\'')}')"
               style="cursor:zoom-in">
          <button class="att-thumb-del" onclick="event.stopPropagation();AttachmentManager._delete(${a.id})" title="Delete">✕</button>
          <button class="att-thumb-primary-btn${a.is_primary_photo?' is-primary':''}"
                  onclick="event.stopPropagation();AttachmentManager._setPrimary(${a.id})"
                  title="${a.is_primary_photo?'Primary photo':'Set as primary'}">
            ${a.is_primary_photo?'★ Primary':'☆ Set primary'}
          </button>
        </div>
      `).join('');
    }

    // ── Documents list ───────────────────────────────────────
    if (docs.length) {
      fileList.innerHTML = docs.map(a => {
        const isMobile = _isMobile();
        // On PC: clickable link. On mobile: show UNC path as text with note.
        const linkHtml = isMobile
          ? `<span class="att-file-name">${a.label || a.original_filename}</span>
             <div class="att-file-unc">${a.unc_path || a.stored_path}</div>
             <div class="att-mobile-note" style="display:block">⚠ Open on PC to access this file</div>`
          : `<a class="att-file-name att-file-link"
                href="${API}/file/${a.id}" target="_blank" rel="noopener"
              >${a.label || a.original_filename}</a>
             <div class="att-file-unc">${a.unc_path || ''}</div>`;

        return `
          <div class="att-file-row">
            <div class="att-file-icon">${_fileIcon(a.mime_type)}</div>
            <div class="att-file-body">
              ${linkHtml}
              <div class="att-file-meta">
                ${_fmtSize(a.file_size)}${a.file_size&&a.notes?' · ':''}${a.notes||''}
                ${!a.file_exists?'<span style="color:var(--red)"> · ⚠ File missing from NAS</span>':''}
              </div>
            </div>
            <button class="btn btn-danger" style="padding:3px 8px;font-size:11px;flex-shrink:0"
                    onclick="AttachmentManager._delete(${a.id})">del</button>
          </div>
        `;
      }).join('');
    }
  }

  // ── Upload ──────────────────────────────────────────────────
  async function _upload(files) {
    const progress = document.getElementById('attUploadProgress');
    const bar      = document.getElementById('attUploadBar');
    const msg      = document.getElementById('attUploadMsg');
    const label    = document.getElementById('attLabelInput').value.trim();

    progress.style.display = 'block';
    bar.style.width = '10%';

    const fd = new FormData();
    for (const f of files) fd.append('files', f);
    if (label) fd.append('label', label);

    try {
      msg.textContent = `Uploading ${files.length} file${files.length!==1?'s':''}…`;
      bar.style.width = '40%';

      await _apiCall('POST', `/${_entityType}/${_entityId}`, fd);

      bar.style.width = '100%';
      msg.textContent = '✓ Upload complete';
      document.getElementById('attLabelInput').value = '';

      setTimeout(() => {
        progress.style.display = 'none';
        bar.style.width = '0%';
      }, 1200);

      await _render();
      // Notify host page to refresh badges
      window.dispatchEvent(new CustomEvent('att:uploaded', {
        detail: { entityType: _entityType, entityId: _entityId }
      }));
    } catch (e) {
      msg.textContent = '✗ ' + e.message;
      msg.style.color = 'var(--red)';
      setTimeout(() => {
        progress.style.display = 'none';
        msg.style.color = '';
      }, 3000);
    }
  }

  // ── Delete ──────────────────────────────────────────────────
  async function _delete(id) {
    if (!confirm('Delete this attachment? The file will be removed from the NAS.')) return;
    try {
      await _apiCall('DELETE', `/${id}`);
      await _render();
      window.dispatchEvent(new CustomEvent('att:deleted', {
        detail: { entityType: _entityType, entityId: _entityId }
      }));
    } catch (e) { alert(e.message); }
  }

  // ── Set primary photo ────────────────────────────────────────
  async function _setPrimary(id) {
    try {
      await _apiCall('PUT', `/${id}/primary`);
      await _render();
      window.dispatchEvent(new CustomEvent('att:changed', {
        detail: { entityType: _entityType, entityId: _entityId }
      }));
    } catch (e) { alert(e.message); }
  }

  // ── View fullscreen image ────────────────────────────────────
  function _viewImage(id, caption) {
    const viewer = document.getElementById('attViewer');
    document.getElementById('attViewerImg').src = `${API}/file/${id}`;
    document.getElementById('attViewerCaption').textContent = caption || '';
    viewer.classList.add('open');
  }

  // ── Wire file input + drag/drop ──────────────────────────────
  function _wireUpload() {
    const zone  = document.getElementById('attDropZone');
    const input = document.getElementById('attFileInput');

    zone.onclick = () => input.click();

    input.addEventListener('change', e => {
      if (e.target.files.length) _upload(Array.from(e.target.files));
      e.target.value = '';
    });

    zone.addEventListener('dragover', e => {
      e.preventDefault();
      zone.classList.add('drag-over');
    });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('drag-over');
      const files = Array.from(e.dataTransfer.files);
      if (files.length) _upload(files);
    });
  }

  // ══════════════════════════════════════════════════════════════
  // PUBLIC API
  // ══════════════════════════════════════════════════════════════

  /**
   * Open the attachment drawer for a record.
   * @param {string} entityType  e.g. 'item', 'hsa_payment', 'med_visit'
   * @param {number} entityId    Record ID
   * @param {string} recordTitle Human-readable title shown in drawer header
   */
  function open(entityType, entityId, recordTitle) {
    injectStyles();
    _wireUpload();
    _entityType = entityType;
    _entityId   = String(entityId);
    _title      = recordTitle || '';
    document.getElementById('attDrawerTitle').textContent =
      `Attachments${recordTitle ? ' — ' + recordTitle : ''}`;
    document.getElementById('attDrawer').classList.add('open');
    _render();
  }

  /**
   * Returns a Promise<string> of badge HTML for use in record cards.
   * Shows paperclip icon + count. Returns '' if no attachments.
   */
  async function badgeHtml(entityType, entityId) {
    try {
      const opts = { headers: { 'Authorization': `Bearer ${_token()}` } };
      const res  = await fetch(`${API}/count/${entityType}/${entityId}`, opts);
      if (!res.ok) return '';
      const { total } = await res.json();
      if (!total) return '';
      return `<span class="att-badge has-files" onclick="event.stopPropagation();AttachmentManager.open('${entityType}',${entityId},'')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
        </svg>
        ${total}
      </span>`;
    } catch { return ''; }
  }

  /**
   * Lightweight static badge — no async fetch.
   * Use when you already know there are attachments (e.g. from a JOIN in the item query).
   */
  function staticBadge(entityType, entityId, count) {
    if (!count) return '';
    return `<span class="att-badge has-files" onclick="event.stopPropagation();AttachmentManager.open('${entityType}',${entityId},'')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
      </svg>
      ${count}
    </span>`;
  }

  return { open, badgeHtml, staticBadge, injectStyles, _delete, _setPrimary, _viewImage };
})();
