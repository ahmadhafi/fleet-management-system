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

export interface TranslationItem {
  en: string;
  id: string;
  ko: string;
}

/**
 * Enterprise Translation Dictionary
 * Tridirectional mappings between English, Indonesian, and Korean
 */
export const TRANSLATION_ITEMS: TranslationItem[] = [
  // Navigation & Shell
  { en: 'Home', id: 'Beranda', ko: '홈' },
  { en: 'Activity', id: 'Aktivitas', ko: '활동' },
  { en: 'Inbox', id: 'Kotak Masuk', ko: '수신함' },
  { en: 'Profile', id: 'Profil', ko: '프로필' },
  { en: 'Dispatch', id: 'Disposisi', ko: '배차' },
  { en: 'Admin', id: 'Admin', ko: '관리자' },
  { en: 'Sign Out', id: 'Keluar', ko: '로그아웃' },
  { en: 'Sign In', id: 'Masuk', ko: '로그인' },
  { en: 'Main application tabs', id: 'Tab navigasi utama', ko: '주요 탭' },
  { en: 'Admin Console', id: 'Konsol Admin', ko: '관리자 콘솔' },
  { en: 'Operational Vehicles', id: 'Kendaraan Operasional', ko: '운행 차량' },
  { en: 'Groups', id: 'Grup', ko: '그룹' },
  { en: 'Currency: IDR (Rp)', id: 'Mata Uang: IDR (Rp)', ko: '통화: IDR (Rp)' },
  { en: 'My Account Profile & Change Password', id: 'Profil Akun Saya & Ganti Kata Sandi', ko: '내 계정 프로필 및 비밀번호 변경' },
  { en: 'My Profile & Change Password', id: 'Profil Saya & Ganti Kata Sandi', ko: '내 프로필 및 비밀번호 변경' },
  { en: 'Appearance', id: 'Tampilan', ko: '화면 테마' },
  // Display Mode (Mobile ⇄ Web appearance)
  { en: 'Display Mode', id: 'Mode Tampilan', ko: '화면 모드' },
  { en: 'Mobile', id: 'Seluler', ko: '모바일' },
  { en: 'Web', id: 'Web', ko: '웹' },
  { en: 'Mobile View', id: 'Tampilan Seluler', ko: '모바일 보기' },
  { en: 'Web View', id: 'Tampilan Web', ko: '웹 보기' },
  { en: 'Switch to Web View', id: 'Beralih ke Tampilan Web', ko: '웹 보기로 전환' },
  { en: 'Switch to Mobile View', id: 'Beralih ke Tampilan Seluler', ko: '모바일 보기로 전환' },
  { en: 'Mobile View keeps a compact phone layout; Web View shows the full desktop layout.', id: 'Tampilan Seluler menjaga tata letak ponsel yang ringkas; Tampilan Web menampilkan tata letak desktop lengkap.', ko: '모바일 보기는 간결한 휴대폰 레이아웃을, 웹 보기는 전체 데스크톱 레이아웃을 표시합니다.' },
  { en: 'Auto', id: 'Otomatis', ko: '자동' },
  { en: 'Light', id: 'Terang', ko: '라이트' },
  { en: 'Dark', id: 'Gelap', ko: '다크' },
  { en: 'Language', id: 'Bahasa', ko: '언어' },
  { en: 'Language (Google Translate)', id: 'Bahasa', ko: '언어' },
  { en: 'Internal Fleet Management System', id: 'Sistem Manajemen Armada Internal', ko: '사내 차량 관제 시스템' },

  // Map Controls & Overlays
  { en: 'Streets', id: 'Jalan', ko: '일반지도' },
  { en: 'Satellite', id: 'Satelit', ko: '위성' },
  { en: 'Terrain', id: 'Topografi', ko: '지형' },
  { en: 'Locate Me', id: 'Lokasi Saya', ko: '내 위치' },
  { en: 'Detect & center on my location', id: 'Deteksi & pusatkan lokasi saya', ko: '내 위치 감지 및 중앙 이동' },
  { en: 'Detecting GPS location...', id: 'Mendeteksi lokasi GPS...', ko: 'GPS 위치 감지 중...' },
  { en: 'Go back', id: 'Kembali', ko: '뒤로가기' },
  { en: 'Cars Live', id: 'Mobil Aktif', ko: '차량 운행중' },
  { en: 'Users', id: 'Pengguna', ko: '사용자' },
  { en: 'Driver assigned', id: 'Driver ditugaskan', ko: '기사 배정됨' },
  { en: 'min ride', id: 'menit perjalanan', ko: '분 소요' },
  { en: 'Operations & Booking', id: 'Operasional & Pemesanan', ko: '운행 및 예약' },
  { en: 'Collapse to Map', id: 'Tutup ke Peta', ko: '지도로 접기' },
  { en: 'Open Fleet & Booking', id: 'Buka Armada & Pemesanan', ko: '차량 및 예약 열기' },
  { en: 'Click to view forms & schedule', id: 'Klik untuk melihat formulir & jadwal', ko: '양식 및 일정 보기' },
  { en: 'Expand booking and operational container', id: 'Buka panel pemesanan & operasional', ko: '예약 및 운행 패널 열기' },

  // Booking & Ride Form
  { en: 'Where to?', id: 'Mau ke mana?', ko: '어디로 가시나요?' },
  { en: 'Book a Ride', id: 'Pesan Kendaraan', ko: '차량 예약' },
  { en: 'Request Fleet Ride', id: 'Ajukan Perjalanan Armada', ko: '차량 배차 요청' },
  { en: 'Current pickup point', id: 'Titik jemput saat ini', ko: '현재 출발지' },
  { en: 'Pickup Location', id: 'Lokasi Penjemputan', ko: '출발지' },
  { en: 'Destination', id: 'Tujuan', ko: '도착지' },
  { en: 'Enter pickup location...', id: 'Masukkan lokasi penjemputan...', ko: '출발지를 입력하세요...' },
  { en: 'Enter destination...', id: 'Masukkan lokasi tujuan...', ko: '도착지를 입력하세요...' },
  { en: 'Search destination or plant...', id: 'Cari tujuan atau plant...', ko: '목적지 또는 공장 검색...' },
  { en: 'Pin on Map', id: 'Tandai di Peta', ko: '지도에서 선택' },
  { en: 'Search location...', id: 'Cari lokasi...', ko: '위치 검색...' },
  { en: 'Add', id: 'Tambah', ko: '추가' },
  { en: 'Add destination', id: 'Tambah tujuan', ko: '목적지 추가' },
  { en: 'Add trip destination', id: 'Tambah tujuan perjalanan', ko: '운행 목적지 추가' },
  { en: 'Can only schedule for 1 destination', id: 'Hanya bisa jadwalkan 1 tujuan', ko: '예약은 1개 목적지만 가능합니다' },
  { en: 'Quick Shortcuts', id: 'Pintasan Cepat', ko: '빠른 바로가기' },
  { en: 'Recent Destinations', id: 'Tujuan Terakhir', ko: '최근 목적지' },
  { en: 'Popular Destinations', id: 'Tujuan Populer', ko: '자주 가는 목적지' },
  { en: 'Use typed address:', id: 'Gunakan alamat yang diketik:', ko: '입력한 주소 사용:' },
  { en: 'Choose on map', id: 'Pilih di peta', ko: '지도에서 선택' },
  { en: 'Confirm pickup point', id: 'Konfirmasi titik jemput', ko: '픽업 위치 확인' },
  { en: 'Confirm location', id: 'Konfirmasi lokasi', ko: '위치 확인' },

  // Scheduling Bar & Triggers
  { en: 'Book Now', id: 'Pesan Sekarang', ko: '지금 예약' },
  { en: 'Ready to depart immediately or tap schedule button for advance reservation', id: 'Siap jalan segera atau tap tombol jadwal untuk reservasi', ko: '즉시 출발 가능 또는 예약 버튼을 눌러 사전 예약' },
  { en: 'Set Schedule', id: 'Atur Jadwal', ko: '일정 설정' },
  { en: 'Set Trip Schedule', id: 'Atur Jadwal Perjalanan', ko: '운행 일정 설정' },
  { en: 'Change Trip Schedule', id: 'Ubah Jadwal Perjalanan', ko: '운행 일정 변경' },
  { en: 'Departure Schedule', id: 'Jadwal Keberangkatan', ko: '출발 일정' },
  { en: 'Change', id: 'Ubah', ko: '변경' },
  { en: 'Remove', id: 'Hapus', ko: '삭제' },
  { en: 'Remove schedule and return to instant booking', id: 'Hapus Jadwal dan kembali ke Pesan Langsung', ko: '일정을 취소하고 즉시 예약으로 전환' },
  { en: 'Schedule cancelled. Returned to instant booking mode.', id: 'Jadwal dibatalkan. Kembali ke mode pesan langsung.', ko: '예약이 취소되었습니다. 즉시 예약 모드로 전환됩니다.' },
  { en: 'Schedule set successfully:', id: 'Jadwal berhasil diatur:', ko: '일정이 설정되었습니다:' },
  { en: 'Continue to Vehicle', id: 'Lanjut Pilih Kendaraan', ko: '차량 선택으로 이동' },

  // Gojek Wheel Picker Sheet
  { en: 'No worries, your booking is our priority', id: 'Gak perlu cemas, booking-mu jadi prioritas', ko: '안심하세요, 예약이 최우선 처리됩니다' },
  { en: 'When do you want to leave?', id: 'Kapan mau berangkat?', ko: '언제 출발하시나요?' },
  { en: 'Today', id: 'Hari ini', ko: '오늘' },
  { en: 'Tomorrow', id: 'Besok', ko: '내일' },
  { en: 'Select date', id: 'Pilih tanggal', ko: '날짜 선택' },
  { en: 'Pickup time estimate', id: 'Estimasi waktu jemput', ko: '예상 픽업 시간' },
  { en: 'Pickup time drum wheel picker', id: 'Pemilih waktu penjemputan drum wheel', ko: '픽업 시간 드럼 휠 선택기' },
  { en: 'Select pickup time slot', id: 'Pilih slot waktu penjemputan', ko: '픽업 시간대 선택' },
  { en: 'Cancel', id: 'Batal', ko: '취소' },
  { en: 'Set schedule', id: 'Set jadwal', ko: '일정 확정' },
  { en: 'Trip Reservation Type', id: 'Tipe Reservasi Perjalanan', ko: '운행 예약 유형' },
  { en: 'Point-to-point', id: 'Point-to-point', ko: '편도 운행' },
  { en: 'Drop & pick up later', id: 'Drop & jemput nanti', ko: '하차 후 추후 픽업' },
  { en: 'Full business day', id: 'Seharian kerja', ko: '업무 시간 전일 대절' },
  { en: 'Full Day (Seharian)', id: 'Full Day (Seharian)', ko: '종일 대절' },
  { en: 'In 2h (Standard)', id: '2 Jam Lagi (Standar)', ko: '2시간 후 (기본)' },
  { en: 'In 4h', id: '4 Jam Lagi', ko: '4시간 후' },
  { en: 'Today Full Day', id: 'Hari Ini Seharian', ko: '오늘 종일 대절' },
  { en: 'Tomorrow Full Day', id: 'Besok Seharian', ko: '내일 종일 대절' },
  { en: 'Departure Date & Time *', id: 'Tanggal & Waktu Berangkat *', ko: '출발 일시 *' },
  { en: 'Drop-Off Departure *', id: 'Keberangkatan Drop-Off *', ko: '출발(하차) 일시 *' },
  { en: 'Post-Event Pick-Up Time *', id: 'Waktu Jemput Pulang Acara *', ko: '행사 후 픽업 일시 *' },
  { en: 'Final Return to Pool *', id: 'Pengembalian ke Pool *', ko: '최종 풀 복귀 일시 *' },
  { en: 'Full Day End Date & Time *', id: 'Waktu Selesai Seharian Penuh *', ko: '종일 대절 종료 일시 *' },
  { en: 'Return Date & Time *', id: 'Tanggal & Waktu Kembali *', ko: '귀환 일시 *' },
  { en: 'Urgent Reason *', id: 'Alasan Mendesak *', ko: '긴급 사유 *' },
  { en: 'Enter urgent reason (e.g. client site emergency, urgent VIP transport)...', id: 'Tulis alasan urgensi (misal: darurat site klien, transport VIP mendadak)...', ko: '긴급 사유를 입력하세요 (예: 거래처 긴급 지원, VIP 의전 등)...' },
  { en: 'Departure time cannot be in the past. Please select an upcoming departure time.', id: 'Waktu keberangkatan tidak boleh di masa lalu. Silakan pilih waktu mendatang.', ko: '출발 시간은 과거일 수 없습니다. 이후 시간을 선택해 주세요.' },
  { en: 'Custom schedule', id: 'Jadwal khusus', ko: '지정 일정' },

  // Reservation Types
  { en: 'Standard Trip', id: 'Perjalanan Standar', ko: '일반 운행' },
  { en: 'Full Day', id: 'Seharian Penuh', ko: '종일 대절' },
  { en: 'Drop & Pick Up', id: 'Antar & Jemput', ko: '왕복 배차' },
  { en: 'Full Day Reservation', id: 'Reservasi Seharian Penuh', ko: '종일 대절 예약' },
  { en: 'Drop & Pick Up Later', id: 'Antar & Jemput Nanti', ko: '행사 후 픽업 예약' },
  { en: 'Dedicated vehicle for the entire business day', id: 'Kendaraan khusus sepanjang hari kerja', ko: '업무 시간 전일 전담 배차' },
  { en: 'Drop off to event location, driver picks up after event finishes', id: 'Antar ke lokasi acara, driver menjemput setelah acara selesai', ko: '행사장 하차 후 종료 시 픽업' },

  // Vehicle Selection Step
  { en: 'Select Vehicle', id: 'Pilih Kendaraan', ko: '차량 선택' },
  { en: 'Vehicle Type', id: 'Tipe Kendaraan', ko: '차량 종류' },
  { en: 'All Categories', id: 'Semua Kategori', ko: '모든 차종' },
  { en: 'All', id: 'Semua', ko: '전체' },
  { en: 'Free Corporate Facility', id: 'Fasilitas Operasional Perusahaan', ko: '사내 업무용 무료 차량' },
  { en: 'Company facility for working purpose', id: 'Fasilitas perusahaan untuk keperluan dinas', ko: '업무 목적 회사 지원 차량' },
  { en: 'Seats', id: 'Kursi', ko: '인승' },
  { en: 'seats', id: 'kursi', ko: '인승' },
  { en: 'Available Now', id: 'Tersedia Sekarang', ko: '지금 이용 가능' },
  { en: 'Scheduled / In Use', id: 'Terjadwal / Digunakan', ko: '예약됨 / 사용 중' },
  { en: 'No vehicles registered in this category yet.', id: 'Belum ada kendaraan di kategori ini.', ko: '해당 차종의 등록된 차량이 없습니다.' },
  { en: 'Add Vehicle in Admin Console', id: 'Tambah Kendaraan di Konsol Admin', ko: '관리자 콘솔에서 차량 추가' },
  { en: 'Ready to Depart', id: 'Siap Berangkat', ko: '출발 준비 완료' },
  { en: 'Schedule', id: 'Jadwalkan', ko: '예약' },
  { en: 'Book', id: 'Pesan', ko: '예약' },

  // Order Summary & Confirmation
  { en: 'Almost there', id: 'Hampir selesai', ko: '거의 완료됨' },
  { en: 'Booking Summary', id: 'Ringkasan Pemesanan', ko: '예약 확인' },
  { en: 'Almost there! Check trip details before requesting booking.', id: 'Hampir selesai! Periksa rincian sebelum mengajukan booking.', ko: '거의 완료되었습니다! 예약 신청 전 상세 내역을 확인해 주세요.' },
  { en: 'Schedule & Reservation', id: 'Jadwal & Reservasi', ko: '일정 및 예약' },
  { en: 'Trip Purpose', id: 'Keperluan Perjalanan', ko: '운행 목적' },
  { en: 'Purpose of Trip', id: 'Keperluan Perjalanan', ko: '운행 목적' },
  { en: 'Purpose', id: 'Keperluan', ko: '목적' },
  { en: 'Passengers', id: 'Penumpang', ko: '동승자' },
  { en: 'Passenger Details', id: 'Rincian Penumpang', ko: '동승자 상세' },
  { en: 'Passenger Count', id: 'Jumlah Penumpang', ko: '탑승 인원' },
  { en: 'Passenger Nicknames', id: 'Nama Panggilan Penumpang', ko: '동승자 이름' },
  { en: 'Passenger Nicknames (Comma separated)', id: 'Nama Panggilan Penumpang (Pisahkan koma)', ko: '동승자 닉네임 (쉼표로 구분)' },
  { en: 'Notes', id: 'Catatan', ko: '메모' },
  { en: 'Dispatch Notes', id: 'Catatan Disposisi', ko: '배차 메모' },
  { en: 'Group & Driver', id: 'Grup & Driver', ko: '그룹 및 기사' },
  { en: 'Department & Driver', id: 'Departemen & Pengemudi', ko: '부서 및 기사' },
  { en: '* Mandatory', id: '* Wajib', ko: '* 필수' },
  { en: '* Wajib diisi', id: '* Wajib diisi', ko: '* 필수' },
  { en: '✓ Filled', id: '✓ Terisi', ko: '✓ 입력됨' },
  { en: 'Done', id: 'Selesai', ko: '완료' },
  { en: 'Confirm', id: 'Konfirmasi', ko: '확인' },
  { en: 'Confirm Booking', id: 'Konfirmasi Pemesanan', ko: '예약 확정' },
  { en: 'Confirm & Request Booking', id: 'Konfirmasi & Kirim Booking', ko: '예약 확정 및 신청' },
  { en: 'Request GalaxyFleet', id: 'Pesan GalaxyFleet', ko: 'GalaxyFleet 배차 요청' },
  { en: 'Complete Details', id: 'Lengkapi Data', ko: '정보 입력' },
  { en: 'Fill Data', id: 'Lengkapi Data', ko: '정보 입력' },
  { en: 'Close', id: 'Tutup', ko: '닫기' },
  { en: 'Back', id: 'Kembali', ko: '뒤로' },
  { en: 'Save', id: 'Simpan', ko: '저장' },
  { en: 'Submit', id: 'Kirim', ko: '제출' },
  { en: 'Delete', id: 'Hapus', ko: '삭제' },
  { en: 'Edit', id: 'Ubah', ko: '수정' },

  // Sub-Modals & Validation Messages
  { en: 'Select operational purpose or enter custom purpose:', id: 'Pilih tujuan operasional atau masukkan tujuan khusus:', ko: '운행 목적을 선택하거나 직접 입력하세요:' },
  { en: 'Client visit', id: 'Kunjungan klien', ko: '고객사 미팅' },
  { en: 'Site audit', id: 'Audit lapangan', ko: '현장 실사' },
  { en: 'Airport transfer', id: 'Antar jemput bandara', ko: '공항 픽업/샌딩' },
  { en: 'Executive briefing', id: 'Briefing eksekutif', ko: '임원 보고' },
  { en: 'Trip Purpose *', id: 'Tujuan Perjalanan *', ko: '운행 목적 *' },
  { en: 'Example: Cikarang Plant Visit...', id: 'Contoh: Kunjungan Pabrik Cikarang...', ko: '예: 찌카랑 공장 방문...' },
  { en: 'Mandatory • Tap to select or enter purpose', id: 'Wajib diisi • Ketuk untuk pilih atau ketik tujuan', ko: '필수 입력 • 터치하여 목적 선택 또는 입력' },
  { en: 'Mandatory • Tap to enter passenger nickname', id: 'Wajib diisi • Ketuk untuk masukkan nama panggilan (nickname)', ko: '필수 입력 • 터치하여 동승자 닉네임 입력' },
  { en: 'Trip Purpose is mandatory. Please select or enter your trip purpose before booking.', id: 'Tujuan perjalanan (Purpose) wajib diisi. Silakan pilih atau ketik tujuan perjalanan Anda sebelum memesan.', ko: '운행 목적은 필수입니다. 예약 전 목적을 선택하거나 입력해 주세요.' },
  { en: 'Passenger data is mandatory. Please enter at least 1 passenger nickname.', id: 'Data penumpang (Passengers) wajib diisi. Masukkan minimal 1 nama panggilan penumpang.', ko: '동승자 명단은 필수입니다. 최소 1명의 동승자 닉네임을 입력해 주세요.' },
  { en: 'Please select an available vehicle first.', id: 'Silakan pilih kendaraan yang tersedia terlebih dahulu.', ko: '이용 가능한 차량을 먼저 선택해 주세요.' },
  { en: 'Please enter both pickup and destination locations.', id: 'Harap masukkan lokasi penjemputan dan tujuan.', ko: '출발지와 목적지를 모두 입력해 주세요.' },
  { en: 'Please select both departure and return dates/times.', id: 'Harap pilih tanggal/waktu berangkat dan kembali.', ko: '출발 및 귀환 일시를 모두 선택해 주세요.' },
  { en: 'Return time must be after departure time.', id: 'Waktu kembali harus setelah waktu keberangkatan.', ko: '귀환 시간은 출발 시간 이후여야 합니다.' },
  { en: 'Please complete Purpose and Passengers before booking', id: 'Lengkapi Purpose dan Passengers sebelum memesan', ko: '예약 전 목적과 동승자를 입력해 주세요' },
  { en: 'Submit Booking Request', id: 'Kirim Permintaan Booking', ko: '예약 신청서 제출' },
  { en: 'Mandatory to fill Purpose & Passengers', id: 'Wajib isi Purpose & Passengers', ko: '목적 및 동승자 필수 입력' },

  // Activity Tab
  { en: 'Ongoing', id: 'Berjalan', ko: '진행 중' },
  { en: 'History', id: 'Riwayat', ko: '완료 내역' },
  { en: 'No ongoing rides right now.', id: 'Tidak ada perjalanan yang sedang berlangsung saat ini.', ko: '현재 진행 중인 운행이 없습니다.' },
  { en: 'No completed trips yet.', id: 'Belum ada riwayat perjalanan selesai.', ko: '완료된 운행 기록이 없습니다.' },
  { en: 'Open Driver Dispatch', id: 'Buka Disposisi Driver', ko: '기사 배차 콘솔 열기' },
  { en: 'Book a ride', id: 'Pesan kendaraan', ko: '차량 예약하기' },

  // Statuses & Workflow
  { en: 'PENDING', id: 'Menunggu Persetujuan', ko: '승인 대기' },
  { en: 'PENDING_APPROVAL', id: 'Menunggu Persetujuan', ko: '승인 대기' },
  { en: 'AWAITING_HWS', id: 'Menunggu Head of WS Part', ko: 'WS 부서장 승인 대기' },
  { en: 'AWAITING HWS', id: 'Menunggu Head of WS Part', ko: 'WS 부서장 승인 대기' },
  { en: 'AWAITING_PIC', id: 'Menunggu Fleet PIC', ko: '차량 담당자 승인 대기' },
  { en: 'AWAITING PIC', id: 'Menunggu Fleet PIC', ko: '차량 담당자 승인 대기' },
  { en: 'APPROVED', id: 'Disetujui', ko: '승인됨' },
  { en: 'IN_PROGRESS', id: 'Dalam Perjalanan', ko: '운행 중' },
  { en: 'IN TRIP', id: 'Dalam Perjalanan', ko: '운행 중' },
  { en: 'COMPLETED', id: 'Selesai', ko: '완료됨' },
  { en: 'REJECTED', id: 'Ditolak', ko: '반려됨' },
  { en: 'CANCELLED', id: 'Dibatalkan', ko: '취소됨' },
  { en: 'Pending Approval', id: 'Menunggu Persetujuan', ko: '승인 대기' },
  { en: 'Approved', id: 'Disetujui', ko: '승인됨' },
  { en: 'In Progress', id: 'Dalam Perjalanan', ko: '운행 중' },
  { en: 'Completed', id: 'Selesai', ko: '완료됨' },
  { en: 'Rejected', id: 'Ditolak', ko: '반려됨' },
  { en: 'Cancelled', id: 'Dibatalkan', ko: '취소됨' },
  { en: 'Standby', id: 'Standby / Tersedia', ko: '대기 중' },
  { en: 'Assigned', id: 'Ditugaskan', ko: '배정됨' },
  { en: 'Available', id: 'Tersedia', ko: '이용 가능' },
  { en: 'On Duty', id: 'Sedang Bertugas', ko: '근무 중' },
  { en: 'Awaiting Dual-Approval', id: 'Menunggu Persetujuan Ganda', ko: '2차 승인 대기' },
  { en: 'Fleet Operation PIC', id: 'PIC Operasional Armada', ko: '차량 운영 담당자' },
  { en: 'Head Of WS Part', id: 'Head Of WS Part', ko: 'WS 부서장' },

  // Driver Dispatch Console
  { en: 'Driver Dispatch', id: 'Disposisi Driver', ko: '기사 배차' },
  { en: 'Online & Checked In', id: 'Online & Siap Tugas', ko: '온라인 및 출근 완료' },
  { en: 'Offline / Standby', id: 'Offline / Standby', ko: '오프라인 / 대기' },
  { en: 'Company Driver', id: 'Driver Perusahaan', ko: '사내 전담 기사' },
  { en: 'Driver duty console & car operational schedule', id: 'Konsol tugas driver & jadwal operasional mobil', ko: '기사 업무 콘솔 및 차량 운행 일정' },
  { en: 'Assigned Trips', id: 'Perjalanan Ditugaskan', ko: '배정된 운행' },
  { en: 'Start Trip', id: 'Mulai Perjalanan', ko: '운행 시작' },
  { en: 'Complete Trip', id: 'Selesaikan Perjalanan', ko: '운행 완료' },
  { en: 'Upload Receipt', id: 'Unggah Struk / Kuitansi', ko: '영수증 첨부' },
  { en: 'Expense Category', id: 'Kategori Pengeluaran', ko: '지출 항목' },
  { en: 'Amount', id: 'Jumlah (Rp)', ko: '금액' },
  { en: 'Description', id: 'Keterangan', ko: '설명' },
  { en: 'Toll', id: 'Tol', ko: '통행료' },
  { en: 'Fuel', id: 'BBM', ko: '주유비' },
  { en: 'Parking', id: 'Parkir', ko: '주차비' },
  { en: 'Maintenance', id: 'Perawatan', ko: '정비비' },
  { en: 'Other', id: 'Lainnya', ko: '기타' },
  { en: 'Submit Expense', id: 'Kirim Pengeluaran', ko: '지출 등록' },
  { en: 'Receipt image', id: 'Foto struk/bukti', ko: '영수증 사진' },

  // Admin Modules
  { en: 'Fleet Map', id: 'Peta Armada', ko: '차량 관제 지도' },
  { en: 'Fleet Live Map', id: 'Peta Armada Live', ko: '실시간 차량 관제' },
  { en: 'Admin Dispatch', id: 'Disposisi Admin', ko: '관리자 배차' },
  { en: 'Approvals & Dispatch', id: 'Persetujuan & Disposisi', ko: '승인 및 배차' },
  { en: 'Fleet Operations', id: 'Operasional Armada', ko: '차량 관리' },
  { en: 'Fleet, Drivers & Energy', id: 'Armada, Pengemudi & Energi', ko: '차량, 기사 및 에너지 관리' },
  { en: 'Analytics & Reports', id: 'Analitik & Laporan', ko: '통계 및 보고서' },
  { en: 'Analytics & Reports (IDR)', id: 'Analitik & Laporan (IDR)', ko: '통계 및 보고서 (IDR)' },
  { en: 'Audit Log', id: 'Log Audit', ko: '감사 로그' },
  { en: 'Audit Trail', id: 'Jejak Audit', ko: '감사 추적' },
  { en: 'Audit Log & Cybersecurity', id: 'Log Audit & Keamanan Siber', ko: '감사 로그 및 보안' },
  { en: 'GalaxyFleet Admin Console', id: 'Konsol Admin GalaxyFleet', ko: 'GalaxyFleet 관리자 콘솔' },
  { en: 'Vehicles', id: 'Kendaraan', ko: '차량' },
  { en: 'Drivers', id: 'Pengemudi', ko: '기사' },
  { en: 'Fuel & EV', id: 'BBM & EV', ko: '연료 및 전기차' },
  { en: 'Expenses', id: 'Pengeluaran', ko: '지출' },
  { en: 'Documents', id: 'Dokumen', ko: '문서' },
  { en: 'Total Vehicles', id: 'Total Kendaraan', ko: '총 차량 수' },
  { en: 'Active Bookings', id: 'Pemesanan Aktif', ko: '진행 중인 예약' },
  { en: 'Total Distance', id: 'Total Jarak', ko: '총 주행거리' },
  { en: 'Approve', id: 'Setujui', ko: '승인' },
  { en: 'Reject', id: 'Tolak', ko: '반려' },
  { en: 'Reassign', id: 'Tugaskan Ulang', ko: '재배정' },
  { en: 'Reason for rejection', id: 'Alasan penolakan', ko: '반려 사유' },
  { en: 'Assign Driver', id: 'Tugaskan Driver', ko: '기사 배정' },
  { en: 'Select Driver', id: 'Pilih Driver', ko: '기사 선택' },

  // Auth & Profile
  { en: 'Sign In to GalaxyFleet', id: 'Masuk ke GalaxyFleet', ko: 'GalaxyFleet 로그인' },
  { en: 'Register Account', id: 'Daftar Akun Baru', ko: '새 계정 등록' },
  { en: 'Password', id: 'Kata Sandi', ko: '비밀번호' },
  { en: 'Remember Me', id: 'Ingat Saya', ko: '로그인 유지' },
  { en: "Don't have an account?", id: 'Belum punya akun?', ko: '계정이 없으신가요?' },
  { en: 'Already have an account?', id: 'Sudah punya akun?', ko: '이미 계정이 있으신가요?' },
  { en: 'Create Account', id: 'Buat Akun', ko: '계정 생성' },
  { en: 'Awaiting Administrator Approval', id: 'Menunggu Persetujuan Administrator', ko: '관리자 승인 대기 중' },
  { en: 'User Profile', id: 'Profil Pengguna', ko: '사용자 프로필' },
  { en: 'Account Information', id: 'Informasi Akun', ko: '계정 정보' },
  { en: 'Username', id: 'Nama Pengguna', ko: '아이디' },
  { en: 'Nickname', id: 'Nama Panggilan', ko: '닉네임' },
  { en: 'Department', id: 'Departemen', ko: '부서' },
  { en: 'Role', id: 'Peran', ko: '직책' },
  { en: 'Group', id: 'Grup', ko: '그룹' },
  { en: 'Current Password', id: 'Kata Sandi Saat Ini', ko: '현재 비밀번호' },
  { en: 'New Password', id: 'Kata Sandi Baru', ko: '새 비밀번호' },
  { en: 'Confirm New Password', id: 'Konfirmasi Kata Sandi Baru', ko: '새 비밀번호 확인' },
  { en: 'Update Password', id: 'Perbarui Kata Sandi', ko: '비밀번호 변경' },
  { en: 'Password updated successfully', id: 'Kata sandi berhasil diperbarui', ko: '비밀번호가 성공적으로 변경되었습니다' },
  { en: 'Enter current password', id: 'Masukkan kata sandi saat ini', ko: '현재 비밀번호 입력' },
  { en: 'Enter new password', id: 'Masukkan kata sandi baru', ko: '새 비밀번호 입력' },
  { en: 'Edit Profile', id: 'Ubah Profil', ko: '프로필 수정' },
  { en: 'Edit Profile & Details', id: 'Ubah Profil & Detail', ko: '프로필 및 상세 정보 수정' },
  { en: 'Change Account Password', id: 'Ganti Kata Sandi Akun', ko: '계정 비밀번호 변경' },
  { en: 'Push Notifications', id: 'Notifikasi Push', ko: '푸시 알림' },
  { en: 'Mark all as read', id: 'Tandai semua sudah dibaca', ko: '모두 읽음으로 표시' },
  { en: 'Mark all read', id: 'Tandai semua dibaca', ko: '모두 읽음으로 표시' },
  { en: 'Enable Real-Time Notifications', id: 'Aktifkan Notifikasi Real-Time', ko: '실시간 알림 활성화' },
  { en: 'Enable Real-Time Alerts', id: 'Aktifkan Notifikasi Real-Time', ko: '실시간 알림 활성화' },
  { en: 'Get instant push alerts for car approvals, driver dispatches, and operations.', id: 'Terima notifikasi instan untuk persetujuan mobil, disposisi driver, dan operasional.', ko: '차량 승인, 기사 배차 및 운행 알림을 실시간으로 받아보세요.' },
  { en: 'Get instant alerts for car approvals, dispatches, and trips.', id: 'Terima notifikasi instan untuk persetujuan mobil, disposisi, dan perjalanan.', ko: '차량 승인, 배차 및 운행 알림을 실시간으로 받아보세요.' },
  { en: 'Allow Alerts', id: 'Izinkan Notifikasi', ko: '알림 허용' },
  { en: 'Dismiss', id: 'Tutup', ko: '닫기' },
  { en: 'Allow', id: 'Izinkan', ko: '허용' },
  { en: 'Later', id: 'Nanti', ko: '나중에' },

  // Profile Modal & Menu
  { en: 'Profile Details', id: 'Detail Profil', ko: '프로필 정보' },
  { en: 'Change Password', id: 'Ganti Kata Sandi', ko: '비밀번호 변경' },
  { en: 'Upload New Photo', id: 'Unggah Foto Baru', ko: '새 사진 업로드' },
  { en: 'Remove Photo', id: 'Hapus Foto', ko: '사진 삭제' },
  { en: 'Full Name / Display Nickname', id: 'Nama Lengkap / Nama Panggilan', ko: '이름 / 닉네임' },
  { en: 'Contact Phone Number (WhatsApp / Mobile)', id: 'Nomor Telepon Kontak (WhatsApp / HP)', ko: '연락처 (WhatsApp / 휴대전화)' },
  { en: 'System Role', id: 'Peran Sistem', ko: '시스템 역할' },
  { en: 'Assigned Group', id: 'Grup Ditugaskan', ko: '소속 그룹' },
  { en: 'Saving...', id: 'Menyimpan...', ko: '저장 중...' },
  { en: 'Save Profile', id: 'Simpan Profil', ko: '프로필 저장' },
  { en: 'Updating...', id: 'Memperbarui...', ko: '변경 중...' },
  { en: 'Install GalaxyFleet App', id: 'Instal Aplikasi GalaxyFleet', ko: 'GalaxyFleet 앱 설치' },
  { en: 'Driver Dispatch Console', id: 'Konsol Disposisi Driver', ko: '기사 배차 콘솔' },
  { en: 'Admin Command Console', id: 'Konsol Komando Admin', ko: '관리자 관제 콘솔' },
  { en: 'Update display nickname, phone & photo', id: 'Perbarui nama panggilan, telepon & foto', ko: '닉네임, 연락처 및 사진 수정' },
  { en: 'Update login password securely', id: 'Perbarui kata sandi dengan aman', ko: '비밀번호 안전하게 변경' },
  { en: 'Active on this device', id: 'Aktif di perangkat ini', ko: '이 기기에서 활성화됨' },
  { en: 'Receive booking & dispatch updates', id: 'Terima pembaruan booking & disposisi', ko: '예약 및 배차 알림 수신' },
  { en: 'Add shortcut to your home screen', id: 'Tambah pintasan ke layar utama', ko: '홈 화면에 바로가기 추가' },
  { en: 'View assigned orders & periodic GPS check-ins', id: 'Lihat pesanan tugas & check-in GPS berkala', ko: '배정된 주문 및 주기적 GPS 체크인 확인' },
  { en: 'Approvals, vehicles, analytics & audit log', id: 'Persetujuan, kendaraan, analitik & log audit', ko: '승인, 차량, 통계 및 감사 로그' },
  { en: 'Phone', id: 'Telepon', ko: '전화' },

  // Inbox
  { en: 'Push notifications enabled (Send test)', id: 'Notifikasi push aktif (Kirim tes)', ko: '푸시 알림 활성화됨 (테스트 발송)' },
  { en: 'Enable Push Alerts', id: 'Aktifkan Notifikasi Push', ko: '푸시 알림 활성화' },
  { en: "You're all caught up! Alerts appear here.", id: 'Semua sudah beres! Notifikasi akan muncul di sini.', ko: '모두 확인했습니다! 새로운 알림이 여기에 표시됩니다.' },

  // Driver Dispatch Console
  { en: 'Duty & Trips', id: 'Tugas & Perjalanan', ko: '업무 및 운행' },
  { en: 'Car Timetable & Schedule', id: 'Jadwal & Agenda Mobil', ko: '차량 운행 시간표 및 일정' },
  { en: 'All Cars', id: 'Semua Mobil', ko: '모든 차량' },
  { en: 'Booked Today', id: 'Terjadwal Hari Ini', ko: '오늘 예약됨' },
  { en: 'Ready to Drive — Duty Active', id: 'Siap Mengemudi — Tugas Aktif', ko: '운행 준비 완료 — 근무 중' },
  { en: 'Step 1: Confirm Ready to Drive & Work', id: 'Langkah 1: Konfirmasi Siap Mengemudi & Bekerja', ko: '1단계: 운행 준비 및 출근 확인' },
  { en: 'Confirm Ready to Drive & Send Check-In Location', id: 'Konfirmasi Siap Mengemudi & Kirim Lokasi Check-In', ko: '운행 준비 확인 및 출근 위치 전송' },
  { en: 'Update Check-In Location', id: 'Perbarui Lokasi Check-In', ko: '체크인 위치 업데이트' },
  { en: 'Go Offline', id: 'Mode Offline', ko: '오프라인 전환' },
  { en: 'Reimbursements & Receipts', id: 'Klaim Biaya & Kuitansi', ko: '경비 청구 및 영수증' },
  { en: 'Upload Parking, Gas, Charging (EV), and Toll receipts for reimbursement approval', id: 'Unggah kuitansi Parkir, BBM, Charging (EV), dan Tol untuk persetujuan klaim biaya', ko: '주차비, 주유비, 충전비(EV), 통행료 영수증을 업로드하여 정산 승인을 받으세요' },
  { en: 'Edit Profile & Password', id: 'Ubah Profil & Kata Sandi', ko: '프로필 및 비밀번호 수정' },
  { en: 'Update Photo', id: 'Perbarui Foto', ko: '사진 변경' },
  { en: 'My Driver Agenda (Today)', id: 'Agenda Pengemudi Saya (Hari Ini)', ko: '내 운행 일정 (오늘)' },
  { en: 'Free all day', id: 'Kosong sepanjang hari', ko: '하루 종일 이용 가능' },
  { en: 'Acknowledge Order & Confirm Ready', id: 'Konfirmasi Terima Pesanan & Siap', ko: '주문 접수 및 준비 완료' },
  { en: 'Mandatory Start Odometer Photo', id: 'Foto Odometer Awal Wajib', ko: '출발 주행거리 계기판 사진 (필수)' },
  { en: 'Mandatory Completion Odometer Photo', id: 'Foto Odometer Selesai Wajib', ko: '도착 주행거리 계기판 사진 (필수)' },
  { en: 'Start Odometer (km)', id: 'Odometer Awal (km)', ko: '출발 주행거리 (km)' },
  { en: 'End Odometer', id: 'Odometer Akhir', ko: '도착 주행거리' },

  // Auth Screen
  { en: 'Enter your username', id: 'Masukkan username Anda', ko: '아이디를 입력하세요' },
  { en: 'Enter your password', id: 'Masukkan kata sandi Anda', ko: '비밀번호를 입력하세요' },
  { en: 'Enter your nickname', id: 'Masukkan nama panggilan Anda', ko: '닉네임을 입력하세요' },
  { en: 'Minimum 6 characters', id: 'Minimal 6 karakter', ko: '최소 6자 이상' },
  { en: 'Account Type', id: 'Tipe Akun', ko: '계정 유형' },
  { en: 'User / Employee (Book & Reserve Cars)', id: 'Pengguna / Karyawan (Pesan & Reservasi Mobil)', ko: '임직원 / 사용자 (차량 예약 및 이용)' },
  { en: 'Company Driver (Receive Dispatch Orders)', id: 'Driver Perusahaan (Terima Pesanan Tugas)', ko: '전담 기사 (배차 및 운행 수행)' },
  { en: 'Submit Registration', id: 'Kirim Pendaftaran', ko: '가입 신청' },

  // Fleet Ops subtabs (exact and uppercase keys)
  { en: 'VEHICLES', id: 'KENDARAAN', ko: '차량' },
  { en: 'DRIVERS', id: 'PENGEMUDI', ko: '기사' },
  { en: 'GROUPS', id: 'GRUP', ko: '그룹' },
  { en: 'FUEL_EV', id: 'BBM & EV', ko: '연료/전기차' },
  { en: 'MAINTENANCE', id: 'PERAWATAN', ko: '정비' },
  { en: 'EXPENSES', id: 'PENGELUARAN', ko: '지출' },
  { en: 'DOCUMENTS', id: 'DOKUMEN', ko: '문서' },

  // Super-App Home (Pic 1) & Booking Landing (Pic 2)
  { en: 'Company Facility', id: 'Fasilitas Perusahaan', ko: '사내 지원 시설' },
  { en: 'Zero Operational Cost (Rp0)', id: 'Bebas Biaya Operasional (Rp0)', ko: '업무 비용 무료 (Rp0)' },
  { en: 'Book Car', id: 'Pesan Mobil', ko: '차량 예약' },
  { en: 'Official Car', id: 'Mobil Dinas', ko: '업무용 차량' },
  { en: 'Shuttle Bus', id: 'Bus Jemputan', ko: '통근 버스' },
  { en: 'VIP / Executive', id: 'VIP / Direksi', ko: 'VIP / 임원' },
  { en: 'Logistics Transport', id: 'Kirim Logistik', ko: '물류 배송' },
  { en: 'Favorite Routes', id: 'Rute Favorit', ko: '자주 가는 경로' },
  { en: 'Fleet Helpdesk', id: 'Bantuan Armada', ko: '차량 지원센터' },
  { en: 'Your Frequent Destinations', id: 'Pilihan kamu biasanya', ko: '자주 찾는 목적지' },
  { en: 'Where to today?', id: 'Mau ke mana hari ini?', ko: '어디로 이동하시나요?' },
  { en: 'Under Development', id: 'Sedang Dikembangkan', ko: '개발 중' },
  { en: 'Under Dev', id: 'Tahap Dev', ko: '개발 중' },
  { en: 'Shuttle Bus service is currently under development.', id: 'Bus Jemputan sedang dalam tahap pengembangan (Under Development).', ko: '셔틀버스 서비스는 현재 개발 중입니다 (Under Development).' },
  { en: 'Seamless corporate mobility with GalaxyFleet', id: 'Pergi dinas operasional mudah dengan GalaxyFleet', ko: 'GalaxyFleet과 함께하는 편리한 업무 이동' },
  { en: 'Travel on duty with your team • Zero-cost corporate vehicle facility', id: 'Pergi dinas bersama tim • Fasilitas kendaraan dinas bebas biaya', ko: '팀원과 함께 업무 이동 • 사내 차량 무료 지원' },
  { en: 'Search corporate services or destinations...', id: 'Cari layanan dinas atau tujuan...', ko: '업무 서비스 또는 목적지 검색...' },

  // Driver Console & Gojek Driver Reference
  { en: 'Trip Log', id: 'Log Perjalanan', ko: '운행 일지' },
  { en: 'Duty', id: 'Tugas', ko: '근무' },
  { en: 'Account', id: 'Akun', ko: '계정' },
  { en: 'Messages', id: 'Pesan', ko: '메시지' },
  { en: 'Ready for Duty', id: 'Siap Tugas', ko: '근무 대기' },
  { en: 'Switching to online...', id: 'Mengubah jadi online...', ko: '온라인 상태로 전환 중...' },
  { en: 'You are now online', id: 'Anda sekarang online', ko: '현재 온라인 상태입니다' },
  { en: "Let's start duty!", id: 'Mulai kerja, yuk!', ko: '업무를 시작해 볼까요!' },
  { en: 'in service driving', id: 'dalam dinas menyetir', ko: '운행 중' },
  { en: 'Total Driving Time', id: 'Total Waktu Menyetir', ko: '총 운행 시간' },
  { en: 'Trips Completed', id: 'Perjalanan Selesai', ko: '완료된 운행' },
  { en: 'Assigned Vehicle', id: 'Kendaraan Ditugaskan', ko: '배정 차량' },
  { en: 'SIM License', id: 'Surat Izin Mengemudi (SIM)', ko: '운전면허증' },
  { en: 'Corporate Driver Profile', id: 'Profil Driver Perusahaan', ko: '전담 기사 프로필' },
  { en: 'App Version', id: 'Versi Aplikasi', ko: '앱 버전' },

  // Prototype Simple Mobile Flow & Admin Mobile Navigation
  { en: 'Search services', id: 'Cari layanan', ko: '서비스 검색' },
  { en: 'Search services, cars, destinations...', id: 'Cari layanan, mobil, tujuan...', ko: '서비스, 차량, 목적지 검색...' },
  { en: 'Quick Destinations', id: 'Pilihan cepat buatmu', ko: '빠른 목적지 선택' },
  { en: 'Ready for official travel', id: 'Siap untuk perjalanan dinas Anda', ko: '업무 출장 준비 완료' },
  { en: 'Available • 8 Cars', id: 'Tersedia • 8 Unit', ko: '이용 가능 • 8대' },
  { en: 'Ready for Duty', id: 'Siap Jalan', ko: '운행 준비 완료' },
  { en: 'Office Route', id: 'Rute Kantor', ko: '사무실 노선' },
  { en: 'Book in Advance', id: 'Pesan di Depan', ko: '사전 예약' },
  { en: 'Book Now', id: 'Pesan Sekarang', ko: '지금 예약' },
  { en: 'Company Car', id: 'Mobil Kantor', ko: '회사 차량' },
  { en: 'Trip Log', id: 'Riwayat Trip', ko: '운행 기록' },
  { en: 'Recent Activity', id: 'Aktivitas Terbaru', ko: '최근 활동' },
  { en: 'Car', id: 'Mobil', ko: '차량' },
  { en: 'No bookings yet', id: 'Belum ada booking', ko: '예약 내역이 없습니다' },
  { en: 'Tap Car to start a booking.', id: 'Ketuk Mobil untuk mulai memesan.', ko: '차량을 눌러 예약을 시작하세요.' },
  { en: 'Operational Car', id: 'Mobil Operasional', ko: '업무용 차량' },
  { en: 'Where to,', id: 'Mau pergi,', ko: '어디로 가시나요,' },
  { en: 'Operational cars ready to roll.', id: 'Mobil operasional siap jalan.', ko: '업무용 차량이 대기 중입니다.' },
  { en: 'Booking reviewed before departure', id: 'Booking dicek sebelum berangkat', ko: '출발 전 승인 검토가 진행됩니다' },
  { en: 'Reviewed by Fleet PIC & Head of WS. Check status here.', id: 'Disetujui Fleet PIC & Head of WS sebelum jalan. Cek di sini.', ko: '차량 담당자 및 부서장 승인 후 운행됩니다. 상태를 확인하세요.' },
  { en: 'Internal Work Fleet • Chauffeur Included', id: 'Armada Dinas Internal • Termasuk Driver', ko: '사내 업무용 차량 • 전담 기사 포함' },
  { en: 'All Fleet', id: 'Semua Armada', ko: '전체 차량' },
  { en: 'Electric EV', id: 'Listrik EV', ko: '전기차 EV' },
  { en: 'Executive & MPV', id: 'Eksekutif & MPV', ko: '승합 및 MPV' },
  { en: 'Shuttle (Dev)', id: 'Shuttle (Dev)', ko: '셔틀 (개발중)' },
  { en: 'Ready', id: 'Siap', ko: '대기' },
  { en: 'Busy', id: 'Terpakai', ko: '운행 중' },
  { en: 'Map', id: 'Peta', ko: '지도' },
  { en: 'Fleet', id: 'Armada', ko: '차량' },
  { en: 'Reports', id: 'Laporan', ko: '보고서' },
  { en: 'Audit', id: 'Audit', ko: '감사' },
  { en: 'Pending Account Registrations', id: 'Pendaftaran Akun Menunggu', ko: '가입 승인 대기 계정' },
  { en: 'Send Upcoming Push Reminders', id: 'Kirim Pengingat Jadwal Push', ko: '예약 알림 푸시 발송' },
  { en: 'All registered accounts have been reviewed.', id: 'Semua akun terdaftar telah ditinjau.', ko: '모든 가입 계정이 검토되었습니다.' },
  { en: 'Vehicle Bookings & Dispatch Queue', id: 'Antrean Booking & Disposisi Kendaraan', ko: '차량 예약 및 배차 대기열' },
  { en: 'No vehicle bookings submitted yet.', id: 'Belum ada pemesanan kendaraan.', ko: '등록된 차량 예약이 없습니다.' },
  { en: 'Review & Dispatch', id: 'Tinjau & Disposisi', ko: '검토 및 배차' },
  { en: 'Manage', id: 'Kelola', ko: '관리' },
  { en: 'User Registry & Account Management', id: 'Daftar Pengguna & Manajemen Akun', ko: '사용자 등록 및 계정 관리' },
  { en: 'Create User', id: 'Buat Pengguna', ko: '사용자 생성' },
  { en: 'Deactivate', id: 'Nonaktifkan', ko: '비활성화' },
  { en: 'Activate', id: 'Aktifkan', ko: '활성화' },
  { en: 'Mandatory: Fill Purpose & Passengers before booking', id: 'Wajib isi: Keperluan & Penumpang sebelum memesan', ko: '필수 입력: 예약 전 운행 목적과 동승자를 입력하세요' },
  { en: 'Assigned Dedicated Car', id: 'Mobil Khusus Ditugaskan', ko: '전담 배정 차량' },
  { en: 'Driver dispatch console', id: 'Konsol disposisi driver', ko: '기사 배차 콘솔' },
  { en: 'Status updated to Offline', id: 'Status berubah ke Offline', ko: '오프라인 상태로 전환되었습니다' },
  { en: 'Online', id: 'Online', ko: '온라인' },
  { en: 'Offline', id: 'Offline', ko: '오프라인' },
  { en: 'Reimbursements', id: 'Reimbursements', ko: '경비 청구' },
  { en: 'Driver Reimbursements', id: 'Klaim Biaya Driver', ko: '기사 경비 청구' },
  { en: 'Upload Parking, Gas, EV Charging, and Toll receipts', id: 'Unggah struk Parkir, BBM, Pengisian EV, dan Tol', ko: '주차, 주유, EV 충전, 통행료 영수증을 업로드하세요' },
  { en: 'No reimbursement claims submitted yet.', id: 'Belum ada pengajuan klaim biaya.', ko: '아직 제출된 경비 청구가 없습니다.' },

  // Additional Employee, Driver & Admin UI Phrases (Comprehensive Coverage)
  { en: 'Waiting for approval', id: 'Menunggu persetujuan', ko: '승인 대기 중' },
  { en: 'Approved & Dispatched', id: 'Disetujui & Dikirim', ko: '승인 및 배차 완료' },
  { en: 'Request sent', id: 'Permintaan terkirim', ko: '요청 전송됨' },
  { en: 'Booking Approved!', id: 'Booking Disetujui!', ko: '예약 승인 완료!' },
  { en: 'Booking Request Rejected', id: 'Permintaan Booking Ditolak', ko: '예약 요청 반려됨' },
  { en: 'Awaiting Fleet Operation PIC Urgent Approval', id: 'Menunggu Persetujuan Mendesak PIC Armada', ko: '차량 담당자 긴급 승인 대기 중' },
  { en: 'Awaiting Fleet Operation PIC Consent (Stage 1)', id: 'Menunggu Persetujuan PIC Operasional Armada (Tahap 1)', ko: '1단계: 차량 운영 담당자 동의 대기 중' },
  { en: 'Awaiting Head Of WS Part Review', id: 'Menunggu Tinjauan Head Of WS Part', ko: 'WS 부서장 검토 대기 중' },
  { en: 'Awaiting Head Of WS Part Approval (Stage 2)', id: 'Menunggu Persetujuan Head Of WS Part (Tahap 2)', ko: '2단계: WS 부서장 최종 승인 대기 중' },
  { en: 'Awaiting Fleet PIC Dispatch', id: 'Menunggu Disposisi Fleet PIC', ko: '차량 담당자 배차 대기 중' },
  { en: 'Stage 1 Approved', id: 'Tahap 1 Disetujui', ko: '1단계 승인 완료' },
  { en: 'Stage 1: Fleet PIC Consent', id: 'Tahap 1: Persetujuan Fleet PIC', ko: '1단계: 차량 담당자 동의' },
  { en: 'Stage 2: Head Of WS Approval', id: 'Tahap 2: Persetujuan Head Of WS', ko: '2단계: WS 부서장 승인' },
  { en: 'Sequential Approval Hierarchy', id: 'Hierarki Persetujuan Berurutan', ko: '순차적 승인 체계' },
  { en: 'Step 1: Fleet Operation PIC must consent first before Step 2: Head Of WS Part can approve.', id: 'Tahap 1: PIC Operasional Armada wajib menyetujui lebih dulu sebelum Tahap 2: Head Of WS Part dapat menyetujui.', ko: '1단계 차량 운영 담당자 동의 후 2단계 WS 부서장 승인이 가능합니다.' },
  { en: 'Awaiting Stage 1 (Fleet Operation PIC Consent) first', id: 'Menunggu Tahap 1 (Persetujuan PIC Armada) terlebih dahulu', ko: '1단계(차량 담당자 동의) 완료 대기 중' },
  { en: 'Consent as Fleet Operation PIC (Stage 1)', id: 'Setujui sebagai PIC Operasional Armada (Tahap 1)', ko: '차량 담당자 동의 (1단계)' },
  { en: 'Approve & Dispatch as Head Of WS (Stage 2)', id: 'Setujui & Disposisi sebagai Head Of WS (Tahap 2)', ko: 'WS 부서장 최종 승인 및 배차 (2단계)' },
  { en: 'Approve & Delegate as Admin', id: 'Setujui & Delegasikan sebagai Admin', ko: '관리자 권한으로 즉시 승인 및 배차' },
  { en: 'Open Active Trip & Driver Info', id: 'Buka Info Perjalanan & Driver Aktif', ko: '진행 중인 운행 및 기사 정보 열기' },
  { en: 'Dismiss & Return to Home', id: 'Tutup & Kembali ke Beranda', ko: '닫고 홈으로 돌아가기' },
  { en: 'Sync Status', id: 'Sinkronkan Status', ko: '상태 동기화' },
  { en: 'Cancel Request', id: 'Batalkan Permintaan', ko: '요청 취소' },
  { en: 'Cancel Booking', id: 'Batalkan Booking', ko: '예약 취소' },
  { en: 'Cancel Approved Booking', id: 'Batalkan Booking yang Disetujui', ko: '승인된 예약 취소' },
  { en: 'Plans changed? You can cancel this booking to free the vehicle slot.', id: 'Rencana berubah? Anda dapat membatalkan booking ini agar slot mobil tersedia kembali.', ko: '일정이 변경되셨나요? 예약을 취소하여 차량 슬롯을 비울 수 있습니다.' },
  { en: 'I Am Here / Confirm Boarding', id: 'Saya Sudah di Mobil / Konfirmasi Naik', ko: '탑승 확인 (출발 대기)' },
  { en: 'Boarding Confirmed', id: 'Konfirmasi Naik Tercatat', ko: '탑승 확인 완료' },
  { en: 'Boarding Confirmed • Ready for Driver Start Trip', id: 'Penumpang Sudah Naik • Siap Driver Mulai Jalan', ko: '탑승 확인됨 • 기사 출발 대기' },
  { en: 'Departure Reminder (10 Min Warning)', id: 'Pengingat Keberangkatan (10 Menit Sebelum Jalan)', ko: '출발 10분 전 알림' },
  { en: 'Auto-cancels 20 minutes after scheduled departure if passenger does not show up.', id: 'Otomatis dibatalkan 20 menit setelah jadwal berangkat jika penumpang tidak hadir.', ko: '출발 시간 후 20분 이내 미탑승 시 자동 취소됩니다.' },
  { en: 'Please confirm boarding or ask driver to start trip within 20 minutes of departure.', id: 'Harap konfirmasi naik atau minta driver mulai perjalanan dalam 20 menit dari jadwal berangkat.', ko: '출발 후 20분 이내에 탑승 확인을 누르거나 기사에게 운행 시작을 요청하세요.' },
  { en: 'Pre-Booking Confirmation', id: 'Konfirmasi Sebelum Booking', ko: '예약 최종 확인' },
  { en: 'Review your schedule and trip details before submitting your booking request.', id: 'Periksa kembali jadwal dan rincian perjalanan Anda sebelum mengirim permintaan booking.', ko: '예약 요청을 제출하기 전에 일정과 운행 정보를 확인하세요.' },
  { en: 'Default departure is set to 2 hours from now. Need to leave earlier? Tap Change Schedule.', id: 'Waktu berangkat otomatis diatur 2 jam dari sekarang. Perlu berangkat lebih cepat/mendesak? Ketuk Ubah Jadwal.', ko: '기본 출발 시간은 현재로부터 2시간 후로 설정됩니다. 긴급 출발이 필요하시면 일정 변경을 누르세요.' },
  { en: 'Urgent Departure (< 2 Hours From Now)', id: 'Keberangkatan Mendesak (< 2 Jam Dari Sekarang)', ko: '긴급 출발 (현재로부터 2시간 이내)' },
  { en: 'You selected a departure time less than 2 hours from now. Would you like to keep this urgent time or adjust the schedule?', id: 'Anda memilih waktu keberangkatan kurang dari 2 jam dari sekarang. Apakah Anda yakin ingin jadwal mendesak ini atau ingin mengubah jadwal?', ko: '출발 시간이 현재로부터 2시간 이내입니다. 긴급 일정으로 진행하시겠습니까, 아니면 시간을 변경하시겠습니까?' },
  { en: 'Adjust Schedule Time', id: 'Ubah Waktu Jadwal', ko: '출발 시간 변경' },
  { en: 'Confirm & Submit Booking', id: 'Konfirmasi & Kirim Booking', ko: '예약 확정 및 제출' },
  { en: 'Pick Destination on Map', id: 'Pilih Tujuan di Peta', ko: '지도에서 목적지 선택' },
  { en: 'Select via map', id: 'Pilih lewat peta', ko: '지도에서 선택' },
  { en: 'Saved places', id: 'Tempat tersimpan', ko: '저장된 장소' },
  { en: 'Confirm pickup spot', id: 'Konfirmasi titik jemput', ko: '픽업 지점 확인' },
  { en: 'Use GPS', id: 'Gunakan GPS', ko: 'GPS 사용' },
  { en: 'Quick Corporate Locations', id: 'Lokasi Korporat Cepat', ko: '주요 사내 거점' },
  { en: 'Driver provided', id: 'Termasuk pengemudi', ko: '전담 기사 포함' },
  { en: 'Company driver assigned & schedule locked', id: 'Driver perusahaan ditugaskan & jadwal dikunci', ko: '사내 기사 배정 및 일정 고정' },
  { en: 'Included', id: 'Termasuk', ko: '포함됨' },
  { en: 'Self-drive', id: 'Lepas kunci (Self-drive)', ko: '자가 운전' },
  { en: 'Disabled by company policy', id: 'Dinonaktifkan sesuai kebijakan perusahaan', ko: '회사 정책에 의해 비활성화됨' },
  { en: 'Auto-assign on Admin approval', id: 'Otomatis ditugaskan saat disetujui Admin', ko: '관리자 승인 시 자동 배정' },
  { en: 'Petty Cash Balance', id: 'Saldo Kas Kecil (Petty Cash)', ko: '소액 현금(페티캐시) 잔액' },
  { en: 'Driver Petty Cash Wallet', id: 'Dompet Petty Cash Driver', ko: '기사 소액 현금(페티캐시) 지갑' },
  { en: 'Cash parking and operational fees are deducted from your Petty Cash float and replenished upon Admin/Fleet PIC approval.', id: 'Biaya parkir tunai dan operasional dipotong dari saldo Petty Cash Anda dan diisi kembali saat klaim disetujui Admin/Fleet PIC.', ko: '현금 주차비 및 운행 경비는 페티캐시 잔액에서 차감되며 관리자 승인 시 보충됩니다.' },
  { en: 'Pending Petty Cash Claims', id: 'Klaim Petty Cash Menunggu', ko: '승인 대기 중인 페티캐시 청구' },
  { en: 'Reimbursed to Petty Cash', id: 'Telah Direimburse ke Petty Cash', ko: '페티캐시 보충 완료액' },
  { en: 'Payment Source', id: 'Sumber Pembayaran', ko: '결제 수단' },
  { en: 'Petty Cash (Cash Parking / Operational)', id: 'Petty Cash (Parkir Tunai / Operasional)', ko: '페티캐시 (현금 주차/운행비)' },
  { en: 'Driver Personal Advance (Reimburse)', id: 'Talangan Pribadi Driver (Reimburse)', ko: '기사 개인 선결제 (정산 청구)' },
  { en: 'Top Up Petty Cash', id: 'Top Up Saldo Petty Cash', ko: '페티캐시 잔액 충전' },
  { en: 'Assigned Operational Vehicle (Auto-Filled)', id: 'Kendaraan Operasional Ditugaskan (Otomatis Terisi)', ko: '배정된 운행 차량 (자동 입력됨)' },
  { en: 'Locked to your logged-in driver account so reimbursements never mix with other drivers.', id: 'Dikunci ke akun driver Anda agar klaim reimbursement tidak tercampur dengan driver lain.', ko: '로그인한 기사 계정에 고정되어 다른 기사의 정산 내역과 섞이지 않습니다.' },
  { en: 'Remove Photo / Cancel Upload', id: 'Hapus Foto / Batalkan Unggahan', ko: '사진 삭제 / 업로드 취소' },
  { en: 'Delete Receipt Photo', id: 'Hapus Foto Struk', ko: '영수증 사진 삭제' },
  { en: 'Delete Claim', id: 'Hapus Klaim', ko: '청구 내역 삭제' },
  { en: 'My Assigned Schedule Only', id: 'Hanya Jadwal Tugas Saya', ko: '내 배정 일정만 표시' },
  { en: 'Drivers can view their own assigned schedule only. Full fleet schedule is restricted to Admin, Fleet PIC, and Head of WS.', id: 'Driver hanya dapat melihat jadwal miliknya sendiri. Jadwal seluruh armada hanya untuk Admin, Fleet PIC, dan Head of WS.', ko: '기사는 본인의 배정 일정만 볼 수 있습니다. 전체 차량 일정은 관리자, 차량 담당자 및 부서장만 열람 가능합니다.' },
  { en: 'Fleet Schedule', id: 'Jadwal Armada', ko: '차량 운행 일정' },
  { en: 'Live operational timetable & dedicated drivers', id: 'Jadwal operasional langsung & pengemudi khusus', ko: '실시간 운행 시간표 및 전담 기사' },
  { en: 'Live Availability', id: 'Ketersediaan Live', ko: '실시간 현황' },
  { en: 'Select & Book This Vehicle', id: 'Pilih & Pesan Kendaraan Ini', ko: '이 차량 선택 및 예약' },
  { en: 'No dispatch orders assigned to you yet.', id: 'Belum ada perintah disposisi yang ditugaskan kepada Anda.', ko: '아직 배정된 운행 명령이 없습니다.' },
  { en: 'View Receipt', id: 'Lihat Struk', ko: '영수증 보기' },
  { en: 'Submit Claim', id: 'Kirim Klaim', ko: '청구 제출' },
  { en: 'Overall Fleet Live Map', id: 'Peta Live Seluruh Armada', ko: '전체 차량 실시간 관제 지도' },
  { en: 'Live Vehicle Status Directory', id: 'Direktori Status Kendaraan Live', ko: '실시간 차량 상태 목록' },
  { en: 'Register New Vehicle', id: 'Daftarkan Kendaraan Baru', ko: '신규 차량 등록' },
  { en: 'Add Vehicle', id: 'Tambah Kendaraan', ko: '차량 추가' },
  { en: 'Register / Update Driver Profile & Group', id: 'Daftarkan / Perbarui Profil & Grup Driver', ko: '기사 프로필 및 그룹 등록/수정' },
  { en: 'Save Driver', id: 'Simpan Driver', ko: '기사 저장' },
  { en: 'Add Group', id: 'Tambah Grup', ko: '그룹 추가' },
  { en: 'Gasoline Fuel Records (Litres)', id: 'Catatan BBM Bensin (Liter)', ko: '가솔린 주유 기록 (리터)' },
  { en: 'EV Charging Records (kWh)', id: 'Catatan Pengisian EV (kWh)', ko: '전기차 충전 기록 (kWh)' },
  { en: 'Maintenance Schedule', id: 'Jadwal Perawatan', ko: '정비 일정' },
  { en: 'Document Vault', id: 'Penyimpanan Dokumen', ko: '문서 보관함' },
  { en: 'Usage Analytics & Executive Briefing', id: 'Analitik Penggunaan & Laporan Eksekutif', ko: '운행 통계 및 임원 브리핑' },
  { en: 'Open Executive Report (PDF/Print)', id: 'Buka Laporan Eksekutif (PDF/Cetak)', ko: '임원 보고서 열기 (PDF/인쇄)' },
  { en: 'Print Executive Briefing', id: 'Cetak Laporan Eksekutif', ko: '임원 브리핑 인쇄' },
  { en: 'Vehicle Usage & Cost Breakdown (IDR)', id: 'Rincian Penggunaan & Biaya Kendaraan (IDR)', ko: '차량별 운행 및 비용 내역 (IDR)' },
  { en: 'Driver Operational Usage Summary', id: 'Ringkasan Penggunaan Operasional Driver', ko: '기사별 운행 요약' },
  { en: 'Group Order', id: 'Pesanan Grup', ko: '그룹 배차' },
  { en: 'Work Trip', id: 'Perjalanan Dinas', ko: '업무 운행' },
  { en: 'Call', id: 'Telepon', ko: '전화' },
  { en: 'Share', id: 'Bagikan', ko: '공유' },
  { en: 'Instant', id: 'Langsung', ko: '즉시' },
  { en: 'Scheduled', id: 'Terjadwal', ko: '예약됨' },
  { en: 'Booking History', id: 'Riwayat Pesanan', ko: '예약 내역' },
  { en: 'Stage 1/2: Awaiting Fleet PIC Consent', id: 'Tahap 1/2: Menunggu Persetujuan PIC Fleet', ko: '1/2단계: 차량 담당자 동의 대기' },
  { en: 'Stage 2/2: Fleet PIC Consented', id: 'Tahap 2/2: PIC Fleet Setuju', ko: '2/2단계: 차량 담당자 동의 완료' },
  { en: 'Awaiting Head of WS', id: 'Menunggu Head of WS', ko: 'WS 부서장 승인 대기' },
  { en: 'Stage 2/2: Fleet PIC Consented • Awaiting Head of WS', id: 'Tahap 2/2: PIC Fleet Setuju • Menunggu Head of WS', ko: '2/2단계: 차량 담당자 동의 완료 • WS 부서장 승인 대기' },
  { en: 'Internal Work Fleet • Driver Included', id: 'Armada Dinas Internal • Termasuk Driver', ko: '사내 업무용 차량 • 전담 기사 포함' },
  { en: 'Driver included', id: 'Termasuk Driver', ko: '전담 기사 포함' },
  { en: 'Round Trip', id: 'Pulang Pergi (Round Trip)', ko: '왕복 운행' },
  { en: 'Standard Trip', id: 'Perjalanan Standar', ko: '일반 편도 운행' },
  { en: 'Full Day', id: 'Seharian Penuh (Full Day)', ko: '전일 대절 (Full Day)' },
  { en: 'Trip Category', id: 'Kategori Perjalanan', ko: '운행 유형' },
  { en: 'Departure & Return Time', id: 'Waktu Berangkat & Kembali', ko: '출발 및 복귀 시간' },
  { en: 'Passengers Name (1, 2, 3...)', id: 'Nama Penumpang (1, 2, 3...)', ko: '탑승자 이름 (1, 2, 3...)' },
  { en: 'Set Schedule (07:00 AM - 04:00 PM)', id: 'Jadwal Booking (07:00 - 16:00)', ko: '배차 시간표 (07:00 AM - 04:00 PM)' },
  { en: 'Negotiate / Hitchhike', id: 'Negosiasi / Nebeng (Hitchhike)', ko: '일정 협의 / 합승 요청' },
  { en: 'Hitchhike (Same Destination)', id: 'Nebeng / Gabung Trip (Tujuan Sama)', ko: '합승 요청 (동일 목적지)' },
  { en: 'Negotiate to Cancel', id: 'Negosiasi Batalkan / Tukar Slot', ko: '예약 양보/취소 협의' },
  { en: 'Accept Hitchhike', id: 'Terima Nebeng (Tambah Penumpang)', ko: '합승 수락 (동승자 추가)' },
  { en: 'Auto-Accepted Order', id: 'Order Otomatis Diterima', ko: '자동 수락된 배차' },
  { en: 'Back', id: 'Kembali', ko: '뒤로' },
  { en: 'Driver Schedule', id: 'Jadwal Pengemudi', ko: '기사 배차 일정' },
  { en: 'booked', id: 'dipesan', ko: '예약됨' },
  { en: 'Pool Driver', id: 'Pengemudi Pool', ko: '대기 기사' },
  { en: 'You', id: 'Anda', ko: '본인' },
  { en: 'pax', id: 'orang', ko: '명' },
  { en: 'Passengers On Board', id: 'Penumpang di Dalam Mobil', ko: '탑승자 명단' },
  { en: 'Tap a booking to see who booked the car and who is on board', id: 'Ketuk jadwal untuk melihat pemesan dan daftar penumpang', ko: '예약을 탭하여 예약자와 탑승자를 확인하세요' },
  { en: 'Previous day', id: 'Hari sebelumnya', ko: '이전 날짜' },
  { en: 'Next day', id: 'Hari berikutnya', ko: '다음 날짜' },
  { en: 'Open Approval / Dispatch', id: 'Buka Persetujuan / Dispatch', ko: '승인 / 배차 열기' },
  { en: 'Employee', id: 'Karyawan', ko: '직원' },
  { en: 'Available All Day', id: 'Tersedia Seharian', ko: '종일 이용 가능' },
  { en: 'Tap to read full message', id: 'Ketuk untuk baca selengkapnya', ko: '전체 내용을 보려면 탭하세요' },
  { en: 'Notification Details', id: 'Detail Notifikasi', ko: '알림 상세 정보' },
  { en: 'Accept & Transfer Slot', id: 'Terima & Alihkan Slot', ko: '수락 및 예약 양도' },
  { en: 'Accepted', id: 'Diterima', ko: '수락됨' },
  { en: 'added to passengers', id: 'ditambahkan ke penumpang', ko: '탑승자에 추가됨' },
  { en: 'Booking cancelled & transferred', id: 'Pesanan dibatalkan & dialihkan', ko: '예약 취소 및 양도 완료' },
  { en: 'Hitchhike accepted! Passenger added to your booking.', id: 'Nebeng diterima! Penumpang ditambahkan ke pesanan Anda.', ko: '합승이 수락되었습니다! 탑승자 명단에 추가되었습니다.' },
  { en: 'Cancellation accepted! Booking cancelled and transferred to requester', id: 'Pembatalan diterima! Pesanan dibatalkan dan dialihkan ke pemohon', ko: '취소 요청이 수락되었습니다! 예약이 취소되고 요청자에게 양도되었습니다' },
  { en: 'Hitchhike request rejected.', id: 'Permintaan nebeng ditolak.', ko: '합승 요청이 거절되었습니다.' },
  { en: 'Cancellation request rejected. Your booking remains active.', id: 'Permintaan pembatalan ditolak. Pesanan Anda tetap aktif.', ko: '취소 요청이 거절되었습니다. 기존 예약이 유지됩니다.' },
  { en: 'Active Schedule', id: 'Jadwal Aktif', ko: '현재 일정' },
  { en: 'Past & Completed (Audit)', id: 'Riwayat Selesai (Audit)', ko: '완료 및 과거 기록 (감사)' },
  { en: 'Completed & past schedule records preserved for audit review', id: 'Riwayat jadwal & perjalanan selesai tersimpan untuk tinjauan audit', ko: '감사 검토를 위해 보존된 완료 및 과거 배차 기록' },
  { en: 'Completed Trips', id: 'Perjalanan Selesai', ko: '완료된 운행' },
  { en: 'All Past (Completed/Cancelled/Rejected)', id: 'Semua Riwayat (Selesai/Batal/Ditolak)', ko: '전체 과거 기록 (완료/취소/거절)' },
  { en: 'All Records', id: 'Semua Catatan', ko: '전체 기록' },
  { en: 'All Dates', id: 'Semua Tanggal', ko: '전체 날짜' },
  { en: 'Search car, driver, booker, destination...', id: 'Cari mobil, pengemudi, pemesan, tujuan...', ko: '차량, 기사, 예약자, 목적지 검색...' },
  { en: 'No schedule audit records match this filter.', id: 'Tidak ada catatan audit jadwal yang cocok.', ko: '조건에 맞는 일정 감사 기록이 없습니다.' },
  { en: 'View Audit Record', id: 'Lihat Catatan Audit', ko: '감사 기록 보기' },
  { en: 'Past & Completed Schedule Records (Audit)', id: 'Catatan Jadwal & Perjalanan Selesai (Audit)', ko: '완료 및 과거 배차 기록 (감사)' },
  { en: 'Review completed bookings, passengers, routes, odometer readings, and approval decisions.', id: 'Tinjau pesanan selesai, penumpang, rute, odometer, dan keputusan persetujuan.', ko: '완료된 예약, 탑승자, 경로, 주행거리계 및 승인 내역을 검토합니다.' },
  { en: 'Open Full Schedule Audit', id: 'Buka Audit Jadwal Lengkap', ko: '전체 일정 감사 열기' },
  { en: 'No completed or past bookings recorded yet.', id: 'Belum ada catatan pesanan selesai atau lampau.', ko: '아직 완료되거나 지난 예약 기록이 없습니다.' },
  { en: 'Schedule Audit Record', id: 'Catatan Audit Jadwal', ko: '일정 감사 기록' },
  { en: 'Booking Audit', id: 'Audit Pemesanan', ko: '예약 감사' },
  { en: 'Booker', id: 'Pemesan', ko: '예약자' },
  { en: 'Actual Trip Time', id: 'Waktu Perjalanan Aktual', ko: '실제 운행 시간' },
  { en: 'Odometer & Distance', id: 'Odometer & Jarak Tempuh', ko: '주행거리계 및 이동 거리' },
  { en: 'Cancellation Reason', id: 'Alasan Pembatalan', ko: '취소 사유' },
  { en: 'Approval History', id: 'Riwayat Persetujuan', ko: '승인 이력' },
  { en: 'Hitchhike Passenger(s)', id: 'Penumpang Nebeng', ko: '합승 탑승자' },
  { en: 'Seats', id: 'Kursi', ko: '좌석' },
  { en: 'left', id: 'tersisa', ko: '남음' },
  { en: 'This vehicle is full. No remaining seats available for hitchhike.', id: 'Mobil ini sudah penuh. Tidak ada kursi tersisa untuk nebeng.', ko: '이 차량은 만석입니다. 합승 가능한 좌석이 없습니다.' },
  { en: 'Your name (Passenger 1)', id: 'Nama Anda (Penumpang 1)', ko: '본인 이름 (탑승자 1)' },
  { en: 'Additional passenger', id: 'Penumpang tambahan', ko: '추가 탑승자' },
  { en: 'Add Another Person', id: 'Tambah Orang Lain', ko: '동승자 추가' },
  { en: 'Car seat limit reached', id: 'Batas kursi mobil tercapai', ko: '차량 좌석 한도 도달' },
  { en: 'Your Passenger(s) After Switch', id: 'Daftar Penumpang Anda Setelah Dialihkan', ko: '예약 양도 후 탑승자 명단' },

  // Complete UI Coverage — Approval Lock, Executive Modals, Map Pin, Schedule, Driver, Admin & Reports
  { en: 'Booking cancelled and vehicle/driver slot released.', id: 'Pemesanan dibatalkan dan slot kendaraan/pengemudi telah dibuka kembali.', ko: '예약이 취소되었으며 차량/기사 일정이 해제되었습니다.' },
  { en: 'Boarding confirmed! Auto-cancellation timer stopped and driver notified.', id: 'Keberangkatan dikonfirmasi! Timer pembatalan otomatis dihentikan dan driver telah diberitahu.', ko: '탑승이 확인되었습니다! 자동 취소 타이머가 중지되었으며 기사에게 알림이 전송되었습니다.' },
  { en: 'Booking Approval', id: 'Persetujuan Pemesanan', ko: '예약 승인' },
  { en: 'Urgent Booking (< 2h)', id: 'Pemesanan Mendesak (< 2 jam)', ko: '긴급 예약 (2시간 미만)' },
  { en: 'Fleet PIC', id: 'PIC Armada', ko: '차량 담당자' },
  { en: 'Pending', id: 'Menunggu', ko: '대기 중' },
  { en: 'Ready', id: 'Siap', ko: '준비됨' },
  { en: 'Head of WS', id: 'Kepala WS', ko: 'WS 부서장' },
  { en: 'Waiting Step 1', id: 'Menunggu Tahap 1', ko: '1단계 대기 중' },
  { en: 'Assigned Driver', id: 'Pengemudi Ditugaskan', ko: '배정된 기사' },
  { en: 'Booking is approved and locked. Cannot be edited or rejected; only the requester can cancel this booking.', id: 'Pemesanan telah disetujui dan dikunci. Tidak dapat diubah atau ditolak; hanya pemesan yang dapat membatalkan pesanan ini.', ko: '예약이 승인되어 잠겼습니다. 수정하거나 거절할 수 없으며 예약자만 취소할 수 있습니다.' },
  { en: 'Assigned Driver & Vehicle', id: 'Pengemudi & Kendaraan Ditugaskan', ko: '배정된 기사 및 차량' },
  { en: 'Locked by Fleet PIC', id: 'Dikunci oleh PIC Armada', ko: '차량 담당자에 의해 잠김' },
  { en: 'FLEET PIC APPROVED', id: 'DISETUJUI PIC ARMADA', ko: '차량 담당자 승인됨' },
  { en: 'Approved by Fleet PIC — cannot be rejected or edited. Only the requester can cancel this booking.', id: 'Telah disetujui PIC Armada — tidak dapat ditolak atau diubah. Hanya pemesan yang dapat membatalkan pesanan ini.', ko: '차량 담당자 승인 완료 — 거절하거나 수정할 수 없습니다. 예약자만 취소할 수 있습니다.' },
  { en: 'Final Approve', id: 'Persetujuan Akhir', ko: '최종 승인' },
  { en: 'Checking...', id: 'Memeriksa...', ko: '확인 중...' },
  { en: 'Paired Vehicle', id: 'Kendaraan Terpasang', ko: '연결된 차량' },
  { en: 'Auto-paired', id: 'Terpasang otomatis', ko: '자동 연결' },
  { en: 'Vehicle', id: 'Kendaraan', ko: '차량' },
  { en: 'Note', id: 'Catatan', ko: '메모' },
  { en: 'required if rejecting', id: 'wajib jika menolak', ko: '거절 시 필수' },
  { en: 'Optional approval note or rejection reason...', id: 'Catatan persetujuan opsional atau alasan penolakan...', ko: '승인 메모(선택) 또는 거절 사유...' },
  { en: 'Approve (Admin)', id: 'Setujui (Admin)', ko: '승인 (관리자)' },
  { en: 'Approve & Assign', id: 'Setujui & Tugaskan', ko: '승인 및 배정' },
  { en: 'Await Fleet PIC', id: 'Menunggu PIC Armada', ko: '차량 담당자 대기' },
  { en: 'Approve & Dispatch', id: 'Setujui & Berangkatkan', ko: '승인 및 배차' },
  { en: 'Upload Expense Receipt', id: 'Unggah Struk Pengeluaran', ko: '경비 영수증 업로드' },
  { en: 'Claim reimbursement for operational car expenses', id: 'Ajukan penggantian biaya operasional kendaraan', ko: '운행 차량 경비 정산 청구' },
  { en: 'Cash parking & toll expenses deduct from Petty Cash and are replenished upon approval.', id: 'Biaya parkir & tol tunai memotong Kas Kecil dan diisi ulang setelah disetujui.', ko: '현금 주차 및 통행료는 소액 현금에서 차감되며 승인 시 보충됩니다.' },
  { en: 'Expense receipt saved & Petty Cash claim submitted for reimbursement approval!', id: 'Struk pengeluaran disimpan & klaim Kas Kecil diajukan untuk persetujuan!', ko: '영수증이 저장되었으며 소액 현금 정산 청구가 제출되었습니다!' },
  { en: 'Assigned Driver & Operational Vehicle (Auto-Filled)', id: 'Pengemudi & Kendaraan Operasional (Terisi Otomatis)', ko: '배정된 기사 및 운행 차량 (자동 입력)' },
  { en: 'Operational Vehicle', id: 'Kendaraan Operasional', ko: '운행 차량' },
  { en: 'Driver', id: 'Pengemudi', ko: '기사' },
  { en: 'Locked to your driver account to prevent mixed claims', id: 'Dikunci ke akun pengemudi Anda agar klaim tidak tercampur', ko: '청구 혼선을 방지하기 위해 기사 계정에 고정됨' },
  { en: 'Charging (EV)', id: 'Pengisian Daya (EV)', ko: '충전 (EV)' },
  { en: 'Payment Source (Petty Cash Reimbursement)', id: 'Sumber Pembayaran (Reimbursement Kas Kecil)', ko: '결제 수단 (소액 현금 정산)' },
  { en: 'Personal Cash Advance', id: 'Talangan Pribadi', ko: '개인 선결제' },
  { en: 'Amount (Rp)', id: 'Jumlah (Rp)', ko: '금액 (Rp)' },
  { en: 'Description / Location', id: 'Deskripsi / Lokasi', ko: '내용 / 위치' },
  { en: 'Receipt Photo / Document', id: 'Foto Struk / Dokumen', ko: '영수증 사진 / 문서' },
  { en: 'Verified & Ready', id: 'Terverifikasi & Siap', ko: '확인됨 및 준비 완료' },
  { en: 'Take a photo of the receipt or attach PDF slip. Stored securely in database.', id: 'Ambil foto struk atau lampirkan slip PDF. Tersimpan aman di database.', ko: '영수증 사진을 촬영하거나 PDF를 첨부하세요. 데이터베이스에 안전하게 저장됩니다.' },
  { en: 'Please review your departure schedule and details before submitting', id: 'Harap tinjau jadwal keberangkatan dan detail Anda sebelum mengirim', ko: '제출하기 전에 출발 일정과 세부 정보를 확인해 주세요' },
  { en: 'Urgent (< 2h)', id: 'Mendesak (< 2 jam)', ko: '긴급 (2시간 미만)' },
  { en: 'Standard (+2h)', id: 'Standar (+2 jam)', ko: '일반 (+2시간)' },
  { en: 'Urgent Short-Notice Departure Reminder', id: 'Pengingat Keberangkatan Mendesak', ko: '긴급 단기 출발 알림' },
  { en: 'Default booking is 2 hours from current time. You selected an urgent departure in', id: 'Pemesanan standar adalah 2 jam dari waktu sekarang. Anda memilih keberangkatan mendesak dalam', ko: '기본 예약은 현재 시간으로부터 2시간 후입니다. 선택한 긴급 출발 시간:' },
  { en: 'This requires Stage 1 Fleet Operation PIC consent followed by Stage 2 Head Of WS approval.', id: 'Ini memerlukan persetujuan Tahap 1 PIC Operasional Armada diikuti persetujuan Tahap 2 Kepala WS.', ko: '1단계 차량 운영 담당자 동의 후 2단계 WS 부서장 승인이 필요합니다.' },
  { en: 'Urgent Reason', id: 'Alasan Mendesak', ko: '긴급 사유' },
  { en: 'Scheduled 2+ Hours in Advance (Standard Policy)', id: 'Dijadwalkan 2+ Jam Sebelumnya (Kebijakan Standar)', ko: '2시간 이상 사전 예약 (표준 정책)' },
  { en: 'Your booking is automatically set for 2+ hours from now. Need to depart urgently sooner than 2 hours? Tap "Change Schedule Time" below.', id: 'Pemesanan Anda otomatis diatur 2+ jam dari sekarang. Perlu berangkat mendesak kurang dari 2 jam? Ketuk "Ubah Waktu Jadwal" di bawah.', ko: '예약이 현재 시간보다 2시간 이상 후로 자동 설정되었습니다. 2시간 이내에 긴급 출발이 필요하면 아래 "일정 시간 변경"을 누르세요.' },
  { en: 'Departure', id: 'Keberangkatan', ko: '출발' },
  { en: 'Return', id: 'Kembali', ko: '복귀' },
  { en: 'Route', id: 'Rute', ko: '경로' },
  { en: 'Boarding & No-Show Policy', id: 'Kebijakan Boarding & No-Show', ko: '탑승 및 노쇼 정책' },
  { en: 'You will receive constant reminders starting 10 minutes before departure. If you do not show up or confirm boarding within 20 minutes after departure time, the booking will be automatically cancelled and the vehicle slot freed.', id: 'Anda akan menerima pengingat mulai 10 menit sebelum keberangkatan. Jika tidak hadir atau mengonfirmasi boarding dalam 20 menit setelah waktu keberangkatan, pemesanan otomatis dibatalkan dan slot kendaraan dilepas.', ko: '출발 10분 전부터 지속적으로 알림이 발송됩니다. 출발 시간 후 20분 이내에 탑승 확인을 하지 않으면 예약이 자동 취소되고 차량 슬롯이 해제됩니다.' },
  { en: 'Change Schedule Time', id: 'Ubah Waktu Jadwal', ko: '일정 시간 변경' },
  { en: 'Back to Summary', id: 'Kembali ke Ringkasan', ko: '요약으로 돌아가기' },
  { en: 'Weekly Summary Report • Friday Sign-Off', id: 'Laporan Ringkasan Mingguan • Persetujuan Jumat', ko: '주간 요약 보고서 • 금요일 승인' },
  { en: 'Monthly Summary Report • End of Month Sign-Off', id: 'Laporan Ringkasan Bulanan • Persetujuan Akhir Bulan', ko: '월간 요약 보고서 • 월말 승인' },
  { en: 'Digital approval required from Fleet Manager & Head of WS.', id: 'Persetujuan digital diperlukan dari Manajer Armada & Kepala WS.', ko: '차량 관리자 및 WS 부서장의 디지털 승인이 필요합니다.' },
  { en: 'Completed Trips', id: 'Perjalanan Selesai', ko: '완료된 운행' },
  { en: 'Total Cost (IDR)', id: 'Total Biaya (IDR)', ko: '총 비용 (IDR)' },
  { en: 'Fleet & Drivers', id: 'Armada & Pengemudi', ko: '차량 및 기사' },
  { en: 'Digital Approval Signatures', id: 'Tanda Tangan Persetujuan Digital', ko: '디지털 승인 서명' },
  { en: 'Digital Approval Notes (Optional)', id: 'Catatan Persetujuan Digital (Opsional)', ko: '디지털 승인 메모 (선택)' },
  { en: 'e.g., Verified weekly mileage and operational receipts', id: 'mis., Jarak tempuh mingguan dan struk operasional telah diverifikasi', ko: '예: 주간 주행 거리 및 운행 영수증 확인 완료' },
  { en: 'Re-Sign Digitally', id: 'Tanda Tangan Ulang Digital', ko: '디지털 재서명' },
  { en: 'Approve Report Digitally', id: 'Setujui Laporan Secara Digital', ko: '보고서 디지털 승인' },
  { en: 'Review Later', id: 'Tinjau Nanti', ko: '나중에 검토' },
  { en: 'View Details', id: 'Lihat Detail', ko: '상세 보기' },
  { en: 'Replenished to Petty Cash', id: 'Diisi Ulang ke Kas Kecil', ko: '소액 현금 보충 완료' },
  { en: 'Digital Report Approvals (Weekly Friday & End of Month)', id: 'Persetujuan Laporan Digital (Jumat Mingguan & Akhir Bulan)', ko: '디지털 보고서 승인 (매주 금요일 및 월말)' },
  { en: 'Auto-prompts Fleet Manager & Head of WS every Friday and End of Month for digital sign-off.', id: 'Otomatis mengingatkan Manajer Armada & Kepala WS setiap Jumat dan Akhir Bulan untuk tanda tangan digital.', ko: '매주 금요일 및 월말에 차량 관리자와 WS 부서장에게 디지털 서명을 자동 요청합니다.' },
  { en: 'No periodic summary reports generated yet.', id: 'Belum ada laporan ringkasan berkala yang dibuat.', ko: '아직 생성된 정기 요약 보고서가 없습니다.' },
  { en: 'Approve Digitally', id: 'Setujui Digital', ko: '디지털 승인' },
  { en: 'Review / Update Signature', id: 'Tinjau / Perbarui Tanda Tangan', ko: '서명 검토 / 업데이트' },
  { en: 'Continue to Trip Form', id: 'Lanjut ke Formulir Perjalanan', ko: '예약 양식으로 계속' },
  { en: 'Submit Trip Request', id: 'Kirim Permintaan Perjalanan', ko: '운행 요청 제출' },
  { en: 'Car assigned by Fleet Manager', id: 'Mobil ditugaskan oleh Manajer Armada', ko: '차량 관리자가 차량 배정' },
  { en: 'Trip Purpose is mandatory.', id: 'Tujuan Perjalanan wajib diisi.', ko: '운행 목적은 필수 항목입니다.' },
  { en: 'Passenger data is mandatory.', id: 'Data penumpang wajib diisi.', ko: '탑승자 정보는 필수 항목입니다.' },
  { en: 'Back to Full Map', id: 'Kembali ke Peta Penuh', ko: '전체 지도로 돌아가기' },
  { en: 'Trips', id: 'Perjalanan', ko: '운행' },
  { en: 'No trips scheduled for you today. On standby.', id: 'Tidak ada perjalanan terjadwal untuk Anda hari ini. Sedang siaga.', ko: '오늘 예정된 운행이 없습니다. 대기 중입니다.' },
  { en: 'Online & Ready for Duty', id: 'Online & Siap Bertugas', ko: '온라인 및 운행 대기 중' },
  { en: 'Automatically ready when Online is active', id: 'Otomatis siap saat status Online aktif', ko: '온라인 활성화 시 자동으로 대기 상태 전환' },
  { en: 'Tap Online to automatically go on duty', id: 'Ketuk Online untuk otomatis mulai bertugas', ko: '온라인을 눌러 자동으로 운행 시작' },
  { en: 'You are now Online and automatically Ready for Duty!', id: 'Anda sekarang Online dan otomatis Siap Bertugas!', ko: '온라인 상태가 되었으며 자동으로 운행 대기 중입니다!' },
  { en: 'Trip in Progress', id: 'Perjalanan Berlangsung', ko: '운행 진행 중' },
  { en: 'Take odometer photo & type reading to start', id: 'Ambil foto odometer & ketik angkanya untuk memulai', ko: '운행 시작을 위해 주행거리계 사진을 찍고 수치를 입력하세요' },
  { en: 'Photo required for verification', id: 'Foto wajib untuk verifikasi', ko: '확인용 사진 필수' },
  { en: 'Odometer photo verified', id: 'Foto odometer terverifikasi', ko: '주행거리계 사진 확인됨' },
  { en: 'Mandatory: Driver must take a photo of the odometer before starting the trip.', id: 'Wajib: Pengemudi harus mengambil foto odometer sebelum memulai perjalanan.', ko: '필수: 기사는 운행 시작 전 주행거리계 사진을 촬영해야 합니다.' },
  { en: 'Odometer photo & manual reading verified, trip started!', id: 'Foto & angka odometer terverifikasi, perjalanan dimulai!', ko: '주행거리계 사진 및 수치가 확인되어 운행이 시작되었습니다!' },
  { en: 'Photo required to verify odometer', id: 'Foto wajib untuk verifikasi odometer', ko: '주행거리계 확인용 사진 필수' },
  { en: 'End photo verified', id: 'Foto akhir terverifikasi', ko: '종료 사진 확인됨' },
  { en: 'Mandatory: Driver must take a photo of the odometer upon trip completion.', id: 'Wajib: Pengemudi harus mengambil foto odometer saat menyelesaikan perjalanan.', ko: '필수: 기사는 운행 완료 시 주행거리계 사진을 촬영해야 합니다.' },
  { en: 'Trip completed, odometer photo and manual reading verified!', id: 'Perjalanan selesai, foto & angka odometer terverifikasi!', ko: '운행 완료, 주행거리계 사진 및 수치가 확인되었습니다!' },
  { en: 'Petty Cash Wallet', id: 'Dompet Kas Kecil', ko: '소액 현금 지갑' },
  { en: 'Parking & Operational Cash', id: 'Kas Parkir & Operasional', ko: '주차 및 운행 현금' },
  { en: 'Deducted on cash parking/expense claims & replenished when Admin approves', id: 'Dipotong saat klaim parkir/biaya tunai & diisi ulang saat Admin menyetujui', ko: '현금 주차/경비 청구 시 차감되며 관리자 승인 시 보충됨' },
  { en: 'Petty Cash', id: 'Kas Kecil', ko: '소액 현금' },
  { en: 'Receipt claim', id: 'Klaim struk', ko: '영수증 청구' },
  { en: 'Remove Receipt Photo', id: 'Hapus Foto Struk', ko: '영수증 사진 삭제' },
  { en: 'Receipt photo removed.', id: 'Foto struk telah dihapus.', ko: '영수증 사진이 삭제되었습니다.' },
  { en: 'Remove Receipt', id: 'Hapus Struk', ko: '영수증 삭제' },
  { en: 'Reimbursement claim removed.', id: 'Klaim penggantian biaya telah dihapus.', ko: '정산 청구가 삭제되었습니다.' },
  { en: 'Start Odometer Photo', id: 'Foto Odometer Awal', ko: '출발 주행거리계 사진' },
  { en: 'End Odometer Photo', id: 'Foto Odometer Akhir', ko: '종료 주행거리계 사진' },
  { en: 'No description', id: 'Tanpa deskripsi', ko: '설명 없음' },
  { en: 'Booking details copied & opened WhatsApp to share with passenger!', id: 'Detail pemesanan disalin & WhatsApp dibuka untuk dibagikan ke penumpang!', ko: '예약 내역이 복사되었으며 탑승자에게 공유할 WhatsApp이 열렸습니다!' },
  { en: 'Share to Passenger (WhatsApp)', id: 'Bagikan ke Penumpang (WhatsApp)', ko: '탑승자에게 공유 (WhatsApp)' },
  { en: 'Driver profile photo updated successfully!', id: 'Foto profil pengemudi berhasil diperbarui!', ko: '기사 프로필 사진이 업데이트되었습니다!' },
  { en: 'Edit Profile & Nickname', id: 'Ubah Profil & Nama Panggilan', ko: '프로필 및 이름 편집' },
  { en: 'Update contact phone or nickname', id: 'Perbarui nomor telepon atau nama panggilan', ko: '연락처 또는 이름 업데이트' },
  { en: 'Sign out of your driver session', id: 'Keluar dari sesi pengemudi Anda', ko: '기사 세션에서 로그아웃' },
  { en: 'In Trip', id: 'Dalam Perjalanan', ko: '운행 중' },
  { en: 'Pickup spot', id: 'Titik jemput', ko: '픽업 지점' },
  { en: 'Trip Category, Time & Booking Form', id: 'Kategori, Waktu & Form Pemesanan', ko: '운행 유형, 시간 및 예약 양식' },
  { en: 'Depart & return', id: 'Berangkat & kembali', ko: '출발 및 복귀' },
  { en: 'Set Time', id: 'Atur Waktu', ko: '시간 설정' },
  { en: 'Return Pick-Up Time *', id: 'Waktu Penjemputan Kembali *', ko: '복귀 픽업 시간 *' },
  { en: 'Example: Cikarang Plant Visit, Client Meeting...', id: 'Contoh: Kunjungan Pabrik Cikarang, Rapat Klien...', ko: '예: 치카랑 공장 방문, 고객 미팅...' },
  { en: 'Vehicle & Driver Assigned by Fleet Manager', id: 'Kendaraan & Pengemudi Ditugaskan Manajer Armada', ko: '차량 관리자가 차량 및 기사 배정' },
  { en: 'You do not need to pick a car. When approving your request, Fleet Manager will assign an available company car & driver for your schedule.', id: 'Anda tidak perlu memilih mobil. Saat menyetujui permintaan Anda, Manajer Armada akan menugaskan mobil dinas & pengemudi yang tersedia.', ko: '차량을 직접 선택할 필요가 없습니다. 요청 승인 시 차량 관리자가 이용 가능한 회사 차량과 기사를 배정합니다.' },
  { en: 'Add pickup instructions for driver', id: 'Tambah instruksi penjemputan untuk pengemudi', ko: '기사에게 전달할 픽업 안내 추가' },
  { en: 'Auto-assign', id: 'Tugaskan otomatis', ko: '자동 배정' },
  { en: 'Step 2 of 2', id: 'Tahap 2 dari 2', ko: '2단계 중 2단계' },
  { en: 'Step 1 of 2', id: 'Tahap 1 dari 2', ko: '2단계 중 1단계' },
  { en: 'Awaiting Fleet PIC', id: 'Menunggu PIC Armada', ko: '차량 담당자 대기 중' },
  { en: 'Request Submitted', id: 'Permintaan Terkirim', ko: '요청 제출됨' },
  { en: 'Schedule reserved', id: 'Jadwal dipesan', ko: '일정 예약됨' },
  { en: 'Authorized by Admin', id: 'Disahkan oleh Admin', ko: '관리자 승인 완료' },
  { en: 'Fleet PIC & Head of WS', id: 'PIC Armada & Kepala WS', ko: '차량 담당자 및 WS 부서장' },
  { en: 'Driver Assigned', id: 'Pengemudi Ditugaskan', ko: '기사 배정됨' },
  { en: 'Ready for departure', id: 'Siap berangkat', ko: '출발 준비 완료' },
  { en: '1. Fleet PIC', id: '1. PIC Armada', ko: '1. 차량 담당자' },
  { en: 'Approved & driver paired', id: 'Disetujui & pengemudi dipasangkan', ko: '승인 및 기사 배정 완료' },
  { en: 'Pending review', id: 'Menunggu tinjauan', ko: '검토 대기 중' },
  { en: '2. Head of WS', id: '2. Kepala WS', ko: '2. WS 부서장' },
  { en: 'Pending final sign-off', id: 'Menunggu persetujuan akhir', ko: '최종 승인 대기 중' },
  { en: 'Fleet Review', id: 'Tinjauan Armada', ko: '차량 검토' },
  { en: 'Assigning driver & vehicle', id: 'Menugaskan pengemudi & kendaraan', ko: '기사 및 차량 배정 중' },
  { en: 'View Driver & Trip', id: 'Lihat Pengemudi & Perjalanan', ko: '기사 및 운행 보기' },
  { en: 'Confirm Boarding', id: 'Konfirmasi Naik Mobil', ko: '탑승 확인' },
  { en: 'Back to Home', id: 'Kembali ke Beranda', ko: '홈으로 돌아가기' },
  { en: 'Trip status synced.', id: 'Status perjalanan disinkronkan.', ko: '운행 상태가 동기화되었습니다.' },
  { en: 'Refresh', id: 'Segarkan', ko: '새로고침' },
  { en: 'Driver En Route', id: 'Pengemudi Dalam Perjalanan', ko: '기사 이동 중' },
  { en: 'Booking Confirmed', id: 'Pemesanan Dikonfirmasi', ko: '예약 확정됨' },
  { en: 'Live Trip GPS', id: 'GPS Perjalanan Langsung', ko: '실시간 운행 GPS' },
  { en: 'Driver Pickup ETA', id: 'Estimasi Kedatangan Pengemudi', ko: '기사 도착 예정 시간' },
  { en: 'Connecting to driver GPS...', id: 'Menghubungkan ke GPS pengemudi...', ko: '기사 GPS 연결 중...' },
  { en: 'Live driver GPS & ETA active 10m before departure', id: 'GPS & ETA pengemudi aktif 10 menit sebelum keberangkatan', ko: '출발 10분 전부터 실시간 기사 GPS 및 도착 예정 시간 활성화' },
  { en: 'Assigned Company Driver', id: 'Pengemudi Perusahaan Ditugaskan', ko: '배정된 사내 기사' },
  { en: "Let's start work!", id: 'Ayo mulai bertugas!', ko: '운행을 시작해 볼까요!' },
  { en: 'Please do not close or leave the app until it finishes.', id: 'Mohon jangan menutup atau meninggalkan aplikasi hingga selesai.', ko: '완료될 때까지 앱을 닫거나 나가지 마세요.' },
  { en: 'Driver Status', id: 'Status Pengemudi', ko: '기사 상태' },
  { en: 'Dispatch Acceptance', id: 'Penerimaan Disposisi', ko: '배차 수락' },
  { en: 'Trip Completion', id: 'Penyelesaian Perjalanan', ko: '운행 완료' },
  { en: 'Details', id: 'Detail', ko: '상세' },
  { en: 'Active Dispatches', id: 'Disposisi Aktif', ko: '진행 중인 배차' },
  { en: 'Open', id: 'Buka', ko: '열기' },
  { en: 'View your assigned shift & bookings', id: 'Lihat jadwal shift & pemesanan Anda', ko: '배정된 근무 일정 및 예약 보기' },
  { en: 'Trip Log & Petty Cash', id: 'Riwayat Perjalanan & Kas Kecil', ko: '운행 기록 및 소액 현금' },
  { en: 'Fuel, toll & parking receipts', id: 'Struk BBM, tol & parkir', ko: '주유, 통행료 및 주차 영수증' },
  { en: 'View', id: 'Lihat', ko: '보기' },
  { en: 'Appearance & Language', id: 'Tampilan & Bahasa', ko: '화면 및 언어' },
  { en: 'Back to Home App', id: 'Kembali ke Beranda Aplikasi', ko: '홈 앱으로 돌아가기' },
  { en: 'Collapse container to view full map', id: 'Tutup panel untuk melihat peta penuh', ko: '전체 지도를 보려면 패널 접기' },
  { en: 'Pickup location', id: 'Lokasi penjemputan', ko: '출발지' },
  { en: 'Clear pickup', id: 'Hapus titik jemput', ko: '출발지 지우기' },
  { en: 'Destination location', id: 'Lokasi tujuan', ko: '도착지' },
  { en: 'Clear destination', id: 'Hapus tujuan', ko: '도착지 지우기' },
  { en: 'Back to Search', id: 'Kembali ke Pencarian', ko: '검색으로 돌아가기' },
  { en: 'Pickup Point', id: 'Titik Jemput', ko: '출발지' },
  { en: 'Pinning Pickup Point (Drag or tap map)', id: 'Tandai Titik Jemput (Geser atau ketuk peta)', ko: '출발지 지정 중 (지도 드래그 또는 탭)' },
  { en: 'Pinning Destination (Drag or tap map)', id: 'Tandai Tujuan (Geser atau ketuk peta)', ko: '목적지 지정 중 (지도 드래그 또는 탭)' },
  { en: 'View Map Path', id: 'Lihat Rute Peta', ko: '지도 경로 보기' },
  { en: 'Show List', id: 'Lihat Daftar', ko: '목록 보기' },
  { en: 'Show Form', id: 'Lihat Formulir', ko: '양식 보기' },
  { en: 'Calculating route path & ETA...', id: 'Menghitung jalur rute & ETA...', ko: '경로 및 도착 예정 시간 계산 중...' },
  { en: 'Calculating street route...', id: 'Menghitung rute jalan...', ko: '도로 경로 계산 중...' },
  { en: 'Pan map to resolve street address...', id: 'Geser peta untuk memuat alamat jalan...', ko: '지도를 이동하여 주소를 확인하세요...' },
  { en: 'Select a lettered gate or lobby spot for faster driver rendezvous', id: 'Pilih gerbang atau lobi agar pengemudi lebih mudah menjemput Anda', ko: '빠른 기사 만남을 위해 게이트 또는 로비 지점을 선택하세요' },
  { en: 'Main Lobby / Drop-Off Entrance', id: 'Lobi Utama / Pintu Masuk Drop-Off', ko: '메인 로비 / 승하차장 입구' },
  { en: 'Use exact text you entered instead of suggested result', id: 'Gunakan teks persis yang Anda ketik daripada hasil saran', ko: '추천 결과 대신 입력한 주소 그대로 사용' },
  { en: 'Select this location directly or refine coordinates using Select via map', id: 'Pilih lokasi ini langsung atau sesuaikan titik lewat Pilih di peta', ko: '이 위치를 바로 선택하거나 지도에서 선택으로 좌표를 조정하세요' },
  { en: 'No exact map match returned above. Tap your typed address above to use it, or tap Select via map to pin manually.', id: 'Tidak ada hasil peta yang persis sama. Ketuk alamat yang diketik di atas atau ketuk Pilih lewat peta untuk menandai manual.', ko: '일치하는 지도 결과가 없습니다. 위 입력 주소를 탭하거나 지도에서 선택을 눌러 수동으로 지정하세요.' },
  { en: 'No saved places yet. Search any Indonesian city, street, or landmark above and tap the bookmark icon to save it.', id: 'Belum ada tempat tersimpan. Cari kota, jalan, atau landmark lalu ketuk ikon bookmark untuk menyimpannya.', ko: '저장된 장소가 없습니다. 도시, 도로명 또는 장소를 검색한 후 북마크 아이콘을 눌러 저장하세요.' },
  { en: 'Type at least 2 characters to search any city, district, landmark, or address across Indonesia.', id: 'Ketik minimal 2 huruf untuk mencari kota, kecamatan, gedung, atau alamat di seluruh Indonesia.', ko: '인도네시아 전역의 도시, 지역, 장소 또는 주소를 검색하려면 2글자 이상 입력하세요.' },
  { en: 'Head Office', id: 'Kantor Pusat', ko: '본사' },
  { en: 'SCBD Head Office', id: 'Kantor Pusat SCBD', ko: 'SCBD 본사' },
  { en: 'Airport VIP', id: 'Bandara VIP', ko: '공항 VIP' },
  { en: 'Plant 1', id: 'Pabrik 1', ko: '1공장' },
  { en: 'Plant 2', id: 'Pabrik 2', ko: '2공장' },
  { en: 'Plant 1 Sunter', id: 'Pabrik 1 Sunter', ko: '순터 1공장' },
  { en: 'Plant 2 Karawang', id: 'Pabrik 2 Karawang', ko: '카라왕 2공장' },
  { en: 'Manufacturing Plant', id: 'Pabrik Manufaktur', ko: '제조 공장' },
  { en: 'KIIC Industrial Area', id: 'Kawasan Industri KIIC', ko: 'KIIC 산업단지' },
  { en: 'Point-to-point', id: 'Sekali jalan', ko: '편도 이동' },
  { en: 'Full business day', id: 'Seharian penuh', ko: '종일 업무' },
  { en: 'PENDING_APPROVAL', id: 'Menunggu Persetujuan', ko: '승인 대기' },
  { en: 'APPROVED', id: 'Disetujui', ko: '승인됨' },
  { en: 'IN_PROGRESS', id: 'Sedang Berjalan', ko: '운행 중' },
  { en: 'COMPLETED', id: 'Selesai', ko: '완료됨' },
  { en: 'REJECTED', id: 'Ditolak', ko: '거절됨' },
  { en: 'CANCELLED', id: 'Dibatalkan', ko: '취소됨' },
  { en: 'AVAILABLE', id: 'Tersedia', ko: '이용 가능' },
  { en: 'STANDBY', id: 'Siaga', ko: '대기 중' },
  { en: 'ACTIVE', id: 'Aktif', ko: '활성' },
  { en: 'Retry', id: 'Coba Lagi', ko: '다시 시도' },
  { en: 'No available driver/vehicle pairs for this time slot. Cannot approve.', id: 'Tidak ada pasangan pengemudi/kendaraan tersedia untuk jadwal ini. Tidak dapat menyetujui.', ko: '해당 시간대에 이용 가능한 기사/차량 조합이 없어 승인할 수 없습니다.' },
  { en: 'Please select an available driver (with an available fixed car) before approving.', id: 'Pilih pengemudi yang tersedia (dengan mobil tetap yang tersedia) sebelum menyetujui.', ko: '승인 전에 이용 가능한 기사(전담 차량 포함)를 선택하세요.' },
  { en: 'Where to today?', id: 'Mau ke mana hari ini?', ko: '오늘 어디로 가시나요?' },
  { en: 'Your current pickup location', id: 'Lokasi penjemputan Anda saat ini', ko: '현재 출발지' },
  { en: 'Search for a destination', id: 'Cari lokasi tujuan', ko: '목적지 검색' },
  { en: 'Release to set pin...', id: 'Lepaskan untuk menetapkan pin...', ko: '놓아서 핀 위치 지정...' },
  { en: 'Drag OpenStreetMap to set location', id: 'Geser peta untuk mengatur lokasi', ko: '지도를 드래그하여 위치 지정' },
  { en: 'License Plate', id: 'Nomor Polisi', ko: '차량 번호판' },
  { en: 'Car Type', id: 'Tipe Mobil', ko: '차종' },
  { en: 'Make', id: 'Merek', ko: '제조사' },
  { en: 'Model', id: 'Model', ko: '모델' },
  { en: 'Operational Status', id: 'Status Operasional', ko: '운행 상태' },
  { en: 'Available (Bookable)', id: 'Tersedia (Bisa Dipesan)', ko: '이용 가능 (예약 가능)' },
  { en: 'Standby (Reserved / Executive)', id: 'Siaga (Khusus / Eksekutif)', ko: '대기 (임원/전용)' },
  { en: 'Deactivated (Temporarily Offline)', id: 'Dinonaktifkan (Offline Sementara)', ko: '비활성화 (임시 중단)' },
  { en: 'In Maintenance', id: 'Dalam Perawatan', ko: '정비 중' },
  { en: 'Retired', id: 'Tidak Beroperasi', ko: '폐차/종료' },
  { en: 'Dedicated Driver (Fixed Car Assignment)', id: 'Pengemudi Tetap (Mobil Tetap)', ko: '전담 기사 (고정 차량 배정)' },
  { en: 'No Dedicated Driver (Pool Driver)', id: 'Tanpa Pengemudi Tetap (Pool)', ko: '전담 기사 없음 (공용)' },
  { en: 'No available driver/car for this schedule', id: 'Tidak ada pengemudi/mobil tersedia untuk jadwal ini', ko: '이 일정에 이용 가능한 기사/차량이 없습니다' },
  { en: 'Location Access Required', id: 'Akses Lokasi Diperlukan', ko: '위치 권한 필요' },
  { en: 'Required before using or dispatching a company operational car', id: 'Diperlukan sebelum menggunakan atau menugaskan mobil operasional perusahaan', ko: '사내 업무용 차량을 이용하거나 배차하기 전에 필요합니다' },
  { en: 'Account Settings', id: 'Pengaturan Akun', ko: '계정 설정' },
  { en: 'Hitchhike Ride', id: 'Nebeng Perjalanan', ko: '합승 요청' },
  { en: 'Join this car (same destination)', id: 'Gabung mobil ini (tujuan sama)', ko: '이 차량에 합승 (동일 목적지)' },
  { en: 'Negotiate Cancel', id: 'Negosiasi Batal', ko: '취소 협의' },
  { en: 'Ask holder to release / swap slot', id: 'Minta pemesan melepaskan / tukar jadwal', ko: '예약자에게 슬롯 양보/변경 요청' },
  { en: 'ID & Purpose', id: 'ID & Keperluan', ko: 'ID 및 목적' },
  { en: 'Requester & Group', id: 'Pemohon & Grup', ko: '요청자 및 그룹' },
  { en: 'Window', id: 'Jadwal', ko: '시간' },
  { en: 'Vehicle & Driver', id: 'Kendaraan & Pengemudi', ko: '차량 및 기사' },
  { en: 'Status', id: 'Status', ko: '상태' },
  { en: 'Control', id: 'Kontrol', ko: '관리' },
  { en: 'Day', id: 'Hari', ko: '일간' },
  { en: 'Week', id: 'Minggu', ko: '주간' },
  { en: 'Month', id: 'Bulan', ko: '월간' },
  { en: 'All-Time', id: 'Semua Waktu', ko: '전체 기간' },
  { en: 'Overall', id: 'Keseluruhan', ko: '전체' },
  { en: 'Gasoline', id: 'Bensin', ko: '가솔린' },
  { en: 'Electric (EV)', id: 'Listrik (EV)', ko: '전기차 (EV)' },
  { en: 'Active', id: 'Aktif', ko: '활성' },
  { en: 'On Leave', id: 'Cuti', ko: '휴가' },
  { en: 'Unavailable', id: 'Tidak Tersedia', ko: '이용 불가' },
  { en: 'Google Calendar Schedule (07:00 AM – 04:00 PM):', id: 'Jadwal Kalender (07:00 – 16:00):', ko: '캘린더 일정 (07:00 AM – 04:00 PM):' },
  { en: 'Set Schedule (24 Hours)', id: 'Jadwal Booking (24 Jam)', ko: '배차 시간표 (24시간)' },
  { en: '24 Hours (00:00 – 24:00)', id: '24 Jam (00:00 – 24:00)', ko: '24시간 (00:00 – 24:00)' },
  { en: 'Google Calendar Schedule (24 Hours):', id: 'Jadwal Kalender (24 Jam):', ko: '캘린더 일정 (24시간):' },
  { en: 'UNAVAILABLE • BOOKED', id: 'TIDAK TERSEDIA • DIPESAN', ko: '예약 불가 • 예약됨' },
  { en: 'Forgot Password?', id: 'Lupa Kata Sandi?', ko: '비밀번호를 잊으셨나요?' },
  { en: 'Forgot Password', id: 'Lupa Kata Sandi', ko: '비밀번호 찾기' },
  { en: 'Request a direct password reset from the Administrator', id: 'Ajukan reset kata sandi langsung ke Administrator', ko: '관리자에게 직접 비밀번호 재설정 요청' },
  { en: 'WhatsApp / Mobile Phone Number', id: 'Nomor WhatsApp / Ponsel', ko: 'WhatsApp / 휴대폰 번호' },
  { en: 'Mandatory for account recovery & WhatsApp fleet coordination.', id: 'Wajib untuk pemulihan akun & koordinasi armada via WhatsApp.', ko: '계정 복구 및 WhatsApp 배차 연락을 위해 필수입니다.' },
  { en: 'Mandatory for account recovery, password reset via Admin WhatsApp, and ride coordination.', id: 'Wajib untuk pemulihan akun, reset kata sandi via WhatsApp Admin, dan koordinasi perjalanan.', ko: '계정 복구, 관리자 WhatsApp 비밀번호 재설정 및 운행 연락을 위해 필수입니다.' },
  { en: 'WhatsApp / phone number is mandatory (at least 8 digits) for account recovery.', id: 'Nomor WhatsApp / ponsel wajib diisi (minimal 8 digit) untuk pemulihan akun.', ko: '계정 복구를 위해 WhatsApp/휴대폰 번호(최소 8자리)가 필수입니다.' },
  { en: 'Registered WhatsApp / Phone Number', id: 'Nomor WhatsApp / Ponsel Terdaftar', ko: '등록된 WhatsApp / 휴대폰 번호' },
  { en: 'Notes for Admin (Optional)', id: 'Catatan untuk Admin (Opsional)', ko: '관리자 메모 (선택)' },
  { en: 'Request Password Reset', id: 'Ajukan Reset Kata Sandi', ko: '비밀번호 재설정 요청' },
  { en: 'Password Reset Request Sent', id: 'Permintaan Reset Kata Sandi Terkirim', ko: '비밀번호 재설정 요청 완료' },
  { en: 'Message Admin on WhatsApp (Free)', id: 'Hubungi Admin di WhatsApp (Gratis)', ko: 'WhatsApp으로 관리자 문의 (무료)' },
  { en: 'Back to Sign In', id: 'Kembali ke Halaman Masuk', ko: '로그인으로 돌아가기' },
  { en: 'Password Reset Requests', id: 'Permintaan Reset Kata Sandi', ko: '비밀번호 재설정 요청' },
  { en: 'No pending password reset requests.', id: 'Tidak ada permintaan reset kata sandi yang menunggu.', ko: '대기 중인 비밀번호 재설정 요청이 없습니다.' },
  { en: 'Reset Password', id: 'Reset Kata Sandi', ko: '비밀번호 재설정' },
  { en: 'Reset User Password', id: 'Reset Kata Sandi Pengguna', ko: '사용자 비밀번호 재설정' },
  { en: 'New Temporary Password', id: 'Kata Sandi Sementara Baru', ko: '새 임시 비밀번호' },
  { en: 'Generate', id: 'Buat Otomatis', ko: '자동 생성' },
  { en: 'Set New Password', id: 'Simpan Kata Sandi Baru', ko: '새 비밀번호 설정' },
  { en: 'Resetting...', id: 'Mereset...', ko: '재설정 중...' },
  { en: 'Password Reset Complete', id: 'Reset Kata Sandi Selesai', ko: '비밀번호 재설정 완료' },
  { en: 'Send Password via WhatsApp (Free)', id: 'Kirim Kata Sandi via WhatsApp (Gratis)', ko: 'WhatsApp으로 비밀번호 전송 (무료)' },
  { en: 'Copy', id: 'Salin', ko: '복사' },
  { en: 'Copied!', id: 'Tersalin!', ko: '복사됨!' },
  { en: 'Done', id: 'Selesai', ko: '완료' },
  { en: 'Dismiss', id: 'Abaikan', ko: '무시' },
  { en: 'WhatsApp Phone Required for Recovery', id: 'Nomor WhatsApp Wajib untuk Pemulihan Akun', ko: '계정 복구용 WhatsApp 번호 필요' },
  { en: 'Add Phone Number', id: 'Tambah Nomor HP', ko: '전화번호 추가' },
  { en: 'Transfer car slot (same or different location)', id: 'Alihkan slot mobil (lokasi sama atau berbeda)', ko: '차량 슬롯 양도 (동일 또는 다른 위치)' },
  { en: 'Location for Transferred Slot', id: 'Lokasi untuk Slot yang Dialihkan', ko: '양도받을 슬롯의 이동 경로' },
  { en: 'Same Location', id: 'Lokasi Sama', ko: '동일 위치' },
  { en: 'Different Location', id: 'Lokasi Berbeda', ko: '다른 위치' },
  { en: 'New Pickup Location', id: 'Lokasi Jemput Baru', ko: '새 픽업 위치' },
  { en: 'New Destination', id: 'Tujuan Baru', ko: '새 목적지' },
  { en: 'New Route', id: 'Rute Baru', ko: '새 경로' },
  { en: 'Trip Purpose (Optional)', id: 'Keperluan Perjalanan (Opsional)', ko: '운행 목적 (선택)' },
  { en: 'Transferred (Pending FM & HWS Approval)', id: 'Dialihkan (Menunggu Persetujuan FM & HWS)', ko: '양도됨 (FM 및 HWS 승인 대기)' },
];

