import { stringToFunction, functionRegexp } from './functionStrings'
import { inDevelopment } from './index'

describe('function string parsing', () => {
  it('has working regex', () => {
    const result = functionRegexp.exec('function(a,b,c) { return a+b+c+5}')
    expect(result).toBeTruthy()
    const [, paramList, remainder] = result
    expect(paramList).toEqual('a,b,c')
    expect(remainder).toEqual(' return a+b+c+5}')
  })
  it('has working regex 2', () => {
    const result = functionRegexp.exec('function( a, b,c){\nreturn a+b+c+5 }')
    expect(result).toBeTruthy()
    const [, paramList, remainder] = result
    expect(paramList).toEqual(' a, b,c')
    expect(remainder).toEqual('\nreturn a+b+c+5 }')
  })
  it('has working regex 3', () => {
    const result = functionRegexp.exec(`function() {
  return 'volvox-sorted red/blue'
}
    `)
    expect(result).toBeTruthy()
    const [, paramList, remainder] = result
    expect(paramList).toEqual('')
    expect(remainder).toContain('volvox-sorted red/blue')
  })
  ;[
    'function(a,b,c) { return a+b+c+5}',
    'function(a, b,c){return a+b+c+5 }',
    'function( a, b,c){\nreturn a+b+c+5 }',
    '  function( a, b,c){\nreturn a+b+c+5 } ',
    '  function( a, b,c){\nreturn a+b+c+5; ;}',
    '  function( a, b,c){\nreturn a+b+c+5; \n ;\n}',
  ].forEach(funcStr => {
    it(`can parse '${funcStr}'`, () => {
      const func = stringToFunction(funcStr, {
        verifyFunctionSignature: ['a', 'b', 'c'],
      })
      expect(func(5, 10, 15)).toBe(35)
      // should throw an exception if the signature verification failed
      expect(() => func(42)).toThrow()
    })
  })
})
