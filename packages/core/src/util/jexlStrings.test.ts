import { stringToJexlExpression } from './jexlStrings.ts'
import SimpleFeature from './simpleFeature.ts'

describe('function string parsing', () => {
  it('can detect a jexl expression', () => {
    const str = 'jexl:a+b+c+5'
    expect(str.startsWith('jexl:')).toBeTruthy()
  })
  it('can create a jexl expression', () => {
    const str = 'jexl:a+b+c+5'
    const expr = stringToJexlExpression(str)
    expect(expr._exprStr).toEqual('a+b+c+5')
  })
  it('can create a jexl expression 2', () => {
    const str = 'jexl:\na+b+c+5'
    const expr = stringToJexlExpression(str)
    expect(expr._exprStr).toEqual('\na+b+c+5')
    const result = expr.eval({ a: 5, b: 10, c: 15 })
    expect(result).toEqual(35)
  })
  it('startsWith is registered and works', async () => {
    // Regression: startsWith was registered twice; the second registration
    // silently overwrote the first, but both were identical so it still worked.
    // This test ensures the function exists and behaves correctly.
    const expr = stringToJexlExpression('jexl:startsWith("hello", "hel")')
    expect(await expr.eval({})).toBe(true)
    const expr2 = stringToJexlExpression('jexl:startsWith("hello", "world")')
    expect(await expr2.eval({})).toBe(false)
  })

  it('can use the loaded core helper functions to access feature info', () => {
    const feature = new SimpleFeature({
      uniqueId: 'jexlFeature',
      refName: 't1',
      score: 10,
      start: 1,
      end: 9,
    })
    expect(
      stringToJexlExpression(`jexl:get(feature,'score')`).eval({
        feature,
      }),
    ).toEqual(10)
    expect(
      stringToJexlExpression(`jexl:get(feature,'uniqueId')`).eval({
        feature,
      }),
    ).toBe('jexlFeature')
    expect(
      stringToJexlExpression(
        `jexl:get(feature,'end') - get(feature,'start') == 8`,
      ).eval({ feature }),
    ).toBe(true)
  })
})
