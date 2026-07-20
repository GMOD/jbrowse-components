import BaseResult from '../../TextSearch/BaseResults.ts'
import {
  cap,
  coerceToResult,
  getDeduplicatedResult,
  getFiltered,
  getInputWidth,
  getOptionLabel,
} from './util.ts'

const opt = (label: string) => ({ result: new BaseResult({ label }) })

describe('cap', () => {
  it('leaves a short list untouched', () => {
    const options = [opt('a'), opt('b')]
    expect(cap(options)).toBe(options)
  })

  it('truncates and appends a single disabled limit row past the cap', () => {
    const options = Array.from({ length: 150 }, (_, i) => opt(`ref${i}`))
    const capped = cap(options)

    expect(capped).toHaveLength(101)
    const last = capped.at(-1)!
    expect(last.isLimit).toBe(true)
    expect(last.result.getLabel()).toBe('keep typing for more results')
    expect(capped.slice(0, 100).every(o => !o.isLimit)).toBe(true)
  })
})

describe('getFiltered', () => {
  it('matches case-insensitively on a substring of the label', () => {
    const options = [opt('chr1'), opt('chr2'), opt('ctgA')]
    expect(getFiltered(options, 'CHR').map(getOptionLabel)).toEqual([
      'chr1',
      'chr2',
    ])
  })

  it('still applies the cap to the filtered subset', () => {
    const options = Array.from({ length: 150 }, (_, i) => opt(`chr${i}`))
    expect(getFiltered(options, 'chr').at(-1)!.isLimit).toBe(true)
  })
})

describe('getDeduplicatedResult', () => {
  it('keeps a unique hit as a plain option', () => {
    const [option] = getDeduplicatedResult([
      new BaseResult({ label: 'chr1', displayString: 'chr1:1..100' }),
    ])

    expect(option!.result.results).toBeUndefined()
    expect(option!.result.getDisplayString()).toBe('chr1:1..100')
  })

  it('collapses hits sharing a display string into one multi-result option', () => {
    const dupes = [
      new BaseResult({ label: 'BRCA', displayString: 'chr1:1..100' }),
      new BaseResult({ label: 'BRCA', displayString: 'chr1:1..100' }),
    ]
    const result = getDeduplicatedResult(dupes)

    expect(result).toHaveLength(1)
    expect(result[0]!.result.results).toHaveLength(2)
    expect(result[0]!.result.getLabel()).toBe('chr1:1..100')
  })

  it('preserves distinct display strings as separate options', () => {
    const result = getDeduplicatedResult([
      new BaseResult({ label: 'a', displayString: 'chr1:1..100' }),
      new BaseResult({ label: 'b', displayString: 'chr2:1..100' }),
    ])
    expect(result).toHaveLength(2)
  })
})

describe('coerceToResult', () => {
  it('wraps a raw freeSolo string into a BaseResult', () => {
    expect(coerceToResult('chr1:1-100').getLabel()).toBe('chr1:1-100')
  })

  it('unwraps a selected option to its result', () => {
    const option = opt('chr1')
    expect(coerceToResult(option)).toBe(option.result)
  })
})

describe('getOptionLabel', () => {
  it('returns a raw string as-is', () => {
    expect(getOptionLabel('chr1')).toBe('chr1')
  })

  it('uses the display string of an option', () => {
    expect(
      getOptionLabel({
        result: new BaseResult({ label: 'chr1', displayString: 'chr1:1..100' }),
      }),
    ).toBe('chr1:1..100')
  })
})

describe('getInputWidth', () => {
  it('clamps an empty value up to minWidth', () => {
    expect(getInputWidth('', 200, 550)).toBe(200)
  })

  it('clamps a very long value down to maxWidth', () => {
    expect(getInputWidth('x'.repeat(500), 200, 550)).toBe(550)
  })

  it('grows with the measured text between the bounds', () => {
    const short = getInputWidth('chr1', 50, 550)
    const long = getInputWidth('chr1:1,000,000..2,000,000', 50, 550)
    expect(long).toBeGreaterThan(short)
    expect(long).toBeLessThanOrEqual(550)
  })

  it('quantizes so a small length change does not reflow the box', () => {
    // crossing 99,999 -> 100,000 grows the string by a digit+comma (~8px) but
    // both land in the same step, which is what stops the header jittering as
    // the user pans/zooms
    expect(getInputWidth('chr1:1..99,999', 50, 550)).toBe(
      getInputWidth('chr1:1..100,000', 50, 550),
    )
  })

  it('returns a multiple of the quantization step between the bounds', () => {
    expect(getInputWidth('chr1:1..2,000,000', 50, 550) % 30).toBe(0)
  })

  it('reserves less width when the adornment is smaller', () => {
    const withHelp = getInputWidth('chr1:1..2,000,000', 50, 550, 100)
    const withoutHelp = getInputWidth('chr1:1..2,000,000', 50, 550, 70)
    expect(withoutHelp).toBeLessThan(withHelp)
  })
})
