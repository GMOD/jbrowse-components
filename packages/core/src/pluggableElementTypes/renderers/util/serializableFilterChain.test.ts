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

function feature(data: Record<string, unknown>) {
  return new SimpleFeature({
    uniqueId: 'f',
    refName: 't1',
    start: 0,
    end: 10,
    ...data,
  })
}

test('an expression entry holds on a truthy value, as a bare expression does', () => {
  const c = new SerializableFilterChain({
    filters: [{ field: "jexl:get(feature,'name')", equal: true }],
    jexl: createJexlInstance(),
  })
  expect(c.passes(feature({ name: 'BRCA1' }))).toBe(true)
  expect(c.passes(feature({}))).toBe(false)
})

test('a jexl: field is computed, then tested like a record field', () => {
  const c = new SerializableFilterChain({
    filters: [
      { field: 'jexl:feature.end - feature.start', gte: 5 },
      { field: 'score', lt: 3 },
    ],
    jexl: createJexlInstance(),
  })
  expect(c.passes(feature({ score: 1 }))).toBe(true)
  expect(c.passes(feature({ score: 4 }))).toBe(false)
  expect(c.passes(feature({ score: 1, end: 3 }))).toBe(false)
})
