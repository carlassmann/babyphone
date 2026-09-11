# Pip artwork

`src/PipMascot.tsx` and `src/PipMascot.css` contain the interactive vector mascot and its sleeping, awake, listening, and reduced-motion states.

`public/icon.svg` is its simplified sleepy companion mark. `public/icon-192.png` and `public/icon-512.png` are raster exports of that SVG using Sharp. The 512px image keeps the bird inside the maskable safe area.

The UI uses locally bundled DM Sans and Fredoka through Fontsource, and Lucide SVG interface icons. No remote fonts or image requests are needed after installation.
