import { codex } from '../codex';
import { SPRITE_IDS } from './sprites';

/** Which codex cards and familiars have authored sprites. The art "manifest" is derived, never hand-kept. */
export function artStatus(): { id: string; texture: string; done: boolean }[] {
  const rows = [
    ...[...codex.ingredients.keys()].map((id) => ({ id, texture: `ingredient/${id}` })),
    ...[...codex.tinctures.keys()].map((id) => ({ id, texture: `tincture/${id}` })),
    ...[...codex.junk.keys()].map((id) => ({ id, texture: `junk/${id}` })),
    ...[...codex.familiars.keys()].map((id) => ({ id, texture: `familiar/${id}` })),
  ];
  return rows.map((r) => ({ ...r, done: SPRITE_IDS.has(r.texture) }));
}
