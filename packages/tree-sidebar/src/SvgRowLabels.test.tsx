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
    // floored at a pixel so the mark survives; y stays exact
    expect(Number(rect?.getAttribute('height'))).toBe(1)
    expect(rect?.getAttribute('y')).toBe('0')
  })

  it('keeps a sub-pixel mark on its own row rather than shifting it', () => {
    const c = draw({
      sources: [{ name: 'a' }, { name: 'b' }, { name: 'c', labelColor: wolf }],
      rowHeight: 0.32,
      labelOffset: 0,
    })
    const rect = c.querySelector('rect')
    // third row: y = 2 * 0.32, exact, even though the rect is floored to 1px
    expect(Number(rect?.getAttribute('y'))).toBeCloseTo(0.64)
    expect(Number(rect?.getAttribute('height'))).toBe(1)
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

  it('paints a rare mark last so a common run cannot bury it', () => {
    // one wolf row sandwiched in a long village-dog block: floored to a pixel,
    // whichever paints later wins the overlap, and it must be the single row
    const sources = [
      ...Array.from({ length: 20 }, (_, i) => ({
        name: `village${i}`,
        labelColor: dog,
      })),
      { name: 'wolf', labelColor: wolf },
      ...Array.from({ length: 20 }, (_, i) => ({
        name: `village${i + 20}`,
        labelColor: dog,
      })),
    ]
    const rects = [
      ...draw({ sources, rowHeight: 0.32, labelOffset: 0 }).querySelectorAll(
        'rect',
      ),
    ]
    expect(rects.at(-1)?.getAttribute('fill')).toBe(wolf)
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
