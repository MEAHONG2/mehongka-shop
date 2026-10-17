// ===== 메홍키덜트샾 공용 상품 데이터 모듈 =====
// Supabase products 테이블에서 상품을 불러와 카테고리 페이지 카드 렌더링과
// 검색 기능에 사용한다. supabase-config.js(supabaseClient)가 먼저 로드되어 있어야 한다.
(function () {
  var cache = null;

  async function getAllProducts() {
    if (cache) return cache;
    const { data, error } = await supabaseClient
      .from('products')
      .select('*')
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true });
    if (error) {
      console.error('상품을 불러오지 못했습니다:', error.message);
      cache = [];
    } else {
      cache = data || [];
    }
    return cache;
  }

  function productUrl(p) {
    return p.category + '.html#' + p.slug;
  }

  // 르망24 상품은 제네시스 마그마 레이싱 테마 배지를 붙인다.
  function raceBadgeFor(p) {
    if (p.category !== 'lemans') return '';
    const label = p.slug.indexOf('genesis') === 0 ? 'MAGMA ED.' : 'RACE READY';
    return '<span class="race-badge">' + label + '</span>';
  }

  function productCardHtml(p) {
    const isLemans = p.category === 'lemans';
    return (
      '<div class="card' + (isLemans ? ' magma-card' : '') + '" id="' + p.slug + '">' +
      '<div class="img-wrap">' +
      raceBadgeFor(p) +
      '<img class="product-img" src="' + p.image_url + '" alt="' + p.name + '">' +
      (p.sold_out ? '<span class="sold-out">품절</span>' : '') +
      '<button class="wish-btn" onclick="toggleWish(this)">🤍</button>' +
      '</div>' +
      '<h3>' + p.name + '</h3>' +
      '<div class="old-price">' + p.old_price.toLocaleString() + '원</div>' +
      '<div class="price">' + p.price.toLocaleString() + '원</div>' +
      '<button onclick="addToCart(\'' + p.name.replace(/'/g, "\\'") + '\', ' + p.price + ')">담기</button>' +
      (isLemans ? '<div class="magma-card-divider"></div>' : '') +
      '</div>'
    );
  }

  // 특정 카테고리의 상품을 불러와 containerId 요소 안에 카드로 렌더링한다.
  window.renderCategoryProducts = async function (category, containerId) {
    const all = await getAllProducts();
    const list = all.filter(function (p) { return p.category === category; });
    const container = document.getElementById(containerId);
    if (!container) return;
    if (list.length === 0) {
      container.innerHTML = '<p style="color:#888;grid-column:1/-1;">등록된 상품이 없습니다. (Supabase products 테이블을 확인해주세요)</p>';
      return;
    }
    container.innerHTML = list.map(productCardHtml).join('');
  };

  // 카테고리별 대표 상품(정렬순서가 가장 앞선 상품) 1개씩을 "인기상품"으로 보여준다.
  window.renderPopularProducts = async function (containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const all = await getAllProducts();
    if (all.length === 0) {
      container.textContent = '상품 정보를 불러오지 못했습니다.';
      return;
    }
    const emojiMap = { rc: '🚗', plamo: '🤖', figure: '🦸' };
    const bestByCategory = {};
    all.forEach(function (p) {
      if (!bestByCategory[p.category] || p.sort_order < bestByCategory[p.category].sort_order) {
        bestByCategory[p.category] = p;
      }
    });
    const picks = Object.keys(bestByCategory).map(function (cat) { return bestByCategory[cat]; });
    container.innerHTML = picks.map(function (p) {
      return (emojiMap[p.category] || '🛒') + ' ' + p.name + ' - ' + p.price.toLocaleString() + '원';
    }).join('<br>');
  };

  window.getAllProducts = getAllProducts;
  window.productUrl = productUrl;
})();
