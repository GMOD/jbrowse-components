import { stringToJexlExpression } from './jexlStrings'
import SimpleFeature from './simpleFeature'

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
    const result = expr.evalSync({ a: 5, b: 10, c: 15 })
    expect(result).toEqual(35)
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
      stringToJexlExpression(`jexl:get(feature,'score')`).evalSync({
        feature,
      }),
    ).toEqual(10)
    expect(
      stringToJexlExpression(`jexl:get(feature,'uniqueId')`).evalSync({
        feature,
      }),
    ).toBe('jexlFeature')
    expect(
      stringToJexlExpression(
        `jexl:get(feature,'end') - get(feature,'start') == 8`,
      ).evalSync({ feature }),
    ).toBe(true)
  })
})
