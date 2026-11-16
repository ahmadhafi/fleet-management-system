import { useEffect, useState } from 'react';

export type SupportedLang = 'en' | 'id' | 'ko';

export interface LanguageOption {
  code: SupportedLang;
  short: string;
  label: string;
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en', short: 'EN', label: 'English' },
  { code: 'id', short: 'ID', label: 'Indonesia' },
  { code: 'ko', short: 'KO', label: '한국어' },
];

/**
 * Comprehensive Enterprise Translation Dictionary
 * Maps English phrases to Bahasa Indonesia and Korean.
 */
export const DICTIONARY: Record<string, { id: string; ko: string }> = {
  // Navigation & Shell
  'Home': { id: 'Beranda', ko: '홈' },
  'Activity': { id: 'Aktivitas', ko: '활동' },
  'Inbox': { id: 'Kotak Masuk', ko: '수신함' },
  'Profile': { id: 'Profil', ko: '프로필' },
  'Dispatch': { id: 'Disposisi', ko: '배차' },
  'Admin': { id: 'Admin', ko: '관리자' },
  'Sign Out': { id: 'Keluar', ko: '로그아웃' },
  'Sign In': { id: 'Masuk', ko: '로그인' },
  'Main application tabs': { id: 'Tab navigasi utama', ko: '주요 탭' },
  'Admin Console': { id: 'Konsol Admin', ko: '관리자 콘솔' },
  'Operational Vehicles': { id: 'Kendaraan Operasional', ko: '운행 차량' },
  'Groups': { id: 'Grup', ko: '그룹' },
  'Currency: IDR (Rp)': { id: 'Mata Uang: IDR (Rp)', ko: '통화: IDR (Rp)' },
  'My Account Profile & Change Password': { id: 'Profil Akun Saya & Ganti Kata Sandi', ko: '내 계정 프로필 및 비밀번호 변경' },
  'My Profile & Change Password': { id: 'Profil Saya & Ganti Kata Sandi', ko: '내 프로필 및 비밀번호 변경' },

  // Map Controls & Overlays
  'Streets': { id: 'Jalan', ko: '일반지도' },
  'Satellite': { id: 'Satelit', ko: '위성' },
  'Terrain': { id: 'Topografi', ko: '지형' },
  'Locate Me': { id: 'Lokasi Saya', ko: '내 위치' },
  'Detect & center on my location': { id: 'Deteksi & pusatkan lokasi saya', ko: '내 위치 감지 및 중앙 이동' },
  'Detecting GPS location...': { id: 'Mendeteksi lokasi GPS...', ko: 'GPS 위치 감지 중...' },
  'Go back': { id: 'Kembali', ko: '뒤로가기' },
  'Cars Live': { id: 'Mobil Aktif', ko: '차량 운행중' },
  'Users': { id: 'Pengguna', ko: '사용자' },
  'Driver assigned': { id: 'Driver ditugaskan', ko: '기사 배정됨' },
  'min ride': { id: 'menit perjalanan', ko: '분 소요' },
  'Operations & Booking': { id: 'Operasional & Pemesanan', ko: '운행 및 예약' },
  'Collapse to Map': { id: 'Tutup ke Peta', ko: '지도로 접기' },
  'Open Fleet & Booking': { id: 'Buka Armada & Pemesanan', ko: '차량 및 예약 열기' },
  'Click to view forms & schedule': { id: 'Klik untuk melihat formulir & jadwal', ko: '양식 및 일정 보기' },

  // Booking & Ride Form
  'Book a Ride': { id: 'Pesan Kendaraan', ko: '차량 예약' },
  'Request Fleet Ride': { id: 'Ajukan Perjalanan Armada', ko: '차량 배차 요청' },
  'Where to?': { id: 'Mau ke mana?', ko: '어디로 가시나요?' },
  'Pickup Location': { id: 'Lokasi Penjemputan', ko: '출발지' },
  'Destination': { id: 'Tujuan', ko: '도착지' },
  'Enter pickup location...': { id: 'Masukkan lokasi penjemputan...', ko: '출발지를 입력하세요...' },
  'Enter destination...': { id: 'Masukkan lokasi tujuan...', ko: '도착지를 입력하세요...' },
  'Pin on Map': { id: 'Tandai di Peta', ko: '지도에서 선택' },
  'Search location...': { id: 'Cari lokasi...', ko: '위치 검색...' },
  'Purpose of Trip': { id: 'Keperluan Perjalanan', ko: '운행 목적' },
  'e.g., Client meeting at Cikarang': { id: 'cth., Rapat klien di Cikarang', ko: '예: 거래처 미팅' },
  'Select Vehicle': { id: 'Pilih Kendaraan', ko: '차량 선택' },
  'Vehicle Type': { id: 'Tipe Kendaraan', ko: '차량 종류' },
  'Passenger Count': { id: 'Jumlah Penumpang', ko: '탑승 인원' },
  'Passengers': { id: 'Penumpang', ko: '동승자' },
  'Passenger Nicknames': { id: 'Nama Panggilan Penumpang', ko: '동승자 이름' },
  'Start Time': { id: 'Waktu Mulai', ko: '시작 시간' },
  'End Time': { id: 'Waktu Selesai', ko: '종료 시간' },
  'Reservation Type': { id: 'Jenis Reservasi', ko: '예약 유형' },
  'Standard Trip': { id: 'Perjalanan Standar', ko: '일반 운행' },
  'Full Day': { id: 'Seharian Penuh', ko: '종일 대절' },
  'Drop & Pick Up': { id: 'Antar & Jemput', ko: '왕복 배차' },
  'Full Day Reservation': { id: 'Reservasi Seharian Penuh', ko: '종일 대절 예약' },
  'Drop & Pick Up Later': { id: 'Antar & Jemput Nanti', ko: '행사 후 픽업 예약' },
  'Dedicated vehicle for the entire business day': { id: 'Kendaraan khusus sepanjang hari kerja', ko: '업무 시간 전일 전담 배차' },
  'Drop off to event location, driver picks up after event finishes': { id: 'Antar ke lokasi acara, driver menjemput setelah acara selesai', ko: '행사장 하차 후 종료 시 픽업' },
  'Confirm Booking': { id: 'Konfirmasi Pemesanan', ko: '예약 확정' },
  'Request Booking': { id: 'Ajukan Pemesanan', ko: '예약 신청' },
  'Submitting...': { id: 'Mengirim...', ko: '전송 중...' },
  'Cancel Booking': { id: 'Batalkan Pemesanan', ko: '예약 취소' },
  'Cancel': { id: 'Batal', ko: '취소' },
  'Confirm': { id: 'Konfirmasi', ko: '확인' },
  'Back': { id: 'Kembali', ko: '뒤로' },
  'Close': { id: 'Tutup', ko: '닫기' },
  'Save': { id: 'Simpan', ko: '저장' },
  'Submit': { id: 'Kirim', ko: '제출' },
  'Delete': { id: 'Hapus', ko: '삭제' },
  'Edit': { id: 'Ubah', ko: '수정' },
  'Free Corporate Facility': { id: 'Fasilitas Operasional Perusahaan', ko: '사내 업무용 무료 차량' },
  'Company facility for working purpose': { id: 'Fasilitas perusahaan untuk keperluan dinas', ko: '업무 목적 회사 지원 차량' },

  // Statuses & Workflow
  'PENDING': { id: 'Menunggu Persetujuan', ko: '승인 대기' },
  'AWAITING_HWS': { id: 'Menunggu Head of WS Part', ko: 'WS 부서장 승인 대기' },
  'AWAITING_PIC': { id: 'Menunggu Fleet PIC', ko: '차량 담당자 승인 대기' },
  'APPROVED': { id: 'Disetujui', ko: '승인됨' },
  'IN_PROGRESS': { id: 'Dalam Perjalanan', ko: '운행 중' },
  'COMPLETED': { id: 'Selesai', ko: '완료됨' },
  'REJECTED': { id: 'Ditolak', ko: '반려됨' },
  'CANCELLED': { id: 'Dibatalkan', ko: '취소됨' },
  'Pending Approval': { id: 'Menunggu Persetujuan', ko: '승인 대기' },
  'Approved': { id: 'Disetujui', ko: '승in됨' },
  'In Progress': { id: 'Dalam Perjalanan', ko: '운행 중' },
  'Completed': { id: 'Selesai', ko: '완료됨' },
  'Rejected': { id: 'Ditolak', ko: '반려됨' },
  'Cancelled': { id: 'Dibatalkan', ko: '취소됨' },
  'Standby': { id: 'Standby / Tersedia', ko: '대기 중' },
  'Assigned': { id: 'Ditugaskan', ko: '배정됨' },
  'Available': { id: 'Tersedia', ko: '이용 가능' },
  'On Duty': { id: 'Sedang Bertugas', ko: '근무 중' },
  'Awaiting Dual-Approval': { id: 'Menunggu Persetujuan Ganda', ko: '2차 승인 대기' },
  'Fleet Operation PIC': { id: 'PIC Operasional Armada', ko: '차량 운영 담당자' },
  'Head Of WS Part': { id: 'Head Of WS Part', ko: 'WS 부서장' },

  // Activity & Inbox
  'My Bookings': { id: 'Pemesanan Saya', ko: '내 예약 목록' },
  'Recent Trips': { id: 'Perjalanan Terakhir', ko: '최근 운행 내역' },
  'No trips found': { id: 'Tidak ada riwayat perjalanan', ko: '운행 기록이 없습니다' },
  'No notifications': { id: 'Tidak ada notifikasi', ko: '알림이 없습니다' },
  'Notifications': { id: 'Notifikasi', ko: '알림' },
  'Mark all as read': { id: 'Tandai semua sudah dibaca', ko: '모두 읽음으로 표시' },
  'View Details': { id: 'Lihat Detail', ko: '상세 정보' },
  'Trip Details': { id: 'Detail Perjalanan', ko: '운행 상세' },

  // Profile & Settings
  'User Profile': { id: 'Profil Pengguna', ko: '사용자 프로필' },
  'Account Information': { id: 'Informasi Akun', ko: '계정 정보' },
  'Username': { id: 'Nama Pengguna', ko: '아이디' },
  'Nickname': { id: 'Nama Panggilan', ko: '닉네임' },
  'Department': { id: 'Departemen', ko: '부서' },
  'Role': { id: 'Peran', ko: '직책' },
  'Group': { id: 'Grup', ko: '그룹' },
  'Current Password': { id: 'Kata Sandi Saat Ini', ko: '현재 비밀번호' },
  'New Password': { id: 'Kata Sandi Baru', ko: '새 비밀번호' },
  'Confirm New Password': { id: 'Konfirmasi Kata Sandi Baru', ko: '새 비밀번호 확인' },
  'Update Password': { id: 'Perbarui Kata Sandi', ko: '비밀번호 변경' },
  'Password updated successfully': { id: 'Kata sandi berhasil diperbarui', ko: '비밀번호가 성공적으로 변경되었습니다' },
  'Enter current password': { id: 'Masukkan kata sandi saat ini', ko: '현재 비밀번호 입력' },
  'Enter new password': { id: 'Masukkan kata sandi baru', ko: '새 비밀번호 입력' },

  // Driver Dispatch Console
  'Driver Dispatch Console': { id: 'Konsol Disposisi Driver', ko: '기사 배차 콘솔' },
  'Assigned Trips': { id: 'Perjalanan Ditugaskan', ko: '배정된 운행' },
  'Start Trip': { id: 'Mulai Perjalanan', ko: '운행 시작' },
  'Complete Trip': { id: 'Selesaikan Perjalanan', ko: '운행 완료' },
  'Upload Receipt': { id: 'Unggah Struk / Kuitansi', ko: '영수증 첨부' },
  'Expense Category': { id: 'Kategori Pengeluaran', ko: '지출 항목' },
  'Amount': { id: 'Jumlah (Rp)', ko: '금액' },
  'Description': { id: 'Keterangan', ko: '설명' },
  'Toll': { id: 'Tol', ko: '통행료' },
  'Fuel': { id: 'BBM', ko: '주유비' },
  'Parking': { id: 'Parkir', ko: '주차비' },
  'Maintenance': { id: 'Perawatan', ko: '정비비' },
  'Other': { id: 'Lainnya', ko: '기타' },
  'Submit Expense': { id: 'Kirim Pengeluaran', ko: '지출 등록' },
  'Receipt image': { id: 'Foto struk/bukti', ko: '영수증 사진' },

  // Admin Modules
  'Fleet Map': { id: 'Peta Armada', ko: '차량 관제 지도' },
  'Fleet Live Map': { id: 'Peta Armada Live', ko: '실시간 차량 관제' },
  'Admin Dispatch': { id: 'Disposisi Admin', ko: '관리자 배차' },
  'Approvals & Dispatch': { id: 'Persetujuan & Disposisi', ko: '승인 및 배차' },
  'Fleet Operations': { id: 'Operasional Armada', ko: '차량 관리' },
  'Fleet, Drivers & Energy': { id: 'Armada, Pengemudi & Energi', ko: '차량, 기사 및 에너지 관리' },
  'Analytics & Reports': { id: 'Analitik & Laporan', ko: '통계 및 보고서' },
  'Analytics & Reports (IDR)': { id: 'Analitik & Laporan (IDR)', ko: '통계 및 보고서 (IDR)' },
  'Audit Log': { id: 'Log Audit', ko: '감사 로그' },
  'Audit Trail': { id: 'Jejak Audit', ko: '감사 추적' },
  'Audit Log & Cybersecurity': { id: 'Log Audit & Keamanan Siber', ko: '감사 로그 및 보안' },
  'GalaxyFleet Admin Console': { id: 'Konsol Admin GalaxyFleet', ko: 'GalaxyFleet 관리자 콘솔' },
  'Total Vehicles': { id: 'Total Kendaraan', ko: '총 차량 수' },
  'Active Bookings': { id: 'Pemesanan Aktif', ko: '진행 중인 예약' },
  'Total Distance': { id: 'Total Jarak', ko: '총 주행거리' },
  'Approve': { id: 'Setujui', ko: '승인' },
  'Reject': { id: 'Tolak', ko: '반려' },
  'Reassign': { id: 'Tugaskan Ulang', ko: '재배정' },
  'Reason for rejection': { id: 'Alasan penolakan', ko: '반려 사유' },
  'Assign Driver': { id: 'Tugaskan Driver', ko: '기사 배정' },
  'Select Driver': { id: 'Pilih Driver', ko: '기사 선택' },

  // Auth / Login
  'Sign In to GalaxyFleet': { id: 'Masuk ke GalaxyFleet', ko: 'GalaxyFleet 로그인' },
  'Register Account': { id: 'Daftar Akun Baru', ko: '새 계정 등록' },
  'Password': { id: 'Kata Sandi', ko: '비밀번호' },
  'Remember Me': { id: 'Ingat Saya', ko: '로그인 유지' },
  "Don't have an account?": { id: 'Belum punya akun?', ko: '계정이 없으신가요?' },
  'Already have an account?': { id: 'Sudah punya akun?', ko: '이미 계정이 있으신가요?' },
  'Create Account': { id: 'Buat Akun', ko: '계정 생성' },
  'Awaiting Administrator Approval': { id: 'Menunggu Persetujuan Administrator', ko: '관리자 승인 대기 중' },
};

