type TypedArrayConstructor =
  | Int8ArrayConstructor
  | Uint8ArrayConstructor
  | Uint8ClampedArrayConstructor
  | Int16ArrayConstructor
  | Uint16ArrayConstructor
  | Int32ArrayConstructor
  | Uint32ArrayConstructor
  | Float32ArrayConstructor
  | Float64ArrayConstructor

export default class FlatQueue<T = number> {
  ids: T[]
  values: number[]
  capacity: number
  length = 0

  constructor(
    capacity = Infinity,
    ValuesArray: TypedArrayConstructor = Float64Array,
    IdsArray: TypedArrayConstructor = Uint32Array,
  ) {
    const fixed = capacity !== Infinity
    this.ids = fixed
      ? (new IdsArray(capacity) as unknown as T[])
      : ([] as unknown as T[])
    this.values = fixed
      ? (new ValuesArray(capacity) as unknown as number[])
      : ([] as unknown as number[])
    this.capacity = capacity
  }

  clear() {
    this.length = 0
  }

  push(id: T, value: number) {
    if (this.length === this.capacity) {
      throw new RangeError('Queue is at capacity.')
    }
    let pos = this.length++

    while (pos > 0) {
      const parent = (pos - 1) >> 1
      const parentValue = this.values[parent]!
      if (value >= parentValue) {
        break
      }
      this.ids[pos] = this.ids[parent]!
      this.values[pos] = parentValue
      pos = parent
    }

    this.ids[pos] = id
    this.values[pos] = value
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
}
