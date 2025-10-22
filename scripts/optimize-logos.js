const fs = require('fs');
const path = require('path');

// Logo optimizasyon scripti
async function optimizeLogos() {
  const logoDir = path.join(__dirname, '../public/crypto-logos/basahub logo');
  const files = fs.readdirSync(logoDir);
  
  console.log('🎨 Logo optimizasyonu başlıyor...');
  
  for (const file of files) {
    if (file.endsWith('.png') && !file.startsWith('.')) {
      const filePath = path.join(logoDir, file);
      const stats = fs.statSync(filePath);
      const sizeKB = Math.round(stats.size / 1024);
      
      console.log(`📁 ${file}: ${sizeKB}KB`);
      
      // Eğer dosya 500KB'dan büyükse optimize et
      if (stats.size > 500 * 1024) {
        console.log(`⚠️  ${file} çok büyük (${sizeKB}KB), optimize ediliyor...`);
        
        try {
          // Sharp kullanarak optimize et
          const sharp = require('sharp');
          
          await sharp(filePath)
            .resize(200, 200, { 
              fit: 'inside',
              withoutEnlargement: true 
            })
            .png({ 
              quality: 80,
              compressionLevel: 9,
              progressive: true
            })
            .toFile(filePath.replace('.png', '_optimized.png'));
            
          // Orijinal dosyayı yedekle ve optimize edilmişi kullan
          fs.renameSync(filePath, filePath.replace('.png', '_original.png'));
          fs.renameSync(filePath.replace('.png', '_optimized.png'), filePath);
          
          const newStats = fs.statSync(filePath);
          const newSizeKB = Math.round(newStats.size / 1024);
          const reduction = Math.round(((stats.size - newStats.size) / stats.size) * 100);
          
          console.log(`✅ ${file} optimize edildi: ${sizeKB}KB → ${newSizeKB}KB (%${reduction} azalma)`);
          
        } catch (error) {
          console.error(`❌ ${file} optimize edilemedi:`, error.message);
        }
      } else {
        console.log(`✅ ${file} zaten optimize (${sizeKB}KB)`);
      }
    }
  }
  
  console.log('🎉 Logo optimizasyonu tamamlandı!');
}

// Sharp yüklü değilse uyarı ver
try {
  require('sharp');
  optimizeLogos();
} catch (error) {
  console.log('📦 Sharp paketi yüklü değil, yükleniyor...');
  console.log('npm install sharp --save-dev');
  console.log('Sonra tekrar çalıştırın: node scripts/optimize-logos.js');
}
