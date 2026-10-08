// Dev URL params: ?fixture=<name> ?seed=<s> ?noanim=1 ?renderer=canvas

export type Fixture = { scene: string; seed?: string; state?: unknown; season?: string; time?: string; weather?: string };

const fixtures = import.meta.glob<Fixture>('/fixtures/*.json', { eager: true, import: 'default' });

export const params = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

export const noAnim = params.get('noanim') === '1';

export function loadFixture(): (Fixture & { name: string }) | null {
  const name = params.get('fixture');
  if (!name) return null;
  const fixture = fixtures[`/fixtures/${name}.json`];
  if (!fixture) {
    console.error(`[elmbrook] unknown fixture "${name}". Known: ${Object.keys(fixtures).join(', ')}`);
    return null;
  }
  return { ...fixture, name };
}
