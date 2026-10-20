// Builds the web's brand files from the OH ESTUDIO brand kit ("Manual de marca OH Estudio", assets/).
//
//   npm run brand -- ~/Desktop/oh/"Manual de marca OH Estudio SCREENS"/assets
//
// The kit's logos are 1600–3800 px PNGs (the vector is still pending), so this writes light copies at
// the sizes the site shows them, untouched otherwise (the manual forbids redrawing the logo), plus:
// - container.png: the symbol's solid container (the shield of the horizontal logo), used as the
//   brand's "contenedor" photo frame and "punta" bullet (CSS masks);
// - the favicons, app icons and link preview image from assets/web.
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const KIT = process.argv[2];
if (!KIT) throw new Error('usage: npm run brand -- <brand kit assets folder>');
const PUB = path.join(process.cwd(), 'public', 'brand');
const APP = path.join(process.cwd(), 'src', 'app');

const logo = (file: string, out: string, height: number) =>
  sharp(path.join(KIT, 'logos', file)).trim().resize({ height }).png({ compressionLevel: 9, palette: true }).toFile(path.join(PUB, out));

async function main() {
  await mkdir(PUB, { recursive: true });
  // header and footer: horizontal version (the manual's choice for web headers), 3x its display height
  await logo('horizontal-azul.png', 'logo-horizontal-azul.png', 132);
  await logo('horizontal-marfil.png', 'logo-horizontal-marfil.png', 132);
  // opening curtain: the principal version on blue, as on the manual's cover
  await logo('principal-blanco.png', 'logo-principal-blanco.png', 480);
  // small spaces: the symbol alone
  await logo('principal-simbolo-azul.png', 'simbolo-azul.png', 192);
  await logo('principal-simbolo-blanco.png', 'simbolo-blanco.png', 192);

  // the container: the left shield of the horizontal logo, as a solid alpha silhouette
  const src = path.join(KIT, 'logos', 'horizontal-azul.png');
  const { width = 0, height = 0 } = await sharp(src).metadata();
  const left = await sharp(src).extract({ left: 0, top: 0, width: Math.round(width * 0.36), height }).png().toBuffer();
  const shield = await sharp(left).trim().toBuffer();
  const alpha = await sharp(shield).resize({ height: 512 }).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = alpha.info;
  await sharp({ create: { width: w, height: h, channels: 3, background: '#000000' } })
    .joinChannel(alpha.data, { raw: { width: w, height: h, channels: 1 } })
    .png({ compressionLevel: 9 }).toFile(path.join(PUB, 'container.png'));

  // the pattern, for large brand backgrounds
  await sharp(path.join(KIT, 'merch', 'patron-azul-2000.png')).resize(1000).png({ compressionLevel: 9, palette: true }).toFile(path.join(PUB, 'patron-azul.png'));

  // icons and link preview (Next.js file conventions in src/app)
  const web = (f: string) => path.join(KIT, 'web', f);
  await sharp(web('favicon-48.png')).toFile(path.join(APP, 'icon.png'));
  await sharp(web('apple-touch-icon-180.png')).toFile(path.join(APP, 'apple-icon.png'));
  await sharp(web('icon-512.png')).toFile(path.join(PUB, 'icon-512.png'));
  await sharp(web('icon-192.png')).toFile(path.join(PUB, 'icon-192.png'));
  await sharp(web('og-image-1200x630.png')).flatten({ background: '#123BFF' }).jpeg({ quality: 88 }).toFile(path.join(APP, 'opengraph-image.jpg'));
  console.log('brand files written to public/brand and src/app');
}

main().catch(e => { console.error(e); process.exit(1); });
