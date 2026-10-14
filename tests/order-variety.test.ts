import { describe, expect, it } from 'vitest';
import type { OrderRequest } from '../src/core';
import { ok, start } from './helpers';

const key = (q: OrderRequest) => (q.kind === 'recipe' ? q.recipe : `family:${q.family}`);

describe('order variety', () => {
  it('rarely repeats a request on the board or from yesterday\'s', () => {
    let repeats = 0;
    let posted = 0;
    for (let i = 0; i < 40; i++) {
      let s = start(`variety-${i}`);
      for (const day of [1, 2, 3]) {
        const yesterday = s.orders.map((o) => key(o.request));
        s = ok(s, { type: 'debug', op: 'jumpToDay', week: 3, day }).state;
        const seen = new Set(day > 1 ? yesterday : []);
        for (const o of s.orders) {
          posted++;
          if (seen.has(key(o.request))) {
            repeats++;
          }
          seen.add(key(o.request));
        }
      }
    }
    expect(posted).toBeGreaterThan(200);
    // Without the rule, 26 of these 240 orders repeat (the deck reaches Superb with one recipe).
    expect(repeats).toBeLessThanOrEqual(posted / 40);
  });
});