/**
 * Legacy compatibility export
 */
export const DICTIONARY: Record<string, { id: string; ko: string }> = {};
for (const item of TRANSLATION_ITEMS) {
  DICTIONARY[item.en] = { id: item.id, ko: item.ko };
}

// Fast Bidirectional & Tridirectional Index
const TRANSLATION_MAP = new Map<string, TranslationItem>();

function registerEntry(entry: TranslationItem) {
  const keys = [entry.en, entry.id, entry.ko];
  for (const k of keys) {
    if (!k) continue;
    const trimmed = k.trim();
    TRANSLATION_MAP.set(trimmed, entry);
    TRANSLATION_MAP.set(trimmed.toLowerCase(), entry);

    // Also index core text without trailing punctuation (*, :, ...)
    const stripped = trimmed.replace(/[:*.]+$/, '').trim();
    if (stripped && stripped !== trimmed) {
      if (!TRANSLATION_MAP.has(stripped)) TRANSLATION_MAP.set(stripped, entry);
      if (!TRANSLATION_MAP.has(stripped.toLowerCase())) TRANSLATION_MAP.set(stripped.toLowerCase(), entry);
    }
  }
}

for (const item of TRANSLATION_ITEMS) {
  registerEntry(item);
}

// Informal aliases map strictly forward to canonical entries without clobbering English reverse mappings
const PHRASE_ALIASES: Array<[string, string]> = [
  ['Perkiraan waktu jemput', 'Pickup time estimate'],
  ['Gak jadi', 'Cancel'],
  ['Jadwalin', 'Schedule'],
];
for (const [alias, canonicalEn] of PHRASE_ALIASES) {
  const canonical = TRANSLATION_MAP.get(canonicalEn);
  if (canonical) {
    TRANSLATION_MAP.set(alias, canonical);
    TRANSLATION_MAP.set(alias.toLowerCase(), canonical);
  }
}

