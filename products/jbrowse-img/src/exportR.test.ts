import { wantsRScript } from './options.ts'
import { warnLinearOnlyOptions } from './renderRegion.ts'

describe('wantsRScript', () => {
  test('selects the R emitter by extension, case-insensitively', () => {
    expect(wantsRScript('fig.R')).toBe(true)
    expect(wantsRScript('fig.r')).toBe(true)
    expect(wantsRScript('/tmp/some.dir/out.R')).toBe(true)
  })

  test('leaves every image extension alone', () => {
    for (const out of ['out.svg', 'out.png', 'out.pdf', 'out.jpg']) {
      expect(wantsRScript(out)).toBe(false)
    }
  })

  // No --out means "write to stdout", which is the SVG path.
  test('is false when --out is absent', () => {
    expect(wantsRScript(undefined)).toBe(false)
  })

  // ".r" has to be the extension, not merely the last letter.
  test('does not match a name that merely ends in r', () => {
    expect(wantsRScript('contour')).toBe(false)
    expect(wantsRScript('out.svgr')).toBe(false)
  })
})

describe('R export is linear-only', () => {
  // The failure this prevents is silent: without the throw, a comparative run
  // falls through to renderToSvg and writes SVG markup into a file named .R,
  // which only fails later, in R, as a syntax error in "your" script.
  test.each(['dotplot', 'synteny', 'circular'] as const)(
    'a %s view rejects --out *.R',
    mode => {
      expect(() => {
        warnLinearOnlyOptions(mode, { emitR: true })
      }).toThrow(/no R export/)
    },
  )

  test('a linear view accepts it', () => {
    expect(() => {
      warnLinearOnlyOptions('linear', { emitR: true })
    }).not.toThrow()
  })

  // The pre-existing warnings must still fire, and must not be upgraded to
  // throws by the branch above.
  test('still only warns about the linear-only flags', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(() => {
      warnLinearOnlyOptions('circular', { refseq: true })
    }).not.toThrow()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('--refseq'))
    warn.mockRestore()
  })
})
