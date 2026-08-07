import { render } from '@testing-library/react'

import YScaleBar from './YScaleBar.tsx'

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
})