// Create a fast normalized lowercase index
const DICTIONARY_LOWER: Record<string, { id: string; ko: string }> = {};
for (const [key, value] of Object.entries(DICTIONARY)) {
  DICTIONARY_LOWER[key.trim().toLowerCase()] = value;
}

/**
 * Get current application language from storage or browser
 */
export function getCurrentLanguage(): SupportedLang {
  try {
    const saved = localStorage.getItem('gf_lang') as SupportedLang | null;
    if (saved && ['en', 'id', 'ko'].includes(saved)) {
      return saved;
    }
    const match = document.cookie.match(/(?:^|;\s*)googtrans=\/en\/(en|id|ko)/);
    if (match && ['en', 'id', 'ko'].includes(match[1])) {
      return match[1] as SupportedLang;
    }
    // Auto-detect Indonesian or Korean from browser
    if (typeof navigator !== 'undefined') {
      const navLang = (navigator.language || '').toLowerCase();
      if (navLang.startsWith('id')) return 'id';
      if (navLang.startsWith('ko')) return 'ko';
    }
  } catch {
    // Ignore storage/cookie access errors
  }
  return 'en';
}

/**
 * Translates a given English string to target language
 */
export function t(text: string, targetLang?: SupportedLang): string {
  const lang = targetLang || getCurrentLanguage();
  if (lang === 'en' || !text) return text;

  const trimmed = text.trim();
  if (!trimmed) return text;

  // Exact match
  const match = DICTIONARY[trimmed] || DICTIONARY_LOWER[trimmed.toLowerCase()];
  if (match && match[lang]) {
    // Preserve leading and trailing whitespace
    const leadingSpaces = text.match(/^\s*/)?.[0] || '';
    const trailingSpaces = text.match(/\s*$/)?.[0] || '';
    return `${leadingSpaces}${match[lang]}${trailingSpaces}`;
  }

  return text;
}

