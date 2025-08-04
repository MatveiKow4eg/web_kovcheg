const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const inputDirs = ['./index_img', './']; // где искать webp
const outputDir = './optimized_img'; // куда сохранять мини-копии

const sizes = [40, 80, 400, 800, 1200];

function findWebpFiles(dir) {
  let results = [];
  fs.readdirSync(dir).forEach(function(file) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    // Добавляем фильтр, чтобы НЕ заходить в optimized_img!
    if (stat && stat.isDirectory()) {
      if (file !== 'optimized_img') {
        results = results.concat(findWebpFiles(filePath));
      }
    } else if (filePath.endsWith('.webp')) {
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
  // собираем все .webp из нужных папок
  let files = [];
  for (const dir of inputDirs) {
    if (fs.existsSync(dir)) {
      files = files.concat(findWebpFiles(dir));
    }
  }
  // удаляем дубли (если вдруг один и тот же файл попал дважды)
  files = Array.from(new Set(files));
  // дальше обычная обработка
  for (const file of files) {
    // делаем путь относительным к папке, где файл лежит
    const relPath = path.relative('.', file).replace(/\\/g, '/').replace('.webp', '');
    for (const size of sizes) {
      const outputPath = path.join(outputDir, `${relPath}-${size}.webp`);
      ensureDirSync(path.dirname(outputPath));
      await sharp(file)
        .resize({ width: size })
        .webp({ quality: 60 })
        .toFile(outputPath);
      console.log('Created:', outputPath);
    }
  }
})();
