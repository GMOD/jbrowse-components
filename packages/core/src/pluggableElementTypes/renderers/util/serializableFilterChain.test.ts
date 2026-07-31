import createJexlInstance from '../../../util/jexl.ts'
import SimpleFeature from '../../../util/simpleFeature.ts'
import SerializableFilterChain from './serializableFilterChain.ts'

test('one', () => {
  const c = new SerializableFilterChain({
    filters: ['jexl:feature.y == 2'],
    jexl: createJexlInstance(),
  })

  expect(c.passes({ y: 1 })).toBe(false)
  expect(c.passes({ y: 2 })).toBe(true)
  expect(c.toJSON()).toEqual({ filters: ['jexl:feature.y == 2'] })
})

test('an empty chain admits everything without touching the feature', () => {
  const c = new SerializableFilterChain({
    filters: ['', '   '],
    jexl: createJexlInstance(),
  })
  const feature = new SimpleFeature({
    uniqueId: 'test',
    refName: 't1',
    start: 1,
    end: 2,
  })
  const get = jest.spyOn(feature, 'get')

  expect(c.passes(feature)).toBe(true)
  expect(get).not.toHaveBeenCalled()
})
