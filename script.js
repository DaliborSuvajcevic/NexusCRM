/* PRODUCT LAB · CRM
   Client-side lead pipeline for AI Product Lab. No backend: data lives in this browser's localStorage. */
(() => {
  'use strict';

  /* ---------- Config ---------- */
  const STORE_KEY = 'plcrm.v1.leads';          // namespaced: all github.io sites share one localStorage origin
  const LANG_KEY = 'plcrm.lang';
  const LEGACY_KEY = 'leads';                  // old NexusCRM key
  const MIGRATED_FLAG = 'plcrm.v1.migrated';
  const STAGES = ['new', 'talking', 'brief', 'production', 'delivered', 'won', 'lost'];
  const OPEN_STAGES = ['new', 'talking', 'brief', 'production', 'delivered'];
  const SOURCES = ['instagram', 'website', 'referral', 'other'];
  const PACKAGES = { START: 49, GROW: 99, BRAND: 199, CUSTOM: null };

  /* ---------- State ---------- */
  let leads = [];
  let lang = 'sr';
  let activeStage = 'all';
  let searchTerm = '';
  let sortMode = 'follow';
  let editingId = null;
  let storageOk = true;

  /* ---------- Helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const t = (key) => (I18N[lang] && I18N[lang][key]) || I18N.sr[key] || key;
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const todayISO = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const money = (n) => new Intl.NumberFormat(lang === 'sr' ? 'sr-Latn-RS' : 'en-GB', { maximumFractionDigits: 0 }).format(n || 0) + ' €';
  const cleanHandle = (v) => String(v || '').trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, '')
    .replace(/^@/, '').split(/[/?#\s]/)[0]
    .replace(/[^A-Za-z0-9._]/g, '').slice(0, 30);
  const str = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const svg = (path) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true'); s.innerHTML = path; return s;
  };
  const ICON = {
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    ig: '<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6" fill="currentColor"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'
  };

  /* ---------- Storage ---------- */
  const normalize = (raw) => {
    if (!raw || typeof raw !== 'object') return null;
    const stage = STAGES.includes(raw.stage) ? raw.stage : 'new';
    const value = Number(raw.value);
    return {
      id: str(raw.id, 64) || uid(),
      name: str(raw.name, 120),
      brand: str(raw.brand, 120),
      instagram: cleanHandle(raw.instagram),
      email: str(raw.email, 160),
      phone: str(raw.phone, 40),
      source: SOURCES.includes(raw.source) ? raw.source : 'other',
      product: str(raw.product, 160),
      package: Object.prototype.hasOwnProperty.call(PACKAGES, raw.package) ? raw.package : '',
      value: Number.isFinite(value) && value >= 0 ? Math.round(value) : 0,
      stage,
      followUp: /^\d{4}-\d{2}-\d{2}$/.test(raw.followUp) ? raw.followUp : '',
      notes: str(raw.notes, 4000),
      createdAt: str(raw.createdAt, 40) || new Date().toISOString(),
      updatedAt: str(raw.updatedAt, 40) || new Date().toISOString(),
      wonAt: stage === 'won' ? (str(raw.wonAt, 40) || str(raw.updatedAt, 40) || new Date().toISOString()) : ''
    };
  };

  const load = () => {
    try {
      const data = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
      leads = Array.isArray(data) ? data.map(normalize).filter(Boolean) : [];
    } catch (e) { leads = []; }
  };

  const save = () => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(leads)); storageOk = true; }
    catch (e) { if (storageOk) toast(t('t_storage_err'), true); storageOk = false; }
  };

  /* One-time move of data from the old NexusCRM version (key "leads", statuses New / In Progress / Closed). */
  const migrateLegacy = () => {
    try {
      if (localStorage.getItem(MIGRATED_FLAG) || localStorage.getItem(STORE_KEY)) return 0;
      const old = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
      if (!Array.isArray(old) || !old.length) return 0;
      localStorage.setItem(MIGRATED_FLAG, '1');
      const map = { 'New': 'new', 'In Progress': 'talking', 'Closed': 'won' };
      const srcMap = { Instagram: 'instagram', Website: 'website', Referral: 'referral' };
      leads = old.map((o) => normalize({
        name: o.name, email: o.email, phone: o.phone,
        source: srcMap[o.source] || 'other',
        stage: map[o.status] || 'new',
        notes: o.notes,
        createdAt: o.id ? new Date(Number(o.id)).toISOString() : undefined
      })).filter(Boolean);
      save();
      return leads.length;
    } catch (e) { return 0; }
  };

  /* ---------- i18n ---------- */
  const applyLang = (next, persist) => {
    lang = next === 'en' ? 'en' : 'sr';
    document.documentElement.lang = lang;
    document.title = t('title');
    document.querySelectorAll('[data-i18n]').forEach((n) => { n.textContent = t(n.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach((n) => { n.innerHTML = t(n.dataset.i18nHtml); }); // trusted static copy only
    document.querySelectorAll('[data-i18n-attr]').forEach((n) => {
      n.dataset.i18nAttr.split(';').forEach((pair) => {
        const [attr, key] = pair.split(':');
        if (attr && key) n.setAttribute(attr.trim(), t(key.trim()));
      });
    });
    document.querySelectorAll('.lang-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    fillStageSelect($('fStage'));
    if (persist) { try { localStorage.setItem(LANG_KEY, lang); } catch (e) {} }
    render();
  };

  const fillStageSelect = (select, current) => {
    const keep = current || select.value;
    select.innerHTML = '';
    STAGES.forEach((s) => { const o = el('option', null, t('stage_' + s)); o.value = s; select.appendChild(o); });
    if (keep) select.value = keep;
  };

  const plural = (n) => {
    if (lang === 'en') return n === 1 ? t('count_one') : t('count_many');
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return t('count_one');
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return t('count_few');
    return t('count_many');
  };

  /* ---------- Derived data ---------- */
  const followState = (lead) => {
    if (!lead.followUp || !OPEN_STAGES.includes(lead.stage)) return '';
    const today = todayISO();
    if (lead.followUp < today) return 'overdue';
    if (lead.followUp === today) return 'due';
    return 'later';
  };

  const matchesSearch = (lead) => {
    if (!searchTerm) return true;
    const hay = [lead.name, lead.brand, lead.instagram, '@' + lead.instagram, lead.email, lead.phone, lead.product, lead.notes].join(' ').toLowerCase();
    return hay.includes(searchTerm);
  };

  const visibleLeads = () => {
    const list = leads.filter((l) => (activeStage === 'all' || l.stage === activeStage) && matchesSearch(l));
    const rank = { overdue: 0, due: 1, later: 2, '': 3 };
    list.sort((a, b) => {
      if (sortMode === 'value') return b.value - a.value || b.createdAt.localeCompare(a.createdAt);
      if (sortMode === 'new') return b.createdAt.localeCompare(a.createdAt);
      const ra = rank[followState(a)], rb = rank[followState(b)];
      if (ra !== rb) return ra - rb;
      if (a.followUp && b.followUp && a.followUp !== b.followUp) return a.followUp.localeCompare(b.followUp);
      return b.createdAt.localeCompare(a.createdAt);
    });
    return list;
  };

  const formatDate = (iso) => {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString(lang === 'sr' ? 'sr-Latn-RS' : 'en-GB', { day: 'numeric', month: 'short' });
  };

  /* ---------- Render ---------- */
  const renderStats = () => {
    const open = leads.filter((l) => OPEN_STAGES.includes(l.stage));
    const month = todayISO().slice(0, 7);
    const wonMonth = leads.filter((l) => l.stage === 'won' && l.wonAt && l.wonAt.slice(0, 7) === month);
    const due = open.filter((l) => ['due', 'overdue'].includes(followState(l)));
    $('statOpen').textContent = open.length;
    $('statPipeline').textContent = money(open.reduce((s, l) => s + l.value, 0));
    $('statWon').textContent = money(wonMonth.reduce((s, l) => s + l.value, 0));
    $('statDue').textContent = due.length;
    $('statDue').closest('.stat').classList.toggle('alert', due.some((l) => followState(l) === 'overdue'));
  };

  const renderChips = () => {
    const wrap = $('stageChips');
    wrap.innerHTML = '';
    const make = (key, label, count) => {
      const b = el('button', 'chip');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', String(activeStage === key));
      if (key !== 'all') b.dataset.stage = key;
      b.append(document.createTextNode(label), el('em', null, String(count)));
      b.addEventListener('click', () => { activeStage = key; render(); });
      wrap.appendChild(b);
    };
    make('all', t('all'), leads.length);
    STAGES.forEach((s) => make(s, t('stage_' + s), leads.filter((l) => l.stage === s).length));
  };

  const leadCard = (lead) => {
    const card = el('article', 'lead-card' + (lead.stage === 'won' ? ' is-won' : '') + (lead.stage === 'lost' ? ' is-lost' : ''));
    card.dataset.id = lead.id;

    const top = el('div', 'lead-top');
    const display = lead.name || (lead.instagram ? '@' + lead.instagram : '?');
    top.appendChild(el('div', 'avatar', display.replace('@', '').charAt(0).toUpperCase() || '?'));
    const id = el('div', 'lead-id');
    id.appendChild(el('h3', null, display));
    const sub = [lead.brand, lead.instagram && lead.name ? '@' + lead.instagram : ''].filter(Boolean).join(' · ');
    if (sub) id.appendChild(el('p', null, sub));
    top.appendChild(id);
    if (lead.value || lead.package) {
      const v = el('div', 'lead-value');
      v.appendChild(el('strong', null, lead.value ? money(lead.value) : '—'));
      if (lead.package) v.appendChild(el('span', null, lead.package));
      top.appendChild(v);
    }
    card.appendChild(top);

    if (lead.product) card.appendChild(el('p', 'lead-product', lead.product));

    const meta = el('div', 'lead-meta');
    const sel = el('select', 'stage-select');
    sel.dataset.stage = lead.stage;
    sel.setAttribute('aria-label', t('stage_change'));
    fillStageSelect(sel, lead.stage);
    sel.addEventListener('change', () => updateStage(lead.id, sel.value));
    meta.appendChild(sel);

    const fs = followState(lead);
    const f = el('span', 'follow' + (fs === 'due' ? ' due' : fs === 'overdue' ? ' overdue' : ''));
    f.appendChild(svg(ICON.cal));
    let ftxt = t('no_followup');
    if (lead.followUp) ftxt = (fs === 'overdue' ? t('overdue') + ' · ' : '') + (fs === 'due' ? t('today') : formatDate(lead.followUp));
    f.appendChild(document.createTextNode(ftxt));
    if (lead.followUp || OPEN_STAGES.includes(lead.stage)) meta.appendChild(f);
    card.appendChild(meta);

    const actions = el('div', 'lead-actions');
    actions.appendChild(el('span', 'src', t({ instagram: 'src_ig', website: 'src_site', referral: 'src_ref', other: 'src_other' }[lead.source])));
    actions.appendChild(el('span', 'spacer'));
    if (lead.instagram) {
      const a = el('a', 'icon-btn');
      a.href = 'https://www.instagram.com/' + encodeURIComponent(lead.instagram) + '/';
      a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.setAttribute('aria-label', t('open_ig')); a.title = t('open_ig');
      a.appendChild(svg(ICON.ig));
      actions.appendChild(a);
    }
    if (lead.email && isEmail(lead.email)) {
      const a = el('a', 'icon-btn');
      a.href = 'mailto:' + encodeURIComponent(lead.email).replace('%40', '@');
      a.setAttribute('aria-label', t('send_email')); a.title = t('send_email');
      a.appendChild(svg(ICON.mail));
      actions.appendChild(a);
    }
    const ed = el('button', 'icon-btn');
    ed.type = 'button';
    ed.setAttribute('aria-label', t('edit')); ed.title = t('edit');
    ed.appendChild(svg(ICON.edit));
    ed.addEventListener('click', () => openModal(lead.id));
    actions.appendChild(ed);
    card.appendChild(actions);
    return card;
  };

  const render = () => {
    renderStats();
    renderChips();
    const list = visibleLeads();
    const grid = $('leadGrid');
    grid.innerHTML = '';
    const frag = document.createDocumentFragment();
    list.forEach((l) => frag.appendChild(leadCard(l)));
    grid.appendChild(frag);
    $('emptyState').classList.toggle('hidden', list.length > 0);
    $('resultCount').textContent = list.length + ' ' + plural(list.length);
  };

  /* ---------- Actions ---------- */
  const updateStage = (id, stage) => {
    const lead = leads.find((l) => l.id === id);
    if (!lead || !STAGES.includes(stage)) return;
    if (stage === 'won' && lead.stage !== 'won') lead.wonAt = new Date().toISOString();
    if (stage !== 'won') lead.wonAt = '';
    lead.stage = stage;
    lead.updatedAt = new Date().toISOString();
    save(); render(); toast(t('t_stage'));
  };

  const modal = $('leadModal');
  const form = $('leadForm');
  let lastFocus = null;

  const openModal = (id) => {
    editingId = id || null;
    const lead = id ? leads.find((l) => l.id === id) : null;
    form.reset();
    form.querySelectorAll('.invalid').forEach((n) => n.classList.remove('invalid'));
    fillStageSelect($('fStage'), lead ? lead.stage : 'new');
    $('modalTitle').textContent = lead ? t('m_edit') : t('m_new');
    $('deleteBtn').classList.toggle('hidden', !lead);
    if (lead) {
      $('fName').value = lead.name; $('fBrand').value = lead.brand;
      $('fIg').value = lead.instagram ? '@' + lead.instagram : '';
      $('fEmail').value = lead.email; $('fPhone').value = lead.phone;
      $('fSource').value = lead.source; $('fProduct').value = lead.product;
      $('fPackage').value = lead.package; $('fValue').value = lead.value || '';
      $('fFollow').value = lead.followUp; $('fNotes').value = lead.notes;
    } else {
      $('fSource').value = 'instagram';
      $('fFollow').value = todayISO();
    }
    lastFocus = document.activeElement;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    setTimeout(() => $('fName').focus(), 50);
  };

  const closeModal = () => {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    editingId = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  };

  // Package picks a default value; a manually typed value is kept.
  $('fPackage').addEventListener('change', (e) => {
    const price = PACKAGES[e.target.value];
    if (price && (!$('fValue').value || Object.values(PACKAGES).includes(Number($('fValue').value)))) $('fValue').value = price;
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    form.querySelectorAll('.invalid').forEach((n) => n.classList.remove('invalid'));
    const name = $('fName').value.trim();
    const ig = cleanHandle($('fIg').value);
    const email = $('fEmail').value.trim();
    if (!name && !ig) { $('fName').classList.add('invalid'); $('fName').focus(); return toast(t('t_err_name'), true); }
    if (email && !isEmail(email)) { $('fEmail').classList.add('invalid'); $('fEmail').focus(); return toast(t('t_err_email'), true); }

    const now = new Date().toISOString();
    const existing = editingId ? leads.find((l) => l.id === editingId) : null;
    const stage = $('fStage').value;
    const data = normalize({
      id: existing ? existing.id : uid(),
      name, brand: $('fBrand').value, instagram: ig, email, phone: $('fPhone').value,
      source: $('fSource').value, product: $('fProduct').value, package: $('fPackage').value,
      value: $('fValue').value, stage, followUp: $('fFollow').value, notes: $('fNotes').value,
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      wonAt: stage === 'won' ? (existing && existing.stage === 'won' && existing.wonAt ? existing.wonAt : now) : ''
    });

    if (existing) leads[leads.indexOf(existing)] = data;
    else leads.unshift(data);
    save();
    closeModal();
    render();
    toast(existing ? t('t_saved') : t('t_added'));
  });

  $('deleteBtn').addEventListener('click', () => {
    if (!editingId || !confirm(t('confirm_delete'))) return;
    leads = leads.filter((l) => l.id !== editingId);
    save(); closeModal(); render(); toast(t('t_deleted'));
  });

  /* ---------- Backup ---------- */
  $('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify({ app: 'productlab-crm', version: 1, exportedAt: new Date().toISOString(), leads }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'productlab-crm-backup-' + todayISO() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast(t('t_exported'));
  });

  $('importInput').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        const list = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.leads) ? parsed.leads : null;
        if (!list) throw new Error('format');
        const clean = list.map(normalize).filter(Boolean);
        if (!confirm(t('confirm_import'))) return;
        leads = clean; save(); render();
        toast(t('t_imported') + clean.length);
      } catch (err) { toast(t('t_import_err'), true); }
    };
    reader.readAsText(file);
  });

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg, isError) {
    const n = $('toast');
    n.textContent = msg;
    n.classList.toggle('error', !!isError);
    n.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => n.classList.remove('show'), 2800);
  }

  /* ---------- Wiring ---------- */
  $('newLeadBtn').addEventListener('click', () => openModal());
  $('emptyAddBtn').addEventListener('click', () => openModal());
  $('closeModalBtn').addEventListener('click', closeModal);
  $('cancelBtn').addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });

  let searchTimer;
  $('search').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { searchTerm = e.target.value.trim().toLowerCase(); render(); }, 150);
  });
  $('sort').addEventListener('change', (e) => { sortMode = e.target.value; render(); });
  document.querySelectorAll('.lang-btn').forEach((b) => b.addEventListener('click', () => applyLang(b.dataset.lang, true)));

  // Keep the "today / overdue" labels correct if the tab stays open past midnight.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  /* ---------- Init ---------- */
  load();
  const migrated = migrateLegacy();
  let savedLang = 'sr';
  try {
    const q = new URLSearchParams(location.search).get('lang');
    savedLang = q === 'en' || q === 'sr' ? q : (localStorage.getItem(LANG_KEY) || 'sr');
  } catch (e) {}
  applyLang(savedLang, false);
  if (migrated) toast(t('t_migrated') + migrated);
})();
