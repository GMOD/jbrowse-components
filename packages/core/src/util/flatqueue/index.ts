export default class FlatQueue<T> {
  ids: T[] = []
  values: number[] = []
  length = 0

  clear() {
    this.length = 0
  }

  push(item: T, priority: number) {
    let pos = this.length++

    while (pos > 0) {
      const parent = (pos - 1) >> 1
      const parentValue = this.values[parent]!
      if (priority >= parentValue) {
        break
      }
      this.ids[pos] = this.ids[parent]!
      this.values[pos] = parentValue
      pos = parent
    }

    this.ids[pos] = item
    this.values[pos] = priority
  }

  pop() {
    if (this.length === 0) {
      return undefined
    }

    const ids = this.ids
    const values = this.values
    const top = ids[0]
    const last = --this.length

    if (last > 0) {
      const id = ids[last]!
      const value = values[last]!
      let pos = 0
      const halfLen = last >> 1

      while (pos < halfLen) {
        const left = (pos << 1) + 1
        const right = left + 1
        const child =
          left + (+(right < last) & +(values[right]! < values[left]!))
        if (values[child]! >= value) {
          break
        }
        ids[pos] = ids[child]!
        values[pos] = values[child]!
        pos = child
      }

      ids[pos] = id
      values[pos] = value
    }

    return top
  }

  peek() {
    return this.length > 0 ? this.ids[0] : undefined
  }

  peekValue() {
    return this.length > 0 ? this.values[0] : undefined
  }

  shrink() {
    this.ids.length = this.values.length = this.length
  }
}
