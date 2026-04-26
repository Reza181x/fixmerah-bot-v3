export const DEFAULT_TEMPLATES = [
  // ===== INDONESIA =====
  { name: '🇮🇩 Santai',     lang: 'id', text: 'Halo Tim WhatsApp,\n\nSaya {name} dengan nomor {number}. Hari ini {date} saya tidak bisa login, muncul pesan \'Login tidak tersedia\'.\nSaya tidak pakai aplikasi modifikasi, hanya resmi. Mohon bantuannya.' },
  { name: '🇮🇩 Formal',     lang: 'id', text: 'Kepada Tim Dukungan WhatsApp,\n\nDengan hormat, saya {name} ingin melaporkan kendala login pada akun {number}.\nPada {date} saya mendapati pesan \'Login tidak tersedia untuk saat ini\'.\nSaya pastikan tidak melanggar Ketentuan Layanan. Mohon diperiksa. Terima kasih.' },
  { name: '🇮🇩 Curhat',     lang: 'id', text: 'Assalamualaikum WA Support,\nSaya {name}, nomor {number} saya tiba-tiba tidak bisa login. Padahal cuma buat chat keluarga.\n{date} tiba-tiba muncul \'Login tidak tersedia\'. Saya bingung, tidak pernah aneh-aneh.\nMohon dibantu. Makasih.' },
  { name: '🇮🇩 Kronologi',  lang: 'id', text: 'Halo WhatsApp,\nSaya {name} dengan nomor {number}. Kronologi: pagi ini ({date}) saya mau buka WA, tiba-tiba muncul \'Login tidak tersedia untuk saat ini\'.\nSaya tidak ganti perangkat, tidak instal ulang. Saya hanya pakai aplikasi resmi. Tolong cek dan bantu.' },
  { name: '🇮🇩 Emosional',  lang: 'id', text: 'Dear WhatsApp... tolong akun {number} saya sudah bertahun-tahun, isinya kenangan keluarga, teman, kerjaan. Tiba-tiba kena \'Login tidak tersedia\'.\nSaya {name}, tidak pernah spam. Mohon bantuannya.' },
  { name: '🇮🇩 Marah Sopan',lang: 'id', text: 'WhatsApp! Kenapa akun {number} saya tiba-tiba tidak bisa login? \'Login tidak tersedia\'.\nSaya {name}, hanya chat biasa, tidak ada spam. Cek log saya. Buka akses saya sekarang.' },
  { name: '😢 Mengharukan', lang: 'id', text: 'Untuk WhatsApp yang terhormat,\n\nAkun {number} saya adalah satu-satunya alat komunikasi dengan anak saya di luar negeri. Saya {name}, sejak {date} tidak bisa login.\nSaya tidak pernah pakai WA ilegal. Bantu saya... tolong buka loginnya.' },

  // ===== ENGLISH =====
  { name: '🇬🇧 Polite',       lang: 'en', text: 'Dear WhatsApp Team,\n\nI am {name} with number {number}. Since {date} I cannot log in, receiving \'Login not available right now\'.\nI use only the official app. Please help restore my access. Thank you.' },
  { name: '🇬🇧 Urgent',       lang: 'en', text: 'Hello WhatsApp Support,\n\nMy name is {name}, my business number {number} cannot login since {date}. It shows \'Login not available\'.\nThis is urgent for my work. I have never violated any policies. Please assist quickly.' },
  { name: '🇬🇧 Hijacked',     lang: 'en', text: 'To WhatsApp Support,\n\nI believe my account {number} was hacked. I lost access and later found it banned.\nI have secured my SIM and email. Please help me recover my account.\n\nRegards, {name}' },
  { name: '🇬🇧 Short',        lang: 'en', text: 'Hello, my number {number} is stuck at \'Login not available\'. I am {name}. I\'ve never used modded apps. Please fix it. Thank you.' },
  { name: '🇬🇧 Apology',      lang: 'en', text: 'Dear WhatsApp, I apologize if my account {number} inadvertently violated any policy. I assure you it won\'t happen again. Please lift the login restriction.\n\nBest, {name}' },

  // ===== SPANISH =====
  { name: '🇪🇸 Formal',   lang: 'es', text: 'Estimado equipo de WhatsApp,\n\nSoy {name}, mi número {number} no puede iniciar sesión desde {date}. Mensaje \'Inicio de sesión no disponible\'.\nSolo uso la aplicación oficial. Ayúdenme, por favor.' },
  { name: '🇪🇸 Hackeada', lang: 'es', text: 'WhatsApp, mi número {number} fue hackeado y ahora no puedo iniciar sesión. {date}\nSoy {name}. Ya recuperé mi SIM. Ayúdenme a entrar de nuevo.' },

  // ===== ARABIC =====
  { name: '🇸🇦 Formal', lang: 'ar', text: 'السادة دعم واتساب،\n\nأنا {name}، رقمي {number} لا يمكنه تسجيل الدخول منذ {date}. تظهر رسالة \'تسجيل الدخول غير متاح\'.\nأستخدم التطبيق الرسمي فقط. أرجو المساعدة.\n\nشكراً' },

  // ===== OTHERS =====
  { name: '🇰🇷 Short',    lang: 'ko', text: 'WhatsApp 팀, 제 번호 {number}로 로그인할 수 없습니다. \'지금은 로그인할 수 없습니다\'라는 메시지가 떠요.\n저는 {name}입니다. 공식 앱만 썼는데 도와주세요.' },
  { name: '🇯🇵 Formal',   lang: 'ja', text: 'WhatsAppサポート様、\n\n私は {name} です。番号 {number} でログインできません。「現在ログインできません」と表示されます。\n公式アプリしか使っていません。{date} より前に復旧をお願いします。' },
  { name: '🇫🇷 Formal',   lang: 'fr', text: 'Bonjour WhatsApp,\n\nJe suis {name}, mon numéro {number} ne peut pas se connecter depuis {date}. Message \'Connexion non disponible actuellement\'.\nApplication officielle uniquement. Merci de m\'aider.' },
  { name: '🇩🇪 Formal',   lang: 'de', text: 'Sehr geehrtes WhatsApp-Team,\n\nIch bin {name}, meine Nummer {number} kann sich seit {date} nicht anmelden. Fehlermeldung \'Anmeldung derzeit nicht möglich\'.\nNur offizielle App genutzt. Bitte um Hilfe.' },
  { name: '🇵🇹 Simples',  lang: 'pt', text: 'Olá WhatsApp,\n\nSou {name}, número {number}. Desde {date} não consigo entrar. Aparece \'Login não disponível no momento\'.\nUso apenas o app oficial. Peço ajuda.' },
  { name: '🇮🇳 Hindi',    lang: 'hi', text: 'प्रिय WhatsApp सपोर्ट,\n\nमैं {name} हूँ, मेरा नंबर {number} है। {date} से लॉगिन नहीं हो पा रहा है। \'अभी लॉगिन उपलब्ध नहीं है\' दिखाता है।\nकेवल आधिकारिक ऐप इस्तेमाल किया है। कृपया मदद करें।\n\nधन्यवाद' },
  { name: '🇮🇹 Gentile',  lang: 'it', text: 'Gentile WhatsApp,\n\nSono {name}, il mio numero {number} non può accedere dal {date}. Messaggio \'Login non disponibile al momento\'.\nSolo app ufficiale. Aiutatemi, per favore.' },
  { name: '🇷🇺 Вежливый', lang: 'ru', text: 'Уважаемая поддержка WhatsApp,\n\nМеня зовут {name}, номер {number}. С {date} не могу войти, пишет \'Вход временно недоступен\'.\nПриложение официальное. Прошу помочь.' },
  { name: '🇳🇱 Beleefd',  lang: 'nl', text: 'Beste WhatsApp,\n\nIk ben {name}, mijn nummer {number} kan sinds {date} niet inloggen. Foutmelding \'Inloggen momenteel niet beschikbaar\'.\nAlleen officiële app gebruikt. Help mij alstublieft.' },
  { name: '🇹🇷 Kısa',     lang: 'tr', text: 'Merhaba WhatsApp,\n\nBen {name}, numaram {number}. {date} tarihinden beri giriş yapamıyorum. \'Şu anda giriş yapılamıyor\' hatası alıyorum.\nSadece resmi uygulamayı kullandım. Yardım edin.' },
  { name: '🇲🇾 Melayu',   lang: 'ms', text: 'Assalamualaikum WhatsApp, saya {name}, nombor {number} tak boleh login. Keluar mesej \'Log masuk tidak tersedia\'.\nSaya guna aplikasi rasmi sahaja. Tolong bantu saya.' },
  { name: '🇵🇭 Filipino', lang: 'tl', text: 'Magandang araw WhatsApp,\n\nAko si {name}, ang numero ko {number} ay hindi makapag-login mula noong {date}. Lumalabas \'Login not available\'.\nOpisyal na app lang gamit ko. Pakiusap tulungan niyo ako.' },
  { name: '🌏 Global Mix',lang: 'mix',text: 'Hello / Hola / Halo WhatsApp,\n\nI am {name}, my number {number} cannot login since {date}. \'Login tidak tersedia\'.\nOfficial app only, no mods. Tolong bantu saya. Terima kasih / Thank you / Gracias!' },
]

export function getTemplatesByLang(lang) {
  return DEFAULT_TEMPLATES.filter(t => t.lang === lang)
}

export function getRandomTemplate(lang) {
  const list = getTemplatesByLang(lang)
  if (!list.length) return DEFAULT_TEMPLATES[0]
  return list[Math.floor(Math.random() * list.length)]
}

export function fillTemplate(template, { name, number, date }) {
  return template.text
    .replace(/{name}/g, name)
    .replace(/{number}/g, number)
    .replace(/{date}/g, date)
}