/**
 * Safe cookie setter that works across localhost, cPanel, subdomains, and public suffixes
 */
function setGoogTransCookie(lang: SupportedLang) {
  try {
    const cookieVal = `/en/${lang}`;
    document.cookie = `googtrans=${cookieVal}; path=/; SameSite=Lax`;
    const host = window.location.hostname;
    if (host && host.includes('.')) {
      document.cookie = `googtrans=${cookieVal}; path=/; domain=${host}; SameSite=Lax`;
      const parts = host.split('.');
      // Avoid setting domain cookie on known 2-part ccTLDs like .co.id, .com.sg
      if (parts.length >= 3 && !['co.id', 'or.id', 'ac.id', 'go.id', 'com.sg'].includes(parts.slice(-2).join('.'))) {
        const rootDomain = `.${parts.slice(-2).join('.')}`;
        document.cookie = `googtrans=${cookieVal}; path=/; domain=${rootDomain}; SameSite=Lax`;
      }
    }
  } catch {
    // Ignore cookie errors
  }
}

/**
 * Trigger external Google Translate combo if loaded
 */
function triggerGoogleTranslateCombo(lang: SupportedLang): boolean {
  try {
    const combo = document.querySelector('select.goog-te-combo') as HTMLSelectElement | null;
    if (!combo) return false;
    const targetValue = lang === 'en' ? '' : lang;
    combo.value = targetValue;
    combo.dispatchEvent(new Event('change', { bubbles: true }));
    combo.dispatchEvent(new Event('input', { bubbles: true }));
    if (typeof (combo as any).onchange === 'function') {
      try {
        (combo as any).onchange();
      } catch {}
    }
    return true;
  } catch {
    return false;
  }
}

