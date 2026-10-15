import { describe, expect, it } from 'vitest';
import { noLigatures } from '../src/view/text';

describe('game text', () => {
  it('keeps "fi" and "fl" from joining into a ligature', () => {
    expect(noLigatures('the first fire, a flower')).toBe('the f‌irst f‌ire, a f‌lower');
    expect(noLigatures('fog off')).toBe('fog off');
  });
});
