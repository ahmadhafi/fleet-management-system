export interface IndonesianPoi {
  name: string;
  address: string;
  lat: number;
  lon: number;
  keywords: string;
}

const ABBREVIATION_MAP: Record<string, string[]> = {
  jl: ['jalan'],
  jln: ['jalan'],
  st: ['stasiun'],
  sta: ['stasiun'],
  rs: ['rumah', 'sakit'],
  rsu: ['rumah', 'sakit'],
  rsud: ['rumah', 'sakit'],
  rsup: ['rumah', 'sakit'],
  gt: ['gerbang', 'tol'],
  ki: ['kawasan', 'industri'],
  kab: ['kabupaten'],
  kec: ['kecamatan'],
  bdr: ['bandara', 'airport'],
  airport: ['bandara'],
  port: ['pelabuhan'],
  station: ['stasiun'],
  univ: ['universitas'],
  ui: ['universitas', 'indonesia', 'depok'],
  itb: ['institut', 'teknologi', 'bandung'],
  ugm: ['universitas', 'gadjah', 'mada', 'yogyakarta'],
  its: ['institut', 'teknologi', 'sepuluh', 'nopember', 'surabaya'],
  unair: ['universitas', 'airlangga', 'surabaya'],
  ub: ['universitas', 'brawijaya', 'malang'],
  ikn: ['ibu', 'kota', 'nusantara', 'sepaku', 'kalimantan'],
  jogja: ['yogyakarta'],
  sby: ['surabaya'],
  bdg: ['bandung'],
  smg: ['semarang'],
  jkt: ['jakarta'],
  tgr: ['tangerang'],
  bks: ['bekasi'],
  mks: ['makassar'],
  mdn: ['medan'],
  dps: ['denpasar', 'bali'],
  bpn: ['balikpapan'],
  plm: ['palembang'],
  pku: ['pekanbaru'],
  bth: ['batam'],
  bdj: ['banjarmasin'],
  pnk: ['pontianak'],
  mdc: ['manado'],
  djj: ['jayapura', 'sentani'],
};

export function normalizeIndoQuery(raw: string): { lower: string; tokens: string[]; expandedTokens: string[] } {
  const lower = raw.toLowerCase().trim().replace(/[^\p{L}\p{N}\s.-]/gu, ' ').replace(/\s+/g, ' ');
  const tokens = lower.split(' ').filter(Boolean);
  const expanded = new Set<string>(tokens);
  for (const t of tokens) {
    const mapped = ABBREVIATION_MAP[t];
    if (mapped) {
      for (const m of mapped) expanded.add(m);
    }
  }
  return { lower, tokens, expandedTokens: Array.from(expanded) };
}