// WeakMaps to remember original English text of nodes and attributes without leaking memory
const originalTextMap = new WeakMap<Node, string>();
const originalPlaceholderMap = new WeakMap<Element, string>();
const originalTitleMap = new WeakMap<Element, string>();

/**
 * High-performance DOM tree walker that translates text nodes in place
 */
export function translateDomTree(root: Node = document.body, lang: SupportedLang = getCurrentLanguage()) {
  if (typeof document === 'undefined' || !root) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (node: Node) => {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;

      // Skip elements that should never be translated
      const tag = parent.tagName;
      if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE', 'SVG'].includes(tag)) {
        return NodeFilter.FILTER_REJECT;
      }
      if (parent.closest('.notranslate, [translate="no"], .goog-te-combo')) {
        return NodeFilter.FILTER_REJECT;
      }

      const val = node.nodeValue;
      if (!val || !val.trim()) return NodeFilter.FILTER_REJECT;

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const nodesToUpdate: Array<{ node: Node; originalText: string }> = [];

  let currentNode = walker.nextNode();
  while (currentNode) {
    let original = originalTextMap.get(currentNode);
    if (original === undefined) {
      original = currentNode.nodeValue || '';
      originalTextMap.set(currentNode, original);
    }
    nodesToUpdate.push({ node: currentNode, originalText: original });
    currentNode = walker.nextNode();
  }

  for (const { node, originalText } of nodesToUpdate) {
    if (lang === 'en') {
      if (node.nodeValue !== originalText) {
        node.nodeValue = originalText;
      }
    } else {
      const translated = t(originalText, lang);
      if (translated !== originalText && node.nodeValue !== translated) {
        node.nodeValue = translated;
      }
    }
  }

  // Also translate input/textarea placeholders and element titles
  if (root instanceof Element || root instanceof Document) {
    const inputs = (root as Element).querySelectorAll?.('input[placeholder], textarea[placeholder]') || [];
    inputs.forEach((el) => {
      const htmlEl = el as HTMLInputElement | HTMLTextAreaElement;
      if (htmlEl.closest?.('.notranslate, [translate="no"]')) return;
      let orig = originalPlaceholderMap.get(htmlEl);
      if (orig === undefined) {
        orig = htmlEl.placeholder || '';
        originalPlaceholderMap.set(htmlEl, orig);
      }
      if (lang === 'en') {
        htmlEl.placeholder = orig;
      } else {
        htmlEl.placeholder = t(orig, lang);
      }
    });

    const titled = (root as Element).querySelectorAll?.('[title]') || [];
    titled.forEach((el) => {
      if (el.closest?.('.notranslate, [translate="no"]')) return;
      let orig = originalTitleMap.get(el);
      if (orig === undefined) {
        orig = el.getAttribute('title') || '';
        originalTitleMap.set(el, orig);
      }
      if (lang === 'en') {
        el.setAttribute('title', orig);
      } else {
        el.setAttribute('title', t(orig, lang));
      }
    });
  }
}

