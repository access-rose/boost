import { LRUCache } from "../lru_cache"
import { toCacheKey } from "../url"
import type { FetchRequest } from "../../http/fetch_request"

const PREFETCH_DELAY = 100

class PrefetchCache extends LRUCache<URL, FetchRequest> {
  #prefetchTimeout: ReturnType<typeof setTimeout> | null = null
  #maxAges: Record<string, Date> = {}

  declare prefetchDelay: number

  constructor(size = 1, prefetchDelay = PREFETCH_DELAY) {
    super(size, toCacheKey)
    this.prefetchDelay = prefetchDelay
  }

  putLater(url: URL, request: FetchRequest, ttl?: number) {
    this.#prefetchTimeout = setTimeout(() => {
      request.perform()
      this.put(url, request, ttl)
      this.#prefetchTimeout = null
    }, this.prefetchDelay)
  }

  put(url: URL, request: FetchRequest, ttl = cacheTtl) {
    super.put(url, request)
    this.#maxAges[toCacheKey(url)] = new Date(new Date().getTime() + ttl)

    return request
  }

  clear() {
    super.clear()
    if (this.#prefetchTimeout) clearTimeout(this.#prefetchTimeout)
  }

  evict(key: string) {
    super.evict(key)
    delete this.#maxAges[key]
  }

  has(key: URL) {
    if (super.has(key)) {
      const maxAge = this.#maxAges[toCacheKey(key)]

      return !!maxAge && maxAge.getTime() > Date.now()
    } else {
      return false
    }
  }
}

export const cacheTtl = 10 * 1000
export const prefetchCache = new PrefetchCache()
