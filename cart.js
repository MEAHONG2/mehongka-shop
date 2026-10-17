// ===== 메홍키덜트샾 공용 장바구니 모듈 =====
// 로그인한 사용자는 Supabase cart_items 테이블에 저장되어 기기/브라우저가 달라도
// 같은 장바구니를 본다. 로그인 전에는 localStorage에 임시(게스트) 저장되고,
// 로그인하는 순간 게스트 장바구니가 자동으로 계정 장바구니에 합쳐진다.
(function () {
  var SHIPPING_FEE = 3000;             // 기본 배송비
  var FREE_SHIPPING_THRESHOLD = 50000; // 이 금액 이상이면 무료배송
  var TABLE = 'cart_items';
  var migratedForUser = null; // 이미 마이그레이션한 사용자 id (중복 마이그레이션 방지)

  function getLocalCart() {
    try {
      return JSON.parse(localStorage.getItem('cart') || '[]');
    } catch (e) {
      return [];
    }
  }
  function saveLocalCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
  }

  async function getUserId() {
    const { data } = await supabaseClient.auth.getSession();
    return (data && data.session && data.session.user) ? data.session.user.id : null;
  }

  async function getDbCart(uid) {
    const { data, error } = await supabaseClient
      .from(TABLE).select('*').eq('user_id', uid).order('id', { ascending: true });
    if (error) {
      console.error('장바구니를 불러오지 못했습니다:', error.message);
      return [];
    }
    return (data || []).map(function (r) {
      return { name: r.product_name, price: r.price, qty: r.qty };
    });
  }

  // 로그인 전 localStorage에 담겨 있던 게스트 장바구니를 계정 장바구니로 합친다.
  async function migrateLocalCartIfNeeded(uid) {
    if (migratedForUser === uid) return;
    migratedForUser = uid;
    const local = getLocalCart();
    if (local.length === 0) return;
    for (const item of local) {
      await upsertAddQty(uid, item.name, item.price, item.qty);
    }
    saveLocalCart([]);
  }

  // 품목이 이미 있으면 수량을 addQty만큼 더하고, 없으면 새로 추가한다.
  async function upsertAddQty(uid, name, price, addQty) {
    const { data: existing } = await supabaseClient
      .from(TABLE).select('id, qty').eq('user_id', uid).eq('product_name', name).maybeSingle();
    if (existing) {
      await supabaseClient.from(TABLE)
        .update({ qty: existing.qty + addQty, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      await supabaseClient.from(TABLE)
        .insert({ user_id: uid, product_name: name, price: price, qty: addQty });
    }
  }

  // 이미 있는 품목의 수량을 delta만큼 조절 (0 이하가 되면 삭제)
  async function adjustQtyDb(uid, name, delta) {
    const { data: existing } = await supabaseClient
      .from(TABLE).select('id, qty').eq('user_id', uid).eq('product_name', name).maybeSingle();
    if (!existing) return;
    const newQty = existing.qty + delta;
    if (newQty <= 0) {
      await supabaseClient.from(TABLE).delete().eq('id', existing.id);
    } else {
      await supabaseClient.from(TABLE)
        .update({ qty: newQty, updated_at: new Date().toISOString() }).eq('id', existing.id);
    }
  }

  async function deleteDbItem(uid, name) {
    await supabaseClient.from(TABLE).delete().eq('user_id', uid).eq('product_name', name);
  }

  async function clearDbCart(uid) {
    await supabaseClient.from(TABLE).delete().eq('user_id', uid);
  }

  function formatWon(n) {
    return n.toLocaleString('ko-KR') + '원';
  }

  // 로그인 여부에 따라 Supabase(cart_items) 또는 localStorage에서 장바구니를 가져온다.
  window.getCart = async function () {
    const uid = await getUserId();
    if (uid) {
      await migrateLocalCartIfNeeded(uid);
      return await getDbCart(uid);
    }
    return getLocalCart();
  };

  window.getCartCount = async function () {
    const cart = await window.getCart();
    return cart.reduce(function (sum, item) { return sum + item.qty; }, 0);
  };

  window.updateCartBadge = async function () {
    const el = document.getElementById('cartCount');
    if (!el) return;
    el.textContent = await window.getCartCount();
  };

  // 상품을 장바구니에 담기 (이름, 가격). cart.html 등 다른 페이지가 열려 있으면
  // window.onCartChange 훅을 통해 화면을 다시 그릴 수 있게 한다.
  window.addToCart = async function (name, price) {
    const uid = await getUserId();
    if (uid) {
      await migrateLocalCartIfNeeded(uid);
      await upsertAddQty(uid, name, price, 1);
    } else {
      const cart = getLocalCart();
      const existing = cart.find(function (i) { return i.name === name; });
      if (existing) {
        existing.qty += 1;
      } else {
        cart.push({ name: name, price: price, qty: 1 });
      }
      saveLocalCart(cart);
    }
    await window.updateCartBadge();
    if (window.onCartChange) window.onCartChange();
    alert(name + '를 장바구니에 담았습니다!');
  };

  // 장바구니에서 품목 제거
  window.removeFromCart = async function (name) {
    const uid = await getUserId();
    if (uid) {
      await deleteDbItem(uid, name);
    } else {
      saveLocalCart(getLocalCart().filter(function (i) { return i.name !== name; }));
    }
    await window.updateCartBadge();
    if (window.onCartChange) window.onCartChange();
  };

  // 수량 +/- 조절 (delta: +1 또는 -1). 0 이하가 되면 자동 삭제.
  window.changeQty = async function (name, delta) {
    const uid = await getUserId();
    if (uid) {
      await adjustQtyDb(uid, name, delta);
    } else {
      const cart = getLocalCart();
      const item = cart.find(function (i) { return i.name === name; });
      if (item) {
        item.qty += delta;
        if (item.qty <= 0) {
          cart.splice(cart.indexOf(item), 1);
        }
      }
      saveLocalCart(cart);
    }
    await window.updateCartBadge();
    if (window.onCartChange) window.onCartChange();
  };

  // 장바구니 전체 비우기
  window.clearCart = async function () {
    const uid = await getUserId();
    if (uid) {
      await clearDbCart(uid);
    } else {
      saveLocalCart([]);
    }
    await window.updateCartBadge();
    if (window.onCartChange) window.onCartChange();
  };

  window.formatWon = formatWon;
  window.SHIPPING_FEE = SHIPPING_FEE;
  window.FREE_SHIPPING_THRESHOLD = FREE_SHIPPING_THRESHOLD;

  // 로그인/로그아웃 시 배지와 (열려 있다면) 장바구니 화면을 다시 그린다.
  supabaseClient.auth.onAuthStateChange(function () {
    window.updateCartBadge();
    if (window.onCartChange) window.onCartChange();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { window.updateCartBadge(); });
  } else {
    window.updateCartBadge();
  }
})();