export const INDONESIAN_POIS: IndonesianPoi[] = [
  // -------------------------------------------------------------------------
  // Operational Plants, Fleet Pools & Corporate Hubs (Jabodetabek / West Java)
  // -------------------------------------------------------------------------
  { name: 'Manufacturing Plant 1', address: 'Jl. Danau Sunter Barat No. 8, Sunter Jaya, Jakarta Utara', lat: -6.13842, lon: 106.88561, keywords: 'plant 1 sunter pabrik manufaktur factory main jakarta utara' },
  { name: 'Manufacturing Plant 2', address: 'Kawasan Industri KIIC Lot A-1, Telukjambe Timur, Karawang Barat', lat: -6.34789, lon: 107.28912, keywords: 'plant 2 karawang kiic pabrik factory assembly jawa barat' },
  { name: 'Cikarang Assembly Plant', address: 'Greenland International Industrial Center (GIIC), Deltamas, Cikarang Pusat', lat: -6.37521, lon: 107.16834, keywords: 'plant cikarang giic deltamas assembly pabrik bekasi' },
  { name: 'Central Fleet Pool & Operations Base', address: 'Jl. Rawa Gelam IV No. 2, Kawasan Industri Pulogadung, Jakarta Timur', lat: -6.19834, lon: 106.88873, keywords: 'central fleet pool hq operational car parkir pulogadung base jakarta timur' },
  { name: 'Karawang Staging Pool', address: 'Jl. Surya Madya VI, Kawasan Industri Suryacipta, Karawang Timur', lat: -6.38891, lon: 107.34567, keywords: 'pool karawang suryacipta operational car fleet' },
  { name: 'Cikarang Fleet Depot', address: 'Kawasan Industri MM2100 Blok C, Cikarang Barat, Bekasi', lat: -6.29412, lon: 107.08745, keywords: 'pool cikarang mm2100 depot fleet armada bekasi' },
  { name: 'Samsung Electronics Indonesia (SEIN Cikarang)', address: 'Jl. Jababeka Raya Blok F29-33, Cikarang Utara, Bekasi', lat: -6.30255, lon: 107.14365, keywords: 'samsung electronics sein jababeka cikarang pabrik factory bekasi' },
  { name: 'Head Office - SCBD District 8', address: 'District 8 SCBD, Treasury Tower Lt. 35, Jl. Jend. Sudirman Kav. 52-53, Jakarta Selatan', lat: -6.22728, lon: 106.80816, keywords: 'head office scbd sudirman district 8 treasury tower hq kantor pusat senayan jakarta selatan' },
  { name: 'Menara Astra Regional Office', address: 'Jl. Jend. Sudirman Kav. 5-6, Karet Tengsin, Jakarta Pusat', lat: -6.20845, lon: 106.82231, keywords: 'menara astra sudirman karet tengsin office kantor jakarta pusat' },
  { name: 'Pondok Indah Office Tower 3', address: 'Jl. Sultan Iskandar Muda Kav. V-TA, Pondok Indah, Jakarta Selatan', lat: -6.28421, lon: 106.78215, keywords: 'pondok indah office tower piot south jakarta kantor cabang selatan' },
  { name: 'Logistics Hub & Distribution Center (Marunda)', address: 'Kawasan Marunda Center Blok B, Tarumajaya, Bekasi', lat: -6.11542, lon: 106.97451, keywords: 'logistics hub distribution center marunda gudang depo bekasi utara' },
  { name: 'R&D Tech Center BSD', address: 'BSD Green Office Park 9, Jl. Grand Boulevard, BSD City, Tangerang', lat: -6.30214, lon: 106.65219, keywords: 'tech center r&d bsd green office park tangerang selatan banten' },

  // -------------------------------------------------------------------------
  // Major Jabodetabek Business Districts, Stations, Airports & Landmarks
  // -------------------------------------------------------------------------
  { name: 'Bandara Internasional Soekarno-Hatta (CGK) - Terminal 3', address: 'Bandara Soekarno-Hatta Terminal 3 Ultimate, Benda, Kota Tangerang, Banten', lat: -6.12556, lon: 106.65589, keywords: 'bandara airport soekarno hatta cgk soetta terminal 3 ultimate t3 tangerang jakarta' },
  { name: 'Bandara Internasional Soekarno-Hatta (CGK) - Terminal 1 & 2', address: 'Bandara Soekarno-Hatta Terminal 1-2, Benda, Kota Tangerang, Banten', lat: -6.13012, lon: 106.65421, keywords: 'bandara airport soekarno hatta cgk soetta terminal 1 2 t1 t2 tangerang' },
  { name: 'Bandara Halim Perdanakusuma (HLP)', address: 'Jl. Halim Perdana Kusuma, Makasar, Jakarta Timur', lat: -6.26654, lon: 106.89087, keywords: 'bandara airport halim perdanakusuma hlp jakarta timur' },
  { name: 'Stasiun Kereta Cepat Whoosh Halim (KCIC)', address: 'Jl. Akses Stasiun Kereta Cepat Halim, Makasar, Jakarta Timur', lat: -6.24876, lon: 106.88765, keywords: 'stasiun kcic whoosh halim kereta cepat station jakarta timur' },
  { name: 'Stasiun Kereta Cepat Whoosh Karawang (KCIC)', address: 'Wanakerta, Telukjambe Barat, Karawang', lat: -6.36845, lon: 107.24123, keywords: 'stasiun kcic whoosh karawang kereta cepat station telukjambe' },
  { name: 'Stasiun Kereta Cepat Whoosh Padalarang (KCIC)', address: 'Kertajaya, Padalarang, Kabupaten Bandung Barat', lat: -6.83987, lon: 107.48123, keywords: 'stasiun kcic whoosh padalarang bandung barat station' },
  { name: 'Stasiun Kereta Cepat Whoosh Tegalluar (KCIC)', address: 'Tegalluar, Bojongsoang, Kabupaten Bandung', lat: -6.97351, lon: 107.71768, keywords: 'stasiun kcic whoosh tegalluar bandung kereta cepat' },
  { name: 'Stasiun Gambir', address: 'Jl. Medan Merdeka Timur No. 1, Gambir, Jakarta Pusat', lat: -6.17667, lon: 106.83056, keywords: 'stasiun gambir central station kereta api monas jakarta pusat' },
  { name: 'Stasiun Pasar Senen', address: 'Jl. Stasiun Senen No. 1, Senen, Jakarta Pusat', lat: -6.17421, lon: 106.84432, keywords: 'stasiun pasar senen kereta api station jakarta pusat' },
  { name: 'Stasiun Manggarai', address: 'Jl. Manggarai Utara 1, Tebet, Jakarta Selatan', lat: -6.20987, lon: 106.85012, keywords: 'stasiun manggarai transit krl airport train jakarta selatan' },
  { name: 'Stasiun Tanah Abang', address: 'Jl. Jati Baru Raya, Cideng, Gambir, Jakarta Pusat', lat: -6.18564, lon: 106.81089, keywords: 'stasiun tanah abang pasar grosir krl jakarta pusat' },
  { name: 'Stasiun MRT Bundaran HI Bank DKI', address: 'Jl. M.H. Thamrin, Gondangdia, Menteng, Jakarta Pusat', lat: -6.19254, lon: 106.82312, keywords: 'stasiun mrt bundaran hi thamrin menteng jakarta pusat' },
  { name: 'Stasiun MRT Blok M BCA', address: 'Jl. Panglima Polim, Melawai, Kebayoran Baru, Jakarta Selatan', lat: -6.24432, lon: 106.79845, keywords: 'stasiun mrt blok m kebayoran baru jakarta selatan' },
  { name: 'Terminal Terpadu Pulo Gebang', address: 'Jl. Sentra Primer Timur, Cakung, Jakarta Timur', lat: -6.21234, lon: 106.95321, keywords: 'terminal pulo gebang bus station cakung jakarta timur' },
  { name: 'Pelabuhan Tanjung Priok', address: 'Jl. Raya Pelabuhan No. 9, Tanjung Priok, Jakarta Utara', lat: -6.10389, lon: 106.88055, keywords: 'pelabuhan tanjung priok port container cargo jakarta utara' },
  { name: 'Kawasan Industri MM2100', address: 'Jl. Irian, Cikarang Barat, Kabupaten Bekasi', lat: -6.29412, lon: 107.08745, keywords: 'mm2100 cikarang barat bekasi industrial estate kawasan industri' },
  { name: 'Kawasan Industri Jababeka 1 & 2', address: 'Jl. Jababeka Raya, Harja Mekar, Cikarang Utara, Bekasi', lat: -6.31145, lon: 107.14231, keywords: 'jababeka cikarang utara industrial estate kawasan industri bekasi' },
  { name: 'Kawasan Industri EJIP', address: 'East Jakarta Industrial Park, Sukaresmi, Cikarang Selatan, Bekasi', lat: -6.32789, lon: 107.11245, keywords: 'ejip cikarang selatan industrial park bekasi kawasan industri' },
  { name: 'Kawasan Industri KIIC Karawang', address: 'Jl. Permata Raya, Karawang Barat, Karawang', lat: -6.35678, lon: 107.27654, keywords: 'kiic karawang barat international industrial city' },
  { name: 'Kawasan Industri Suryacipta', address: 'Jl. Surya Madya, Kutamekar, Ciampel, Karawang', lat: -6.38891, lon: 107.34567, keywords: 'suryacipta city of industry karawang timur ciampel' },
  { name: 'Pacific Place Mall & SCBD', address: 'Jl. Jend. Sudirman Kav. 52-53, Senayan, Kebayoran Baru, Jakarta Selatan', lat: -6.22435, lon: 106.80976, keywords: 'pacific place scbd ritz carlton sudirman senayan' },
  { name: 'Grand Indonesia & Plaza Indonesia', address: 'Jl. M.H. Thamrin No. 1, Menteng, Jakarta Pusat', lat: -6.19512, lon: 106.82145, keywords: 'grand indonesia gi pi plaza indonesia bundaran hi thamrin' },
  { name: 'Senayan City & Plaza Senayan', address: 'Jl. Asia Afrika No. 19, Gelora, Tanah Abang, Jakarta Pusat', lat: -6.22689, lon: 106.79874, keywords: 'senayan city senci plaza senayan asia afrika' },
  { name: 'Central Park Mall & Neo Soho', address: 'Jl. Letjen S. Parman Kav. 28, Tanjung Duren, Jakarta Barat', lat: -6.17743, lon: 106.79012, keywords: 'central park neo soho grogol tanjung duren jakarta barat' },
  { name: 'Mall Kelapa Gading (MKG)', address: 'Jl. Boulevard Raya, Kelapa Gading Timur, Jakarta Utara', lat: -6.15789, lon: 106.90876, keywords: 'mall kelapa gading mkg boulevard raya jakarta utara' },
  { name: 'Mega Kuningan Business District', address: 'Kawasan Mega Kuningan, Jl. DR. Ide Anak Agung Gde Agung, Jakarta Selatan', lat: -6.22891, lon: 106.82876, keywords: 'mega kuningan ritz carlton marriott kedubes jakarta selatan' },
  { name: 'TB Simatupang Business Corridor', address: 'Jl. TB Simatupang, Cilandak Barat, Pasar Minggu, Jakarta Selatan', lat: -6.29218, lon: 106.79884, keywords: 'tb simatupang cilandak selatan perkantoran office' },
  { name: 'Rasuna Said Kuningan (Kota Kasablanka)', address: 'Jl. Casablanca Raya Kav. 88, Menteng Dalam, Tebet, Jakarta Selatan', lat: -6.22368, lon: 106.84289, keywords: 'kota kasablanka kokas casablanca kuningan rasuna said tebet' },
  { name: 'Pondok Indah Mall (PIM 1, 2, 3)', address: 'Jl. Metro Pondok Indah, Pondok Pinang, Kebayoran Lama, Jakarta Selatan', lat: -6.26541, lon: 106.78442, keywords: 'pondok indah mall pim 1 2 3 kebayoran lama jakarta selatan' },
  { name: 'Pantai Indah Kapuk (PIK Avenue)', address: 'Jl. Pantai Indah Kapuk Boulevard, Penjaringan, Jakarta Utara', lat: -6.10889, lon: 106.74021, keywords: 'pik pantai indah kapuk avenue golf island jakarta utara' },
  { name: 'PIK 2 (Pantai Kita / Aloha Pasir Putih)', address: 'Kosambi Timur, Kabupaten Tangerang, Banten', lat: -6.04688, lon: 106.69755, keywords: 'pik 2 aloha kosambi tangerang utara banten' },
  { name: 'Gelora Bung Karno (GBK)', address: 'Jl. Pintu Satu Senayan, Gelora, Jakarta Pusat', lat: -6.21845, lon: 106.80198, keywords: 'gbk gelora bung karno stadion senayan jakarta' },
  { name: 'Monumen Nasional (Monas)', address: 'Gambir, Jakarta Pusat, DKI Jakarta', lat: -6.17539, lon: 106.82715, keywords: 'monas monumen nasional gambir medan merdeka jakarta pusat' },
  { name: 'Balai Kota DKI Jakarta', address: 'Jl. Medan Merdeka Selatan No. 8-9, Gambir, Jakarta Pusat', lat: -6.18123, lon: 106.82845, keywords: 'balai kota dki jakarta gubernur gambir merdeka selatan' },
  { name: 'Jakarta Convention Center (JCC)', address: 'Jl. Gatot Subroto No. 1, Gelora, Tanah Abang, Jakarta Pusat', lat: -6.21456, lon: 106.80678, keywords: 'jcc jakarta convention center senayan gatot subroto pameran' },
  { name: 'JIExpo Kemayoran', address: 'Gedung Pusat Niaga, Arena PRJ Kemayoran, Jakarta Pusat', lat: -6.14876, lon: 106.84567, keywords: 'jiexpo kemayoran prj pameran arena expo jakarta pusat' },
  { name: 'Indonesia Convention Exhibition (ICE BSD)', address: 'Jl. BSD Grand Boulevard Raya No. 1, Pagedangan, Tangerang', lat: -6.30123, lon: 106.63678, keywords: 'ice bsd convention exhibition tangerang pameran event' },
  { name: 'Taman Mini Indonesia Indah (TMII)', address: 'Ceger, Cipayung, Jakarta Timur, DKI Jakarta', lat: -6.30244, lon: 106.89515, keywords: 'tmii taman mini indonesia indah cipayung jakarta timur' },
  { name: 'Taman Impian Jaya Ancol', address: 'Jl. Lodan Timur No. 7, Ancol, Pademangan, Jakarta Utara', lat: -6.12562, lon: 106.84274, keywords: 'ancol dufan pantai ecopark pademangan jakarta utara' },
  { name: 'RS Cipto Mangunkusumo (RSCM)', address: 'Jl. Pangeran Diponegoro No. 71, Kenari, Senen, Jakarta Pusat', lat: -6.19789, lon: 106.84876, keywords: 'rscm cipto mangunkusumo rumah sakit hospital salemba senen' },
  { name: 'RS Siloam Lippo Cikarang', address: 'Jl. M.H. Thamrin Kav. 105, Lippo Cikarang, Bekasi', lat: -6.32654, lon: 107.13542, keywords: 'rs siloam lippo cikarang rumah sakit hospital bekasi' },
  { name: 'RS Medistra Jakarta', address: 'Jl. Gatot Subroto Kav. 59, Kuningan Barat, Jakarta Selatan', lat: -6.24123, lon: 106.83456, keywords: 'rs medistra gatot subroto rumah sakit kuningan' },
  { name: 'RS Pondok Indah', address: 'Jl. Metro Pondok Indah Kav. UE, Kebayoran Lama, Jakarta Selatan', lat: -6.28234, lon: 106.78291, keywords: 'rs pondok indah rspi rumah sakit hospital' },
  { name: 'RS Mitra Keluarga Kelapa Gading', address: 'Jl. Raya Gading Kirana No. 2, Kelapa Gading Barat, Jakarta Utara', lat: -6.15432, lon: 106.89678, keywords: 'rs mitra keluarga kelapa gading rumah sakit' },
  { name: 'Cikarang Pusat - Pemda Bekasi (Deltamas)', address: 'Sukamahi, Cikarang Pusat, Kabupaten Bekasi, Jawa Barat', lat: -6.36389, lon: 107.17222, keywords: 'cikarang pusat pemda deltamas bekasi kabupaten' },
  { name: 'Karawang Barat Kota', address: 'Nagasari, Karawang Barat, Kabupaten Karawang, Jawa Barat', lat: -6.30722, lon: 107.29361, keywords: 'karawang barat alun alun kota stasiun resinda karawang' },
  { name: 'Bekasi Kota - Summarecon & Alun-Alun', address: 'Jl. Boulevard Ahmad Yani, Marga Mulya, Bekasi Utara, Kota Bekasi', lat: -6.22556, lon: 106.99972, keywords: 'bekasi kota alun alun stasiun summarecon bekasi' },
  { name: 'Tangerang Kota (Tangcity & Bale Kota)', address: 'Jl. Jend. Sudirman No. 1, Babakan, Kota Tangerang, Banten', lat: -6.19323, lon: 106.63358, keywords: 'tangerang kota bale kota tangcity banten' },
  { name: 'Alam Sutera & Mall @ Alam Sutera', address: 'Jl. Jalur Sutera Barat, Panunggangan Timur, Tangerang, Banten', lat: -6.22156, lon: 106.65401, keywords: 'alam sutera serpong tangerang banten living world' },
  { name: 'Summarecon Mall Serpong (Gading Serpong)', address: 'Jl. Boulevard Raya Gading Serpong, Kelapa Dua, Tangerang', lat: -6.24075, lon: 106.62855, keywords: 'gading serpong summarecon sms tangerang banten' },
  { name: 'Lippo Karawaci (Supermal Karawaci)', address: 'Jl. Boulevard Diponegoro No. 105, Bencongan, Tangerang', lat: -6.22668, lon: 106.60791, keywords: 'karawaci lippo supermal tangerang siloam banten' },
  { name: 'Bintaro Jaya Xchange (BXc)', address: 'Jl. Sektor VII, Pondok Jaya, Pondok Aren, Tangerang Selatan', lat: -6.28492, lon: 106.72793, keywords: 'bintaro jaya xchange bxc tangsel pondok aren' },
  { name: 'Depok (Universitas Indonesia & Margonda)', address: 'Jl. Margonda Raya / Kampus UI Depok, Jawa Barat', lat: -6.36462, lon: 106.82864, keywords: 'depok margonda universitas indonesia ui jawa barat' },
  { name: 'Sentul International Convention Center (SICC)', address: 'Jl. Jend. Sudirman No. 1, Sentul City, Babakan Madang, Kab. Bogor', lat: -6.56817, lon: 106.85483, keywords: 'sentul city sicc convention bogor babakan madang' },
  { name: 'Bogor Kota - Kebun Raya & Istana Bogor', address: 'Jl. Ir. H. Juanda No. 13, Paledang, Kota Bogor, Jawa Barat', lat: -6.59715, lon: 106.80604, keywords: 'bogor kebun raya istana bogor stasiun pajajaran' },
  { name: 'Puncak Pass / Taman Safari Indonesia Cisarua', address: 'Jl. Kapten Harun Kabir No. 724, Cibeureum, Cisarua, Bogor', lat: -6.71636, lon: 106.95045, keywords: 'puncak cisarua taman safari bogor jawa barat' },

  // -------------------------------------------------------------------------
  // Banten & West Java (Jawa Barat)
  // -------------------------------------------------------------------------
  { name: 'Serang Kota (Alun-Alun & KP3B)', address: 'Kotabaru, Kota Serang, Banten', lat: -6.11528, lon: 106.15417, keywords: 'serang banten alun alun ibu kota provinsi kp3b' },
  { name: 'Cilegon - Kawasan Industri Krakatau Steel', address: 'Jl. Industri No. 5, Ramanuju, Purwakarta, Kota Cilegon, Banten', lat: -6.00639, lon: 106.01194, keywords: 'cilegon krakatau steel industrial estate banten' },
  { name: 'Pelabuhan Penyeberangan Merak', address: 'Tamansari, Pulomerak, Kota Cilegon, Banten', lat: -5.93275, lon: 105.99781, keywords: 'pelabuhan merak ferry cilegon banten sumatra' },
  { name: 'Pantai Anyer (Banten)', address: 'Jl. Raya Anyer-Sirih, Anyar, Kabupaten Serang, Banten', lat: -6.07152, lon: 105.88196, keywords: 'anyer pantai carita serang banten' },
  { name: 'Rangkasbitung (Lebak)', address: 'Muara Ciujung Timur, Rangkasbitung, Kabupaten Lebak, Banten', lat: -6.35962, lon: 106.25042, keywords: 'rangkasbitung lebak stasiun krl banten' },
  { name: 'Purwakarta (Sadang & BIC Industrial)', address: 'Jl. Jend. Sudirman, Nagri Tengah, Kabupaten Purwakarta, Jawa Barat', lat: -6.55405, lon: 107.44149, keywords: 'purwakarta sadang bic bukit indah city jawa barat' },
  { name: 'Subang & Pelabuhan Patimban', address: 'Patimban, Pusakanagara, Kabupaten Subang, Jawa Barat', lat: -6.24542, lon: 107.90291, keywords: 'subang patimban pelabuhan port jawa barat' },
  { name: 'Bandung Kota - Gedung Sate & Gasibu', address: 'Jl. Diponegoro No. 22, Citarum, Bandung Wetan, Kota Bandung', lat: -6.90248, lon: 107.61878, keywords: 'bandung gedung sate gasibu jawa barat dago' },
  { name: 'Jalan Braga & Alun-Alun Bandung', address: 'Jl. Braga / Asia Afrika, Sumur Bandung, Kota Bandung', lat: -6.91751, lon: 107.60925, keywords: 'bandung braga asia afrika alun alun' },
  { name: 'Institut Teknologi Bandung (ITB)', address: 'Jl. Ganesa No. 10, Lb. Siliwangi, Coblong, Kota Bandung', lat: -6.89148, lon: 107.61066, keywords: 'itb kampus ganesa coblong dago bandung' },
  { name: 'Stasiun Bandung & Bandara Husein Sastranegara (BDO)', address: 'Jl. Kebon Kawung No. 43, Cicendo, Kota Bandung, Jawa Barat', lat: -6.91426, lon: 107.60242, keywords: 'stasiun bandung hall kebon kawung bdo husein sastranegara' },
  { name: 'Gerbang Tol Pasteur & Paris Van Java (Bandung)', address: 'Jl. Dr. Djunjunan / Sukajadi, Kota Bandung', lat: -6.89304, lon: 107.58989, keywords: 'pasteur gerbang tol pvj paris van java sukajadi bandung' },
  { name: 'Cimahi Kota', address: 'Jl. Rd. Demang Hardjakusumah, Cibabat, Kota Cimahi, Jawa Barat', lat: -6.87222, lon: 107.54251, keywords: 'cimahi kota baros jawa barat' },
  { name: 'Jatinangor (UNPAD / Sumedang Barat)', address: 'Jl. Raya Bandung Sumedang KM 21, Jatinangor, Kab. Sumedang', lat: -6.92613, lon: 107.77469, keywords: 'jatinangor unpad itb sumedang bandung timur' },
  { name: 'Bandara Internasional Kertajati (KJT)', address: 'Kertajati, Kabupaten Majalengka, Jawa Barat', lat: -6.65222, lon: 108.16528, keywords: 'bandara airport kertajati bijb kjt majalengka cirebon bandung' },
  { name: 'Cirebon Kota (Stasiun Kejaksan & Pelabuhan)', address: 'Jl. Siliwangi, Kejaksan, Kota Cirebon, Jawa Barat', lat: -6.70632, lon: 108.55704, keywords: 'cirebon kejaksan pelabuhan csb grage mall jawa barat pantura' },
  { name: 'Indramayu (Balongan)', address: 'Jl. Raya Balongan, Kabupaten Indramayu, Jawa Barat', lat: -6.34224, lon: 108.35962, keywords: 'indramayu balongan kilang pertamina jawa barat' },
  { name: 'Sukabumi Kota', address: 'Jl. Ahmad Yani, Cikole, Kota Sukabumi, Jawa Barat', lat: -6.92194, lon: 106.92639, keywords: 'sukabumi cikole stasiun pelabuhan ratu jawa barat' },
  { name: 'Cianjur Kota', address: 'Pamoyanan, Kecamatan Cianjur, Kabupaten Cianjur, Jawa Barat', lat: -6.82075, lon: 107.14254, keywords: 'cianjur cipanas puncak jawa barat' },
  { name: 'Garut Kota', address: 'Regol, Garut Kota, Kabupaten Garut, Jawa Barat', lat: -7.21622, lon: 107.90167, keywords: 'garut cipanas tarogong jawa barat' },
  { name: 'Tasikmalaya Kota', address: 'Jl. HZ Mustofa, Yudanagara, Cihideung, Kota Tasikmalaya', lat: -7.32741, lon: 108.22071, keywords: 'tasikmalaya cihideung priangan timur jawa barat' },

  // -------------------------------------------------------------------------
  // Central Java & DIY Yogyakarta (Jawa Tengah & DIY)
  // -------------------------------------------------------------------------
  { name: 'Semarang Kota - Simpang Lima & Lawang Sewu', address: 'Simpang Lima, Karangkidul, Semarang Tengah, Kota Semarang', lat: -6.99028, lon: 110.42294, keywords: 'semarang simpang lima tugu muda lawang sewu jawa tengah' },
  { name: 'Bandara Internasional Jenderal Ahmad Yani (SRG)', address: 'Jl. Puad Ahmad Yani, Tambakharjo, Semarang Barat, Kota Semarang', lat: -6.97144, lon: 110.37541, keywords: 'bandara ahmad yani srg semarang jawa tengah airport' },
  { name: 'Stasiun Semarang Tawang & Kota Lama', address: 'Jl. Taman Tawang No. 1, Tanjung Mas, Semarang Utara', lat: -6.96452, lon: 110.42785, keywords: 'stasiun semarang tawang kota lama pelabuhan tanjung emas' },
  { name: 'Kawasan Industri Kendal (KIK)', address: 'Jl. Raya Arteri Kaliwungu KM 19, Brangsong, Kab. Kendal', lat: -6.94285, lon: 110.27361, keywords: 'kendal kik kawasan industri industrial park semarang jawa tengah' },
  { name: 'Kawasan Industri Terpadu Batang (KITB)', address: 'Ketanggan, Gringsing, Kabupaten Batang, Jawa Tengah', lat: -6.95624, lon: 109.96935, keywords: 'batang kitb grand batang city kawasan industri jawa tengah' },
  { name: 'Pekalongan Kota', address: 'Jl. Mataram, Kuripan Kertoharjo, Kota Pekalongan, Jawa Tengah', lat: -6.88982, lon: 109.67461, keywords: 'pekalongan batik pantura jawa tengah' },
  { name: 'Tegal Kota', address: 'Alun-Alun Kota Tegal, Mangkukusuman, Kota Tegal, Jawa Tengah', lat: -6.86942, lon: 109.14017, keywords: 'tegal slawi pantura jawa tengah' },
  { name: 'Kudus Kota', address: 'Simpang Tujuh Kudus, Demaan, Kabupaten Kudus, Jawa Tengah', lat: -6.80481, lon: 110.84051, keywords: 'kudus pati jepara muria jawa tengah' },
  { name: 'Salatiga Kota', address: 'Lapangan Pancasila, Kalicacing, Sidomukti, Kota Salatiga', lat: -7.33052, lon: 110.50842, keywords: 'salatiga uksw tol semarang solo jawa tengah' },
  { name: 'Solo / Surakarta (Jl. Slamet Riyadi & Stasiun Balapan)', address: 'Jl. Slamet Riyadi / Stasiun Solo Balapan, Banjarsari, Kota Surakarta', lat: -7.55704, lon: 110.82206, keywords: 'solo surakarta balapan slamet riyadi keraton jawa tengah' },
  { name: 'Bandara Internasional Adi Soemarmo (SOC) Solo', address: 'Ngesrep, Ngemplak, Kabupaten Boyolali, Jawa Tengah', lat: -7.51608, lon: 110.75689, keywords: 'bandara adi soemarmo soc solo surakarta boyolali' },
  { name: 'Magelang & Candi Borobudur', address: 'Jl. Badrawati, Borobudur, Kabupaten Magelang, Jawa Tengah', lat: -7.60787, lon: 110.20375, keywords: 'magelang borobudur candi jawa tengah' },
  { name: 'Purwokerto (Banyumas)', address: 'Jl. Jend. Sudirman, Purwokerto Timur, Kabupaten Banyumas', lat: -7.42431, lon: 109.23964, keywords: 'purwokerto banyumas unsoed baturaden jawa tengah' },
  { name: 'Cilacap (Kilang Pertamina & Tanjung Intan)', address: 'Jl. MT Haryono, Donan, Cilacap Tengah, Kabupaten Cilacap', lat: -7.72791, lon: 109.00592, keywords: 'cilacap kilang pertamina tanjung intan jawa tengah' },
  { name: 'Yogyakarta - Malioboro & Titik Nol Kilometer', address: 'Jl. Malioboro, Sosromenduran, Gedong Tengen, Kota Yogyakarta', lat: -7.79558, lon: 110.36949, keywords: 'yogyakarta jogja malioboro stasiun tugu keraton diy' },
  { name: 'Universitas Gadjah Mada (UGM) Sleman', address: 'Bulaksumur, Caturtunggal, Depok, Kabupaten Sleman, DIY', lat: -7.77138, lon: 110.37749, keywords: 'ugm universitas gadjah mada sleman yogyakarta jogja' },
  { name: 'Bandara Internasional Yogyakarta (YIA) Kulon Progo', address: 'Glagah, Temon, Kabupaten Kulon Progo, DI Yogyakarta', lat: -7.90066, lon: 110.05626, keywords: 'bandara yia yogyakarta international airport kulon progo jogja' },
  { name: 'Bandara Adisutjipto (JOG) & Prambanan', address: 'Jl. Solo KM 9, Maguwoharjo, Depok, Sleman, Yogyakarta', lat: -7.78818, lon: 110.43175, keywords: 'adisutjipto jog sleman prambanan maguwoharjo yogyakarta' },

  // -------------------------------------------------------------------------
  // East Java (Jawa Timur)
  // -------------------------------------------------------------------------
  { name: 'Surabaya Pusat - Tunjungan Plaza & Balai Kota', address: 'Jl. Jenderal Basuki Rahmat No. 8-12, Tegalsari, Kota Surabaya', lat: -7.26243, lon: 112.73938, keywords: 'surabaya tunjungan plaza basuki rahmat balai kota jawa timur' },
  { name: 'Surabaya Barat - Pakuwon Mall & Citraland', address: 'Jl. Mayjend. Jonosewojo No. 2, Wiyung, Kota Surabaya', lat: -7.28912, lon: 112.67565, keywords: 'surabaya barat pakuwon mall citraland ciputra world' },
  { name: 'Bandara Internasional Juanda (SUB)', address: 'Jl. Ir. H. Juanda, Betro, Sedati, Kabupaten Sidoarjo, Jawa Timur', lat: -7.37983, lon: 112.78686, keywords: 'bandara juanda sub surabaya sidoarjo airport terminal 1 2' },
  { name: 'Stasiun Surabaya Gubeng & ITS Sukolilo', address: 'Jl. Gubeng Masjid No. 1, Tambaksari / Sukolilo, Kota Surabaya', lat: -7.26541, lon: 112.75202, keywords: 'stasiun gubeng its unair sukolilo surabaya timur' },
  { name: 'Pelabuhan Tanjung Perak & Stasiun Pasarturi', address: 'Jl. Perak Timur No. 620, Pabean Cantian, Kota Surabaya', lat: -7.20636, lon: 112.73278, keywords: 'pelabuhan tanjung perak pasarturi surabaya utara port' },
  { name: 'Kawasan Industri SIER Rungkut Surabaya', address: 'Jl. Rungkut Industri Raya No. 10, Tenggilis Mejoyo, Surabaya', lat: -7.32841, lon: 112.75825, keywords: 'sier rungkut surabaya industrial estate berbek sidoarjo' },
  { name: 'Sidoarjo Kota (Alun-Alun & Delta)', address: 'Sidokumpul, Kecamatan Sidoarjo, Kabupaten Sidoarjo, Jawa Timur', lat: -7.44782, lon: 112.71834, keywords: 'sidoarjo alun alun porong waru jawa timur' },
  { name: 'Gresik - Kawasan Industri JIIPE Manyar', address: 'Manyarejo, Manyar, Kabupaten Gresik, Jawa Timur', lat: -7.11474, lon: 112.61777, keywords: 'gresik jiipe manyar pelabuhan smelter petrokimia semen jawa timur' },
  { name: 'Ngoro Industrial Park (NIP) Mojokerto', address: 'Lolawang, Ngoro, Kabupaten Mojokerto, Jawa Timur', lat: -7.54715, lon: 112.62583, keywords: 'mojokerto ngoro nip industrial park jawa timur' },
  { name: 'Kawasan Industri PIER Pasuruan', address: 'Jl. Raya Rembang Industri, Rembang, Kabupaten Pasuruan', lat: -7.62139, lon: 112.82817, keywords: 'pasuruan pier rembang industrial estate pandaan jawa timur' },
  { name: 'Malang Kota - Tugu & Universitas Brawijaya', address: 'Jl. Tugu / Jl. Veteran, Klojen / Lowokwaru, Kota Malang, Jawa Timur', lat: -7.97713, lon: 112.63398, keywords: 'malang kota tugu universitas brawijaya stasiun malang jawa timur' },
  { name: 'Kota Wisata Batu (Jawa Timur)', address: 'Alun-Alun Kota Batu, Sisir, Kecamatan Batu, Kota Batu', lat: -7.87114, lon: 112.52694, keywords: 'batu malang jatim park selecta jawa timur' },
  { name: 'Kediri Kota & Bandara Dhoho (DHX)', address: 'Jl. Dhoho / Tarokan, Kota Kediri, Jawa Timur', lat: -7.81689, lon: 112.01139, keywords: 'kediri dhoho bandara gudang garam pare jawa timur' },
  { name: 'Madiun Kota', address: 'Jl. Pahlawan No. 37, Kartoharjo, Kota Madiun, Jawa Timur', lat: -7.62982, lon: 111.52391, keywords: 'madiun inka pahlawan magetan ponorogo jawa timur' },
  { name: 'Jember Kota', address: 'Alun-Alun Jember, Kaliwates, Kabupaten Jember, Jawa Timur', lat: -8.17242, lon: 113.70072, keywords: 'jember unej kaliwates tapal kuda jawa timur' },
  { name: 'Banyuwangi Kota & Pelabuhan Ketapang', address: 'Ketapang / Blimbingsari, Kabupaten Banyuwangi, Jawa Timur', lat: -8.14191, lon: 114.39914, keywords: 'banyuwangi ketapang ferry bali bandara blimbingsari bwx ijen' },

  // -------------------------------------------------------------------------
  // Bali & Nusa Tenggara (NTB & NTT)
  // -------------------------------------------------------------------------
  { name: 'Bandara Internasional I Gusti Ngurah Rai (DPS) Bali', address: 'Jl. Raya Gusti Ngurah Rai, Tuban, Kuta, Kab. Badung, Bali', lat: -8.74817, lon: 115.16717, keywords: 'bandara ngurah rai dps denpasar kuta tuban bali airport' },
  { name: 'Denpasar Kota - Lapangan Renon Bali', address: 'Jl. Puputan Renon, Sumerta Kelod, Denpasar Timur, Kota Denpasar', lat: -8.67172, lon: 115.23391, keywords: 'denpasar renon sanur gatsu bali' },
  { name: 'Kuta & Legian (Beachwalk Bali)', address: 'Jl. Pantai Kuta, Kuta, Kabupaten Badung, Bali', lat: -8.71558, lon: 115.16913, keywords: 'kuta legian pantai beachwalk badung bali' },
  { name: 'Seminyak & Canggu (Bali)', address: 'Jl. Kayu Aya / Berawa, Kuta Utara, Kabupaten Badung, Bali', lat: -8.66897, lon: 115.14536, keywords: 'seminyak canggu berawa kerobokan kuta utara bali' },
  { name: 'Nusa Dua ITDC & Bali Collection (BICC)', address: 'Kawasan Pariwisata ITDC Nusa Dua, Benoa, Kuta Selatan, Bali', lat: -8.79812, lon: 115.22883, keywords: 'nusa dua itdc bicc bndcc convention jimbaran kuta selatan bali' },
  { name: 'Ubud Center (Puri Saren / Gianyar)', address: 'Jl. Raya Ubud, Ubud, Kabupaten Gianyar, Bali', lat: -8.50685, lon: 115.26248, keywords: 'ubud gianyar monkey forest bali' },
  { name: 'Pelabuhan Benoa Bali', address: 'Jl. Raya Pelabuhan Benoa, Pedungan, Denpasar Selatan, Bali', lat: -8.74489, lon: 115.21164, keywords: 'pelabuhan benoa cruise bali tol mandara' },
  { name: 'Pelabuhan Gilimanuk & Singaraja Bali Utara', address: 'Gilimanuk, Melaya, Jembrana / Singaraja, Buleleng, Bali', lat: -8.16362, lon: 114.43751, keywords: 'gilimanuk jembrana singaraja buleleng lovina bali' },
  { name: 'Mataram Kota (Lombok Epicentrum)', address: 'Jl. Sriwijaya No. 333, Punia, Kota Mataram, NTB', lat: -8.59195, lon: 116.10592, keywords: 'mataram senggigi lombok ntb epicentrum' },
  { name: 'Bandara Internasional Lombok (LOP / ZAM) & Mandalika', address: 'Tanak Awu, Pujut, Kabupaten Lombok Tengah, NTB', lat: -8.75732, lon: 116.27667, keywords: 'bandara lombok lop zam mandalika sirkuit motogp praya ntb' },
  { name: 'Sumbawa Besar & Bima (NTB)', address: 'Sumbawa Besar, Kabupaten Sumbawa, Nusa Tenggara Barat', lat: -8.49322, lon: 117.42014, keywords: 'sumbawa bima dompu ntb' },
  { name: 'Labuan Bajo (Bandara Komodo LBJ & Pelabuhan)', address: 'Labuan Bajo, Komodo, Kabupaten Manggarai Barat, NTT', lat: -8.48671, lon: 119.88892, keywords: 'labuan bajo komodo lbj flores manggarai barat ntt' },
  { name: 'Kupang Kota & Bandara El Tari (KOE)', address: 'Jl. El Tari / Penfui, Kota Kupang, Nusa Tenggara Timur', lat: -10.17156, lon: 123.67122, keywords: 'kupang el tari koe ntt timor tenau maumere ende' },

  // -------------------------------------------------------------------------
  // Sumatra (Aceh, Sumut, Kepri, Riau, Sumbar, Jambi, Sumsel, Babel, Bengkulu, Lampung)
  // -------------------------------------------------------------------------
  { name: 'Banda Aceh & Bandara Sultan Iskandar Muda (BTJ)', address: 'Jl. Teuku Nyak Arief / Blang Bintang, Banda Aceh, Aceh', lat: 5.55464, lon: 95.32046, keywords: 'banda aceh masjid raya baiturrahman btj blang bintang sabang' },
  { name: 'Lhokseumawe & Arun Industrial', address: 'Banda Sakti, Kota Lhokseumawe, Aceh', lat: 5.18011, lon: 97.15069, keywords: 'lhokseumawe arun langsa meulaboh aceh' },
  { name: 'Medan Kota - Merdeka Walk & Lapangan Merdeka', address: 'Jl. Balai Kota, Kesawan, Medan Barat, Kota Medan, Sumatra Utara', lat: 3.59125, lon: 98.67668, keywords: 'medan kesawan merdeka walk stasiun medan sun plaza sumut' },
  { name: 'Bandara Internasional Kualanamu (KNO) Medan', address: 'Jl. Bandara Kuala Namu, Beringin, Deli Serdang, Sumatra Utara', lat: 3.64222, lon: 98.88528, keywords: 'bandara kualanamu kno medan deli serdang airport' },
  { name: 'Kawasan Industri Medan (KIM) & Pelabuhan Belawan', address: 'Jl. Sumatera / Mabar, Medan Deli & Belawan, Kota Medan', lat: 3.68816, lon: 98.67258, keywords: 'kim kawasan industri medan belawan port pelabuhan' },
  { name: 'Pematangsiantar & Danau Toba (Parapat / Silangit DTB)', address: 'Jl. Sutomo, Pematangsiantar / Silangit Siborongborong, Sumut', lat: 2.95951, lon: 99.06872, keywords: 'pematangsiantar parapat samosir danau toba silangit dtb balige sumut' },
  { name: 'Batam Center & Pelabuhan Ferry Internasional Batam', address: 'Jl. Engku Putri, Teluk Tering, Batam Kota, Kota Batam, Kepri', lat: 1.13012, lon: 104.05295, keywords: 'batam center engku putri ferry pelabuhan nagoya kepri' },
  { name: 'Bandara Internasional Hang Nadim (BTH) Batam', address: 'Batu Besar, Nongsa, Kota Batam, Kepulauan Riau', lat: 1.12103, lon: 104.11867, keywords: 'bandara hang nadim bth batam nongsa airport kepri' },
  { name: 'Kawasan Industri Batamindo (Muka Kuning)', address: 'Jl. Rasamala No. 1, Muka Kuning, Sei Beduk, Kota Batam', lat: 1.06165, lon: 104.03414, keywords: 'batamindo muka kuning kawasan industri panbil kabil batam' },
  { name: 'Tanjung Pinang & Kawasan Industri Bintan (Lobam)', address: 'Tanjungpinang Kota / Bintan Resorts Lagoi, Kepulauan Riau', lat: 0.91862, lon: 104.45542, keywords: 'tanjung pinang bintan lagoi lobam kepri tnj' },
  { name: 'Pekanbaru Kota & Bandara SSK II (PKU)', address: 'Jl. Jend. Sudirman, Simpang Tiga, Marpoyan Damai, Pekanbaru, Riau', lat: 0.46078, lon: 101.44454, keywords: 'pekanbaru sudirman pku ssk ii rumbai duri riau' },
  { name: 'Dumai (Kilang Pertamina & Pelabuhan)', address: 'Jl. Putri Tujuh, Jaya Mukti, Kota Dumai, Riau', lat: 1.66711, lon: 101.44317, keywords: 'dumai pelabuhan kilang rupat bengkalis riau' },
  { name: 'Padang Kota & Bandara Minangkabau (PDG)', address: 'Jl. Jend. Sudirman / Kataping, Kota Padang, Sumatra Barat', lat: -0.94708, lon: 100.41718, keywords: 'padang minangkabau pdg teluk bayur semen indarung sumbar' },
  { name: 'Bukittinggi (Jam Gadang)', address: 'Benteng Pasar Atas, Guguk Panjang, Kota Bukittinggi, Sumbar', lat: -0.30554, lon: 100.36922, keywords: 'bukittinggi jam gadang payakumbuh padang panjang sumbar' },
  { name: 'Jambi Kota & Bandara Sultan Thaha (DJB)', address: 'Jl. Jend. Sudirman / Paal Merah, Kota Jambi, Jambi', lat: -1.61012, lon: 103.61312, keywords: 'jambi sultan thaha djb tugu keris muaro bungo' },
  { name: 'Bengkulu Kota & Bandara Fatmawati (BKS)', address: 'Jl. S. Parman / Pekan Sabtu, Kota Bengkulu', lat: -3.86371, lon: 102.33904, keywords: 'bengkulu fatmawati bks benteng marlborough' },
  { name: 'Palembang Kota - Jembatan Ampera & Jakabaring', address: 'Jl. Merdeka / Seberang Ulu, Ilir Barat I, Kota Palembang, Sumsel', lat: -2.99111, lon: 104.76342, keywords: 'palembang ampera jakabaring musirawas kertapati pusri sumsel' },
  { name: 'Bandara Sultan Mahmud Badaruddin II (PLM) Palembang', address: 'Talang Betutu, Sukarami, Kota Palembang, Sumatra Selatan', lat: -2.90028, lon: 104.70028, keywords: 'bandara smb ii plm palembang airport sumsel' },
  { name: 'Muara Enim & Tanjung Enim (PTBA)', address: 'Tanjung Enim, Lawang Kidul, Kabupaten Muara Enim, Sumsel', lat: -3.74454, lon: 103.78852, keywords: 'muara enim tanjung enim ptba prabumulih lahat sumsel' },
  { name: 'Pangkalpinang (Bangka Belitung) & Tj. Pandan', address: 'Jl. Jenderal Sudirman / Depati Amir, Kota Pangkalpinang, Babel', lat: -2.13163, lon: 106.11693, keywords: 'pangkalpinang bangka belitung tanjung pandan pgk tjq' },
  { name: 'Bandar Lampung Kota & Panjang Port', address: 'Jl. Ahmad Yani / Enggal, Tanjungkarang Pusat, Kota Bandar Lampung', lat: -5.42944, lon: 105.26111, keywords: 'bandar lampung tanjung karang panjang metro tkg radin inten' },
  { name: 'Pelabuhan Penyeberangan Bakauheni', address: 'Bakauheni, Kabupaten Lampung Selatan, Lampung', lat: -5.87091, lon: 105.75282, keywords: 'bakauheni ferry pelabuhan lampung selatan kalianda' },

  // -------------------------------------------------------------------------
  // Kalimantan (IKN Nusantara, Kaltim, Kaltara, Kalsel, Kalteng, Kalbar)
  // -------------------------------------------------------------------------
  { name: 'IKN Ibu Kota Nusantara (Titik Nol & Sumbu Kebangsaan)', address: 'Bumi Harapan, Sepaku, Penajam Paser Utara, Kalimantan Timur', lat: -0.97302, lon: 116.70941, keywords: 'ikn ibu kota nusantara titik nol sepaku kipp penajam kaltim' },
  { name: 'Balikpapan Kota & Bandara SAMS Sepinggan (BPN)', address: 'Jl. Marsma R. Iswahyudi, Sepinggan, Kota Balikpapan, Kaltim', lat: -1.26827, lon: 116.89448, keywords: 'balikpapan sepinggan bpn kariangau semayang kilang kaltim' },
  { name: 'Samarinda Kota & Bandara APT Pranoto (AAP)', address: 'Jl. Gajah Mada / Sungai Siring, Kota Samarinda, Kalimantan Timur', lat: -0.50211, lon: 117.15362, keywords: 'samarinda mahakam apt pranoto aap big mall kaltim' },
  { name: 'Bontang & Sangatta (Kawasan Industri Pupuk / LNG)', address: 'Lok Tuan, Bontang Utara, Kota Bontang, Kalimantan Timur', lat: 0.13333, lon: 117.50011, keywords: 'bontang pupuk kaltim badak lng sangatta kutim' },
  { name: 'Tarakan & Tanjung Selor (Kalimantan Utara)', address: 'Jl. Yos Sudarso, Lingkas Ujung, Kota Tarakan, Kaltara', lat: 3.31332, lon: 117.59153, keywords: 'tarakan juwata trk tanjung selor bulungan kaltara' },
  { name: 'Banjarmasin Kota & Pelabuhan Trisakti', address: 'Jl. Lambung Mangkurat, Kertak Baru Ulu, Kota Banjarmasin, Kalsel', lat: -3.31861, lon: 114.59438, keywords: 'banjarmasin siring trisakti martapura barito kuala kalsel' },
  { name: 'Bandara Syamsudin Noor (BDJ) Banjarbaru', address: 'Landasan Ulin, Kota Banjarbaru, Kalimantan Selatan', lat: -3.44236, lon: 114.76256, keywords: 'banjarbaru syamsudin noor bdj banjarmasin kalsel' },
  { name: 'Palangka Raya Kota & Bandara Tjilik Riwut (PKY)', address: 'Jl. Yos Sudarso / Panarung, Jekan Raya, Kota Palangka Raya, Kalteng', lat: -2.21361, lon: 113.91083, keywords: 'palangka raya palangkaraya pky tjilik riwut sampit pangkalan bun kalteng' },
  { name: 'Pontianak Kota & Bandara Supadio (PNK)', address: 'Jl. Jenderal Ahmad Yani, Kota Pontianak / Kubu Raya, Kalbar', lat: -0.02633, lon: 109.34251, keywords: 'pontianak supadio pnk khatulistiwa singkawang ketapang kalbar' },

  // -------------------------------------------------------------------------
  // Sulawesi (Sulsel, Sultra, Sulteng, Sulbar, Gorontalo, Sulut)
  // -------------------------------------------------------------------------
  { name: 'Makassar Kota - Pantai Losari & CPI', address: 'Jl. Penghibur / Center Point of Indonesia, Makassar, Sulsel', lat: -5.14361, lon: 119.40711, keywords: 'makassar losari cpi trans studio pelabuhan soekarno hatta sulsel' },
  { name: 'Bandara Internasional Sultan Hasanuddin (UPG) Makassar', address: 'Mandai, Kabupaten Maros / Makassar, Sulawesi Selatan', lat: -5.06163, lon: 119.55404, keywords: 'bandara hasanuddin upg makassar maros kima airport sulsel' },
  { name: 'Kawasan Industri Makassar (KIMA)', address: 'Jl. Perintis Kemerdekaan KM 15, Biringkanaya, Kota Makassar', lat: -5.09545, lon: 119.50155, keywords: 'kima kawasan industri makassar unhas daya sulsel' },
  { name: 'Parepare & Palopo (Sulawesi Selatan)', address: 'Jl. Bau Massepe, Mallusetasi, Kota Parepare, Sulsel', lat: -4.01351, lon: 119.62348, keywords: 'parepare palopo bone bulukumba toraja sulsel' },
  { name: 'Kendari Kota & Bandara Haluoleo (KDI)', address: 'Jl. Abdullah Silondae / Ranomeeto, Kota Kendari, Sultra', lat: -3.99846, lon: 122.51297, keywords: 'kendari haluoleo kdi konawe baubau sultra' },
  { name: 'Kawasan Industri Morowali (IMIP)', address: 'Fatufia, Bahodopi, Kabupaten Morowali, Sulawesi Tengah', lat: -2.83842, lon: 122.17016, keywords: 'morowali imip bahodopi nikel smelter industri sulteng' },
  { name: 'Palu Kota & Bandara Mutiara (PLW)', address: 'Jl. Sam Ratulangi / Palu Selatan, Kota Palu, Sulawesi Tengah', lat: -0.90028, lon: 119.87791, keywords: 'palu plw mutiara luwuk donggala poso sulteng' },
  { name: 'Gorontalo Kota & Bandara Djalaluddin (GTO)', address: 'Jl. H.B. Jassin, Kota Selatan, Kota Gorontalo, Gorontalo', lat: 0.54354, lon: 123.05677, keywords: 'gorontalo gto djalaluddin teluk tomini' },
  { name: 'Manado Kota (Boulevard Piere Tendean)', address: 'Jl. Piere Tendean, Sario, Kota Manado, Sulawesi Utara', lat: 1.47483, lon: 124.84208, keywords: 'manado boulevard mega mall mantos sam ratulangi sulut' },
  { name: 'Bandara Sam Ratulangi (MDC) & Pelabuhan Bitung', address: 'Mapanget, Kota Manado / Pelabuhan Hub Bitung, Sulut', lat: 1.54925, lon: 124.92588, keywords: 'sam ratulangi mdc manado bitung tomohon minahasa sulut' },

  // -------------------------------------------------------------------------
  // Maluku & Papua
  // -------------------------------------------------------------------------
  { name: 'Ambon Kota & Bandara Pattimura (AMQ)', address: 'Jl. Pattimura / Laha, Teluk Ambon, Kota Ambon, Maluku', lat: -3.69541, lon: 128.18141, keywords: 'ambon pattimura amq jembatan merah putih maluku' },
  { name: 'Ternate & Sofifi (Maluku Utara)', address: 'Jl. Pahlawan Revolusi / Sultan Babullah, Kota Ternate, Malut', lat: 0.78927, lon: 127.37715, keywords: 'ternate sofifi tte halmahera weda maluku utara' },
  { name: 'Sorong Kota & Bandara DEO (SOQ)', address: 'Jl. Basuki Rahmat / Remu Utara, Kota Sorong, Papua Barat Daya', lat: -0.88844, lon: 131.28162, keywords: 'sorong soq raja ampat papua barat daya pelabuhan' },
  { name: 'Manokwari Kota & Bandara Rendani (MKW)', address: 'Jl. Trikora / Sanggeng, Kabupaten Manokwari, Papua Barat', lat: -0.86145, lon: 134.06204, keywords: 'manokwari rendani mkw papua barat bintuni fakfak' },
  { name: 'Biak & Nabire (Papua)', address: 'Biak Kota / Nabire, Papua Tengah', lat: -1.17822, lon: 136.08211, keywords: 'biak frans kaisiepo bik nabire nbx papua tengah' },
  { name: 'Timika Kota & Bandara Mozes Kilangin (TIM)', address: 'Jl. Yos Sudarso, Kwamki, Mimika Baru, Timika, Papua Tengah', lat: -4.52828, lon: 136.88735, keywords: 'timika mimika freeport mozes kilangin tim kuala kencana papua' },
  { name: 'Jayapura Kota - Taman Imbi & Jembatan Youtefa', address: 'Jl. Ahmad Yani / Abepura, Jayapura Selatan, Kota Jayapura, Papua', lat: -2.53371, lon: 140.71813, keywords: 'jayapura abepura youtefa entrop waena papua' },
  { name: 'Bandara Internasional Sentani (DJJ) Jayapura', address: 'Sentani Kota, Kabupaten Jayapura, Papua', lat: -2.57695, lon: 140.51637, keywords: 'sentani djj jayapura airport danau sentani wamena papua' },
  { name: 'Merauke Kota & Bandara Mopah (MKQ)', address: 'Jl. Raya Mandala, Kabupaten Merauke, Papua Selatan', lat: -8.49322, lon: 140.40184, keywords: 'merauke mopah mkq papua selatan' },
];