/**
 * Dynamic pattern translators for interpolated strings with numbers/names
 */
const DYNAMIC_PATTERNS: Array<{
  regex: RegExp;
  render: (match: RegExpExecArray, lang: SupportedLang) => string;
}> = [
  {
    regex: /^Available\s*•\s*(\d+)\s*Cars?$/i,
    render: (m, l) => (l === 'id' ? `Tersedia • ${m[1]} Unit` : l === 'ko' ? `이용 가능 • ${m[1]}대` : `Available • ${m[1]} Cars`),
  },
  {
    regex: /^(\d+)\s+Cars?\s+Available$/i,
    render: (m, l) => (l === 'id' ? `${m[1]} Mobil Tersedia` : l === 'ko' ? `이용 가능 ${m[1]}대` : Number(m[1]) === 1 ? '1 Car Available' : `${m[1]} Cars Available`),
  },
  {
    regex: /^Tersedia\s*•\s*(\d+)\s*Unit$/i,
    render: (m, l) => (l === 'id' ? `Tersedia • ${m[1]} Unit` : l === 'ko' ? `이용 가능 • ${m[1]}대` : `Available • ${m[1]} Cars`),
  },
  {
    regex: /^Booking Approval #(\d+)$/i,
    render: (m, l) => (l === 'id' ? `Persetujuan Pemesanan #${m[1]}` : l === 'ko' ? `예약 승인 #${m[1]}` : `Booking Approval #${m[1]}`),
  },
  {
    regex: /^Persetujuan Pemesanan #(\d+)$/i,
    render: (m, l) => (l === 'id' ? `Persetujuan Pemesanan #${m[1]}` : l === 'ko' ? `예약 승인 #${m[1]}` : `Booking Approval #${m[1]}`),
  },
  {
    regex: /^Arrival ETA (.+)$/i,
    render: (m, l) => (l === 'id' ? `Estimasi Tiba ${m[1]}` : l === 'ko' ? `도착 예정 ${m[1]}` : `Arrival ETA ${m[1]}`),
  },
  {
    regex: /^Estimasi Tiba (.+)$/i,
    render: (m, l) => (l === 'id' ? `Estimasi Tiba ${m[1]}` : l === 'ko' ? `도착 예정 ${m[1]}` : `Arrival ETA ${m[1]}`),
  },
  {
    regex: /^ETA (.+)$/i,
    render: (m, l) => (l === 'id' ? `Estimasi ${m[1]}` : l === 'ko' ? `예상 도착 ${m[1]}` : `ETA ${m[1]}`),
  },
  {
    regex: /^([\d.,]+)\s*km\s*•\s*~?(\d+)\s*min(?:s|\s*ride)?$/i,
    render: (m, l) =>
      l === 'id' ? `${m[1]} km • ~${m[2]} menit` : l === 'ko' ? `${m[1]} km • 약 ${m[2]}분` : `${m[1]} km • ~${m[2]} min ride`,
  },
  {
    regex: /^~?(\d+)\s*min ride$/i,
    render: (m, l) => (l === 'id' ? `~${m[1]} menit perjalanan` : l === 'ko' ? `약 ${m[1]}분 소요` : `~${m[1]} min ride`),
  },
  {
    regex: /^Trip #(\d+) approved by (.+?)! (.+)$/i,
    render: (m, l) =>
      l === 'id'
        ? `Perjalanan #${m[1]} disetujui oleh ${m[2]}! Dikunci & menunggu persetujuan berikutnya.`
        : l === 'ko'
        ? `운행 #${m[1]}이(가) ${m[2]}에 의해 승인되었습니다! 잠금 완료, 다음 승인 대기 중.`
        : `Trip #${m[1]} approved by ${m[2]}! ${m[3]}`,
  },
  {
    regex: /^Trip #(\d+) fully approved and dispatched!$/i,
    render: (m, l) =>
      l === 'id'
        ? `Perjalanan #${m[1]} telah disetujui penuh dan ditugaskan!`
        : l === 'ko'
        ? `운행 #${m[1]} 최종 승인 및 배차 완료!`
        : `Trip #${m[1]} fully approved and dispatched!`,
  },
  {
    regex: /^Trip #(\d+) rejected and vehicle schedule slot released\.$/i,
    render: (m, l) =>
      l === 'id'
        ? `Perjalanan #${m[1]} ditolak dan slot jadwal kendaraan dilepas.`
        : l === 'ko'
        ? `운행 #${m[1]}이(가) 거절되었으며 차량 일정이 해제되었습니다.`
        : `Trip #${m[1]} rejected and vehicle schedule slot released.`,
  },
  {
    regex: /^Showing (\d+) of (\d+) vehicles$/i,
    render: (m, l) =>
      l === 'id' ? `Menampilkan ${m[1]} dari ${m[2]} kendaraan` : l === 'ko' ? `전체 ${m[2]}대 중 ${m[1]}대 표시` : `Showing ${m[1]} of ${m[2]} vehicles`,
  },
  {
    regex: /^Menampilkan (\d+) dari (\d+) kendaraan$/i,
    render: (m, l) =>
      l === 'id' ? `Menampilkan ${m[1]} dari ${m[2]} kendaraan` : l === 'ko' ? `전체 ${m[2]}대 중 ${m[1]}대 표시` : `Showing ${m[1]} of ${m[2]} vehicles`,
  },
  {
    regex: /^전체 (\d+)대 중 (\d+)대 표시$/i,
    render: (m, l) =>
      l === 'id' ? `Menampilkan ${m[2]} dari ${m[1]} kendaraan` : l === 'ko' ? `전체 ${m[1]}대 중 ${m[2]}대 표시` : `Showing ${m[2]} of ${m[1]} vehicles`,
  },
  {
    regex: /^(\d+) trips? completed$/i,
    render: (m, l) => (l === 'id' ? `${m[1]} perjalanan selesai` : l === 'ko' ? `${m[1]}건 운행 완료` : `${m[1]} trips completed`),
  },
  {
    regex: /^(\d+) perjalanan selesai$/i,
    render: (m, l) => (l === 'id' ? `${m[1]} perjalanan selesai` : l === 'ko' ? `${m[1]}건 운행 완료` : `${m[1]} trips completed`),
  },
  {
    regex: /^([\d.,]+) km traveled$/i,
    render: (m, l) => (l === 'id' ? `${m[1]} km ditempuh` : l === 'ko' ? `${m[1]} km 주행` : `${m[1]} km traveled`),
  },
  {
    regex: /^Booked Slots Today \((\d+)\):?$/i,
    render: (m, l) => (l === 'id' ? `Slot Dipesan Hari Ini (${m[1]}):` : l === 'ko' ? `오늘 예약된 슬롯 (${m[1]}):` : `Booked Slots Today (${m[1]}):`),
  },
  {
    regex: /^Fleet Register \((\d+) Cars — Edit Plate, Type & Standby\)$/i,
    render: (m, l) =>
      l === 'id'
        ? `Daftar Armada (${m[1]} Mobil — Ubah Pelat, Tipe & Siaga)`
        : l === 'ko'
        ? `차량 등록부 (${m[1]}대 — 번호판, 유형 및 대기 편집)`
        : `Fleet Register (${m[1]} Cars — Edit Plate, Type & Standby)`,
  },
  {
    regex: /^System Audit Trail \((\d+) Recorded Events\)$/i,
    render: (m, l) =>
      l === 'id'
        ? `Jejak Audit Sistem (${m[1]} Kejadian Tercatat)`
        : l === 'ko'
        ? `시스템 감사 로그 (${m[1]}건 기록됨)`
        : `System Audit Trail (${m[1]} Recorded Events)`,
  },
  {
    regex: /^Completed Trips Elapsed Driving Time \((\d+) Trips\)$/i,
    render: (m, l) =>
      l === 'id'
        ? `Waktu Tempuh Perjalanan Selesai (${m[1]} Perjalanan)`
        : l === 'ko'
        ? `완료된 운행 소요 시간 (${m[1]}건)`
        : `Completed Trips Elapsed Driving Time (${m[1]} Trips)`,
  },
  {
    regex: /^Confirm pickup point \(Spot ([A-Z])\)$/i,
    render: (m, l) =>
      l === 'id' ? `Konfirmasi titik jemput (Titik ${m[1]})` : l === 'ko' ? `픽업 위치 확인 (지점 ${m[1]})` : `Confirm pickup point (Spot ${m[1]})`,
  },
  {
    regex: /^Pickup spot \(([A-Z])\)$/i,
    render: (m, l) => (l === 'id' ? `Titik jemput (${m[1]})` : l === 'ko' ? `픽업 지점 (${m[1]})` : `Pickup spot (${m[1]})`),
  },
  {
    regex: /^Capacity:\s*(\d+) of (\d+) passengers$/i,
    render: (m, l) =>
      l === 'id' ? `Kapasitas: ${m[1]} dari ${m[2]} penumpang` : l === 'ko' ? `탑승 정원: ${m[2]}명 중 ${m[1]}명` : `Capacity: ${m[1]} of ${m[2]} passengers`,
  },
  {
    regex: /^Driver:\s*(.+)$/i,
    render: (m, l) => (l === 'id' ? `Pengemudi: ${m[1]}` : l === 'ko' ? `기사: ${m[1]}` : `Driver: ${m[1]}`),
  },
  {
    regex: /^Pengemudi:\s*(.+)$/i,
    render: (m, l) => (l === 'id' ? `Pengemudi: ${m[1]}` : l === 'ko' ? `기사: ${m[1]}` : `Driver: ${m[1]}`),
  },
  {
    regex: /^Passenger:\s*(.+)$/i,
    render: (m, l) => (l === 'id' ? `Penumpang: ${m[1]}` : l === 'ko' ? `탑승자: ${m[1]}` : `Passenger: ${m[1]}`),
  },
  {
    regex: /^Departing in (\d+) mins?!$/i,
    render: (m, l) => (l === 'id' ? `Berangkat dalam ${m[1]} menit!` : l === 'ko' ? `${m[1]}분 후 출발!` : `Departing in ${m[1]} mins!`),
  },
  {
    regex: /^Berangkat dalam (\d+) menit!$/i,
    render: (m, l) => (l === 'id' ? `Berangkat dalam ${m[1]} menit!` : l === 'ko' ? `${m[1]}분 후 출발!` : `Departing in ${m[1]} mins!`),
  },
  {
    regex: /^(\d+)분 후 출발!$/i,
    render: (m, l) => (l === 'id' ? `Berangkat dalam ${m[1]} menit!` : l === 'ko' ? `${m[1]}분 후 출발!` : `Departing in ${m[1]} mins!`),
  },
  {
    regex: /^(\d+) seats? available$/i,
    render: (m, l) => (l === 'id' ? `${m[1]} kursi tersedia` : l === 'ko' ? `${m[1]}석 이용 가능` : `${m[1]} seats available`),
  },
  {
    regex: /^(\d+) kursi tersedia$/i,
    render: (m, l) => (l === 'id' ? `${m[1]} kursi tersedia` : l === 'ko' ? `${m[1]}석 이용 가능` : `${m[1]} seats available`),
  },
  {
    regex: /^(\d+)석 이용 가능$/i,
    render: (m, l) => (l === 'id' ? `${m[1]} kursi tersedia` : l === 'ko' ? `${m[1]}석 이용 가능` : `${m[1]} seats available`),
  },
  {
    regex: /^(\d+) pax$/i,
    render: (m, l) => (l === 'id' ? `${m[1]} penumpang` : l === 'ko' ? `${m[1]}명` : `${m[1]} pax`),
  },
  {
    regex: /^(\d+) penumpang$/i,
    render: (m, l) => (l === 'id' ? `${m[1]} penumpang` : l === 'ko' ? `${m[1]}명` : `${m[1]} pax`),
  },
];

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

