interface StoredUserKey {
  provider: string;
  model: string;
  keyRef: string;
  fingerprint: string;
  encryptedKey: string;
  createdAtUtc: string;
}

class UserKeyStore {
  private keys = new Map<string, StoredUserKey>();

  save(uid: string, value: StoredUserKey) {
    this.keys.set(uid, value);
  }

  get(uid: string) {
    return this.keys.get(uid);
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __userKeyStore: UserKeyStore | undefined;
}

export const userKeyStore = globalThis.__userKeyStore ?? new UserKeyStore();

if (!globalThis.__userKeyStore) {
  globalThis.__userKeyStore = userKeyStore;
}
