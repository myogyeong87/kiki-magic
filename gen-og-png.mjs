import { readFileSync, writeFileSync } from 'fs';
import { Resvg } from '@resvg/resvg-js';

const svg = readFileSync('./public/og-image.svg');
const resvg = new Resvg(svg, {
  fitTo: { mode: 'width', value: 1200 },
  font: {
    loadSystemFonts: true,
  },
});
const pngData = resvg.render();
const pngBuffer = pngData.asPng();
writeFileSync('./public/og-image.png', pngBuffer);
console.log('og-image.png generated:', pngBuffer.length, 'bytes');
