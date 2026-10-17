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
      '#authStatus .auth-email{font-size:13px;color:#d4af37;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
      '#authStatus .auth-logout-btn{background:none;border:1px solid #555;color:#ccc;padding:5px 10px;border-radius:6px;font-size:12px;cursor:pointer;font-family:inherit;}' +
      '#authStatus .auth-logout-btn:hover{border-color:#d4af37;color:#d4af37;}';
    document.head.appendChild(style);
  }

  function renderLoggedOut() {
    var el = document.getElementById('authStatus');
    if (el) el.innerHTML = '';
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function renderLoggedIn(user) {
    var el = document.getElementById('authStatus');
    if (!el) return;
    var name = user.user_metadata && user.user_metadata.name;
    var label = name ? (name + '님') : user.email;
    el.innerHTML =
      '<span class="auth-email" title="' + escapeHtml(user.email) + '">' + escapeHtml(label) + '</span>' +
      '<button class="auth-logout-btn" onclick="handleLogout()">로그아웃</button>';
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