export function searchIndonesianPois(
  query: string,
  limit = 10
): Array<{ place_id: string; name: string; address: string; lat: number; lon: number; score: number }> {
  const { lower, tokens, expandedTokens } = normalizeIndoQuery(query);
  if (!lower || lower.length < 2) return [];

  const matches: Array<{ place_id: string; name: string; address: string; lat: number; lon: number; score: number }> = [];

  for (const poi of INDONESIAN_POIS) {
    const nameLower = poi.name.toLowerCase();
    const addrLower = poi.address.toLowerCase();
    const kwLower = poi.keywords.toLowerCase();
    const haystack = `${nameLower} ${addrLower} ${kwLower}`;

    let score = 0;
    if (nameLower.startsWith(lower)) {
      score += 140;
    } else if (nameLower.includes(lower)) {
      score += 90;
    } else if (addrLower.includes(lower)) {
      score += 65;
    } else if (kwLower.includes(lower)) {
      score += 55;
    }

    let matchedConcepts = 0;
    for (const tok of tokens) {
      const candidates = ABBREVIATION_MAP[tok] ? [tok, ...ABBREVIATION_MAP[tok]] : [tok];
      const matchedName = candidates.some((c) => nameLower.includes(c));
      const matchedAny = matchedName || candidates.some((c) => haystack.includes(c));
      if (matchedAny) {
        score += matchedName ? 28 : 18;
        matchedConcepts += 1;
      }
    }

    let matchedExpandedExtra = 0;
    for (const exp of expandedTokens) {
      if (!tokens.includes(exp) && haystack.includes(exp)) {
        score += 8;
        matchedExpandedExtra += 1;
      }
    }

    if (tokens.length > 1 && matchedConcepts === tokens.length) {
      score += 55;
    }

    // Require strong concept match so single common words like "jl" don't crowd out specific multi-word searches
    if (score > 0 && (matchedConcepts > 0 || matchedExpandedExtra > 0)) {
      if (tokens.length >= 2 && matchedConcepts < 2 && score < 60) {
        continue;
      }
      matches.push({
        place_id: `poi_${poi.lat.toFixed(5)}_${poi.lon.toFixed(5)}`,
        name: poi.name,
        address: poi.address,
        lat: poi.lat,
        lon: poi.lon,
        score,
      });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}
