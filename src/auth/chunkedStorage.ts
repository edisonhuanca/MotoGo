type Store = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};
type Manifest = {generation: string; count: number};

// Commit the manifest last so a failed write cannot replace a valid session
// with half a new one. Small Unicode-safe chunks also work with iOS Keychain.
export function createChunkedStorage(store: Store, makeGeneration: () => string): Store {
  const readManifest = async (key: string): Promise<Manifest | null> => {
    const raw = await store.getItem(key + '.manifest');
    if (!raw) return null;
    try {
      const m = JSON.parse(raw);
      return typeof m.generation === 'string' && /^[a-zA-Z0-9_-]+$/.test(m.generation) &&
        Number.isInteger(m.count) && m.count > 0 && m.count <= 256 ? m : null;
    } catch {return null;}
  };
  const clean = async (key: string, m: Manifest) => {
    await Promise.all(Array.from({length: m.count}, (_, i) => store.removeItem(`${key}.${m.generation}.${i}`)));
  };
  return {
    async getItem(key) {
      const m = await readManifest(key);
      if (!m) return null;
      const chunks = await Promise.all(Array.from({length: m.count}, (_, i) => store.getItem(`${key}.${m.generation}.${i}`)));
      return chunks.some(c => c === null) ? null : chunks.join('');
    },
    async setItem(key, value) {
      const previous = await readManifest(key);
      const characters = Array.from(value);
      const count = Math.max(1, Math.ceil(characters.length / 400));
      if (count > 256) throw new Error('Session exceeds secure storage capacity');
      const next = {generation: makeGeneration(), count};
      try {
        for (let i = 0; i < count; i++) await store.setItem(`${key}.${next.generation}.${i}`, characters.slice(i * 400, (i + 1) * 400).join(''));
        await store.setItem(key + '.manifest', JSON.stringify(next));
      } catch (error) {
        await clean(key, next).catch(() => {});
        throw error;
      }
      if (previous) await clean(key, previous).catch(() => {});
    },
    async removeItem(key) {
      const previous = await readManifest(key);
      await store.removeItem(key + '.manifest');
      if (previous) await clean(key, previous);
    },
  };
}
