import Flatbush from './index.ts'

describe('Flatbush', () => {
  describe('from', () => {
    it('throws error for detached ArrayBuffer', () => {
      const detachedBuffer = new ArrayBuffer(0)
      expect(() => Flatbush.from(detachedBuffer)).toThrow(
        'Flatbush data buffer is detached (byteLength=0)',
      )
    })

    it('throws error for non-Flatbush data', () => {
      const buffer = new ArrayBuffer(100)
      expect(() => Flatbush.from(buffer)).toThrow(
        'Data does not appear to be in a Flatbush format',
      )
    })

    it('can roundtrip a simple index', () => {
      // Create a simple flatbush index
      const index = new Flatbush(3)
      index.add(0, 0, 10, 10)
      index.add(20, 20, 30, 30)
      index.add(40, 40, 50, 50)
      index.finish()

      // Reconstruct from the data buffer
      const reconstructed = Flatbush.from(index.data)
      expect(reconstructed.numItems).toBe(3)

      // Search should work
      const results = reconstructed.search(5, 5, 15, 15)
      expect(results).toHaveLength(1)
      expect(results[0]).toBe(0)
    })
  })
})
