import { render } from '@testing-library/react'

import RecombinationTrack from './RecombinationTrack.tsx'

// The model lays the points out (`recombinationCoords`); at bpPerPx 1 over a
// 0..1000 region an x in px reads as a bp coordinate, which is what keeps the
// spacing arithmetic below legible.
function paths(values: number[], positions: number[]) {
  const { container } = render(
    <RecombinationTrack
      points={positions.map((x, i) => ({ x, value: values[i]! }))}
      maxValue={0.5}
      width={1000}
      height={50}
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
    const { line, area } = paths(
      positions.map(() => 0.5),
      positions,
    )
    expect(runCount(line)).toBe(1)
    expect(runCount(area)).toBe(1)
  })

  // 30 points at a 10bp pitch, a 1000bp hole, then 10 more. Mean spacing works
  // out at (290 + 1000 + 90) / 39 = 35bp, so the limit is ~708 and only the hole
  // clears it.
  test('a hole far past the typical spacing breaks the line instead of drawing a chord', () => {
    const positions = [
      ...Array.from({ length: 30 }, (_, i) => i * 10),
      ...Array.from({ length: 10 }, (_, i) => 1290 + i * 10),
    ]
    const { line, area } = paths(
      positions.map(() => 0.5),
      positions,
    )
    expect(runCount(line)).toBe(2)
    // the fill closes per run too, so it doesn't sweep under the hole
    expect(runCount(area)).toBe(2)
    // no segment spans the hole: the run ends at 290 and the next one *starts*
    // (moveTo, not lineTo) at 1290
    expect(line).not.toContain('L 290.0 5.0 L 1290.0')
    expect(line).toContain('L 290.0 5.0 M 1290.0')
  })

  // A hole inflates the mean it is measured against, so with few points it can
  // never clear the threshold. That is the safe direction on purpose: a series
  // too short to have a typical spacing has nothing to call unusual, and a
  // wrongly-broken curve destroys data the reader can see nowhere else.
  test('a lone hole among few points does not break', () => {
    const positions = [0, 10, 20, 30, 40, 2500, 2510, 2520, 2530, 2540]
    expect(
      runCount(
        paths(
          positions.map(() => 0.5),
          positions,
        ).line,
      ),
    ).toBe(1)
  })

  // Long runs of unmeasured (NaN) pairs are the way a thresholded pre-computed
  // LD file expresses a hole; a couple in a row is still jitter to span.
  test('a long NaN run breaks, a short one does not', () => {
    const positions = Array.from({ length: 100 }, (_, i) => i * 10)

    const short = positions.map(() => 0.5)
    short[5] = Number.NaN
    expect(runCount(paths(short, positions).line)).toBe(1)

    // 60 skipped pairs leaves a 610bp hole against a ~25bp mean plotted spacing
    const long = positions.map(() => 0.5)
    for (let i = 20; i < 80; i++) {
      long[i] = Number.NaN
    }
    expect(runCount(paths(long, positions).line)).toBe(2)
  })

  test('too few measured points renders nothing', () => {
    const { container } = render(
      <RecombinationTrack
        points={[{ x: 0, value: 0.5 }]}
        maxValue={0.5}
        width={1000}
        height={50}
      />,
    )
    expect(container.querySelectorAll('path')).toHaveLength(0)
  })

  // An off-screen locus arrives as a NaN x (the model couldn't place it) and is
  // skipped like an unmeasured value, rather than collapsing the curve onto 0.
  test('a non-finite x is skipped', () => {
    const positions = Array.from({ length: 10 }, (_, i) => i * 10)
    const xs = [...positions]
    xs[5] = Number.NaN
    const { container } = render(
      <RecombinationTrack
        points={xs.map(x => ({ x, value: 0.5 }))}
        maxValue={0.5}
        width={1000}
        height={50}
      />,
    )
    const line = container.querySelectorAll('path')[1]!.getAttribute('d')!
    expect(line).not.toContain('NaN')
    expect(line.split('L').length - 1).toBe(9)
  })
})
