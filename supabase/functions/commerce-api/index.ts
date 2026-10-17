// ===== 메홍키덜트샾 커머스 API (네이버 커머스 API 스타일) =====
// Supabase Edge Function. 엔드포인트는 네이버 스마트스토어 커머스 API의 경로/응답
// 포맷을 참고해 설계했다 (OAuth2 client_credentials 토큰 발급 -> Bearer 인증 ->
// 상품 검색/상세 -> 판매자 전용 주문 조회).
//
// 실제 네이버 API와는 무관한 독립 구현이며, 이 쇼핑몰 자체 상품/주문 데이터를
// 외부에서 프로그래밍 방식으로 조회할 수 있게 하는 것이 목적이다.

import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const API_CLIENT_ID = Deno.env.get('API_CLIENT_ID') ?? ''
const API_CLIENT_SECRET = Deno.env.get('API_CLIENT_SECRET') ?? ''
const API_ACCESS_TOKEN = Deno.env.get('API_ACCESS_TOKEN') ?? ''

// service_role 키는 이 서버리스 함수 안에서만 쓰이고 브라우저로는 절대 나가지 않는다.
const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-id, x-client-secret, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'content-type': 'application/json; charset=utf-8' },
  })
}

function errorEnvelope(code: string, message: string, status: number) {
  // 네이버 커머스 API 오류 응답 포맷(code/message)을 그대로 따른다.
  return json({ code, message, traceId: crypto.randomUUID() }, status)
}

function requireBearer(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '')
  return token && token === API_ACCESS_TOKEN
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS })

  const url = new URL(req.url)
  // 함수 자체 경로 프리픽스(/commerce-api)를 제거하고 네이버 스타일 경로만 남긴다.
  const path = url.pathname.replace(/^\/commerce-api/, '') || '/'

  try {
    // ---------- 1) OAuth2 토큰 발급 ----------
    // POST /v1/auth/token  body: { client_id, client_secret } (또는 x-client-id/x-client-secret 헤더)
    if (path === '/v1/auth/token' && req.method === 'POST') {
      let clientId = req.headers.get('x-client-id') ?? ''
      let clientSecret = req.headers.get('x-client-secret') ?? ''
      if (!clientId || !clientSecret) {
        const body = await req.json().catch(() => ({}))
        clientId = body.client_id ?? clientId
        clientSecret = body.client_secret ?? clientSecret
      }
      if (clientId !== API_CLIENT_ID || clientSecret !== API_CLIENT_SECRET) {
        return errorEnvelope('GW.INVALID_CLIENT', 'client_id 또는 client_secret이 올바르지 않습니다.', 401)
      }
      return json({
        access_token: API_ACCESS_TOKEN,
        token_type: 'Bearer',
        expires_in: 10800,
        scope: 'products:read orders:read',
      })
    }

    // ---------- 2) 상품 검색 ----------
    // GET /v1/products/search?category=rc&keyword=RC&page=1&size=20
    if (path === '/v1/products/search' && req.method === 'GET') {
      const category = url.searchParams.get('category')
      const keyword = url.searchParams.get('keyword')
      const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
      const size = Math.min(100, Math.max(1, Number(url.searchParams.get('size') ?? '20')))

      let query = db.from('products').select('*', { count: 'exact' }).order('category').order('sort_order')
      if (category) query = query.eq('category', category)
      if (keyword) query = query.ilike('name', `%${keyword}%`)
      query = query.range((page - 1) * size, page * size - 1)

      const { data, error, count } = await query
      if (error) return errorEnvelope('GW.DB_ERROR', error.message, 500)

      return json({
        page,
        size,
        totalElements: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / size),
        contents: (data ?? []).map(toNaverProduct),
      })
    }

    // ---------- 3) 상품 상세 ----------
    // GET /v1/products/origin-products/{slug}   (네이버의 originProductNo 자리에 slug 사용)
    const detailMatch = path.match(/^\/v1\/products\/origin-products\/([^/]+)$/)
    if (detailMatch && req.method === 'GET') {
      const slug = decodeURIComponent(detailMatch[1])
      const { data, error } = await db.from('products').select('*').eq('slug', slug).maybeSingle()
      if (error) return errorEnvelope('GW.DB_ERROR', error.message, 500)
      if (!data) return errorEnvelope('GW.NO_RESOURCE', '해당 상품을 찾을 수 없습니다.', 404)
      return json(toNaverProduct(data))
    }

    // ---------- 4) 판매자 전용 주문 조회 (Bearer 토큰 필요) ----------
    // GET /v1/pay-order/seller/product-orders?status=placed&page=1&size=20
    if (path === '/v1/pay-order/seller/product-orders' && req.method === 'GET') {
      if (!requireBearer(req)) {
        return errorEnvelope('GW.INVALID_TOKEN', '유효하지 않은 액세스 토큰입니다.', 401)
      }
      const status = url.searchParams.get('status')
      const page = Math.max(1, Number(url.searchParams.get('page') ?? '1'))
      const size = Math.min(100, Math.max(1, Number(url.searchParams.get('size') ?? '20')))

      let query = db.from('orders').select('*', { count: 'exact' }).order('created_at', { ascending: false })
      if (status) query = query.eq('status', status)
      query = query.range((page - 1) * size, page * size - 1)

      const { data, error, count } = await query
      if (error) return errorEnvelope('GW.DB_ERROR', error.message, 500)

      return json({
        page,
        size,
        totalElements: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / size),
        contents: (data ?? []).map(toNaverOrder),
      })
    }

    // ---------- 그 외: 안내 ----------
    if (path === '/' || path === '') {
      return json({
        name: '메홍키덜트샾 커머스 API',
        version: 'v1',
        endpoints: [
          'POST /v1/auth/token',
          'GET  /v1/products/search?category=&keyword=&page=&size=',
          'GET  /v1/products/origin-products/{slug}',
          'GET  /v1/pay-order/seller/product-orders (Bearer 필요)',
        ],
      })
    }

    return errorEnvelope('GW.NOT_FOUND', '요청하신 경로를 찾을 수 없습니다.', 404)
  } catch (e) {
    return errorEnvelope('GW.INTERNAL_ERROR', String(e?.message ?? e), 500)
  }
})

// 우리 products 테이블 -> 네이버 커머스 API 느낌의 응답 필드명으로 매핑
function toNaverProduct(p: Record<string, unknown>) {
  return {
    originProductNo: p.slug,
    categoryName: p.category,
    name: p.name,
    salePrice: p.price,
    regularPrice: p.old_price,
    stockQuantity: p.sold_out ? 0 : 999,
    saleStatusType: p.sold_out ? 'OUTOFSTOCK' : 'SALE',
    representativeImage: { url: p.image_url },
  }
}

// 우리 orders 테이블 -> 네이버 판매자 주문조회 API 느낌의 응답 필드명으로 매핑
function toNaverOrder(o: Record<string, unknown>) {
  return {
    productOrderId: o.id,
    productOrderStatus: o.status,
    receiverName: o.recipient_name,
    receiverTel1: o.phone,
    deliveryAddress: o.address,
    totalPaymentAmount: o.grand_total,
    productAmount: o.product_total,
    deliveryFeeAmount: o.shipping_fee,
    items: o.items,
    orderDate: o.created_at,
  }
}
