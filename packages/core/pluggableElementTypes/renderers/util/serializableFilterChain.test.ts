import SerializableFilterChain from './serializableFilterChain'

test('one', () => {
  const c = new SerializableFilterChain({
    filters: ['function(x) { return x.y === 2 }'],
  })

  expect(c.passes({ y: 1 })).toBe(false)
  expect(c.passes({ y: 2 })).toBe(true)
  expect(c.toJSON()).toEqual({ filters: ['function(x) { return x.y === 2 }'] })
})
