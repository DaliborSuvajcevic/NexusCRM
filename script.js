document.addEventListener('DOMContentLoaded', () => {
  // === Selekcija elemenata ===
  const authModal = document.getElementById('authModal');
  const appContent = document.getElementById('appContent');
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const toggleAuthBtn = document.getElementById('toggleAuth');
  const logoutBtn = document.querySelector('.fa-sign-out-alt')?.closest('button');
  const modal = document.getElementById('leadModal');
  const openModalBtn = document.getElementById('openModalBtn');
  const closeModalBtn = document.getElementById('closeModalBtn');
  const leadForm = document.getElementById('leadForm');
  const searchInput = document.getElementById('search');
  const tbody = document.querySelector('tbody');

  let isLoginMode = true;
  let currentEditRow = null;
  let filteredLeadsCache = null;
  let lastSearchTerm = '';
  let currentPage = 1;
  const ITEMS_PER_PAGE = 4; // Broj leadova po stranici
  let totalLeadsCount = 0;

  // === Pomoćne funkcije ===
  const $ = (id) => document.getElementById(id);
  const setText = (id, text) => { const el = $(id); if (el) el.textContent = text; };
  
  // Toast notifications
  const showToast = (message, type = 'info', duration = 3000) => {
    const existingToast = document.getElementById('toast-notification');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg text-white font-medium z-[100] transform transition-all ${
      type === 'success' ? 'bg-green-600' : 
      type === 'error' ? 'bg-red-600' : 'bg-blue-600'
    }`;
    toast.style.animation = 'toastSlide 0.3s ease-out';
    toast.innerHTML = `
      <div class="flex items-center">
        <i class="fas ${
          type === 'success' ? 'fa-check-circle' : 
          type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'
        } mr-2"></i>
        ${message}
      </div>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'toastSlideOut 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

  // CSS za toast animacije
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      @keyframes toastSlide {
        from { transform: translateX(400px) scale(0.9); opacity: 0; }
        to { transform: translateX(0) scale(1); opacity: 1; }
      }
      @keyframes toastSlideOut {
        from { transform: translateX(0) scale(1); opacity: 1; }
        to { transform: translateX(400px) scale(0.9); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  const saveLeads = () => localStorage.setItem('leads', JSON.stringify(leads));
  const saveUsers = (users) => localStorage.setItem('users', JSON.stringify(users));
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  
  // Escape HTML za XSS zaštitu
  const escapeHtml = (str) => {
    if (!str) return '';
    return str.toString().replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  };

  // Debounce funkcija
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // ========== NOVE FUNKCIJE ZA AVATAR ========== //
  
  // Uzmi inicijal iz username-a
  const getInitial = (username) => {
    if (!username) return 'U';
    return username.charAt(0).toUpperCase();
  };

  // Generiši boju za avatar na osnovu username-a
  const getAvatarColor = (username) => {
    if (!username) return '#4338ca'; // default plava
    
    // Hash funkcija za generisanje konzistentne boje
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generiši boju na osnovu hash-a
    const colors = [
      '#4338ca', // indigo
      '#5b21b6', // purple
      '#9333ea', // violet
      '#06b6d4', // cyan
      '#0ea5e9', // sky
      '#3b82f6', // blue
      '#8b5cf6', // purple-500
      '#ec4899', // pink
      '#ef4444', // red
      '#f59e0b'  // amber
    ];
    
    return colors[Math.abs(hash) % colors.length];
  };

  // Ažuriraj korisnički UI sa avatarom
  const updateUserUI = (username) => {
    const userNameEl = document.getElementById('userNameDisplay');
    const userEmailEl = document.getElementById('userEmailDisplay');
    const avatarEl = document.getElementById('userAvatar');
    
    if (!username) return;
    
    // Uzmi podatke iz localStorage
    const users = JSON.parse(localStorage.getItem('users') || '{}');
    const user = users[username];
    
    // Podesi ime
    if (userNameEl) {
      userNameEl.textContent = username;
    }
    
    // Podesi email
    if (userEmailEl) {
      let email = username + '@example.com';
      if (user?.email) email = user.email;
      else if (username === 'admin') email = 'admin@example.com';
      userEmailEl.textContent = email;
    }
    
    // Podesi avatar sa inicijalom i bojom
    if (avatarEl) {
      avatarEl.textContent = getInitial(username);
      avatarEl.style.backgroundColor = getAvatarColor(username);
    }
  };

 
 // === Inicijalni podaci ===
let leads = JSON.parse(localStorage.getItem('leads')) || []; // ✅ SAMO OVO MENJATE

if (!localStorage.getItem('leads')) {
  saveLeads(); // Sa praznim nizom []
}
totalLeadsCount = leads.length;

  if (!localStorage.getItem('leads')) saveLeads();
  totalLeadsCount = leads.length;

  // === Modal funkcije ===
  const openModal = () => {
    if (modal?.classList.contains('active')) return;
    modal?.classList.add('active');
    document.body.style.overflow = 'hidden';
    currentEditRow = null;
  };

  const closeModal = () => {
    if (!modal?.classList.contains('active')) return;
    modal?.classList.remove('active');
    document.body.style.overflow = 'auto';
    leadForm?.reset();
    currentEditRow = null;
  };

  // === Paginacija ===
  const getPaginatedLeads = (leadsArray, page, pageSize = ITEMS_PER_PAGE) => {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return leadsArray.slice(startIndex, endIndex);
  };

  const updatePaginationInfo = (total, filteredCount, currentPage) => {
    const startIndex = ((currentPage - 1) * ITEMS_PER_PAGE) + 1;
    const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredCount);
    const maxPage = Math.ceil(filteredCount / ITEMS_PER_PAGE);
    const isLastPage = currentPage === maxPage;
    
    const paginationText = document.querySelector('.text-sm.text-gray-700');
    if (paginationText) {
      if (filteredCount === 0) {
        paginationText.innerHTML = 'No leads found';
      } else {
        paginationText.innerHTML = `
          Showing <span class="font-medium">${startIndex}</span> to 
          <span class="font-medium">${endIndex}</span> of 
          <span class="font-medium">${filteredCount}</span> leads
        `;
      }
    }
  };

  // === Ažuriranje statistika ===
  const updateStats = () => {
    const leadsToCount = filteredLeadsCache || leads;
    const total = leadsToCount.length;
    
    let newCount = 0, progressCount = 0, closedCount = 0;
    for (let i = 0; i < leadsToCount.length; i++) {
      const status = leadsToCount[i].status;
      if (status === 'New') newCount++;
      else if (status === 'In Progress') progressCount++;
      else if (status === 'Closed') closedCount++;
    }
    
    setText('totalLeads', totalLeadsCount);
    setText('newLeads', newCount);
    setText('inProgressLeads', progressCount);
    setText('closedLeads', closedCount);
    setText('paginationTotal', total);
    
    updatePaginationInfo(totalLeadsCount, total, currentPage);
  };

  // === Filtriranje ===
  const filterLeads = (term) => {
    if (term === lastSearchTerm && filteredLeadsCache) {
      return filteredLeadsCache;
    }
    
    lastSearchTerm = term;
    
    if (!term.trim()) {
      filteredLeadsCache = null;
      return leads;
    }
    
    const lowerTerm = term.toLowerCase();
    const filtered = [];
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      if (
        lead.name.toLowerCase().includes(lowerTerm) ||
        lead.email.toLowerCase().includes(lowerTerm) ||
        (lead.phone && lead.phone.toLowerCase().includes(lowerTerm)) ||
        lead.source.toLowerCase().includes(lowerTerm)
      ) {
        filtered.push(lead);
      }
    }
    
    filteredLeadsCache = filtered;
    return filtered;
  };

  // === Renderovanje leadova ===
  const renderLeads = (leadsArray = leads, page = currentPage) => {
    if (!tbody) return;
    
    if (leadsArray !== (filteredLeadsCache || leads)) {
      filteredLeadsCache = null;
      lastSearchTerm = '';
    }
    
    const paginatedLeads = getPaginatedLeads(leadsArray, page);
    
    const fragment = document.createDocumentFragment();
    
    if (paginatedLeads.length === 0) {
      const emptyRow = document.createElement('tr');
      emptyRow.innerHTML = `
        <td colspan="7" class="px-6 py-12 text-center">
          <div class="text-gray-400 mb-4">
            <i class="fas fa-inbox text-5xl"></i>
          </div>
          <p class="text-lg font-medium text-gray-900">No leads found</p>
          <p class="mt-1 text-gray-500">Try adjusting your search or filters</p>
          <button id="addFirstLead" class="mt-4 bg-primary text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition">
            <i class="fas fa-plus mr-2"></i> Add Lead
          </button>
        </td>
      `;
      fragment.appendChild(emptyRow);
      tbody.innerHTML = '';
      tbody.appendChild(fragment);
      
      document.getElementById('addFirstLead')?.addEventListener('click', openModal);
      updateStats();
      return;
    }
    
    for (let i = 0; i < paginatedLeads.length; i++) {
      const lead = paginatedLeads[i];
      const statusClass = lead.status === 'New' ? 'new' : 
                         lead.status === 'In Progress' ? 'progress' : 'closed';
      
      const row = document.createElement('tr');
      row.className = 'hover:bg-gray-50 transition-colors duration-150';
      row.dataset.id = lead.id;
      
      row.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="flex items-center">
            <div class="bg-blue-100 text-primary rounded-full w-10 h-10 flex items-center justify-center font-bold mr-3">
              ${escapeHtml(lead.name.charAt(0).toUpperCase())}
            </div>
            <div>
              <div class="text-sm font-medium text-gray-900">${escapeHtml(lead.name)}</div>
            </div>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <div class="text-sm text-gray-900">${escapeHtml(lead.email)}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap hidden md:table-cell">
          <div class="text-sm text-gray-500">${lead.phone ? escapeHtml(lead.phone) : 'N/A'}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
          <span class="px-2 inline-flex text-xs leading-5 font-medium rounded-full bg-purple-100 text-purple-800">
            ${escapeHtml(lead.source)}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span class="status-badge ${statusClass} px-3 py-1 rounded-full text-xs font-medium inline-flex items-center">
            <span class="status-dot dot-${statusClass}"></span> ${escapeHtml(lead.status)}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
          <div class="text-sm text-gray-500">${escapeHtml(lead.createdAt)}</div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <button class="text-indigo-600 hover:text-indigo-900 mr-3 edit-btn" aria-label="Edit lead">
            <i class="fas fa-edit"></i>
          </button>
          <button class="text-danger hover:text-red-800 delete-btn" aria-label="Delete lead">
            <i class="fas fa-trash-alt"></i>
          </button>
        </td>
      `;
      
      fragment.appendChild(row);
    }
    
    tbody.innerHTML = '';
    tbody.appendChild(fragment);
    updateStats();
  };

  // === Finalizacija akcije ===
  const finalizeAction = (msg, type = 'success') => {
    saveLeads();
    filteredLeadsCache = null;
    lastSearchTerm = '';
    currentPage = 1; // Reset na prvu stranicu nakon akcije
    renderLeads(filteredLeadsCache || leads);
    closeModal();
    showToast(msg, type);
  };

  // === Auth logika ===
  const toggleAuth = () => {
    isLoginMode = !isLoginMode;
    loginForm.classList.toggle('hidden', !isLoginMode);
    registerForm.classList.toggle('hidden', isLoginMode);
    $('authTitle').textContent = isLoginMode ? 'Sign in to NexusCRM' : 'Create your account';
    $('authSubtitle').textContent = isLoginMode ? 'Enter your credentials to continue' : 'Join NexusCRM today';
    $('toggleText').textContent = isLoginMode ? "Don't have an account?" : "Already have an account?";
    toggleAuthBtn.textContent = isLoginMode ? 'Sign up' : 'Sign in';
  };

  const handleLogin = (e) => {
    e.preventDefault();
    const username = $('loginUsername').value.trim();
    const password = $('loginPassword').value;
    const users = JSON.parse(localStorage.getItem('users') || '{}');
    const registeredUser = users[username];
    const valid = (username === 'admin' && password === 'password') || 
                  (registeredUser && registeredUser.password === password);
    
    if (valid) {
      localStorage.setItem('isLoggedIn', 'true');
      localStorage.setItem('username', username);
      authModal?.classList.remove('active');
      appContent?.classList.remove('hidden');
      
      // AŽURIRAJ KORISNIČKI UI SA AVATAROM
      updateUserUI(username);
      
      showToast(`Welcome back, ${username}!`);
    } else {
      showToast('Invalid credentials.', 'error');
    }
  };

  const handleRegister = (e) => {
    e.preventDefault();
    const username = $('regUsername').value.trim();
    const email = $('regEmail').value.trim();
    const password = $('regPassword').value;
    const confirmPassword = $('regConfirmPassword').value;
    const users = JSON.parse(localStorage.getItem('users') || '{}');

    if (!username || !email || !password) return showToast('Please fill all fields.', 'error');
    if (password.length < 6) return showToast('Password must be at least 6 characters.', 'error');
    if (password !== confirmPassword) return showToast('Passwords do not match.', 'error');
    if (!isValidEmail(email)) return showToast('Please enter a valid email.', 'error');
    if (users[username]) return showToast('Username already exists.', 'error');
    if (Object.values(users).some(u => u.email === email)) return showToast('Email already registered.', 'error');

    users[username] = { email, password };
    saveUsers(users);
    showToast('Account created successfully!', 'success');
    toggleAuth();
    registerForm.reset();
  };

  const handleLogout = () => {
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('username');
    authModal?.classList.add('active');
    appContent?.classList.add('hidden');
    showToast('Logged out successfully.');
  };

  // === Lead akcije ===
  const handleAddEdit = (e) => {
    e.preventDefault();
    const submitBtn = e.submitter || document.querySelector('button[type="submit"]');
    if (submitBtn.disabled) return;
    
    submitBtn.disabled = true;
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Saving...';
    
    const name = $('name').value.trim();
    const email = $('email').value.trim();
    const phone = $('phone').value.trim() || '';
    const source = $('source').value;
    const status = $('status').value;

    if (!name || !email || !isValidEmail(email)) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
      return showToast('Please fill in all required fields with valid data.', 'error');
    }

    const now = new Date().toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });

    try {
      if (currentEditRow) {
        const id = parseInt(currentEditRow.dataset.id);
        const index = leads.findIndex(l => l.id === id);
        if (index !== -1) {
          leads[index] = { ...leads[index], name, email, phone, source, status };
          finalizeAction('Lead updated successfully!', 'success');
        }
      } else {
        leads.unshift({ id: Date.now(), name, email, phone, source, status, createdAt: now });
        totalLeadsCount++;
        finalizeAction('Lead added successfully!', 'success');
      }
    } catch (error) {
      console.error('Error saving lead:', error);
      showToast('An error occurred. Please try again.', 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  };

  const handleDelete = (id) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    
    const index = leads.findIndex(l => l.id === id);
    if (index !== -1) {
      leads.splice(index, 1);
      totalLeadsCount--;
      
      // Ako je ovo bio poslednji lead na stranici, vrati na prethodnu
      const leadsOnPage = getPaginatedLeads(filteredLeadsCache || leads, currentPage);
      if (leadsOnPage.length === 0 && currentPage > 1) {
        currentPage--;
      }
      
      finalizeAction('Lead deleted.', 'success');
    }
  };

  const handleEdit = (id) => {
    const lead = leads.find(l => l.id === id);
    if (!lead) return;
    
    $('name').value = lead.name;
    $('email').value = lead.email;
    $('phone').value = lead.phone || '';
    $('source').value = lead.source;
    $('status').value = lead.status;
    openModal();
    currentEditRow = { dataset: { id: id } };
  };

  // === Event delegation na tbody ===
  tbody?.addEventListener('click', (e) => {
    const row = e.target.closest('tr');
    if (!row) return;
    
    const id = parseInt(row.dataset.id);
    
    if (e.target.closest('.delete-btn')) {
      handleDelete(id);
    } else if (e.target.closest('.edit-btn') || e.target.closest('.fa-edit')) {
      handleEdit(id);
    }
  });

  // === Filteri ===
  const handleFilter = (e) => {
    const btn = e.target.closest('button.px-4.py-2');
    if (!btn) return;
    
    document.querySelectorAll('button.px-4.py-2').forEach(b => {
      b.classList.remove('bg-primary', 'text-white');
      b.classList.add('bg-gray-100', 'text-gray-700');
    });
    btn.classList.remove('bg-gray-100', 'text-gray-700');
    btn.classList.add('bg-primary', 'text-white');
    
    const filterText = btn.textContent.trim();
    currentPage = 1;
    
    if (filterText === 'All') {
      filteredLeadsCache = null;
      renderLeads(leads, currentPage);
    } else {
      const filtered = leads.filter(l => l.status === filterText);
      filteredLeadsCache = filtered;
      renderLeads(filtered, currentPage);
    }
  };

  // === Search sa debounce ===
  const debouncedSearch = debounce((term) => {
    const filtered = filterLeads(term);
    currentPage = 1;
    renderLeads(filtered, currentPage);
  }, 300);

  const handleSearch = (e) => {
    debouncedSearch(e.target.value);
  };

  // === Pagination ===
  const handlePagination = (direction) => {
    const currentLeads = filteredLeadsCache || leads;
    const maxPage = Math.ceil(currentLeads.length / ITEMS_PER_PAGE);
    
    if (direction === 'next' && currentPage < maxPage) {
      currentPage++;
      renderLeads(currentLeads, currentPage);
    } else if (direction === 'prev' && currentPage > 1) {
      currentPage--;
      renderLeads(currentLeads, currentPage);
    }
  };

  // === Event listeneri ===
  toggleAuthBtn?.addEventListener('click', toggleAuth);
  loginForm?.addEventListener('submit', handleLogin);
  registerForm?.addEventListener('submit', handleRegister);
  logoutBtn?.addEventListener('click', handleLogout);
  openModalBtn?.addEventListener('click', openModal);
  closeModalBtn?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e) => e.target === modal && closeModal());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal?.classList.contains('active')) closeModal();
  });
  leadForm?.addEventListener('submit', handleAddEdit);
  
  // Filteri
  document.querySelector('.flex.space-x-2')?.addEventListener('click', handleFilter);
  
  // Search
  searchInput?.addEventListener('input', handleSearch);
  
  // Pagination dugmad
  const paginationButtons = document.querySelectorAll('button.px-4.py-2.border.border-gray-300');
  paginationButtons.forEach((btn, index) => {
    btn.addEventListener('click', () => handlePagination(index === 0 ? 'prev' : 'next'));
  });

  // === Inicijalno stanje ===
  if (localStorage.getItem('isLoggedIn') === 'true') {
    authModal?.classList.remove('active');
    appContent?.classList.remove('hidden');
    
    // AŽURIRAJ KORISNIČKI UI PRI UČITAVANJU
    const savedUser = localStorage.getItem('username');
    if (savedUser) {
      updateUserUI(savedUser);
    }
  } else {
    authModal?.classList.add('active');
    appContent?.classList.add('hidden');
  }

  renderLeads();

  console.log('NexusCRM initialized with avatar functionality');
});