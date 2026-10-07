import '@fontsource/pixelify-sans/400.css';
import '@fontsource/silkscreen/400.css';
import Phaser from 'phaser';
import { installHook } from './debug/hook';
import { params } from './debug/params';
import { ArtSheet } from './scenes/ArtSheet';
import { Boot } from './scenes/Boot';
import { Hand } from './scenes/Hand';
import { Title } from './scenes/Title';

export const BASE_W = 640;
export const BASE_H = 360;

function integerZoom(): number {
  return Math.max(1, Math.floor(Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H)));
}

async function start() {
  // Text measures wrong if Phaser draws before the web fonts arrive.
  await Promise.all([document.fonts.load('8px "Pixelify Sans"'), document.fonts.load('8px Silkscreen')]);

  const game = new Phaser.Game({
    type: params.get('renderer') === 'canvas' ? Phaser.CANVAS : Phaser.AUTO,
    parent: 'game',
    width: BASE_W,
    height: BASE_H,
    backgroundColor: '#1a1423',
    pixelArt: true,
    antialias: false,
    // One texture per batch. Multi-texture batching corrupted rotated sprites under
    // software WebGL (SwiftShader) in Phaser 4.2; a card game has draw calls to spare.
    // Try ?maxtex=-1 to compare once textures are packed into atlases.
    render: { maxTextures: params.get('maxtex') ? Number(params.get('maxtex')) : 1 },
    roundPixels: true,
    scale: { mode: Phaser.Scale.NONE, zoom: integerZoom() },
    scene: [Boot, Title, Hand, ArtSheet],
  });
  window.addEventListener('resize', () => game.scale.setZoom(integerZoom()));
  installHook(game);
}

void start();
