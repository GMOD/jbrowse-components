import { makeWigglePreProcessSnapshot } from './makeWigglePreProcessSnapshot.ts'

describe('makeWigglePreProcessSnapshot', () => {
  test('passes through null/undefined unchanged', () => {
    const preProcess = makeWigglePreProcessSnapshot()
    expect(preProcess(null)).toBe(null)
    expect(preProcess(undefined)).toBe(undefined)
  })

  test('strips legacy blockState/showLegend/showTooltips fields', () => {
    const preProcess = makeWigglePreProcessSnapshot()
    const result = preProcess({
      type: 'LinearWiggleDisplay',
      blockState: { a: 1 },
      showLegend: true,
      showTooltips: false,
      scale: 'log',
    })
    expect(result).toEqual({ type: 'LinearWiggleDisplay', scaleType: 'log' })
  })

  test('forwards multiWiggle opt to migration', () => {
    const preProcess = makeWigglePreProcessSnapshot({ multiWiggle: true })
    expect(preProcess({ rendererTypeNameState: 'xyplot' })).toEqual({
      defaultRendering: 'multixyplot',
    })
  })
})
