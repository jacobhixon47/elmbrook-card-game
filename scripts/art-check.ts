// Validates every sprite grid and lists codex cards still drawn with placeholders.
import { artStatus } from '../src/art/status';
import { validateSprite } from '../src/art/sprite';
import { SPRITES } from '../src/art/sprites';

const errors = SPRITES.flatMap(validateSprite);
for (const e of errors) console.error(`✗ ${e}`);

const status = artStatus();
const missing = status.filter((s) => !s.done);
console.log(`Sprites: ${SPRITES.length} authored, ${errors.length} invalid`);
console.log(`Cards with art: ${status.length - missing.length}/${status.length}`);
if (missing.length) console.log(`Placeholders: ${missing.map((m) => m.texture).join(', ')}`);
process.exit(errors.length ? 1 : 0);
