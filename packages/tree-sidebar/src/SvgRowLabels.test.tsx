import { render } from '@testing-library/react'

import { SvgRowLabels } from './SvgRowLabels.tsx'
import { rowLabelsBoxWidth } from './rowLabelsBoxWidth.ts'

const ROW_LABEL_MAX_TEXT_WIDTH = 120

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
    const tint = [...c.querySelectorAll('rect')].find(
      r => r.getAttribute('fill') === dog,
    )
    expect(tint?.getAttribute('height')).toBe('16')
    expect(tint?.getAttribute('y')).toBe('2')
    expect(c.querySelector('text')?.textContent).toBe('Collie 1')
  })

  it('boxes each label one line tall, centered in a tall row, with no separator', () => {
    const sources = [{ name: 'a' }, { name: 'b' }]
    const c = draw({ sources, rowHeight: 40, labelOffset: 0, backdrop: 'wash' })
    const w = rowLabelsBoxWidth(sources, 40)
    expect(c.querySelector('path')?.getAttribute('d')).toBe(
      `M0 12h${w}v16h${-w}zM0 52h${w}v16h${-w}z`,
    )
    expect(c.querySelectorAll('rect')).toHaveLength(0)
  })

  it('abuts the boxes of rows no taller than a line, with a separator between them', () => {
    const sources = [{ name: 'a' }, { name: 'b' }, { name: 'c' }]
    const c = draw({ sources, rowHeight: 12, labelOffset: 0, backdrop: 'wash' })
    const w = rowLabelsBoxWidth(sources, 12)
    expect(c.querySelector('path')?.getAttribute('d')).toBe(
      [0, 12, 24].map(y => `M0 ${y}h${w}v12h${-w}z`).join(''),
    )
    const paths = [...c.querySelectorAll('path')].map(p => p.getAttribute('d'))
    expect(paths).toContain(`M0 12h${w}v1h${-w}zM0 24h${w}v1h${-w}z`)
    expect(c.querySelectorAll('rect')).toHaveLength(0)
  })

  it('draws no box without a backdrop, as the export beside its plot does', () => {
    const sources = [{ name: 'a' }, { name: 'b' }]
    const bare = draw({ sources, rowHeight: 40, labelOffset: 0 })
    expect(bare.querySelectorAll('path')).toHaveLength(0)
    expect(bare.querySelectorAll('text')).toHaveLength(2)
    const paper = draw({
      sources,
      rowHeight: 40,
      labelOffset: 0,
      backdrop: 'paper',
    })
    expect(paper.querySelectorAll('path')).toHaveLength(1)
    const wash = draw({
      sources,
      rowHeight: 40,
      labelOffset: 0,
      backdrop: 'wash',
    })
    expect(wash.querySelectorAll('path')).toHaveLength(2)
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

  it('cuts a label past the cap with an ellipsis, whole in its title, and stops the strip at the cap', () => {
    const long = 'protein_coding_primary_transcript_variant_1'
    const sources = [{ name: 'a' }, { name: long }]
    const c = draw({ sources, rowHeight: 20, labelOffset: 0, backdrop: 'wash' })
    const texts = [...c.querySelectorAll('text')]
    expect(texts[0]?.textContent).toBe('a')
    expect(texts[0]?.querySelector('title')).toBeNull()
    expect(texts[1]?.querySelector('title')?.textContent).toBe(long)
    expect(texts[1]?.lastChild?.textContent).toMatch(/^protein_coding.*…$/)
    expect(rowLabelsBoxWidth(sources, 20)).toBe(ROW_LABEL_MAX_TEXT_WIDTH + 10)
    expect(c.querySelector('path')?.getAttribute('d')).toContain(
      `h${ROW_LABEL_MAX_TEXT_WIDTH + 10}`,
    )
  })
})
