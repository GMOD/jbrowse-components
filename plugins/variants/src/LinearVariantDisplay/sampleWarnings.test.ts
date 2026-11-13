import { createTestEnvironment } from './testEnv.ts'

const WARNING = '1 of the 3 samples in the VCF are not in the metadata file'

test('the samples table warnings that came with the sample list are live notices', () => {
  const { display } = createTestEnvironment().createDisplay()
  expect(display.liveNotices).toEqual([])
  display.setSources([{ name: 'S0' }, { name: 'S1' }], undefined, [WARNING])
  expect(display.liveNotices).toContain(WARNING)
  expect(display.cornerNotices).toContain(WARNING)
})

test('a refetch of the same sample list without the warnings clears them', () => {
  const { display } = createTestEnvironment().createDisplay()
  const sources = [{ name: 'S0' }, { name: 'S1' }]
  display.setSources(sources, undefined, [WARNING])
  display.setSources(sources, undefined, [])
  expect(display.liveNotices).toEqual([])
})
