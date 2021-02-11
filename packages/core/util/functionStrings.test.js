/* eslint-disable no-underscore-dangle */
import { stringToJexlExpression } from './functionStrings'
import SimpleFeature from './simpleFeature'

describe('function string parsing', () => {
  it('can detect a jexl expression', () => {
    const str = 'jexl:a+b+c+5'
    expect(str.startsWith('jexl:')).toBeTruthy()
  })
  // it('will fail with no jexl tag', () => {
  //   const str = 'a+b+c+5'
  //   expect(stringToJexlExpression(str)).toThrow()
  // })
  it('can create a jexl expression', () => {
    const str = 'jexl:a+b+c+5'
    const func = stringToJexlExpression(str)
    expect(func._exprStr).toEqual('a+b+c+5')
  })
  it('can create a jexl expression 2', () => {
    const str = 'jexl:\na+b+c+5'
    const func = stringToJexlExpression(str)
    expect(func._exprStr).toEqual('\na+b+c+5')
    const result = func.evalSync({ a: 5, b: 10, c: 15 })
    expect(result).toEqual(35)
  })
  it('can use the loaded core helper functions to access feature info', () => {
    const feature = new SimpleFeature({
      uniqueId: 'jexlFeature',
      score: 10,
      start: 1,
      end: 9,
    })
    expect(
      stringToJexlExpression(`jexl:feature|getData('score')`).evalSync({
        feature,
      }),
    ).toEqual(10)
    expect(
      stringToJexlExpression(`jexl:feature|getData('uniqueId')`).evalSync({
        feature,
      }),
    ).toBe('jexlFeature')
    expect(
      stringToJexlExpression(
        `jexl:feature|getData('end') - feature|getData('start') == 8`,
      ).evalSync({ feature }),
    ).toBe(true)
  })
})
