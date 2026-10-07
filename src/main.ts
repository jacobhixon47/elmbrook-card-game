import '@fontsource/pixelify-sans/400.css';
import '@fontsource/silkscreen/400.css';
import Phaser from 'phaser';
import { installHook } from './debug/hook';
import { params } from './debug/params';
import { ArtSheet } from './scenes/ArtSheet';
import { Boot } from './scenes/Boot';
import { Hand } from './scenes/Hand';
import { Title } from './scenes/Title';
import { BASE_H, BASE_W, ZOOM, integerZoom } from './view/zoom';


async function start() {
  // Text measures wrong if Phaser draws before the web fonts arrive.
  await Promise.all([document.fonts.load('8px "Pixelify Sans"'), document.fonts.load('8px Silkscreen')]);

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
    scene: [Boot, Title, Hand, ArtSheet],
  });
  // Textures and text are rendered for one zoom level; a different one needs a fresh boot.
  window.addEventListener('resize', () => {
    if (integerZoom() !== ZOOM) location.reload();
  });
  installHook(game);
}

void start();
