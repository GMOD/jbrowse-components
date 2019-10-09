import MainThreadRpcDriver from './MainThreadRpcDriver'

test('isPlainObject', () => {
  const d = new MainThreadRpcDriver({ rpcFuncs: 'stub' })
  expect(d.isPlainObject({ foo: 2 })).toBe(true)
  expect(d.isPlainObject(new Map())).toBe(false)
  expect(d.isPlainObject([])).toBe(false)
  expect(d.isPlainObject(new AbortController())).toBe(false)
})
test('arg cloning', () => {
  const d = new MainThreadRpcDriver({ rpcFuncs: 'stub' })
  const aborter = new AbortController()
  const original = {
    signal: aborter.signal,
    topLevelData: 1,
    map: new Map([['zonk', 3]]),
    set: new Set(['donk']),
    buriedStuff: [
      { anotherThing: { sameSignalInAnotherPlace: aborter.signal } },
      'foo',
    ],
  }

  const cloned = d.cloneArgs(original)
  expect(typeof cloned.signal.addEventListener).toBe('function')
  expect(cloned.signal).toBe(
    cloned.buriedStuff[0].anotherThing.sameSignalInAnotherPlace,
  )
  expect(
    typeof cloned.buriedStuff[0].anotherThing.sameSignalInAnotherPlace
      .addEventListener,
  ).toBe('function')
  expect(cloned.buriedStuff[1]).toBe('foo')
  expect(cloned.map.get('zonk')).toBe(3)
  expect(cloned.set.has('donk')).toBe(true)
  expect(cloned.set.has('piffle')).toBe(false)
})
