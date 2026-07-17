type CacheKeyFn<K> = (key: K) => string

const identity = (key: string): string => key

export class LRUCache<K = string, V = unknown> {
  keys: string[] = []
  entries: Record<string, V> = {}
  #toCacheKey: CacheKeyFn<K>

  declare size: number

  constructor(size: number, toCacheKey: CacheKeyFn<K> = identity as CacheKeyFn<K>) {
    this.size = size
    this.#toCacheKey = toCacheKey
  }

  has(key: K) {
    return this.#toCacheKey(key) in this.entries
  }

  get(key: K) {
    if (this.has(key)) {
      const entry = this.read(key)
      this.touch(key)
      return entry
    }
  }

  put(key: K, entry: V) {
    this.write(key, entry)
    this.touch(key)
    return entry
  }

  clear() {
    for (const key of Object.keys(this.entries)) {
      this.evict(key)
    }
  }

  // Private

  read(key: K) {
    return this.entries[this.#toCacheKey(key)]
  }

  write(key: K, entry: V) {
    this.entries[this.#toCacheKey(key)] = entry
  }

  touch(key: K) {
    const cacheKey = this.#toCacheKey(key)
    const index = this.keys.indexOf(cacheKey)
    if (index > -1) this.keys.splice(index, 1)
    this.keys.unshift(cacheKey)
    this.trim()
  }

  trim() {
    for (const key of this.keys.splice(this.size)) {
      this.evict(key)
    }
  }

  evict(key: string) {
    delete this.entries[key]
  }
}
