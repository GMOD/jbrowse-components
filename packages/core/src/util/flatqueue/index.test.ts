import FlatQueue from './index.ts'

const data: number[] = []
for (let i = 0; i < 100; i++) {
  data.push(Math.floor(100 * Math.random()))
}

const sorted = data.slice().sort((a, b) => a - b)

describe('FlatQueue (Upstream Parity)', () => {
  it('maintains a priority queue', () => {
    const queue = new FlatQueue<number>()
    for (let i = 0; i < data.length; i++) {
      queue.push(i, data[i]!)
    }

    expect(queue.values[0]).toBe(sorted[0])
    expect(data[queue.ids[0]!]!).toBe(sorted[0])

    const result = []
    while (queue.length) {
      result.push(data[queue.pop()!]!)
    }

    expect(result).toEqual(sorted)
  })

  it('handles edge cases with few elements', () => {
    const queue = new FlatQueue<number>()

    queue.push(0, 2)
    queue.push(1, 1)
    queue.pop()
    queue.pop()
    queue.pop()
    queue.push(2, 2)
    queue.push(3, 1)
    expect(queue.pop()).toBe(3)
    expect(queue.pop()).toBe(2)
    expect(queue.pop()).toBeUndefined()
  })

  it('uses typed arrays when given a capacity', () => {
    const def = new FlatQueue<number>(100)
    expect(def.ids).toBeInstanceOf(Uint32Array)
    expect(def.values).toBeInstanceOf(Float64Array)
    expect(def.ids.length).toBe(100)

    // values and ids constructors can be specialized
    const narrow = new FlatQueue<number>(100, Uint32Array, Uint16Array)
    expect(narrow.ids).toBeInstanceOf(Uint16Array)
    expect(narrow.values).toBeInstanceOf(Uint32Array)

    const queue = new FlatQueue<number>(data.length, Float64Array, Uint32Array)
    for (let i = 0; i < data.length; i++) {
      queue.push(i, data[i]!)
    }

    const result = []
    while (queue.length) {
      result.push(data[queue.pop()!]!)
    }
    expect(result).toEqual(sorted)
  })

  it('throws when pushing past a fixed capacity', () => {
    const queue = new FlatQueue<number>(3, Uint32Array, Uint32Array)
    expect(queue.capacity).toBe(3)

    for (let i = 0; i < 3; i++) {
      queue.push(i, i)
    }
    expect(() => queue.push(3, 3)).toThrow(RangeError)

    // popping frees a slot again
    queue.pop()
    expect(() => queue.push(3, 3)).not.toThrow()

    // regular-array queues have no capacity limit
    const dynamic = new FlatQueue<number>()
    expect(dynamic.capacity).toBe(Infinity)
    expect(() => {
      for (let i = 0; i < 1000; i++) {
        dynamic.push(i, i)
      }
    }).not.toThrow()
  })
})
