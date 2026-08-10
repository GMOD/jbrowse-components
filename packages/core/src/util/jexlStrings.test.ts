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

  describe('split is total', () => {
    // Regression: `split` was `(s, char) => s.split(char)`, so an absent value
    // threw a TypeError out of a config callback. It reaches one function
    // argument in every nested use, because the inner call supplies the outer
    // one's input — see the note at the registration.
    const evalSplit = (expr: string, ctx: Record<string, unknown> = {}) =>
      stringToJexlExpression(`jexl:${expr}`, jexl).eval(ctx)

    it('splits a string as before', () => {
      expect(evalSplit("split('KITTY KITTY', ' ')")).toEqual(['KITTY', 'KITTY'])
    })

    it('reads an absent value as the empty string', () => {
      // the same answer `split('', ' ')` has always given, rather than [] — so
      // absent and empty stay indistinguishable to a caller indexing the result
      expect(evalSplit('split(nope, " ")')).toEqual([''])
      expect(evalSplit('split(nul, " ")', { nul: null })).toEqual([''])
      expect(evalSplit("split('', ' ')")).toEqual([''])
    })

    it('coerces a non-string rather than throwing', () => {
      expect(evalSplit('split(n, ".")', { n: 1.5 })).toEqual(['1', '5'])
    })

    it('survives the nested form the jexl catalog documents', () => {
      // `bigRmskBed` carries the repeat class as a suffix on the name, and this
      // is LinearMultiRowFeatureDisplay's documented partitionField recipe. The
      // second case is the one that used to take out the whole display.
      const recipe = "split(split(feature.name,'#')[1],'/')[0]"
      expect(
        evalSplit(recipe, { feature: { name: 'META1_LTR#LTR/Copia' } }),
      ).toBe('LTR')
      expect(evalSplit(recipe, { feature: { name: 'no-hash-here' } })).toBe('')
    })
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
