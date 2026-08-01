import createJexlInstance from './jexl.ts'
import { stringToJexlExpression } from './jexlStrings.ts'
import SimpleFeature from './simpleFeature.ts'

const jexl = createJexlInstance()

describe('function string parsing', () => {
  it('can detect a jexl expression', () => {
    const str = 'jexl:a+b+c+5'
    expect(str.startsWith('jexl:')).toBeTruthy()
  })
  it('can create a jexl expression', () => {
    const str = 'jexl:a+b+c+5'
    const expr = stringToJexlExpression(str, jexl)
    expect(expr._exprStr).toEqual('a+b+c+5')
  })
  it('can create a jexl expression 2', () => {
    const str = 'jexl:\na+b+c+5'
    const expr = stringToJexlExpression(str, jexl)
    expect(expr._exprStr).toEqual('\na+b+c+5')
    const result = expr.eval({ a: 5, b: 10, c: 15 })
    expect(result).toEqual(35)
  })
  it('startsWith is registered and works', async () => {
    // Regression: startsWith was registered twice; the second registration
    // silently overwrote the first, but both were identical so it still worked.
    // This test ensures the function exists and behaves correctly.
    const expr = stringToJexlExpression('jexl:startsWith("hello", "hel")', jexl)
    expect(await expr.eval({})).toBe(true)
    const expr2 = stringToJexlExpression(
      'jexl:startsWith("hello", "world")',
      jexl,
    )
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
      stringToJexlExpression(`jexl:get(feature,'score')`, jexl).eval({
        feature,
      }),
    ).toEqual(10)
    expect(
      stringToJexlExpression(`jexl:get(feature,'uniqueId')`, jexl).eval({
        feature,
      }),
    ).toBe('jexlFeature')
    expect(
      stringToJexlExpression(
        `jexl:get(feature,'end') - get(feature,'start') == 8`,
        jexl,
      ).eval({ feature }),
    ).toBe(true)
  })
})

// A config `jexl:` string can only hand these a string, and a color slot can
// only use a string back — so the published catalog examples must round-trip
// through parseCssColor, not through a Colord object the config cannot make.
describe('color functions', () => {
  const evaluate = (str: string) =>
    stringToJexlExpression(str, jexl).eval({}) as string

  // alpha is stored as one of 256 steps, so 0.5 comes back as 128/255
  it.each([
    [`jexl:alpha('green', 0.5)`, 'rgba(0, 128, 0, 0.502)'],
    [`jexl:hsl('#ff0000')`, 'hsl(0, 100%, 50%)'],
    [`jexl:colorString('green')`, '#008000'],
  ])('%s evaluates to a usable color string', (expr, expected) => {
    expect(evaluate(expr)).toBe(expected)
  })

  it('composes, because every color in and out is a string', () => {
    expect(evaluate(`jexl:colorString(hsl('#ff0000'))`)).toBe('#ff0000')
    expect(evaluate(`jexl:alpha(colorString('green'), 0.25)`)).toBe(
      'rgba(0, 128, 0, 0.251)',
    )
  })
})
