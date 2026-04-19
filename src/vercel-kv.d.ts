declare module "@vercel/kv" {
  export const kv: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, options?: { ex?: number }): Promise<void>;
    del(key: string): Promise<void>;
  };
}
