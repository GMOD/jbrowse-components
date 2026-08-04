import { render } from '@testing-library/react'

import RecombinationTrack from './RecombinationTrack.tsx'

// bpPerPx 1 over a 0..1000 region, so an x in px reads as a bp coordinate and
// the spacing arithmetic below is legible.
const region = { start: 0, end: 1000 }

function paths(values: number[], positions: number[]) {
  const { container } = render(
    <RecombinationTrack
      recombination={{ values: new Float32Array(values), positions }}
      width={1000}
      height={50}
      useGenomicPositions
      region={region}
      bpPerPx={1}
    />,
  )
  const [area, line] = [...container.querySelectorAll('path')].map(
    p => p.getAttribute('d') ?? '',
  )
  return { area: area!, line: line! }
}

// Count of subpaths: one per connected run.
function runCount(d: string) {
  return d.split('M').length - 1
}

describe('RecombinationTrack gap breaks', () => {
  test('evenly spaced points stay one connected run', () => {
    const positions = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90]
    const { line, area } = paths(positions.map(() => 0.5), positions)
    expect(runCount(line)).toBe(1)
    expect(runCount(area)).toBe(1)
  })

  // Mean spacing over the 10 plotted points is (540 - 0) / 9 = 60, so the
  // default 5x multiple puts the limit at 300. The 10bp steps inside each
  // cluster are far under it; the 460bp jump between them is not.
  test('a hole far past the typical spacing breaks the line instead of drawing a chord', () => {
    const positions = [0, 10, 20, 30, 40, 500, 510, 520, 530, 540]
    const { line, area } = paths(positions.map(() => 0.5), positions)
    expect(runCount(line)).toBe(2)
    // the fill closes per run too, so it doesn't sweep under the hole
    expect(runCount(area)).toBe(2)
    // no segment spans the hole: the run ends at 40 and the next one *starts*
    // (moveTo, not lineTo) at 500
    expect(line).not.toContain('L 40.0 5.0 L 500.0')
    expect(line).toContain('L 40.0 5.0 M 500.0')
  })

  // Long runs of unmeasured (NaN) pairs are the way a thresholded pre-computed
  // LD file expresses a hole; a couple in a row is still jitter to span.
  test('a long NaN run breaks, a short one does not', () => {
    const positions = Array.from({ length: 40 }, (_, i) => i * 10)
    const short = positions.map(() => 0.5)
    short[5] = Number.NaN
    expect(runCount(paths(short, positions).line)).toBe(1)

    const long = positions.map(() => 0.5)
    for (let i = 5; i < 30; i++) {
      long[i] = Number.NaN
    }
    expect(runCount(paths(long, positions).line)).toBe(2)
  })

  test('too few measured points renders nothing', () => {
    const { container } = render(
      <RecombinationTrack
        recombination={{ values: new Float32Array([0.5]), positions: [0] }}
        width={1000}
        height={50}
      />,
    )
    expect(container.querySelectorAll('path')).toHaveLength(0)
  })
})
