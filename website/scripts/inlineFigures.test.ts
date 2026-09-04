import { spliceInlineFigures } from './inlineFigures.ts'
import { parseMeasurement } from './measurements.ts'

const records = new Map([
  [
    'demo',
    parseMeasurement(
      'demo',
      JSON.stringify({
        id: 'demo',
        measured: '2026-09-04',
        source: { kind: 'hand', repro: 'node bench.ts' },
        columns: [
          { key: 'case', label: 'case' },
          { key: 'peak', label: 'peak', format: 'MB' },
        ],
        rows: [{ values: { case: 'a', peak: 1.4 } }],
      }),
    ),
  ],
])

const splice = (text: string) => spliceInlineFigures(text, records)

describe('splicing a figure in front of its marker', () => {
  it('refreshes the value and leaves the marker alone', () => {
    const { text, problems, count } = splice(
      'peaks at 9MB<!--m:demo.a.peak-->.',
    )
    expect(text).toBe('peaks at 1.4MB<!--m:demo.a.peak-->.')
    expect({ problems, count }).toEqual({ problems: [], count: 1 })
  })

  // `[^\s<]*` rather than `\S+`, so punctuation touching the figure survives
  // the rewrite instead of being eaten by it.
  it('keeps a bracket or a backtick sitting against the figure', () => {
    expect(splice('(`9MB<!--m:demo.a.peak-->`)').text).toBe(
      '(`1.4MB<!--m:demo.a.peak-->`)',
    )
  })

  it('reports a reference that resolves to nothing', () => {
    const { problems, text } = splice('9MB<!--m:demo.a.nope-->')
    expect(problems).toEqual([expect.stringMatching(/has no column "nope"/)])
    expect(text).toBe('9MB<!--m:demo.a.nope-->')
  })

  it('reports a marker with no figure in front of it', () => {
    const { problems, count } = splice('the peak <!--m:demo.a.peak--> is fine')
    expect(problems).toEqual([
      expect.stringMatching(/has no figure in front of it/),
    ])
    expect(count).toBe(0)
  })

  // The one that was silent in both directions: `1.4 MB` is not the value the
  // marker resolves to, so nothing matched it as a figure and nothing flagged
  // it as a marker standing on its own either.
  it('reports a value with a space inside it', () => {
    const { problems, text } = splice('peaks at 1.4 MB<!--m:demo.a.peak-->.')
    expect(problems).toEqual([
      expect.stringMatching(/follows "MB", which is not a figure/),
    ])
    expect(text).toBe('peaks at 1.4 MB<!--m:demo.a.peak-->.')
  })

  it('gives a second marker no claim on the first value', () => {
    const { problems } = splice('9MB<!--m:demo.a.peak--><!--m:demo.a.peak-->')
    expect(problems).toEqual([
      expect.stringMatching(/has no figure in front of it/),
    ])
  })

  it('judges a marker whose reference is malformed', () => {
    expect(splice('9MB<!--m:demo.a-->').problems).toEqual([
      expect.stringMatching(/is not <id>/),
    ])
  })

  it('passes text with no marker through untouched', () => {
    const text = 'peaks at 1.4 MB, measured twice.'
    expect(splice(text)).toEqual({ text, problems: [], count: 0 })
  })
})
