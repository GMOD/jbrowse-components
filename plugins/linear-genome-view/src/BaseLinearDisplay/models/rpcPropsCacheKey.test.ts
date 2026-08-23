import { types } from '@jbrowse/mobx-state-tree'

import { findUnserializable, serializeRpcProps } from './rpcPropsCacheKey.ts'

describe('findUnserializable', () => {
  it('accepts primitives, plain arrays, plain objects and undefined', () => {
    expect(
      findUnserializable(
        { a: 1, b: 'x', c: null, d: undefined, e: [true, { f: [2] }] },
        'rpcProps()',
      ),
    ).toEqual([])
  })

  it('accepts anything with a toJSON, including a class instance', () => {
    class Chain {
      toJSON() {
        return ['expr']
      }
    }
    expect(findUnserializable({ filters: new Chain() }, 'rpcProps()')).toEqual(
      [],
    )
  })

  it('names the path of a Map, a Set, a typed array and a bare class', () => {
    class Bare {
      x = 1
    }
    expect(
      findUnserializable(
        {
          m: new Map(),
          nested: { s: new Set(), list: [new Float32Array(1)] },
          k: new Bare(),
        },
        'rpcProps()',
      ),
    ).toEqual([
      'rpcProps().m (Map without toJSON)',
      'rpcProps().nested.s (Set without toJSON)',
      'rpcProps().nested.list[0] (Float32Array without toJSON)',
      'rpcProps().k (Bare without toJSON)',
    ])
  })

  it('names a function', () => {
    expect(findUnserializable({ f: () => 1 }, 'rpcProps()')).toEqual([
      'rpcProps().f (function)',
    ])
  })
})

describe('serializeRpcProps', () => {
  const Display = types
    .model('FixtureDisplay', {})
    .volatile(() => ({ payload: {} as Record<string, unknown> }))
    .views(self => ({
      rpcProps() {
        return self.payload
      },
    }))
    .actions(self => ({
      setPayload(p: Record<string, unknown>) {
        self.payload = p
      },
    }))

  it('is the JSON of the payload and the empty string without rpcProps', () => {
    const d = Display.create()
    d.setPayload({ a: 1 })
    expect(serializeRpcProps(d)).toBe('{"a":1}')
    expect(serializeRpcProps(types.model('Bare', {}).create())).toBe('')
  })

  it('reports a dead cache axis once per display, with its path', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const d = Display.create()
    d.setPayload({ ok: 1, bad: new Map() })
    serializeRpcProps(d)
    serializeRpcProps(d)
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]![0]).toContain('FixtureDisplay')
    expect(spy.mock.calls[0]![0]).toContain(
      'rpcProps().bad (Map without toJSON)',
    )
    spy.mockRestore()
  })
})
