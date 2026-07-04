// Quick PNG Generator for Icons
safeDebugLog(' Icon PNG Generator Starting...');

// Function to create PNG from SVG using Canvas
function createPngFromSvg(svgContent, size, filename) {
    return new Promise((resolve, reject) => {
        // Create canvas
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        // Create image from SVG
        const img = new Image();
        const svgBlob = new Blob([svgContent], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(svgBlob);

        img.onload = function() {
            // Draw on canvas with high quality
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, size, size);

            // Convert to PNG
            canvas.toBlob(function(blob) {
                const downloadUrl = URL.createObjectURL(blob);
                
                // Create download link
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                URL.revokeObjectURL(downloadUrl);
                URL.revokeObjectURL(url);
                
                safeDebugLog(` Generated ${filename}`);
                resolve();
            }, 'image/png', 1.0);
        };

        img.onerror = () => {
            console.error(`Failed to generate ${filename}`);
            reject();
        };

        img.src = url;
    });
}

// SVG Content for 16x16
const svg16 = `<svg width="16" height="16" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad16" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0ea5e9" />
      <stop offset="100%" style="stop-color:#6366f1" />
    </linearGradient>
    <linearGradient id="searchGrad16" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f59e0b" />
      <stop offset="100%" style="stop-color:#ea580c" />
    </linearGradient>
  </defs>
  
  <rect x="0" y="0" width="16" height="16" fill="url(#bgGrad16)" rx="3"/>
  
  <rect x="2" y="3" width="8" height="10" fill="#ffffff" rx="1"/>
  <rect x="3" y="5" width="5" height="1" fill="#94a3b8" rx="0.5"/>
  <rect x="3" y="7" width="4" height="1" fill="#94a3b8" rx="0.5"/>
  
  <rect x="2.5" y="9" width="6" height="1.5" fill="#fef3c7" rx="0.5"/>
  <rect x="3" y="9.2" width="4" height="0.6" fill="#d97706" rx="0.3"/>
  
  <circle cx="12" cy="6" r="2.5" fill="url(#searchGrad16)"/>
  <circle cx="12" cy="6" r="1.5" fill="none" stroke="#ffffff" stroke-width="0.8"/>
  <line x1="13.2" y1="7.2" x2="14.5" y2="8.5" stroke="#ffffff" stroke-width="1" stroke-linecap="round"/>
  
  <circle cx="5" cy="7" r="1.5" fill="#10b981"/>
  <text x="5" y="8" font-family="Arial, sans-serif" font-size="2" font-weight="bold" fill="#ffffff" text-anchor="middle">?</text>
</svg>`;

// SVG Content for 128x128 (from existing file)
const svg128 = `<svg width="128" height="128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="mainGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0ea5e9;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#3b82f6;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#6366f1;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="searchGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f59e0b;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#ea580c;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <dropShadow dx="2" dy="4" stdDeviation="4" flood-opacity="0.15"/>
    </filter>
  </defs>
  
  <circle cx="64" cy="64" r="60" fill="url(#mainGradient)" filter="url(#shadow)"/>
  
  <rect x="26" y="42" width="52" height="65" fill="#ffffff" rx="4" opacity="0.85" transform="rotate(-1 52 74.5)"/>
  <rect x="28" y="38" width="52" height="65" fill="#ffffff" rx="4" opacity="0.92" transform="rotate(0.5 54 70.5)"/>
  <rect x="30" y="34" width="52" height="65" fill="#ffffff" rx="5"/>
  
  <rect x="30" y="34" width="52" height="12" fill="#f1f5f9" rx="5"/>
  <rect x="35" y="39" width="15" height="2" fill="#cbd5e1" rx="1"/>
  
  <rect x="36" y="52" width="35" height="2.5" fill="#64748b" rx="1.25"/>
  <rect x="36" y="58" width="28" height="2" fill="#94a3b8" rx="1"/>
  <rect x="36" y="63" width="40" height="2.5" fill="#64748b" rx="1.25"/>
  <rect x="36" y="69" width="25" height="2" fill="#94a3b8" rx="1"/>
  
  <rect x="34" y="75" width="42" height="8" fill="#fef3c7" rx="3" opacity="0.7"/>
  <rect x="36" y="77" width="32" height="2.5" fill="#d97706" rx="1.25"/>
  <rect x="36" y="81" width="25" height="1.5" fill="#d97706" rx="0.75" opacity="0.7"/>
  
  <rect x="36" y="88" width="20" height="2" fill="#94a3b8" rx="1"/>
  <rect x="36" y="93" width="30" height="2" fill="#94a3b8" rx="1"/>
  
  <circle cx="78" cy="72" r="16" fill="url(#searchGradient)" opacity="0.95"/>
  <circle cx="78" cy="72" r="11" fill="none" stroke="#ffffff" stroke-width="3"/>
  <line x1="86" y1="80" x2="94" y2="88" stroke="#ffffff" stroke-width="4" stroke-linecap="round"/>
  
  <circle cx="78" cy="72" r="2.5" fill="#ffffff" opacity="0.9"/>
  
  <circle cx="45" cy="50" r="8" fill="#10b981" opacity="0.9"/>
  <text x="45" y="55" font-family="Arial Black, sans-serif" font-size="10" font-weight="900" fill="#ffffff" text-anchor="middle">?</text>
  
  <circle cx="50" cy="40" r="1.5" fill="#fbbf24" opacity="0.8"/>
  <circle cx="90" cy="45" r="1" fill="#fbbf24" opacity="0.6"/>
  <circle cx="25" cy="80" r="1.2" fill="#fbbf24" opacity="0.7"/>
</svg>`;

// Generate icons when page loads
async function generateAllIcons() {
    safeDebugLog(' Starting icon generation...');
    
    try {
        await createPngFromSvg(svg16, 16, 'icon16.png');
        await createPngFromSvg(svg128, 128, 'icon128.png');
        
        safeDebugLog('🎉 All icons generated successfully!');
        alert(' Icons generated! Files should be downloading automatically.');
    } catch (error) {
        console.error('Error generating icons:', error);
        alert('Error generating icons. Check console for details.');
    }
}

// Auto-generate when script loads
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', generateAllIcons);
} else {
    safeDebugLog('📱 Script ready - call generateAllIcons() to create PNGs');
}