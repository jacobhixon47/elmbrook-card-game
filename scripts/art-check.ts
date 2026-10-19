// Validates every sprite grid and lists codex cards still drawn with placeholders, and customers without a portrait.
import { artStatus, portraitStatus } from '../src/art/status';
import { validateSprite } from '../src/art/sprite';
import { PORTRAITS, SPRITES } from '../src/art/sprites';

const errors = [...SPRITES, ...PORTRAITS].flatMap(validateSprite);
for (const e of errors) console.error(`✗ ${e}`);

const status = artStatus();
const missing = status.filter((s) => !s.done);
console.log(`Sprites: ${SPRITES.length} authored, ${errors.length} invalid`);
console.log(`Cards and familiars with art: ${status.length - missing.length}/${status.length}`);
if (missing.length) console.log(`Placeholders: ${missing.map((m) => m.texture).join(', ')}`);
const faces = portraitStatus();
const faceless = faces.filter((s) => !s.done);
console.log(`Portraits: ${faces.length - faceless.length}/${faces.length}`);
if (faceless.length) console.log(`Missing portraits: ${faceless.map((m) => m.id).join(', ')}`);
process.exit(errors.length ? 1 : 0);
