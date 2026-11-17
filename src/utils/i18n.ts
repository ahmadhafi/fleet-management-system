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
  { en: 'Mau ke mana?', id: 'Mau ke mana?', ko: '어디로 가시나요?' },
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
  { en: 'Tambah', id: 'Tambah', ko: '추가' },
  { en: 'Add destination', id: 'Tambah tujuan', ko: '목적지 추가' },
  { en: 'Tambah tujuan', id: 'Tambah tujuan', ko: '목적지 추가' },
  { en: 'Add trip destination', id: 'Tambah tujuan perjalanan', ko: '운행 목적지 추가' },
  { en: 'Tambah tujuan perjalanan', id: 'Tambah tujuan perjalanan', ko: '운행 목적지 추가' },
  { en: 'Can only schedule for 1 destination', id: 'Hanya bisa jadwalkan 1 tujuan', ko: '예약은 1개 목적지만 가능합니다' },
  { en: 'Hanya bisa jadwalkan 1 tujuan', id: 'Hanya bisa jadwalkan 1 tujuan', ko: '예약은 1개 목적지만 가능합니다' },
  { en: 'Quick Shortcuts', id: 'Pintasan Cepat', ko: '빠른 바로가기' },
  { en: 'Recent Destinations', id: 'Tujuan Terakhir', ko: '최근 목적지' },
  { en: 'Popular Destinations', id: 'Tujuan Populer', ko: '자주 가는 목적지' },
  { en: 'Use typed address:', id: 'Gunakan alamat yang diketik:', ko: '입력한 주소 사용:' },
  { en: 'Choose on map', id: 'Pilih di peta', ko: '지도에서 선택' },
  { en: 'Confirm pickup point', id: 'Konfirmasi titik jemput', ko: '픽업 위치 확인' },
  { en: 'Confirm location', id: 'Konfirmasi lokasi', ko: '위치 확인' },

  // Scheduling Bar & Triggers
  { en: 'Book Now', id: 'Pesan Sekarang', ko: '지금 예약' },
  { en: 'Pesan Sekarang', id: 'Pesan Sekarang', ko: '지금 예약' },
  { en: 'Ready to depart immediately or tap schedule button for advance reservation', id: 'Siap jalan segera atau tap tombol jadwal untuk reservasi', ko: '즉시 출발 가능 또는 예약 버튼을 눌러 사전 예약' },
  { en: 'Siap jalan segera atau tap tombol jadwal untuk reservasi', id: 'Siap jalan segera atau tap tombol jadwal untuk reservasi', ko: '즉시 출발 가능 또는 예약 버튼을 눌러 사전 예약' },
  { en: 'Set Schedule', id: 'Atur Jadwal', ko: '일정 예약' },
  { en: 'Atur Jadwal', id: 'Atur Jadwal', ko: '일정 예약' },
  { en: 'Set Trip Schedule', id: 'Atur Jadwal Perjalanan', ko: '운행 일정 설정' },
  { en: 'Atur Jadwal Perjalanan', id: 'Atur Jadwal Perjalanan', ko: '운행 일정 설정' },
  { en: 'Change Trip Schedule', id: 'Ubah Jadwal Perjalanan', ko: '운행 일정 변경' },
  { en: 'Ubah Jadwal Perjalanan', id: 'Ubah Jadwal Perjalanan', ko: '운행 일정 변경' },
  { en: 'Departure Schedule', id: 'Jadwal Keberangkatan', ko: '출발 일정' },
  { en: 'Jadwal Keberangkatan', id: 'Jadwal Keberangkatan', ko: '출발 일정' },
  { en: 'Change', id: 'Ubah', ko: '변경' },
  { en: 'Ubah', id: 'Ubah', ko: '변경' },
  { en: 'Remove', id: 'Hapus', ko: '삭제' },
  { en: 'Hapus', id: 'Hapus', ko: '삭제' },
  { en: 'Remove schedule and return to instant booking', id: 'Hapus Jadwal dan kembali ke Pesan Langsung', ko: '일정을 취소하고 즉시 예약으로 전환' },
  { en: 'Hapus Jadwal dan kembali ke Pesan Langsung', id: 'Hapus Jadwal dan kembali ke Pesan Langsung', ko: '일정을 취소하고 즉시 예약으로 전환' },
  { en: 'Schedule cancelled. Returned to instant booking mode.', id: 'Jadwal dibatalkan. Kembali ke mode pesan langsung.', ko: '예약이 취소되었습니다. 즉시 예약 모드로 전환됩니다.' },
  { en: 'Jadwal dibatalkan. Kembali ke mode pesan langsung.', id: 'Jadwal dibatalkan. Kembali ke mode pesan langsung.', ko: '예약이 취소되었습니다. 즉시 예약 모드로 전환됩니다.' },
  { en: 'Schedule set successfully:', id: 'Jadwal berhasil diatur:', ko: '일정이 설정되었습니다:' },
  { en: 'Jadwal berhasil diatur:', id: 'Jadwal berhasil diatur:', ko: '일정이 설정되었습니다:' },
  { en: 'Continue to Vehicle', id: 'Lanjut Pilih Kendaraan', ko: '차량 선택으로 이동' },
  { en: 'Lanjut Pilih Kendaraan', id: 'Lanjut Pilih Kendaraan', ko: '차량 선택으로 이동' },

  // Gojek Wheel Picker Sheet
  { en: 'No worries, your booking is our priority', id: 'Gak perlu cemas, booking-mu jadi prioritas', ko: '안심하세요, 예약이 최우선 처리됩니다' },
  { en: 'Gak perlu cemas, booking-mu jadi prioritas', id: 'Gak perlu cemas, booking-mu jadi prioritas', ko: '안심하세요, 예약이 최우선 처리됩니다' },
  { en: 'When do you want to leave?', id: 'Kapan mau berangkat?', ko: '언제 출발하시나요?' },
  { en: 'Kapan mau berangkat?', id: 'Kapan mau berangkat?', ko: '언제 출발하시나요?' },
  { en: 'Today', id: 'Hari ini', ko: '오늘' },
  { en: 'Hari ini', id: 'Hari ini', ko: '오늘' },
  { en: 'Tomorrow', id: 'Besok', ko: '내일' },
  { en: 'Besok', id: 'Besok', ko: '내일' },
  { en: 'Select date', id: 'Pilih tanggal', ko: '날짜 선택' },
  { en: 'Pilih tanggal', id: 'Pilih tanggal', ko: '날짜 선택' },
  { en: 'Pickup time estimate', id: 'Estimasi waktu jemput', ko: '예상 픽업 시간' },
  { en: 'Estimasi waktu jemput', id: 'Estimasi waktu jemput', ko: '예상 픽업 시간' },
  { en: 'Perkiraan waktu jemput', id: 'Perkiraan waktu jemput', ko: '예상 픽업 시간' },
  { en: 'Pickup time drum wheel picker', id: 'Pemilih waktu penjemputan drum wheel', ko: '픽업 시간 드럼 휠 선택기' },
  { en: 'Pemilih waktu penjemputan drum wheel', id: 'Pemilih waktu penjemputan drum wheel', ko: '픽업 시간 드럼 휠 선택기' },
  { en: 'Select pickup time slot', id: 'Pilih slot waktu penjemputan', ko: '픽업 시간대 선택' },
  { en: 'Pilih slot waktu penjemputan', id: 'Pilih slot waktu penjemputan', ko: '픽업 시간대 선택' },
  { en: 'Cancel', id: 'Batal', ko: '취소' },
  { en: 'Gak jadi', id: 'Gak jadi', ko: '취소' },
  { en: 'Set schedule', id: 'Set jadwal', ko: '일정 확정' },
  { en: 'Set jadwal', id: 'Set jadwal', ko: '일정 확정' },
  { en: 'Trip Reservation Type', id: 'Tipe Reservasi Perjalanan', ko: '운행 예약 유형' },
  { en: 'Tipe Reservasi Perjalanan', id: 'Tipe Reservasi Perjalanan', ko: '운행 예약 유형' },
  { en: 'Point-to-point', id: 'Point-to-point', ko: '편도 운행' },
  { en: 'Drop & pick up later', id: 'Drop & jemput nanti', ko: '하차 후 추후 픽업' },
  { en: 'Drop & jemput nanti', id: 'Drop & jemput nanti', ko: '하차 후 추후 픽업' },
  { en: 'Full business day', id: 'Seharian kerja', ko: '업무 시간 전일 대절' },
  { en: 'Seharian kerja', id: 'Seharian kerja', ko: '업무 시간 전일 대절' },
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
  { en: 'Alasan Mendesak *', id: 'Alasan Mendesak *', ko: '긴급 사유 *' },
  { en: 'Enter urgent reason (e.g. client site emergency, urgent VIP transport)...', id: 'Tulis alasan urgensi (misal: darurat site klien, transport VIP mendadak)...', ko: '긴급 사유를 입력하세요 (예: 거래처 긴급 지원, VIP 의전 등)...' },
  { en: 'Tulis alasan urgensi (misal: darurat site klien, transport VIP mendadak)...', id: 'Tulis alasan urgensi (misal: darurat site klien, transport VIP mendadak)...', ko: '긴급 사유를 입력하세요 (예: 거래처 긴급 지원, VIP 의전 등)...' },
  { en: 'Departure time cannot be in the past. Please select an upcoming departure time.', id: 'Waktu keberangkatan tidak boleh di masa lalu. Silakan pilih waktu mendatang.', ko: '출발 시간은 과거일 수 없습니다. 이후 시간을 선택해 주세요.' },
  { en: 'Waktu keberangkatan tidak boleh di masa lalu. Silakan pilih waktu mendatang.', id: 'Waktu keberangkatan tidak boleh di masa lalu. Silakan pilih waktu mendatang.', ko: '출발 시간은 과거일 수 없습니다. 이후 시간을 선택해 주세요.' },
  { en: 'Custom schedule', id: 'Jadwal khusus', ko: '지정 일정' },
  { en: 'Jadwal khusus', id: 'Jadwal khusus', ko: '지정 일정' },

  // Reservation Types
  { en: 'Standard Trip', id: 'Perjalanan Standar', ko: '일반 운행' },
  { en: 'Perjalanan Standar', id: 'Perjalanan Standar', ko: '일반 운행' },
  { en: 'Full Day', id: 'Seharian Penuh', ko: '종일 대절' },
  { en: 'Seharian Penuh', id: 'Seharian Penuh', ko: '종일 대절' },
  { en: 'Drop & Pick Up', id: 'Antar & Jemput', ko: '왕복 배차' },
  { en: 'Antar & Jemput', id: 'Antar & Jemput', ko: '왕복 배차' },
  { en: 'Full Day Reservation', id: 'Reservasi Seharian Penuh', ko: '종일 대절 예약' },
  { en: 'Drop & Pick Up Later', id: 'Antar & Jemput Nanti', ko: '행사 후 픽업 예약' },
  { en: 'Dedicated vehicle for the entire business day', id: 'Kendaraan khusus sepanjang hari kerja', ko: '업무 시간 전일 전담 배차' },
  { en: 'Drop off to event location, driver picks up after event finishes', id: 'Antar ke lokasi acara, driver menjemput setelah acara selesai', ko: '행사장 하차 후 종료 시 픽업' },

  // Vehicle Selection Step
  { en: 'Select Vehicle', id: 'Pilih Kendaraan', ko: '차량 선택' },
  { en: 'Pilih Kendaraan', id: 'Pilih Kendaraan', ko: '차량 선택' },
  { en: 'Vehicle Type', id: 'Tipe Kendaraan', ko: '차량 종류' },
  { en: 'Tipe Kendaraan', id: 'Tipe Kendaraan', ko: '차량 종류' },
  { en: 'All Categories', id: 'Semua Kategori', ko: '모든 차종' },
  { en: 'Semua Kategori', id: 'Semua Kategori', ko: '모든 차종' },
  { en: 'All', id: 'Semua', ko: '전체' },
  { en: 'Semua', id: 'Semua', ko: '전체' },
  { en: 'Free Corporate Facility', id: 'Fasilitas Operasional Perusahaan', ko: '사내 업무용 무료 차량' },
  { en: 'Fasilitas Operasional Perusahaan', id: 'Fasilitas Operasional Perusahaan', ko: '사내 업무용 무료 차량' },
  { en: 'Company facility for working purpose', id: 'Fasilitas perusahaan untuk keperluan dinas', ko: '업무 목적 회사 지원 차량' },
  { en: 'Seats', id: 'Kursi', ko: '인승' },
  { en: 'seats', id: 'kursi', ko: '인승' },
  { en: 'Available Now', id: 'Tersedia Sekarang', ko: '지금 이용 가능' },
  { en: 'Tersedia Sekarang', id: 'Tersedia Sekarang', ko: '지금 이용 가능' },
  { en: 'Scheduled / In Use', id: 'Terjadwal / Digunakan', ko: '예약됨 / 사용 중' },
  { en: 'No vehicles registered in this category yet.', id: 'Belum ada kendaraan di kategori ini.', ko: '해당 차종의 등록된 차량이 없습니다.' },
  { en: 'Add Vehicle in Admin Console', id: 'Tambah Kendaraan di Konsol Admin', ko: '관리자 콘솔에서 차량 추가' },
  { en: 'Ready to Depart', id: 'Siap Berangkat', ko: '출발 준비 완료' },
  { en: 'Siap Berangkat', id: 'Siap Berangkat', ko: '출발 준비 완료' },
  { en: 'Schedule', id: 'Jadwalkan', ko: '예약' },
  { en: 'Jadwalin', id: 'Jadwalkan', ko: '예약' },
  { en: 'Jadwalkan', id: 'Jadwalkan', ko: '예약' },
  { en: 'Book', id: 'Pesan', ko: '예약' },
  { en: 'Pesan', id: 'Pesan', ko: '예약' },

  // Order Summary & Confirmation
  { en: 'Almost there', id: 'Hampir selesai', ko: '거의 완료됨' },
  { en: 'Hampir selesai', id: 'Hampir selesai', ko: '거의 완료됨' },
  { en: 'Booking Summary', id: 'Ringkasan Pemesanan', ko: '예약 확인' },
  { en: 'Ringkasan Pemesanan', id: 'Ringkasan Pemesanan', ko: '예약 확인' },
  { en: 'Almost there! Check trip details before requesting booking.', id: 'Hampir selesai! Periksa rincian sebelum mengajukan booking.', ko: '거의 완료되었습니다! 예약 신청 전 상세 내역을 확인해 주세요.' },
  { en: 'Hampir selesai! Periksa rincian sebelum mengajukan booking.', id: 'Hampir selesai! Periksa rincian sebelum mengajukan booking.', ko: '거의 완료되었습니다! 예약 신청 전 상세 내역을 확인해 주세요.' },
  { en: 'Schedule & Reservation', id: 'Jadwal & Reservasi', ko: '일정 및 예약' },
  { en: 'Trip Purpose', id: 'Keperluan Perjalanan', ko: '운행 목적' },
  { en: 'Keperluan Perjalanan', id: 'Keperluan Perjalanan', ko: '운행 목적' },
  { en: 'Purpose of Trip', id: 'Keperluan Perjalanan', ko: '운행 목적' },
  { en: 'Purpose', id: 'Keperluan', ko: '목적' },
  { en: 'Keperluan', id: 'Keperluan', ko: '목적' },
  { en: 'Passengers', id: 'Penumpang', ko: '동승자' },
  { en: 'Penumpang', id: 'Penumpang', ko: '동승자' },
  { en: 'Passenger Details', id: 'Rincian Penumpang', ko: '동승자 상세' },
  { en: 'Passenger Count', id: 'Jumlah Penumpang', ko: '탑승 인원' },
  { en: 'Passenger Nicknames', id: 'Nama Panggilan Penumpang', ko: '동승자 이름' },
  { en: 'Passenger Nicknames (Comma separated)', id: 'Nama Panggilan Penumpang (Pisahkan koma)', ko: '동승자 닉네임 (쉼표로 구분)' },
  { en: 'Notes', id: 'Catatan', ko: '메모' },
  { en: 'Catatan', id: 'Catatan', ko: '메모' },
  { en: 'Dispatch Notes', id: 'Catatan Disposisi', ko: '배차 메모' },
  { en: 'Group & Driver', id: 'Grup & Driver', ko: '그룹 및 기사' },
  { en: 'Department & Driver', id: 'Departemen & Pengemudi', ko: '부서 및 기사' },
  { en: 'Departemen & Pengemudi', id: 'Departemen & Pengemudi', ko: '부서 및 기사' },
  { en: '* Mandatory', id: '* Wajib', ko: '* 필수' },
  { en: '* Wajib', id: '* Wajib', ko: '* 필수' },
  { en: '* Wajib diisi', id: '* Wajib diisi', ko: '* 필수' },
  { en: '* Wajib Diisi', id: '* Wajib diisi', ko: '* 필수' },
  { en: '✓ Filled', id: '✓ Terisi', ko: '✓ 입력됨' },
  { en: '✓ Terisi', id: '✓ Terisi', ko: '✓ 입력됨' },
  { en: 'Done', id: 'Selesai', ko: '완료' },
  { en: 'Selesai', id: 'Selesai', ko: '완료' },
  { en: 'Batal', id: 'Batal', ko: '취소' },
  { en: 'Confirm', id: 'Konfirmasi', ko: '확인' },
  { en: 'Konfirmasi', id: 'Konfirmasi', ko: '확인' },
  { en: 'Confirm Booking', id: 'Konfirmasi Pemesanan', ko: '예약 확정' },
  { en: 'Konfirmasi Pemesanan', id: 'Konfirmasi Pemesanan', ko: '예약 확정' },
  { en: 'Confirm & Request Booking', id: 'Konfirmasi & Kirim Booking', ko: '예약 확정 및 신청' },
  { en: 'Konfirmasi & Kirim Booking', id: 'Konfirmasi & Kirim Booking', ko: '예약 확정 및 신청' },
  { en: 'Request GalaxyFleet', id: 'Pesan GalaxyFleet', ko: 'GalaxyFleet 배차 요청' },
  { en: 'Pesan GalaxyFleet', id: 'Pesan GalaxyFleet', ko: 'GalaxyFleet 배차 요청' },
  { en: 'Complete Details', id: 'Lengkapi Data', ko: '정보 입력' },
  { en: 'Lengkapi Data', id: 'Lengkapi Data', ko: '정보 입력' },
  { en: 'Fill Data', id: 'Lengkapi Data', ko: '정보 입력' },
  { en: 'Close', id: 'Tutup', ko: '닫기' },
  { en: 'Tutup', id: 'Tutup', ko: '닫기' },
  { en: 'Back', id: 'Kembali', ko: '뒤로' },
  { en: 'Save', id: 'Simpan', ko: '저장' },
  { en: 'Submit', id: 'Kirim', ko: '제출' },
  { en: 'Delete', id: 'Hapus', ko: '삭제' },
  { en: 'Edit', id: 'Ubah', ko: '수정' },

  // Sub-Modals & Validation Messages
  { en: 'Select operational purpose or enter custom purpose:', id: 'Pilih tujuan operasional atau masukkan tujuan khusus:', ko: '운행 목적을 선택하거나 직접 입력하세요:' },
  { en: 'Pilih tujuan operasional atau masukkan tujuan khusus:', id: 'Pilih tujuan operasional atau masukkan tujuan khusus:', ko: '운행 목적을 선택하거나 직접 입력하세요:' },
  { en: 'Client visit', id: 'Kunjungan klien', ko: '고객사 미팅' },
  { en: 'Site audit', id: 'Audit lapangan', ko: '현장 실사' },
  { en: 'Airport transfer', id: 'Antar jemput bandara', ko: '공항 픽업/샌딩' },
  { en: 'Executive briefing', id: 'Briefing eksekutif', ko: '임원 보고' },
  { en: 'Trip Purpose *', id: 'Tujuan Perjalanan *', ko: '운행 목적 *' },
  { en: 'Tujuan Perjalanan *', id: 'Tujuan Perjalanan *', ko: '운행 목적 *' },
  { en: 'Example: Cikarang Plant Visit...', id: 'Contoh: Kunjungan Pabrik Cikarang...', ko: '예: 찌카랑 공장 방문...' },
  { en: 'Contoh: Kunjungan Pabrik Cikarang...', id: 'Contoh: Kunjungan Pabrik Cikarang...', ko: '예: 찌카랑 공장 방문...' },
  { en: '⚠️ Mandatory • Tap to select or enter purpose', id: '⚠️ Wajib diisi • Ketuk untuk pilih atau ketik tujuan', ko: '⚠️ 필수 입력 • 터치하여 목적 선택 또는 입력' },
  { en: '⚠️ Wajib diisi • Ketuk untuk pilih atau ketik tujuan', id: '⚠️ Wajib diisi • Ketuk untuk pilih atau ketik tujuan', ko: '⚠️ 필수 입력 • 터치하여 목적 선택 또는 입력' },
  { en: '⚠️ Mandatory • Tap to enter passenger nickname', id: '⚠️ Wajib diisi • Ketuk untuk masukkan nama panggilan (nickname)', ko: '⚠️ 필수 입력 • 터치하여 동승자 닉네임 입력' },
  { en: '⚠️ Wajib diisi • Ketuk untuk masukkan nama panggilan (nickname)', id: '⚠️ Wajib diisi • Ketuk untuk masukkan nama panggilan (nickname)', ko: '⚠️ 필수 입력 • 터치하여 동승자 닉네임 입력' },
  { en: 'Passengers', id: 'Orang', ko: '명' },
  { en: 'Trip Purpose is mandatory. Please select or enter your trip purpose before booking.', id: 'Tujuan perjalanan (Purpose) wajib diisi. Silakan pilih atau ketik tujuan perjalanan Anda sebelum memesan.', ko: '운행 목적은 필수입니다. 예약 전 목적을 선택하거나 입력해 주세요.' },
  { en: 'Tujuan perjalanan (Purpose) wajib diisi. Silakan pilih atau ketik tujuan perjalanan Anda sebelum memesan.', id: 'Tujuan perjalanan (Purpose) wajib diisi. Silakan pilih atau ketik tujuan perjalanan Anda sebelum memesan.', ko: '운행 목적은 필수입니다. 예약 전 목적을 선택하거나 입력해 주세요.' },
  { en: 'Passenger data is mandatory. Please enter at least 1 passenger nickname.', id: 'Data penumpang (Passengers) wajib diisi. Masukkan minimal 1 nama panggilan penumpang.', ko: '동승자 명단은 필수입니다. 최소 1명의 동승자 닉네임을 입력해 주세요.' },
  { en: 'Data penumpang (Passengers) wajib diisi. Masukkan minimal 1 nama panggilan penumpang.', id: 'Data penumpang (Passengers) wajib diisi. Masukkan minimal 1 nama panggilan penumpang.', ko: '동승자 명단은 필수입니다. 최소 1명의 동승자 닉네임을 입력해 주세요.' },
  { en: 'Please select an available vehicle first.', id: 'Silakan pilih kendaraan yang tersedia terlebih dahulu.', ko: '이용 가능한 차량을 먼저 선택해 주세요.' },
  { en: 'Please enter both pickup and destination locations.', id: 'Harap masukkan lokasi penjemputan dan tujuan.', ko: '출발지와 목적지를 모두 입력해 주세요.' },
  { en: 'Please select both departure and return dates/times.', id: 'Harap pilih tanggal/waktu berangkat dan kembali.', ko: '출발 및 귀환 일시를 모두 선택해 주세요.' },
  { en: 'Return time must be after departure time.', id: 'Waktu kembali harus setelah waktu keberangkatan.', ko: '귀환 시간은 출발 시간 이후여야 합니다.' },
  { en: 'Please complete Purpose and Passengers before booking', id: 'Lengkapi Purpose dan Passengers sebelum memesan', ko: '예약 전 목적과 동승자를 입력해 주세요' },
  { en: 'Submit Booking Request', id: 'Kirim Permintaan Booking', ko: '예약 신청서 제출' },
  { en: 'Mandatory to fill Purpose & Passengers', id: 'Wajib isi Purpose & Passengers', ko: '목적 및 동승자 필수 입력' },

  // Activity Tab
  { en: 'Ongoing', id: 'Berjalan', ko: '진행 중' },
  { en: 'Berjalan', id: 'Berjalan', ko: '진행 중' },
  { en: 'History', id: 'Riwayat', ko: '완료 내역' },
  { en: 'Riwayat', id: 'Riwayat', ko: '완료 내역' },
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
  { en: 'Fasilitas Perusahaan', id: 'Fasilitas Perusahaan', ko: '사내 지원 시설' },
  { en: 'Zero Operational Cost (Rp0)', id: 'Bebas Biaya Operasional (Rp0)', ko: '업무 비용 무료 (Rp0)' },
  { en: 'Bebas Biaya Operasional (Rp0)', id: 'Bebas Biaya Operasional (Rp0)', ko: '업무 비용 무료 (Rp0)' },
  { en: 'Book Car', id: 'Pesan Mobil', ko: '차량 예약' },
  { en: 'Pesan Mobil', id: 'Pesan Mobil', ko: '차량 예약' },
  { en: 'Official Car', id: 'Mobil Dinas', ko: '업무용 차량' },
  { en: 'Mobil Dinas', id: 'Mobil Dinas', ko: '업무용 차량' },
  { en: 'Shuttle Bus', id: 'Bus Jemputan', ko: '통근 버스' },
  { en: 'Bus Jemputan', id: 'Bus Jemputan', ko: '통근 버스' },
  { en: 'VIP / Executive', id: 'VIP / Direksi', ko: 'VIP / 임원' },
  { en: 'VIP / Direksi', id: 'VIP / Direksi', ko: 'VIP / 임원' },
  { en: 'Logistics Transport', id: 'Kirim Logistik', ko: '물류 배송' },
  { en: 'Kirim Logistik', id: 'Kirim Logistik', ko: '물류 배송' },
  { en: 'Set Schedule', id: 'Atur Jadwal', ko: '일정 설정' },
  { en: 'Atur Jadwal', id: 'Atur Jadwal', ko: '일정 설정' },
  { en: 'Favorite Routes', id: 'Rute Favorit', ko: '자주 가는 경로' },
  { en: 'Rute Favorit', id: 'Rute Favorit', ko: '자주 가는 경로' },
  { en: 'Driver Dispatch', id: 'Disposisi Driver', ko: '기사 배차' },
  { en: 'Disposisi Driver', id: 'Disposisi Driver', ko: '기사 배차' },
  { en: 'Fleet Helpdesk', id: 'Bantuan Armada', ko: '차량 지원센터' },
  { en: 'Bantuan Armada', id: 'Bantuan Armada', ko: '차량 지원센터' },
  { en: 'Your Frequent Destinations', id: 'Pilihan kamu biasanya', ko: '자주 찾는 목적지' },
  { en: 'Pilihan kamu biasanya', id: 'Pilihan kamu biasanya', ko: '자주 찾는 목적지' },
  { en: 'Seamless corporate mobility with GalaxyFleet', id: 'Pergi dinas operasional mudah dengan GalaxyFleet', ko: 'GalaxyFleet과 함께하는 편리한 업무 이동' },
  { en: 'Pergi dinas operasional mudah dengan GalaxyFleet', id: 'Pergi dinas operasional mudah dengan GalaxyFleet', ko: 'GalaxyFleet과 함께하는 편리한 업무 이동' },
  { en: 'Travel on duty with your team • Zero-cost corporate vehicle facility', id: 'Pergi dinas bersama tim • Fasilitas kendaraan dinas bebas biaya', ko: '팀원과 함께 업무 이동 • 사내 차량 무료 지원' },
  { en: 'Pergi dinas bersama tim • Fasilitas kendaraan dinas bebas biaya', id: 'Pergi dinas bersama tim • Fasilitas kendaraan dinas bebas biaya', ko: '팀원과 함께 업무 이동 • 사내 차량 무료 지원' },
  { en: 'Search corporate services or destinations...', id: 'Cari layanan dinas atau tujuan...', ko: '업무 서비스 또는 목적지 검색...' },
  { en: 'Cari layanan dinas atau tujuan...', id: 'Cari layanan dinas atau tujuan...', ko: '업무 서비스 또는 목적지 검색...' },

  // Driver Console & Gojek Driver Reference
  { en: 'Trip Log', id: 'Log Perjalanan', ko: '운행 일지' },
  { en: 'Log Perjalanan', id: 'Log Perjalanan', ko: '운행 일지' },
  { en: 'Duty', id: 'Tugas', ko: '근무' },
  { en: 'Tugas', id: 'Tugas', ko: '근무' },
  { en: 'Beranda', id: 'Beranda', ko: '홈' },
  { en: 'Akun', id: 'Akun', ko: '계정' },
  { en: 'Pesan', id: 'Pesan', ko: '메시지' },
  { en: 'Ready for Duty', id: 'Siap Tugas', ko: '근무 대기' },
  { en: 'Siap Tugas', id: 'Siap Tugas', ko: '근무 대기' },
  { en: 'Switching to online...', id: 'Mengubah jadi online...', ko: '온라인 상태로 전환 중...' },
  { en: 'Mengubah jadi online...', id: 'Mengubah jadi online...', ko: '온라인 상태로 전환 중...' },
  { en: 'You are now online', id: 'Anda sekarang online', ko: '현재 온라인 상태입니다' },
  { en: 'Anda sekarang online', id: 'Anda sekarang online', ko: '현재 온라인 상태입니다' },
  { en: "Let's start duty!", id: 'Mulai kerja, yuk!', ko: '업무를 시작해 볼까요!' },
  { en: 'Mulai kerja, yuk!', id: 'Mulai kerja, yuk!', ko: '업무를 시작해 볼까요!' },
  { en: 'in service driving', id: 'dalam dinas menyetir', ko: '운행 중' },
  { en: 'dalam dinas menyetir', id: 'dalam dinas menyetir', ko: '운행 중' },
  { en: 'Total Driving Time', id: 'Total Waktu Menyetir', ko: '총 운행 시간' },
  { en: 'Total Waktu Menyetir', id: 'Total Waktu Menyetir', ko: '총 운행 시간' },
  { en: 'Trips Completed', id: 'Perjalanan Selesai', ko: '완료된 운행' },
  { en: 'Perjalanan Selesai', id: 'Perjalanan Selesai', ko: '완료된 운행' },
  { en: 'Total Distance', id: 'Total Jarak', ko: '총 주행 거리' },
  { en: 'Total Jarak', id: 'Total Jarak', ko: '총 주행 거리' },
  { en: 'Assigned Vehicle', id: 'Kendaraan Ditugaskan', ko: '배정 차량' },
  { en: 'Kendaraan Ditugaskan', id: 'Kendaraan Ditugaskan', ko: '배정 차량' },
  { en: 'SIM License', id: 'Surat Izin Mengemudi (SIM)', ko: '운전면허증' },
  { en: 'Corporate Driver Profile', id: 'Profil Driver Perusahaan', ko: '전담 기사 프로필' },
  { en: 'App Version', id: 'Versi Aplikasi', ko: '앱 버전' },
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
 * Translates any input string (English, Indonesian, or Korean) to target language
 */
