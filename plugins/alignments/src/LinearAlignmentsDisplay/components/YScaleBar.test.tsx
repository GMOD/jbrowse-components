import { render } from '@testing-library/react'
import YScaleBar from './YScaleBar'

describe('YScaleBar', () => {
  it('returns null when ticks is undefined', () => {
    const { container } = render(
      <YScaleBar ticks={undefined} orientation="left" />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders blank scale bar with empty ticks', () => {
    const { container } = render(
      <YScaleBar
        ticks={{
          ticks: [],
          yTop: 0,
          yBottom: 45,
        }}
        orientation="left"
      />,
    )
    // Should render the axis line even with empty ticks
    expect(container.querySelector('g')).toBeInTheDocument()
    expect(container.querySelector('path')).toBeInTheDocument()
  })

  it('renders tick marks for valid ticks', () => {
    const { container } = render(
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
      />,
    )
    // Should render axis line plus one group per tick
    const groups = container.querySelectorAll('g')
    expect(groups.length).toBeGreaterThanOrEqual(3) // axis group + tick groups
  })

  it('uses numeric value as key for ticks', () => {
    const { container } = render(
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
      />,
    )
    // Both ticks should render without React key warnings
    const lines = container.querySelectorAll('line')
    expect(lines.length).toBeGreaterThanOrEqual(2)
  })
})
