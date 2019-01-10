import ConfigSlot from './configurationSlot'

test('can convert a string slot to and from a callback', () => {
  const model = ConfigSlot('tester', { type: 'string', defaultValue: 'foo' })
  const instance = model.create()
  expect(instance.value).toBe('foo')
  expect(instance.func()).toBe('foo')
  instance.convertToCallback()
  expect(instance.value).toContain('function')
  expect(instance.func()).toBe('foo')
  instance.convertToValue()
  expect(instance.value).toBe('foo')
  expect(instance.func()).toBe('foo')
})

test('can convert a numeric slot to and from a callback', () => {
  const model = ConfigSlot('tester', { type: 'number', defaultValue: 12 })
  const instance = model.create()
  expect(instance.value).toBe(12)
  expect(instance.func()).toBe(12)
  instance.convertToCallback()
  expect(instance.value).toContain('function')
  expect(instance.func()).toBe(12)
})

test('can convert a stringArray slot to and from a callback', () => {
  const model = ConfigSlot('tester', {
    type: 'stringArray',
    defaultValue: ['foo', 'bar'],
  })
  const instance = model.create()
  expect(instance.value).toEqual(['foo', 'bar'])
  expect(instance.func()).toEqual(['foo', 'bar'])
  instance.convertToCallback()
  expect(instance.value).toContain('function')
  expect(instance.func()).toEqual(['foo', 'bar'])
  instance.convertToValue()
  expect(instance.func()).toEqual(['foo', 'bar'])
  expect(instance.value).toEqual(['foo', 'bar'])
})