export function t(text: string, targetLang?: SupportedLang): string {
  if (!text) return text;
  const lang = targetLang || getCurrentLanguage();

  const trimmed = text.trim();
  if (!trimmed) return text;

  // Direct lookup (exact or lowercase)
  let entry = TRANSLATION_MAP.get(trimmed) || TRANSLATION_MAP.get(trimmed.toLowerCase());

  // Suffix matching if trailing punctuation
  let suffix = '';
  if (!entry) {
    const punctMatch = trimmed.match(/[:*.]+$/);
    if (punctMatch) {
      suffix = punctMatch[0];
      const core = trimmed.slice(0, -suffix.length).trim();
      entry = TRANSLATION_MAP.get(core) || TRANSLATION_MAP.get(core.toLowerCase());
    }
  }

  if (entry) {
    const result = entry[lang] || entry.en;
    const leadingSpaces = text.match(/^\s*/)?.[0] || '';
    const trailingSpaces = text.match(/\s*$/)?.[0] || '';
    return `${leadingSpaces}${result}${suffix}${trailingSpaces}`;
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
    const translated = t(originalText, lang);
    if (translated !== originalText && node.nodeValue !== translated) {
      node.nodeValue = translated;
    } else if (translated === originalText && node.nodeValue !== originalText) {
      node.nodeValue = originalText;
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
    const lang = getCurrentLanguage();

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
