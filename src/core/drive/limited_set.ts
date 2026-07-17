export class LimitedSet<T> extends Set<T> {
  declare maxSize: number

  constructor(maxSize: number) {
    super()
    this.maxSize = maxSize
  }

  add(value: T): this {
    if (this.size >= this.maxSize) {
      const iterator = this.values()
      const oldestValue = iterator.next().value
      if (oldestValue !== undefined) this.delete(oldestValue)
    }
    return super.add(value)
  }
}
