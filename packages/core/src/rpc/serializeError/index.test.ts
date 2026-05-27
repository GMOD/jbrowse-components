import { deserializeError, isErrorLike, serializeError } from './index.ts'

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

  test('handles circular references without throwing', () => {
    const obj: Record<string, unknown> = { a: 1 }
    obj.self = obj
    const s = serializeError(obj) as unknown as Record<string, unknown>
    expect(s.self).toBe('[Circular]')
  })

  test('respects maxDepth on nested objects', () => {
    const deep: Record<string, unknown> = { lvl: 0 }
    let cur = deep
    for (let i = 1; i < 10; i++) {
      const next: Record<string, unknown> = { lvl: i }
      cur.next = next
      cur = next
    }
    const s = serializeError(deep, { maxDepth: 2 }) as unknown as Record<
      string,
      unknown
    >
    // depth 0 has .next, depth 1 has .next, depth 2 should be truncated
    const d1 = s.next as Record<string, unknown>
    const d2 = d1.next as Record<string, unknown>
    expect(d2.next).toBeUndefined()
  })

  test('round-trips Error through deserializeError', () => {
    const original = new TypeError('round trip')
    const wire = serializeError(original)
    const restored = deserializeError(wire)
    expect(restored).toBeInstanceOf(TypeError)
    expect(restored.message).toBe('round trip')
  })

  test('deserializeError returns Error passthrough', () => {
    const e = new Error('passthrough')
    expect(deserializeError(e)).toBe(e)
  })

  test('serializes errors with a cause', () => {
    const inner = new Error('inner')
    const outer = new Error('outer', { cause: inner })
    const s = serializeError(outer) as unknown as Record<string, unknown>
    expect(s.message).toBe('outer')
    expect((s.cause as Record<string, unknown>).message).toBe('inner')
  })

  test('isErrorLike detects error-shaped objects', () => {
    expect(isErrorLike(new Error('x'))).toBe(true)
    expect(isErrorLike({ name: 'Error', message: 'x', stack: 'y' })).toBe(true)
    expect(isErrorLike({ name: 'Error' })).toBe(false)
    expect(isErrorLike(null)).toBe(false)
  })
})
