/* ============================================
   session-forge hub — Shared Utilities (app.js)
   ============================================ */

(function () {
  'use strict';

  const STORAGE_KEY = 'sfh_admin_key';

  // --- Auth / API Key Management ---

  function getApiKey() {
    return localStorage.getItem(STORAGE_KEY) || '';
  }

  function setApiKey(key) {
    if (key) {
      localStorage.setItem(STORAGE_KEY, key.trim());
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  // --- API Fetch Wrapper ---

  async function apiFetch(path, options) {
    options = options || {};
    const key = getApiKey();

    if (!key) {
      showAuthPrompt();
      throw new Error('No API key configured');
    }

    var headers = Object.assign({
      'Authorization': 'Bearer ' + key,
      'Content-Type': 'application/json',
    }, options.headers || {});

    var fetchOpts = Object.assign({}, options, { headers: headers });

    // Don't send Content-Type for GET/HEAD
    if (!fetchOpts.method || fetchOpts.method === 'GET' || fetchOpts.method === 'HEAD') {
      if (!fetchOpts.body) {
        delete headers['Content-Type'];
      }
    }

    var response;
    try {
      response = await fetch('/api' + path, fetchOpts);
    } catch (err) {
      throw new Error('Network error: ' + err.message);
    }

    if (response.status === 401 || response.status === 403) {
      setApiKey('');
      showAuthPrompt('Invalid or expired API key. Please re-enter.');
      throw new Error('Authentication failed');
    }

    if (!response.ok) {
      var errBody;
      try {
        errBody = await response.json();
      } catch (_) {
        errBody = { error: response.statusText };
      }
      throw new Error(errBody.error || 'Request failed: ' + response.status);
    }

    return response.json();
  }

  // --- Auth Prompt Modal ---

  function showAuthPrompt(message) {
    // Remove existing prompt if any
    var existing = document.getElementById('auth-modal-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'auth-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML =
      '<div class="modal">' +
        '<div class="modal-header">' +
          '<h2>Authentication Required</h2>' +
        '</div>' +
        (message ? '<div class="alert alert-warning mb-md">' + escapeHtml(message) + '</div>' : '') +
        '<p class="text-secondary mb-md">Enter your admin API key to access the dashboard. This key starts with <code>sfh_admin_</code> and was displayed when you first started session-forge hub.</p>' +
        '<div class="form-group">' +
          '<label class="form-label" for="auth-key-input">Admin API Key</label>' +
          '<input type="password" id="auth-key-input" class="form-input" placeholder="sfh_admin_..." autocomplete="off">' +
        '</div>' +
        '<div class="modal-footer">' +
          '<button class="btn btn-primary" id="auth-submit-btn">Authenticate</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    var input = document.getElementById('auth-key-input');
    var submitBtn = document.getElementById('auth-submit-btn');

    input.focus();

    function handleSubmit() {
      var value = input.value.trim();
      if (!value) {
        input.style.borderColor = 'var(--color-red)';
        return;
      }
      if (!value.startsWith('sfh_admin_')) {
        input.style.borderColor = 'var(--color-red)';
        input.value = '';
        input.placeholder = 'Key must start with sfh_admin_...';
        return;
      }
      setApiKey(value);
      overlay.remove();
      // Reload current page to re-trigger data loading
      window.location.reload();
    }

    submitBtn.addEventListener('click', handleSubmit);
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') handleSubmit();
    });
  }

  // --- Date Formatting ---

  function formatDate(iso) {
    if (!iso) return 'N/A';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatDateShort(iso) {
    if (!iso) return 'N/A';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function timeAgo(iso) {
    if (!iso) return '';
    var now = Date.now();
    var then = new Date(iso).getTime();
    if (isNaN(then)) return '';

    var diff = Math.max(0, now - then);
    var seconds = Math.floor(diff / 1000);
    var minutes = Math.floor(seconds / 60);
    var hours = Math.floor(minutes / 60);
    var days = Math.floor(hours / 24);
    var weeks = Math.floor(days / 7);

    if (seconds < 10) return 'just now';
    if (seconds < 60) return seconds + ' seconds ago';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return minutes + ' minutes ago';
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return hours + ' hours ago';
    if (days === 1) return 'yesterday';
    if (days < 7) return days + ' days ago';
    if (weeks === 1) return '1 week ago';
    if (weeks < 5) return weeks + ' weeks ago';
    return formatDateShort(iso);
  }

  // --- XSS Protection ---

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    var s = String(str);
    var map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
    };
    return s.replace(/[&<>"']/g, function (c) {
      return map[c];
    });
  }

  // --- Init Auth ---

  function initAuth() {
    var key = getApiKey();
    if (!key) {
      showAuthPrompt();
      return false;
    }
    return true;
  }

  // --- Navigation Highlighting ---

  function initNavHighlight() {
    var currentPath = window.location.pathname;
    var filename = currentPath.split('/').pop() || 'index.html';
    if (filename === '' || filename === '/') filename = 'index.html';

    var links = document.querySelectorAll('.navbar-links a');
    links.forEach(function (link) {
      var href = link.getAttribute('href');
      if (!href) return;
      var linkFile = href.split('/').pop();
      if (linkFile === filename) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }

  // --- Mobile Nav Toggle ---

  function initMobileNav() {
    var hamburger = document.querySelector('.navbar-hamburger');
    var navLinks = document.querySelector('.navbar-links');
    if (!hamburger || !navLinks) return;

    hamburger.addEventListener('click', function () {
      navLinks.classList.toggle('open');
      var isOpen = navLinks.classList.contains('open');
      hamburger.textContent = isOpen ? '\u2715' : '\u2630';
    });

    // Close menu on link click
    navLinks.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        navLinks.classList.remove('open');
        hamburger.textContent = '\u2630';
      });
    });
  }

  // --- URL Params Helper ---

  function getUrlParam(name) {
    var params = new URLSearchParams(window.location.search);
    return params.get(name);
  }

  // --- Toast Notifications ---

  function showToast(message, type) {
    type = type || 'info';
    var toast = document.createElement('div');
    toast.className = 'alert alert-' + type;
    toast.style.cssText = 'position:fixed;bottom:1.5rem;right:1.5rem;z-index:300;max-width:400px;animation:slideUp 300ms ease;box-shadow:0 8px 30px rgba(0,0,0,0.5);';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 300ms ease';
      setTimeout(function () { toast.remove(); }, 300);
    }, 4000);
  }

  // --- Navbar HTML Generator ---

  function getNavbarHTML() {
    return '' +
      '<nav class="navbar">' +
        '<div class="navbar-inner">' +
          '<a href="index.html" class="navbar-brand">' +
            '<span class="brand-icon">S</span>' +
            'session-forge hub' +
          '</a>' +
          '<button class="navbar-hamburger" aria-label="Toggle navigation">&#9776;</button>' +
          '<div class="navbar-links">' +
            '<a href="index.html">Overview</a>' +
            '<a href="agents.html">Agents</a>' +
            '<a href="activity.html">Activity</a>' +
            '<a href="search.html">Search</a>' +
            '<a href="reports.html">Reports</a>' +
            '<a href="sync.html">Sync</a>' +
            '<a href="security.html">Security</a>' +
            '<a href="donate.html">Donate</a>' +
          '</div>' +
        '</div>' +
      '</nav>';
  }

  // --- DOMContentLoaded bootstrap ---

  document.addEventListener('DOMContentLoaded', function () {
    initNavHighlight();
    initMobileNav();
  });

  // --- Expose to global scope ---

  window.SFH = {
    getApiKey: getApiKey,
    setApiKey: setApiKey,
    apiFetch: apiFetch,
    showAuthPrompt: showAuthPrompt,
    formatDate: formatDate,
    formatDateShort: formatDateShort,
    timeAgo: timeAgo,
    escapeHtml: escapeHtml,
    initAuth: initAuth,
    getUrlParam: getUrlParam,
    showToast: showToast,
    getNavbarHTML: getNavbarHTML,
  };

})();
