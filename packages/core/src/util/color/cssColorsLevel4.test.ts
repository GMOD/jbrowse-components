import { isNamedColor, namedColorToHex } from './cssColorsLevel4.ts'

describe('cssColorsLevel4', () => {
  it('resolves named colors', () => {
    expect(namedColorToHex('rebeccapurple')).toBe('#663399')
    expect(isNamedColor('teal')).toBe(true)
  })

  it('does not claim an unknown name', () => {
    expect(namedColorToHex('notacolor')).toBeUndefined()
    expect(isNamedColor('notacolor')).toBe(false)
  })

  // the table is a plain object, so a bare index reached Object.prototype:
  // namedColorToHex('constructor') returned a function typed `string`
  it.each(['constructor', 'toString', 'hasOwnProperty', '__proto__'])(
    'does not resolve the inherited %s',
    name => {
      expect(namedColorToHex(name)).toBeUndefined()
      expect(isNamedColor(name)).toBe(false)
    },
  )
})
