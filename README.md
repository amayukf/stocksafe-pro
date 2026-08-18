# StockSafe Pro V2 📦🚀

An ultra-premium, 100% offline-first Progressive Web Application (PWA) designed for inventory management, barcode scanning, and point-of-sale functionality securely handled locally within the browser.

## Features ✨

- **Offline First (PWA)**: Installable as an app on Desktop and Mobile. No backend database required. All data stays locally on your device via IndexedDB (Dexie.js).
- **Camera Barcode Scanner**: Built-in Quagga2 barcode detector uses your device camera or webcam to scan stock securely without transmitting image data.
- **V2 Premium Analytics**: Integrated `Chart.js` dashboard graphics tracking the last 7-day trailing revenue margins dynamically.
- **POS Sound System**: Synthesized Web Audio API sound effects mimicking real register hardware (scans & sales).
- **Profit & Loss Tracking**: Add Cost Price metrics to see exactly how much you profit per sale.
- **Customizable PDF Receipts**: Print 80mm professional thermal-ready receipts dynamically generated via `jsPDF`. Supports uploading custom shop logos and custom footer texts via settings!
- **Data Portability**: Full JSON Database import/export tools, coupled with one-click CSV inventory reports.
- **Multi-Store Routing**: Seamlessly swap between sub-branches with complete data separation.
- **Micro-Animations**: Staggered cascading slide-in interfaces and toast popups for buttery smooth user interaction.

## Tech Stack 🛠

- HTML5 / CSS3 (CSS Variables, Grid, Glassmorphism, Micro-animations)
- Vanilla JavaScript (ES6+, Async/Await)
- **Dexie.js** (IndexedDB wrapper for local, schema-driven databases)
- **Quagga2** (Javascript Barcode Scanner)
- **jsPDF** (Client-side PDF generator)
- **Chart.js** (Line-chart visualizer)

## How to Install & Run 🔌

Because the app utilizes modern **Web APIs** (specifically Camera Permissions via `getUserMedia`), you **cannot** just double-click the `index.html` file to run it. Due to standard browser security protocols, it must be served securely.

### Development Mode

If you want to run it locally on your computer:

1. Clone the repository.
2. In the folder, run a local web server:
   - `python -m http.server 8080` or
   - `npx serve .`
3. Navigate to `http://localhost:8080` in your browser.

### Production Deployment (The Best Way)

Deploy the folder to any static web host so you can access it via HTTPS on your phone.
We recommend using [Cloudflare Pages](https://pages.cloudflare.com/), [Vercel](https://vercel.com/), or [Netlify](https://www.netlify.com/)—all of which provide 100% free hosting for static applications.
Once hosted safely behind HTTPS, open the URL on your device, authorize camera access, and click **"Add to Home Screen"** to install the PWA offline!

## License 📜

MIT License
