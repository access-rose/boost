import { toCacheKey } from "../url"
import { LRUCache } from "../lru_cache"
import type { PageSnapshot } from "./page_snapshot"

export class SnapshotCache extends LRUCache<URL, PageSnapshot> {
  constructor(size: number) {
    super(size, toCacheKey)
  }

  get snapshots() {
    return this.entries
  }
}
