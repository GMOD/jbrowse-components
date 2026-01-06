import SerializableFilterChain from './serializableFilterChain.ts'

test('one', () => {
  const c = new SerializableFilterChain({
    filters: ['jexl:feature.y == 2'],
  })

  expect(c.passes({ y: 1 })).toBe(false)
  expect(c.passes({ y: 2 })).toBe(true)
  expect(c.toJSON()).toEqual({ filters: ['jexl:feature.y == 2'] })
})