let mutationObserver: MutationObserver | null = null;
let debounceTimer: number | null = null;

/**
 * Initializes continuous live DOM translation observer
 */
export function startDomTranslationObserver() {
  if (typeof window === 'undefined' || mutationObserver) return;

  const currentLang = getCurrentLanguage();
  if (currentLang !== 'en') {
    translateDomTree(document.body, currentLang);
  }

  mutationObserver = new MutationObserver((mutations) => {
    const lang = getCurrentLanguage();
    if (lang === 'en') return;

    let hasRelevantChanges = false;
    for (const m of mutations) {
      if (m.type === 'childList' && m.addedNodes.length > 0) {
        hasRelevantChanges = true;
        break;
      }
    }

    if (hasRelevantChanges) {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        translateDomTree(document.body, lang);
      }, 50);
    }
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/**
 * Sets current language and triggers instant UI updates
 */
export function setAppLanguage(nextLang: SupportedLang) {
  try {
    localStorage.setItem('gf_lang', nextLang);
  } catch {}

  if (typeof document !== 'undefined') {
    document.documentElement.lang = nextLang;
  }

  setGoogTransCookie(nextLang);
  triggerGoogleTranslateCombo(nextLang);

  // Instantly translate DOM
  translateDomTree(document.body, nextLang);

  // Dispatch custom event for React components
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('gf_language_change', { detail: { lang: nextLang } }));
  }
}

/**
 * React hook for consuming and updating language
 */
export function useAppLanguage(): {
  lang: SupportedLang;
  setLang: (l: SupportedLang) => void;
  t: (text: string) => string;
} {
  const [lang, setLangState] = useState<SupportedLang>(() => getCurrentLanguage());

  useEffect(() => {
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<{ lang: SupportedLang }>;
      if (customEvent.detail && customEvent.detail.lang) {
        setLangState(customEvent.detail.lang);
      } else {
        setLangState(getCurrentLanguage());
      }
    };

    window.addEventListener('gf_language_change', handler);
    return () => window.removeEventListener('gf_language_change', handler);
  }, []);

  const setLang = (next: SupportedLang) => {
    setLangState(next);
    setAppLanguage(next);
  };

  return {
    lang,
    setLang,
    t: (text: string) => t(text, lang),
  };
}