function lookupCore(coreText: string, lang: SupportedLang): string | null {
  if (!coreText) return null;
  let entry = TRANSLATION_MAP.get(coreText) || TRANSLATION_MAP.get(coreText.toLowerCase());
  let suffix = '';
  if (!entry) {
    const punctMatch = coreText.match(/[:*.›→←]+$/);
    if (punctMatch) {
      suffix = punctMatch[0];
      const stripped = coreText.slice(0, -suffix.length).trim();
      entry = TRANSLATION_MAP.get(stripped) || TRANSLATION_MAP.get(stripped.toLowerCase());
    }
  }
  if (entry) {
    return `${entry[lang] || entry.en}${suffix}`;
  }

  // Check trailing parenthetical count e.g. "Pending Account Registrations (0)"
  const countMatch = coreText.match(/^(.+?)\s*(\(\d+[^)]*\))$/);
  if (countMatch) {
    const baseEntry = TRANSLATION_MAP.get(countMatch[1].trim()) || TRANSLATION_MAP.get(countMatch[1].trim().toLowerCase());
    if (baseEntry) {
      return `${baseEntry[lang] || baseEntry.en} ${countMatch[2]}`;
    }
  }

  for (const pat of DYNAMIC_PATTERNS) {
    const m = pat.regex.exec(coreText);
    if (m) {
      return pat.render(m, lang);
    }
  }

  return null;
}

