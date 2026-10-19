import { codex } from '../codex';
import { PORTRAIT_IDS, SPRITE_IDS } from './sprites';

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

/** Which customers (regulars, visitors, night customers, patrons) have a portrait. */
export function portraitStatus(): { id: string; texture: string; done: boolean }[] {
  const ids = [...codex.regulars.keys(), ...codex.visitors.keys(), ...codex.nightCustomers.keys(), ...codex.patrons.keys()];
  return ids.map((id) => ({ id, texture: `portrait/${id}`, done: PORTRAIT_IDS.has(`portrait/${id}`) }));
}
