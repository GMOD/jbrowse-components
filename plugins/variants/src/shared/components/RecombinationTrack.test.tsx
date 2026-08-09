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

// RECOMBINATION_GAP_MULTIPLE is 0, so the curve never breaks on a gap: one
// connected run across every hole, which is what review asked for ("i dont think
// i like it now ... going back to not skipping"). These tests pin that, and they
// are also the tests that flip back if the constant is ever restored — the
// arithmetic in each comment is what it was calibrated against, so a re-enable
// has the cases already written.
describe('RecombinationTrack, one run across every hole', () => {
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
  // out at (290 + 1000 + 90) / 39 = 35bp, so at the calibrated multiple of 20
  // the limit was ~708 and this hole was the one case that cleared it. At 0 it
  // is drawn as a chord like any other span.
  test('a hole far past the typical spacing is bridged, not broken', () => {
    const positions = [
      ...Array.from({ length: 30 }, (_, i) => i * 10),
      ...Array.from({ length: 10 }, (_, i) => 1290 + i * 10),
    ]
    const { line, area } = paths(
      positions.map(() => 0.5),
      positions,
    )
    expect(runCount(line)).toBe(1)
    expect(runCount(area)).toBe(1)
    // the chord itself: a lineTo across the hole rather than a moveTo
    expect(line).toContain('L 290.0 5.0 L 1290.0')
  })

  // A hole inflates the mean it is measured against, so with few points it could
  // never clear the threshold even when breaking was on. Kept because it is the
  // case that behaves the same either way.
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

  // Unmeasured (NaN) pairs are still SKIPPED — that is a separate rule from gap
  // breaking and it stays: plotting a NaN would draw a spurious spike. What has
  // changed is that the hole they leave is now spanned however long it is, so a
  // 60-pair run (610bp against a ~25bp mean plotted spacing) is one run.
  test('a NaN run leaves a hole that is spanned, short or long', () => {
    const positions = Array.from({ length: 100 }, (_, i) => i * 10)

    const short = positions.map(() => 0.5)
    short[5] = Number.NaN
    expect(runCount(paths(short, positions).line)).toBe(1)

    const long = positions.map(() => 0.5)
    for (let i = 20; i < 80; i++) {
      long[i] = Number.NaN
    }
    expect(runCount(paths(long, positions).line)).toBe(1)
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
