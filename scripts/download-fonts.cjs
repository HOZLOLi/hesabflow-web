// اسکریپت دانلود خودکار فونت Vazirmatn
const https = require('https');
const fs = require('fs');
const path = require('path');

const FONT_DIR = path.join(__dirname, 'public', 'fonts');
const FONT_BASE_URL = 'https://github.com/rastikerdar/vazirmatn/raw/master/fonts/webfonts/';

const fonts = [
  'Vazirmatn-Regular.woff2',
  'Vazirmatn-Medium.woff2',
  'Vazirmatn-Bold.woff2',
  'Vazirmatn-Black.woff2'
];

// ایجاد پوشه fonts
if (!fs.existsSync(FONT_DIR)) {
  fs.mkdirSync(FONT_DIR, { recursive: true });
}

console.log('🔽 در حال دانلود فونت‌های Vazirmatn...\n');

let downloaded = 0;

fonts.forEach((font) => {
  const url = FONT_BASE_URL + font;
  const filePath = path.join(FONT_DIR, font);

  // چک کن که قبلاً دانلود نشده باشه
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${font} - قبلاً دانلود شده`);
    downloaded++;
    if (downloaded === fonts.length) {
      console.log('\n🎉 همه فونت‌ها آماده هستند!');
    }
    return;
  }

  const file = fs.createWriteStream(filePath);

  https.get(url, (response) => {
    response.pipe(file);

    file.on('finish', () => {
      file.close();
      downloaded++;
      console.log(`✅ ${font} - دانلود شد`);

      if (downloaded === fonts.length) {
        console.log('\n🎉 همه فونت‌ها با موفقیت دانلود شدند!');
        console.log(`📁 مسیر: ${FONT_DIR}`);
      }
    });
  }).on('error', (err) => {
    fs.unlink(filePath, () => {});
    console.error(`❌ خطا در دانلود ${font}:`, err.message);
  });
});
