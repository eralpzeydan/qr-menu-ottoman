import { config as loadEnv } from 'dotenv';

loadEnv();

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET must be defined in your environment for tests to run');
}

if (typeof globalThis.File === 'undefined') {
  class TestFile extends Blob {
    name: string;
    lastModified: number;
    constructor(bits: BlobPart[], name: string, options?: FilePropertyBag) {
      super(bits, options);
      this.name = name;
      this.lastModified = options?.lastModified ?? Date.now();
    }
  }
  // @ts-expect-error Polyfill
  globalThis.File = TestFile;
}
