# 메홍키덜트샾 커머스 API

네이버 스마트스토어의 커머스 API(네이버 커머스 API)와 비슷한 경로/인증/응답 구조로 만든
이 쇼핑몰 전용 REST API입니다. Supabase Edge Function으로 구현되어 있으며, 소스코드는
[`supabase/functions/commerce-api/index.ts`](supabase/functions/commerce-api/index.ts)에 있습니다.

Base URL:
```
https://hjihbwbjvzyyolcbprzh.supabase.co/functions/v1/commerce-api
```

⚠️ **client_id / client_secret / access_token은 이 문서에 올리지 않습니다.** (공개 저장소이기 때문)
실제 값은 Supabase 프로젝트의 Edge Function 비밀값(Secrets)에 `API_CLIENT_ID`, `API_CLIENT_SECRET`,
`API_ACCESS_TOKEN`으로 저장되어 있습니다. Supabase 대시보드 → Edge Functions → Secrets에서 확인하세요.

## 1. 토큰 발급 (OAuth2 client_credentials 스타일)

```
POST /v1/auth/token
Content-Type: application/json

{ "client_id": "...", "client_secret": "..." }
```

응답:
```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "expires_in": 10800,
  "scope": "products:read orders:read"
}
```

## 2. 상품 검색 (인증 불필요)

```
GET /v1/products/search?category=lemans&keyword=르망&page=1&size=20
```

- `category`: `rc` | `plamo` | `figure` | `lemans` (생략 시 전체)
- `keyword`: 상품명 부분 검색 (생략 가능)
- `page`, `size`: 페이지네이션 (기본 1 / 20, 최대 size 100)

응답(네이버 스타일 페이지 포맷):
```json
{
  "page": 1,
  "size": 20,
  "totalElements": 6,
  "totalPages": 1,
  "contents": [
    {
      "originProductNo": "porsche917",
      "categoryName": "lemans",
      "name": "포르쉐 917K 르망 우승 (1970) 프라모델",
      "salePrice": 68000,
      "regularPrice": 85000,
      "stockQuantity": 999,
      "saleStatusType": "SALE",
      "representativeImage": { "url": "https://..." }
    }
  ]
}
```

## 3. 상품 상세 (인증 불필요)

```
GET /v1/products/origin-products/{slug}
```
`{slug}`는 상품 목록 응답의 `originProductNo` 값입니다(예: `genesis-gmr001-19`).

## 4. 판매자 전용 주문 조회 (Bearer 토큰 필요)

```
GET /v1/pay-order/seller/product-orders?status=placed&page=1&size=20
Authorization: Bearer {access_token}
```

Supabase의 `orders` 테이블은 로그인한 본인 주문만 조회 가능하도록 RLS가 걸려 있어
지금까지는 "전체 주문"을 조회할 방법이 없었습니다. 이 엔드포인트는 Edge Function 안에서만
사용하는 service_role 키로 **모든 주문을 판매자 권한으로 조회**합니다(브라우저에는 service_role
키가 절대 노출되지 않습니다 — Bearer 토큰 검증을 통과해야만 호출됩니다).

응답 예시:
```json
{
  "page": 1,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1,
  "contents": [
    {
      "productOrderId": 3,
      "productOrderStatus": "placed",
      "receiverName": "홍길동",
      "receiverTel1": "010-1234-5678",
      "deliveryAddress": "서울시 ...",
      "totalPaymentAmount": 68000,
      "productAmount": 68000,
      "deliveryFeeAmount": 0,
      "items": [{ "name": "포르쉐 917K 르망 우승 (1970) 프라모델", "price": 68000, "qty": 1 }],
      "orderDate": "2026-10-17T05:56:56Z"
    }
  ]
}
```

## 오류 응답 포맷

```json
{ "code": "GW.INVALID_TOKEN", "message": "유효하지 않은 액세스 토큰입니다.", "traceId": "..." }
```

| code | 상황 |
|---|---|
| `GW.INVALID_CLIENT` | client_id/client_secret 불일치 |
| `GW.INVALID_TOKEN` | Bearer 토큰 누락/불일치 |
| `GW.NO_RESOURCE` | 존재하지 않는 상품 slug |
| `GW.NOT_FOUND` | 정의되지 않은 경로 |
| `GW.DB_ERROR` / `GW.INTERNAL_ERROR` | 서버 내부 오류 |

## 배포/수정 방법

Supabase Management API로 배포했습니다(Supabase CLI 없이):
```
PATCH https://api.supabase.com/v1/projects/{project_ref}/functions/commerce-api
Authorization: Bearer {Supabase 개인 액세스 토큰}
Content-Type: application/json

{ "slug": "commerce-api", "verify_jwt": false, "entrypoint_path": "index.ts", "body": "<전체 소스코드>" }
```
코드를 수정한 뒤 같은 요청을 다시 보내면 새 버전으로 재배포됩니다.
