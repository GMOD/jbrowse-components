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
            ticks: [],
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
            ticks: [
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

  it('uses numeric value as key for ticks', () => {
    const { container } = render(
      <svg>
        <YScaleBar
          ticks={{
            ticks: [
              { value: 0, y: 40, label: '0' },
              { value: 10, y: 30, label: '10' },
            ],
            yTop: 0,
            yBottom: 40,
          }}
          orientation="left"
        />
      </svg>,
    )
    const lines = container.querySelectorAll('line')
    expect(lines.length).toBeGreaterThanOrEqual(2)
  })
})
