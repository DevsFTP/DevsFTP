const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1024,
    height: 1024,
    show: false,
    webPreferences: {
      offscreen: true,
      transparent: true
    }
  });

  const svgPath = path.join(__dirname, '../assets/icon.svg');
  const svgContent = fs.readFileSync(svgPath, 'utf8');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        html, body { margin: 0; padding: 0; background: transparent; overflow: hidden; width: 1024px; height: 1024px; }
        svg { width: 1024px; height: 1024px; display: block; }
      </style>
    </head>
    <body>
      ${svgContent}
    </body>
    </html>
  `;

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  // Allow layout and rasterization pass
  await new Promise(r => setTimeout(r, 500));

  const image = await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 });
  const pngBuffer = image.toPNG();

  const pngPath = path.join(__dirname, '../assets/icon.png');
  fs.writeFileSync(pngPath, pngBuffer);
  console.log('Successfully captured vector-smooth 1024x1024 icon.png from Chromium engine!');

  app.quit();
});
