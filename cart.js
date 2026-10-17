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

  // 상품을 장바구니에 담기 (이름, 가격)
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
    renderCartList();
    alert(name + '를 장바구니에 담았습니다!');
  };

  // 장바구니에서 품목 제거
  window.removeFromCart = function (name) {
    var cart = getCart().filter(function (i) { return i.name !== name; });
    saveCart(cart);
    updateCartBadge();
    renderCartList();
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
    renderCartList();
  };

  function buildModal() {
    if (document.getElementById('cartModalOverlay')) return;

    var style = document.createElement('style');
    style.textContent =
      '#cartModalOverlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:200;align-items:center;justify-content:center;}' +
      '#cartModalOverlay.active{display:flex;}' +
      '#cartModal{background:#1a1a1a;color:#eee;border:1px solid #d4af37;border-radius:14px;width:380px;max-width:90vw;max-height:80vh;overflow-y:auto;padding:26px;box-shadow:0 10px 40px rgba(0,0,0,0.6);}' +
      '#cartModal h2{font-family:"Nanum Myeongjo",serif;color:#d4af37;margin-bottom:16px;font-size:21px;}' +
      '#cartModal .cart-item{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #333;font-size:14px;gap:8px;}' +
      '#cartModal .cart-item .item-name{font-weight:bold;color:#fff;}' +
      '#cartModal .cart-item .item-qty{color:#aaa;font-size:12px;margin-top:3px;}' +
      '#cartModal .cart-item .item-right{display:flex;align-items:center;gap:10px;}' +
      '#cartModal .qty-control{display:flex;align-items:center;gap:6px;}' +
      '#cartModal .qty-btn{width:22px;height:22px;border:1px solid #555;border-radius:5px;background:#0f0f0f;color:#d4af37;font-size:14px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;}' +
      '#cartModal .qty-btn:hover{border-color:#d4af37;}' +
      '#cartModal .qty-num{min-width:18px;text-align:center;font-size:13px;color:#fff;}' +
      '#cartModal .cart-item .item-remove{background:none;border:none;color:#888;cursor:pointer;font-size:16px;padding:4px;}' +
      '#cartModal .cart-item .item-remove:hover{color:#e23b3b;}' +
      '#cartModal .cart-empty{text-align:center;color:#888;padding:30px 0;font-size:14px;}' +
      '#cartModal .cart-summary{margin-top:16px;border-top:1px solid #d4af37;padding-top:12px;font-size:14px;}' +
      '#cartModal .cart-summary div{display:flex;justify-content:space-between;margin-bottom:6px;color:#ccc;}' +
      '#cartModal .cart-summary .grand-total{font-weight:bold;color:#d4af37;font-size:18px;margin-top:8px;border-top:1px dashed #555;padding-top:10px;}' +
      '#cartModal .cart-close{margin-top:18px;width:100%;background:#d4af37;color:#111;border:none;padding:11px;border-radius:7px;font-weight:bold;cursor:pointer;font-size:15px;}' +
      '#cartModal .cart-close:hover{opacity:0.85;}';
    document.head.appendChild(style);

    var overlay = document.createElement('div');
    overlay.id = 'cartModalOverlay';
    overlay.innerHTML =
      '<div id="cartModal">' +
      '<h2>🛒 장바구니</h2>' +
      '<div id="cartItemsBox"></div>' +
      '<div class="cart-summary" id="cartSummaryBox"></div>' +
      '<button class="cart-close" onclick="closeCart()">닫기</button>' +
      '</div>';
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeCart();
    });
    document.body.appendChild(overlay);
  }

  function renderCartList() {
    var itemsBox = document.getElementById('cartItemsBox');
    var summaryBox = document.getElementById('cartSummaryBox');
    if (!itemsBox || !summaryBox) return;

    var cart = getCart();
    if (cart.length === 0) {
      itemsBox.innerHTML = '<div class="cart-empty">장바구니가 비어 있습니다.</div>';
      summaryBox.innerHTML = '';
      return;
    }

    itemsBox.innerHTML = cart.map(function (item) {
      return (
        '<div class="cart-item">' +
        '<div><div class="item-name">' + item.name + '</div>' +
        '<div class="item-qty">' + formatWon(item.price) + ' x ' + item.qty + ' = ' + formatWon(item.price * item.qty) + '</div></div>' +
        '<div class="item-right">' +
        '<div class="qty-control">' +
        '<button class="qty-btn" onclick="changeQty(\'' + item.name + '\', -1)">−</button>' +
        '<span class="qty-num">' + item.qty + '</span>' +
        '<button class="qty-btn" onclick="changeQty(\'' + item.name + '\', 1)">+</button>' +
        '</div>' +
        '<button class="item-remove" onclick="removeFromCart(\'' + item.name + '\')">✕</button>' +
        '</div>' +
        '</div>'
      );
    }).join('');

    var productTotal = cart.reduce(function (sum, item) { return sum + item.price * item.qty; }, 0);
    var shipping = productTotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE;
    var grandTotal = productTotal + shipping;

    summaryBox.innerHTML =
      '<div><span>상품 합계</span><span>' + formatWon(productTotal) + '</span></div>' +
      '<div><span>배송비</span><span>' + (shipping === 0 ? '무료' : formatWon(shipping)) + '</span></div>' +
      '<div class="grand-total"><span>총 결제금액</span><span>' + formatWon(grandTotal) + '</span></div>';
  }

  window.openCart = function () {
    buildModal();
    renderCartList();
    document.getElementById('cartModalOverlay').classList.add('active');
  };

  window.closeCart = function () {
    var overlay = document.getElementById('cartModalOverlay');
    if (overlay) overlay.classList.remove('active');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateCartBadge);
  } else {
    updateCartBadge();
  }
})();
