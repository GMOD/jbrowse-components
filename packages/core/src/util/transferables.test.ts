import { collectTransferables, isDetachedBuffer } from './transferables'

describe('transferables', () => {
  describe('isDetachedBuffer', () => {
    it('returns false for a normal ArrayBuffer', () => {
      const buffer = new ArrayBuffer(100)
      expect(isDetachedBuffer(buffer)).toBe(false)
    })

    it('returns true for an empty ArrayBuffer (simulates detached)', () => {
      const buffer = new ArrayBuffer(0)
      expect(isDetachedBuffer(buffer)).toBe(true)
    })
  })

  describe('collectTransferables', () => {
    it('returns empty array for empty result', () => {
      const result = collectTransferables({})
      expect(result).toEqual([])
    })

    it('collects flatbush buffer', () => {
      const flatbush = new ArrayBuffer(100)
      const result = collectTransferables({ flatbush })
      expect(result).toContain(flatbush)
    })

    it('collects subfeatureFlatbush buffer', () => {
      const subfeatureFlatbush = new ArrayBuffer(100)
      const result = collectTransferables({ subfeatureFlatbush })
      expect(result).toContain(subfeatureFlatbush)
    })

    it('collects multiple transferables', () => {
      const flatbush = new ArrayBuffer(100)
      const subfeatureFlatbush = new ArrayBuffer(200)
      const result = collectTransferables({ flatbush, subfeatureFlatbush })
      expect(result).toHaveLength(2)
      expect(result).toContain(flatbush)
      expect(result).toContain(subfeatureFlatbush)
    })

    it('warns and skips detached flatbush buffer', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      const flatbush = new ArrayBuffer(0) // simulates detached
      const result = collectTransferables({ flatbush })
      expect(result).toEqual([])
      expect(warnSpy).toHaveBeenCalledWith(
        'flatbush buffer is already detached, cannot transfer',
      )
      warnSpy.mockRestore()
    })

    it('warns and skips detached subfeatureFlatbush buffer', () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {})
      const subfeatureFlatbush = new ArrayBuffer(0) // simulates detached
      const result = collectTransferables({ subfeatureFlatbush })
      expect(result).toEqual([])
      expect(warnSpy).toHaveBeenCalledWith(
        'subfeatureFlatbush buffer is already detached, cannot transfer',
      )
      warnSpy.mockRestore()
    })
  })
})
