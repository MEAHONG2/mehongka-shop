// ===== 메홍키덜트샾 공용 장바구니 모듈 =====
// localStorage에 상품명/가격/수량을 저장해서 모든 페이지(index/rc/plamo/figure)에서 공유한다.
(function () {
  var SHIPPING_FEE = 3000;           // 기본 배송비
  var FREE_SHIPPING_THRESHOLD = 50000; // 이 금액 이상이면 무료배송

  function getCart() {
    try {
      return JSON.parse(localStorage.getItem('cart') || '[]');
    } catch (e) {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem('cart', JSON.stringify(cart));
  }

  function getCartCount() {
    return getCart().reduce(function (sum, item) { return sum + item.qty; }, 0);
  }

  function updateCartBadge() {
    var el = document.getElementById('cartCount');
    if (el) el.textContent = getCartCount();
  }

  function formatWon(n) {
    return n.toLocaleString('ko-KR') + '원';
  }

  // 상품을 장바구니에 담기 (이름, 가격). cart.html 등 다른 페이지가 열려 있으면
  // window.onCartChange 훅을 통해 화면을 다시 그릴 수 있게 한다.
  window.addToCart = function (name, price) {
    var cart = getCart();
    var existing = cart.find(function (i) { return i.name === name; });
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ name: name, price: price, qty: 1 });
    }
    saveCart(cart);
    updateCartBadge();
    if (window.onCartChange) window.onCartChange();
    alert(name + '를 장바구니에 담았습니다!');
  };

  // 장바구니에서 품목 제거
  window.removeFromCart = function (name) {
    var cart = getCart().filter(function (i) { return i.name !== name; });
    saveCart(cart);
    updateCartBadge();
    if (window.onCartChange) window.onCartChange();
  };

  // 수량 +/- 조절 (delta: +1 또는 -1). 0 이하가 되면 자동 삭제.
  window.changeQty = function (name, delta) {
    var cart = getCart();
    var item = cart.find(function (i) { return i.name === name; });
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
      cart = cart.filter(function (i) { return i.name !== name; });
    }
    saveCart(cart);
    updateCartBadge();
    if (window.onCartChange) window.onCartChange();
  };

  // 장바구니 전체 비우기
  window.clearCart = function () {
    saveCart([]);
    updateCartBadge();
    if (window.onCartChange) window.onCartChange();
  };

  window.getCart = getCart;
  window.getCartCount = getCartCount;
  window.formatWon = formatWon;
  window.SHIPPING_FEE = SHIPPING_FEE;
  window.FREE_SHIPPING_THRESHOLD = FREE_SHIPPING_THRESHOLD;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateCartBadge);
  } else {
    updateCartBadge();
  }
})();
