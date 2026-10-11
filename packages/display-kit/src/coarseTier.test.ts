import { coarseTierCovers, isSubAdapterConfig } from './coarseTier.ts'

test('a source slot is a sub-adapter config only with a type', () => {
  expect(isSubAdapterConfig({ type: 'BigBedAdapter', uri: 'a.bb' })).toBe(true)
  expect(isSubAdapterConfig({ uri: 'a.bb' })).toBe(false)
  expect(isSubAdapterConfig(undefined)).toBe(false)
  expect(isSubAdapterConfig(null)).toBe(false)
})

test('held payloads cover the screen while every visible block sits inside its read', () => {
  const held = [
    {
      region: {
        refName: 'chr1',
        start: 1000,
        end: 5000,
        assemblyName: 'volvox',
      },
      displayedRegionIndex: 0,
    },
  ]
  const block = (start: number, end: number, displayedRegionIndex = 0) => ({
    refName: 'chr1',
    start,
    end,
    displayedRegionIndex,
  })
  expect(coarseTierCovers(held, [block(2000.4, 3000.6)])).toBe(true)
  expect(coarseTierCovers(held, [block(2000, 5001)])).toBe(false)
  expect(coarseTierCovers(held, [block(2000, 3000, 1)])).toBe(false)
  expect(coarseTierCovers(held, [])).toBe(true)
})