/**
 * Translates any input string (English, Indonesian, or Korean) to target language
 */
export function t(text: string, targetLang?: SupportedLang): string {
  if (!text) return text;
  const lang = targetLang || getCurrentLanguage();

  const trimmed = text.trim();
  if (!trimmed) return text;

  const leadingSpaces = text.match(/^\s*/)?.[0] || '';
  const trailingSpaces = text.match(/\s*$/)?.[0] || '';

  // 1. Direct / pattern lookup
  const direct = lookupCore(trimmed, lang);
  if (direct !== null) {
    return `${leadingSpaces}${direct}${trailingSpaces}`;
  }

  // 2. Leading icon/symbol/step prefix preservation (e.g., "✓ Filled", "← Back", "1. Trip Category *")
  const prefixMatch = trimmed.match(/^((?:[✓✅⏳⚠️🚨⚡⛽🚗🅿️📋🕒📍🎯👤👥🔁✕+•←→🏢🛣️🔧]+|\d+\.)\s+)(.+)$/u);
  if (prefixMatch) {
    const translatedRest = lookupCore(prefixMatch[2].trim(), lang);
    if (translatedRest !== null) {
      return `${leadingSpaces}${prefixMatch[1]}${translatedRest}${trailingSpaces}`;
    }
  }

  // 3. Multi-segment separator translation (" • ", " · ", " — ", " / ")
  for (const sep of [' • ', ' · ', ' — ']) {
    if (trimmed.includes(sep)) {
      const parts = trimmed.split(sep);
      let changed = false;
      const mapped = parts.map((part) => {
        const tr = t(part, lang);
        if (tr !== part) changed = true;
        return tr;
      });
      if (changed) {
        return `${leadingSpaces}${mapped.join(sep)}${trailingSpaces}`;
      }
    }
  }

  return text;
}

