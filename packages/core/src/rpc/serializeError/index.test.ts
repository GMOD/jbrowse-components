import { deserializeError, serializeError } from './index.ts'

describe('serializeError', () => {
  test('serializes a basic Error to a plain object', () => {
    const e = new Error('boom')
    const s = serializeError(e)
    expect(s.name).toBe('Error')
    expect(s.message).toBe('boom')
    expect(typeof s.stack).toBe('string')
  })

  test('preserves error subclasses by name', () => {
    expect(serializeError(new TypeError('t')).name).toBe('TypeError')
    expect(serializeError(new RangeError('r')).name).toBe('RangeError')
  })

  test('preserves custom own-enumerable props (e.g. url, code)', () => {
    const e = Object.assign(new Error('auth'), {
      name: 'AuthNeededError',
      url: 'http://example.com/data',
      code: 'EAUTH',
    })
    const s = serializeError(e)
    expect(s.name).toBe('AuthNeededError')
    expect(s.url).toBe('http://example.com/data')
    expect(s.code).toBe('EAUTH')

    const restored = deserializeError(s) as Error & Record<string, unknown>
    expect(restored.name).toBe('AuthNeededError')
    expect(restored.url).toBe('http://example.com/data')
  })

  test('drops function-valued props so postMessage can clone the result', () => {
    const e = Object.assign(new Error('boom'), { retry: () => {} })
    const s = serializeError(e) as Record<string, unknown>
    expect(s.retry).toBeUndefined()
  })

  test('round-trips Error through deserializeError, preserving name + stack', () => {
    const original = new TypeError('round trip')
    const wire = serializeError(original)
    const restored = deserializeError(wire)
    expect(restored).toBeInstanceOf(Error)
    expect(restored.name).toBe('TypeError')
    expect(restored.message).toBe('round trip')
    expect(restored.stack).toBe(original.stack)
  })

  test('deserializeError returns Error passthrough', () => {
    const e = new Error('passthrough')
    expect(deserializeError(e)).toBe(e)
  })

  test('deserializeError wraps a bare string message', () => {
    const restored = deserializeError('Unknown RPC method')
    expect(restored).toBeInstanceOf(Error)
    expect(restored.message).toBe('Unknown RPC method')
  })

  test('serializes and restores errors with a cause', () => {
    const inner = new Error('inner')
    const outer = new Error('outer', { cause: inner })
    const s = serializeError(outer)
    expect(s.message).toBe('outer')
    expect((s.cause as Record<string, unknown>).message).toBe('inner')

    const restored = deserializeError(s)
    expect((restored.cause as Error).message).toBe('inner')
  })

  test('does not infinite-loop on a self-referential cause', () => {
    const e = new Error('loop')
    e.cause = e
    expect(() => serializeError(e)).not.toThrow()
  })

  test('wraps a thrown non-error value', () => {
    const s = serializeError('just a string')
    expect(s.name).toBe('NonError')
    expect(s.message).toBe('just a string')
  })

  test('wraps a thrown undefined without producing a non-string message', () => {
    const s = serializeError(undefined)
    expect(s.name).toBe('NonError')
    expect(s.message).toBe('undefined')
  })
})
