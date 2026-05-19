import { accessNested, generateTitle, isEmpty } from './util.ts'

describe('isEmpty', () => {
  test('empty object', () => {
    expect(isEmpty({})).toBe(true)
  })
  test('non-empty object', () => {
    expect(isEmpty({ a: 1 })).toBe(false)
  })
})

describe('generateTitle', () => {
  test('name and type', () => {
    expect(generateTitle('myName', undefined, 'gene')).toBe('myName - gene')
  })

  test('id used when name missing', () => {
    expect(generateTitle(undefined, 'myId', 'gene')).toBe('myId - gene')
  })

  test('undefined type does not render as literal "undefined"', () => {
    expect(generateTitle('myName', undefined, undefined)).toBe('myName')
    expect(generateTitle('myName', undefined, undefined)).not.toContain(
      'undefined',
    )
  })

  test('all undefined returns empty string', () => {
    expect(generateTitle(undefined, undefined, undefined)).toBe('')
  })

  test('name longer than 20 chars is ellipsed', () => {
    const long = 'a'.repeat(40)
    expect(generateTitle(long, undefined, 'gene')).toContain('...')
  })
})

describe('accessNested', () => {
  test('returns string value at path', () => {
    expect(accessNested(['a', 'b'], { a: { b: 'hello' } })).toBe('hello')
  })

  test('falls back to Description field on nested object', () => {
    expect(accessNested(['a'], { a: { Description: 'desc' } })).toBe('desc')
  })

  test('returns undefined for missing path', () => {
    expect(accessNested(['x', 'y'], {})).toBeUndefined()
  })
})
