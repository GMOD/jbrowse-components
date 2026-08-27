import { fillTemplate, isTrack } from './util.ts'

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
  it('ignores whitespace inside braces', () => {
    expect(fillTemplate('{ foo }', { foo: 'bar' })).toBe('bar')
  })
})
