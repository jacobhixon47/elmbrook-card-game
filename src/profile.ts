// The player's profile: what persists between runs on this browser (GDD §15.1). M4 brings real
// saves; until then it is one small record in localStorage, which may be missing or blocked.

export type Profile = { tutorialDone: boolean };

const KEY = 'elmbrook.profile';
const DEFAULT: Profile = { tutorialDone: false };

export function loadProfile(): Profile {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    return raw ? { ...DEFAULT, ...(JSON.parse(raw) as Partial<Profile>) } : { ...DEFAULT };
  } catch {
    return { ...DEFAULT };
  }
}

export function saveProfile(change: Partial<Profile>): Profile {
  const next = { ...loadProfile(), ...change };
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked (private window): the tutorial simply shows again next time.
  }
  return next;
}