/**
 * Safe cookie setter that works across localhost, cPanel, subdomains, and public suffixes
 */
function setGoogTransCookie(lang: SupportedLang) {
  try {
    if (lang === 'en') {
      document.cookie = 'googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax';
      const host = window.location.hostname;
      if (host && host.includes('.')) {
        document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${host}; SameSite=Lax`;
      }
      return;
    }
    const cookieVal = `/en/${lang}`;
    document.cookie = `googtrans=${cookieVal}; path=/; SameSite=Lax`;
    const host = window.location.hostname;
    if (host && host.includes('.')) {
      document.cookie = `googtrans=${cookieVal}; path=/; domain=${host}; SameSite=Lax`;
      const parts = host.split('.');
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

// WeakMaps to remember original text of nodes and attributes without leaking memory
const originalTextMap = new WeakMap<Node, string>();
const translatedByWalkerMap = new WeakMap<Node, string>();
const originalPlaceholderMap = new WeakMap<Element, string>();
const originalTitleMap = new WeakMap<Element, string>();
let isTranslatingDom = false;

/**
 * High-performance DOM tree walker that translates text nodes in place
 */
export function translateDomTree(root: Node = document.body, lang: SupportedLang = getCurrentLanguage()) {
  if (typeof document === 'undefined' || !root || isTranslatingDom) return;
  isTranslatingDom = true;
  try {
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
      const prevWalkerVal = translatedByWalkerMap.get(currentNode);
      const currentVal = currentNode.nodeValue || '';
      if (original === undefined) {
        original = currentVal;
        originalTextMap.set(currentNode, original);
      } else if (currentVal !== prevWalkerVal && currentVal !== original) {
        // React re-rendered this text node cleanly; adopt new text without reverting it
        original = currentVal;
        originalTextMap.set(currentNode, original);
        translatedByWalkerMap.delete(currentNode);
      }
      nodesToUpdate.push({ node: currentNode, originalText: original });
      currentNode = walker.nextNode();
    }

    for (const { node, originalText } of nodesToUpdate) {
      const translated = t(originalText, lang);
      const prevWalkerVal = translatedByWalkerMap.get(node);
      if (translated !== originalText) {
        if (node.nodeValue !== translated) {
          node.nodeValue = translated;
        }
        translatedByWalkerMap.set(node, translated);
      } else if (prevWalkerVal !== undefined && node.nodeValue === prevWalkerVal) {
        node.nodeValue = originalText;
        translatedByWalkerMap.delete(node);
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
        const translated = t(orig, lang);
        if (htmlEl.placeholder !== translated) {
          htmlEl.placeholder = translated;
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
        const translated = t(orig, lang);
        if (el.getAttribute('title') !== translated) {
          el.setAttribute('title', translated);
        }
      });
    }
  } finally {
    isTranslatingDom = false;
  }
}

let mutationObserver: MutationObserver | null = null;
let debounceTimer: number | null = null;

/**
 * Initializes continuous live DOM translation observer for all languages
 */
export function startDomTranslationObserver() {
  if (typeof window === 'undefined' || mutationObserver) return;

  const currentLang = getCurrentLanguage();
  translateDomTree(document.body, currentLang);

  mutationObserver = new MutationObserver((mutations) => {
    if (isTranslatingDom) return;
    const lang = getCurrentLanguage();

    let hasRelevantChanges = false;
    for (const m of mutations) {
      if (m.type === 'childList' && m.addedNodes.length > 0) {
        hasRelevantChanges = true;
        break;
      }
      if (m.type === 'characterData' && m.target) {
        const prev = translatedByWalkerMap.get(m.target);
        if (m.target.nodeValue !== prev) {
          hasRelevantChanges = true;
          break;
        }
      }
    }

    if (hasRelevantChanges) {
      if (debounceTimer) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        translateDomTree(document.body, lang);
      }, 40);
    }
  });

  mutationObserver.observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

/**
 * Sets current language and triggers instant UI updates across React & DOM
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
    // Schedule post-React-render passes so newly rendered React text nodes also translate
    window.requestAnimationFrame?.(() => translateDomTree(document.body, nextLang));
    window.setTimeout(() => translateDomTree(document.body, nextLang), 60);
    window.setTimeout(() => translateDomTree(document.body, nextLang), 180);
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

