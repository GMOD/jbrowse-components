import { deepUpdate, fillTemplate, isSource, isTrack } from './util.ts'

describe('isTrack', () => {
  it('returns true for objects with a string label', () => {
    expect(isTrack({ label: 'myTrack' })).toBe(true)
  })
  it('returns false for missing label', () => {
    expect(isTrack({ key: 'x' })).toBe(false)
  })
  it('returns false for non-string label', () => {
    expect(isTrack({ label: 42 })).toBe(false)
  })
  it('returns false for null/undefined', () => {
    expect(isTrack(null)).toBe(false)
    expect(isTrack(undefined)).toBe(false)
  })
})

describe('isSource', () => {
  it('returns true for objects with a string url', () => {
    expect(isSource({ url: 'https://example.com' })).toBe(true)
  })
  it('returns false for missing url', () => {
    expect(isSource({ name: 'x' })).toBe(false)
  })
  it('returns false for null', () => {
    expect(isSource(null)).toBe(false)
  })
})

describe('deepUpdate', () => {
  it('merges flat objects', () => {
    expect(deepUpdate({ a: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 })
  })
  it('overrides existing keys', () => {
    expect(deepUpdate({ a: 1 }, { a: 2 })).toEqual({ a: 2 })
  })
  it('recursively merges nested objects', () => {
    expect(deepUpdate({ a: { x: 1, y: 2 } }, { a: { y: 9, z: 3 } })).toEqual({
      a: { x: 1, y: 9, z: 3 },
    })
  })
  it('ignores prototype-poisoning keys', () => {
    const a = { normal: 1 }
    deepUpdate(a, { __proto__: { evil: true }, constructor: { x: 1 } })
    expect((a as any).evil).toBeUndefined()
  })
})

describe('fillTemplate', () => {
  it('replaces simple variables', () => {
    expect(fillTemplate('{foo}', { foo: 'bar' })).toBe('bar')
  })
  it('replaces nested dot-path variables', () => {
    expect(fillTemplate('{a.b}', { a: { b: 'hello' } })).toBe('hello')
  })
  it('leaves unknown variables untouched', () => {
    expect(fillTemplate('{unknown}', {})).toBe('{unknown}')
  })
  it('replaces multiple variables in one string', () => {
    expect(
      fillTemplate('{dataRoot}/seq/{chr}', { dataRoot: '/data', chr: '1' }),
    ).toBe('/data/seq/1')
  })
  it('calls function values with the var name', () => {
    const fn = jest.fn(() => 'computed')
    expect(fillTemplate('{x}', { x: fn })).toBe('computed')
    expect(fn).toHaveBeenCalledWith('x')
  })
  it('ignores whitespace inside braces', () => {
    expect(fillTemplate('{ foo }', { foo: 'bar' })).toBe('bar')
  })
})
