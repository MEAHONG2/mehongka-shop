// ===== Supabase 연결 설정 (메홍키덜트샾 공용) =====
// SUPABASE_KEY는 publishable(anon) 키로, 클라이언트(브라우저)에 노출되어도 되도록
// 설계된 키입니다. 실제 데이터 접근 권한은 Supabase 쪽 Row Level Security(RLS)
// 정책으로 통제합니다. service_role 키 등 비밀 키는 절대 여기 넣지 마세요.
const SUPABASE_URL = 'https://hjihbwbjvzyyolcbprzh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_sJZYecJy4wtmsorb1akjug_ZOD1rh0X';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
