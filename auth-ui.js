// ===== 메홍키덜트샾 공용 로그인 상태 표시 모듈 =====
// header-right 안의 #authStatus 요소에 로그인한 사용자의 이메일과 로그아웃 버튼을 보여준다.
// supabase-config.js(supabaseClient)가 먼저 로드되어 있어야 한다.
(function () {
  function injectStyle() {
    if (document.getElementById('authUiStyle')) return;
    var style = document.createElement('style');
    style.id = 'authUiStyle';
    style.textContent =
      '#authStatus{display:flex;align-items:center;gap:8px;}' +
      '#authStatus .auth-email{font-size:13px;color:#ff1e1e;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '#authStatus .auth-logout-btn{background:none;border:1px solid #555;color:#ccc;padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer;font-family:inherit;}' +
      '#authStatus .auth-logout-btn:hover{border-color:#ff1e1e;color:#ff1e1e;}';
    document.head.appendChild(style);
  }

  function renderLoggedOut() {
    var el = document.getElementById('authStatus');
    if (el) el.innerHTML = '';

    // 상단 메뉴의 "로그인" 자리를 원래대로 되돌린다.
    var navLink = document.getElementById('navAuthLink');
    if (navLink) {
      navLink.textContent = '로그인';
      navLink.href = 'login.html';
      navLink.removeAttribute('onclick');
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderLoggedIn(user) {
    var name = user.user_metadata && user.user_metadata.name;
    var label = name ? (name + '님') : user.email;

    var el = document.getElementById('authStatus');
    if (el) {
      el.innerHTML =
        '<span class="auth-email" title="' + escapeHtml(user.email) + '">' + escapeHtml(label) + '</span>' +
        '<button class="auth-logout-btn" onclick="handleLogout()">로그아웃</button>';
    }

    // 상단 메뉴의 "로그인" 자리에 고객 이름을 보여준다 (클릭하면 로그아웃).
    var navLink = document.getElementById('navAuthLink');
    if (navLink) {
      navLink.textContent = label;
      navLink.href = '#';
      navLink.setAttribute('onclick', 'handleLogout(); return false;');
    }
  }

  async function refreshAuthUI() {
    injectStyle();
    var result = await supabaseClient.auth.getSession();
    var session = result && result.data && result.data.session;
    if (session && session.user) {
      renderLoggedIn(session.user);
    } else {
      renderLoggedOut();
    }
  }

  window.handleLogout = async function () {
    await supabaseClient.auth.signOut();
    location.href = 'index.html';
  };

  supabaseClient.auth.onAuthStateChange(function () {
    refreshAuthUI();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', refreshAuthUI);
  } else {
    refreshAuthUI();
  }
})();
