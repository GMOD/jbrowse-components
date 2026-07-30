import { render } from '@testing-library/react'

import { SvgRowLabels } from './SvgRowLabels.tsx'

function draw(props: Parameters<typeof SvgRowLabels>[0]) {
  const { container } = render(
    <svg>
      <SvgRowLabels {...props} />
    </svg>,
  )
  return container
}

const wolf = '#67001f'
const dog = '#f4a582'

describe('SvgRowLabels', () => {
  it('draws a label box and its text when the row fits text', () => {
    const c = draw({
      sources: [{ name: 'COLL000001', label: 'Collie 1', labelColor: dog }],
      rowHeight: 20,
      labelOffset: 0,
    })
    expect(c.querySelectorAll('rect')).toHaveLength(1)
    expect(c.querySelector('text')?.textContent).toBe('Collie 1')
  })

  it('draws a narrow color swatch, and no text, below the text threshold', () => {
    const c = draw({
      sources: [{ name: 'a', label: 'Collie 1', labelColor: dog }],
      rowHeight: 0.32,
      labelOffset: 0,
    })
    expect(c.querySelectorAll('text')).toHaveLength(0)
    const rect = c.querySelector('rect')
    // narrow enough to be a stripe rather than the text-width box
    expect(Number(rect?.getAttribute('width'))).toBeLessThan(10)
    expect(Number(rect?.getAttribute('height'))).toBeCloseTo(0.32)
  })

  it('draws nothing below the threshold when no row carries a color', () => {
    const c = draw({
      sources: [{ name: 'a' }, { name: 'b' }],
      rowHeight: 0.32,
      labelOffset: 0,
    })
    expect(c.querySelectorAll('rect')).toHaveLength(0)
  })

  it('merges consecutive same-color rows into one rect spanning them', () => {
    const c = draw({
      sources: [
        { name: 'a', labelColor: dog },
        { name: 'b', labelColor: dog },
        { name: 'c', labelColor: dog },
        { name: 'd', labelColor: wolf },
      ],
      rowHeight: 2,
      labelOffset: 0,
    })
    const rects = [...c.querySelectorAll('rect')]
    expect(rects).toHaveLength(2)
    expect(rects[0]!.getAttribute('y')).toBe('0')
    expect(Number(rects[0]!.getAttribute('height'))).toBe(6)
    expect(rects[1]!.getAttribute('y')).toBe('6')
    expect(Number(rects[1]!.getAttribute('height'))).toBe(2)
  })

  it('does not bridge a run across an uncolored row', () => {
    const c = draw({
      sources: [
        { name: 'a', labelColor: dog },
        { name: 'b' },
        { name: 'c', labelColor: dog },
      ],
      rowHeight: 2,
      labelOffset: 0,
    })
    const rects = [...c.querySelectorAll('rect')]
    expect(rects).toHaveLength(2)
    expect(rects[0]!.getAttribute('y')).toBe('0')
    expect(rects[1]!.getAttribute('y')).toBe('4')
  })

  it('culls swatch runs outside the available height', () => {
    const c = draw({
      sources: [
        { name: 'onscreen', labelColor: dog },
        { name: 'offscreen', labelColor: wolf },
      ],
      rowHeight: 4,
      labelOffset: 0,
      scrollTop: 0,
      // the second run starts at y=4, past this, so it is culled; a run starting
      // exactly on the bottom edge is kept, same as the text path
      availableHeight: 2,
    })
    expect(c.querySelectorAll('rect')).toHaveLength(1)
  })
})
