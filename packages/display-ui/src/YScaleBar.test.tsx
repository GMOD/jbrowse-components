import { render } from '@testing-library/react'

import YScaleBar from './YScaleBar.tsx'
import { AXIS_GUTTER_WIDTH_PX, leftAxisSpineX } from './yScaleTicks.ts'

describe('YScaleBar', () => {
  it('returns null when ticks is undefined', () => {
    const { container } = render(
      <svg>
        <YScaleBar ticks={undefined} orientation="left" />
      </svg>,
    )
    expect(container.querySelector('g')).toBeNull()
  })

  it('renders blank scale bar with empty ticks', () => {
    const { container } = render(
      <svg>
        <YScaleBar
          ticks={{
            items: [],
            yTop: 0,
            yBottom: 45,
          }}
          orientation="left"
        />
      </svg>,
    )
    expect(container.querySelector('g')).toBeTruthy()
    expect(container.querySelector('path')).toBeTruthy()
  })

  it('renders tick marks for valid ticks', () => {
    const { container } = render(
      <svg>
        <YScaleBar
          ticks={{
            items: [
              { value: 0, y: 40, label: '0' },
              { value: 100, y: 20, label: '100' },
              { value: 200, y: 0, label: '200' },
            ],
            yTop: 0,
            yBottom: 40,
          }}
          orientation="left"
        />
      </svg>,
    )
    const groups = container.querySelectorAll('g')
    expect(groups.length).toBeGreaterThanOrEqual(3)
  })

  // Two ticks can share a `value` at different `y` — computeCoverageTicks
  // emitted exactly that at maxDepth 1, which is why the key is composite. The
  // old version of this test rendered two ticks with distinct values AND
  // distinct y, then counted <line> elements, so it passed against the colliding
  // key it was written to guard.
  it('renders both of two ticks sharing a value, without a duplicate key', () => {
    const errors: unknown[][] = []
    const spy = jest
      .spyOn(console, 'error')
      .mockImplementation((...args: unknown[]) => {
        errors.push(args)
      })
    try {
      const { container } = render(
        <svg>
          <YScaleBar
            ticks={{
              items: [
                { value: 1, y: 40, label: '1' },
                { value: 1, y: 10, label: '1' },
              ],
              yTop: 0,
              yBottom: 40,
            }}
            orientation="left"
          />
        </svg>,
      )
      expect(container.querySelectorAll('line')).toHaveLength(2)
      expect(String(errors)).not.toMatch(/same key|duplicate/i)
    } finally {
      spy.mockRestore()
    }
  })

  // The drawing half of the axis/renderer contract: the value mapping puts
  // domain-min at yBottom, and the stroke marking it goes on the last pixel
  // inside the box rather than the first one below — which in multi-wiggle,
  // where rows stack edge to edge, belongs to the next sample.
  it('keeps the bottom tick and the spine inside the box', () => {
    const { container } = render(
      <svg>
        <YScaleBar
          ticks={{
            items: [
              { value: 0, y: 40, label: '0' },
              { value: 100, y: 0, label: '100' },
            ],
            yTop: 0,
            yBottom: 40,
          }}
          orientation="left"
        />
      </svg>,
    )
    const groups = [...container.querySelectorAll('g[transform]')]
    expect(groups.map(g => g.getAttribute('transform'))).toEqual([
      'translate(0,39.5)',
      'translate(0,0.5)',
    ])
    expect(container.querySelector('path')?.getAttribute('d')).toBe(
      'M-6 0.5H0.5V39.5H-6',
    )
  })

  // Multi-wiggle's case: a full-height axis per row, no inset, so both end
  // labels are centered on a row boundary. Ticks stay put; only the text moves.
  it('insetLabels pulls the end labels inside the box, leaving ticks alone', () => {
    const { container } = render(
      <svg>
        <YScaleBar
          insetLabels
          ticks={{
            items: [
              { value: 0, y: 100, label: '0' },
              { value: 50, y: 50, label: '50' },
              { value: 100, y: 0, label: '100' },
            ],
            yTop: 0,
            yBottom: 100,
          }}
          orientation="left"
        />
      </svg>,
    )
    const groups = [...container.querySelectorAll('g[transform]')]
    expect(groups.map(g => g.getAttribute('transform'))).toEqual([
      'translate(0,99.5)',
      'translate(0,50.5)',
      'translate(0,0.5)',
    ])
    // bottom label up to y=95, top label down to y=5, middle one untouched —
    // and untouched means no `y` at all, so the markup is byte-identical
    // wherever the inset doesn't bite
    expect(groups.map(g => g.querySelector('text')?.getAttribute('y'))).toEqual(
      ['-4.5', null, '4.5'],
    )
  })

  // What `AXIS_GUTTER_WIDTH_PX` / `leftAxisSpineX` are for, checked against the
  // component they compensate for rather than against a transcription of its
  // numbers. A left-oriented axis grows leftward, so a spine at x=0 puts every
  // label at negative x — which is what once put an exported coverage axis off
  // the image. The alignments coverage gutter and the MAF band gutters both go
  // through these.
  it('a left axis at leftAxisSpineX keeps spine and labels inside the gutter', () => {
    const { container } = render(
      <svg>
        <g transform={`translate(${leftAxisSpineX()}, 0)`}>
          <YScaleBar
            ticks={{
              items: [
                { value: 0, y: 40, label: '0' },
                { value: 100, y: 0, label: '100' },
              ],
              yTop: 0,
              yBottom: 40,
            }}
            orientation="left"
          />
        </g>
      </svg>,
    )
    const originX = leftAxisSpineX()
    // the spine's own stroke and the tick marks reaching back from it: M and H
    // carry the xs (V is the spine's y), and all of them land in the gutter
    const d = container.querySelector('path')!.getAttribute('d')!
    const spineXs = [...d.matchAll(/[MH](-?[\d.]+)/g)].map(m => Number(m[1]!))
    expect(spineXs).not.toHaveLength(0)
    for (const localX of spineXs) {
      expect(originX + localX).toBeGreaterThan(0)
      expect(originX + localX).toBeLessThanOrEqual(AXIS_GUTTER_WIDTH_PX)
    }
    // every label anchor sits inside the gutter, with room left for the text
    // itself — the labels are `textAnchor: end`, so they extend leftward from
    // their x and it is the *left* margin that has to be positive
    const labelXs = [...container.querySelectorAll('text')].map(
      t => originX + Number(t.getAttribute('x')),
    )
    expect(labelXs).not.toHaveLength(0)
    for (const x of labelXs) {
      expect(x).toBeGreaterThan(0)
      expect(x).toBeLessThan(AXIS_GUTTER_WIDTH_PX)
    }
  })

  it('leaves labels centered on their ticks without insetLabels', () => {
    const { container } = render(
      <svg>
        <YScaleBar
          ticks={{
            items: [
              { value: 0, y: 100, label: '0' },
              { value: 100, y: 0, label: '100' },
            ],
            yTop: 0,
            yBottom: 100,
          }}
          orientation="left"
        />
      </svg>,
    )
    expect(
      [...container.querySelectorAll('text')].map(t => t.getAttribute('y')),
    ).toEqual([null, null])
  })
})
