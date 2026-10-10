import '@fontsource/pixelify-sans/400.css';
import '@fontsource/silkscreen/400.css';
import digitsUrl from '@fontsource/vt323/files/vt323-latin-400-normal.woff2?url';
import Phaser from 'phaser';
import { installHook } from './debug/hook';
import { installOverlay } from './debug/overlay';
import { loadFixture, params } from './debug/params';
import { ArtSheet } from './scenes/ArtSheet';
import { Boot } from './scenes/Boot';
import { Run } from './scenes/Run';
import { Title } from './scenes/Title';
import { Cottage } from './scenes/Cottage';
import { BASE_H, BASE_W, ZOOM, integerZoom } from './view/zoom';
import { installDigits } from './view/text';


async function start() {
  // Text measures wrong if Phaser draws before the web fonts arrive.
  await Promise.all([document.fonts.load('8px "Pixelify Sans"'), document.fonts.load('8px Silkscreen'), installDigits(digitsUrl)]);

  const game = new Phaser.Game({
    type: params.get('renderer') === 'canvas' ? Phaser.CANVAS : Phaser.AUTO,
    parent: 'game',
    width: BASE_W * ZOOM,
    height: BASE_H * ZOOM,
    backgroundColor: '#1a1423',
    pixelArt: true,
    antialias: false,
    // One texture per batch. Multi-texture batching corrupted rotated sprites under
    // software WebGL (SwiftShader) in Phaser 4.2; a card game has draw calls to spare.
    // Try ?maxtex=-1 to compare once textures are packed into atlases.
    render: { maxTextures: params.get('maxtex') ? Number(params.get('maxtex')) : 1 },
    roundPixels: true,
    scale: { mode: Phaser.Scale.NONE },
    scene: [Boot, Title, Cottage, Run, ArtSheet],
  });
  // Textures and text are rendered for one zoom level; a different one needs a fresh boot.
  window.addEventListener('resize', () => {
    if (integerZoom() !== ZOOM) location.reload();
  });
  installHook(game);
  installOverlay(game, loadFixture()?.overlay === true);
}

void start();
