const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// 👉 указываешь папку, где лежат PNG
const inputDir = 'C:/Users/KWOG WORSHIP/web_kovcheg/optimized_img/gallery';

// 👉 куда сохранять результат (можно указать ту же папку, если не нужно дублировать)
const outputDir = 'C:/Users/KWOG WORSHIP/web_kovcheg/optimized_img/gallery_webp';

// размеры в пикселях
const sizes = [40, 80, 400, 800, 1200];

function findPngFiles(dir) {
  let results = [];
  fs.readdirSync(dir).forEach(function (file) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results = results.concat(findPngFiles(filePath));
    } else if (filePath.toLowerCase().endsWith('.png')) {
      results.push(filePath);
    }
  });
  return results;
}

function ensureDirSync(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

(async () => {
  if (!fs.existsSync(inputDir)) {
    console.error('Папка не найдена:', inputDir);
    process.exit(1);
  }

  let files = findPngFiles(inputDir);

  for (const file of files) {
    const relPath = path.relative(inputDir, file).replace(/\\/g, '/').replace('.png', '');

    for (const size of sizes) {
      const outputPath = path.join(outputDir, `${relPath}-${size}.webp`);
      ensureDirSync(path.dirname(outputPath));

      await sharp(file)
        .resize({ width: size })
        .webp({ quality: 70 }) // можно менять качество (0–100)
        .toFile(outputPath);

      console.log('Created:', outputPath);
    }
  }

  console.log('✅ Готово!');
})();
