import { markPlot } from './markToPlot.ts'
import { frame, renderPlot } from './rplot.ts'

import type { DisplaySpec } from './markToPlot.ts'

const bigwig = frame({
  name: 'df',
  columns: ['start', 'end', 'score', 'strand', 'row', 'name', 'color'],
  packages: ['rtracklayer'],
  statements: 'df <- read_bigwig(path, chrom, start, end)',
})

function render(display: DisplaySpec, region = { start: 100, end: 200 }) {
  const { plot, notes } = markPlot({ display, frame: bigwig, region })
  return { r: renderPlot('p', plot), notes, plot }
}

describe('a mark becomes a geom', () => {
  it('draws a bar from the origin to the value field', () => {
    const { r } = render({
      marks: [{ mark: 'bar', encoding: { y: 'score', color: 'steelblue' } }],
    })
    expect(r).toContain('aes(xmin = start, xmax = end, ymin = 0, ymax = score)')
    expect(r).toContain('fill = "steelblue"')
  })

  it('moves a bar baseline onto the display origin', () => {
    const { r } = render({
      marks: [{ mark: 'bar', encoding: { y: 'score' } }],
      origin: 5,
    })
    expect(r).toContain('ymin = 5')
  })

  it('stacks a span on its row band', () => {
    const { r } = render({ marks: [{ mark: 'span', encoding: {} }] })
    expect(r).toContain('ymin = row, ymax = row + 0.8')
  })

  it('centres a point between the two edges', () => {
    const { r } = render({
      marks: [{ mark: 'point', encoding: { y: 'score' } }],
    })
    expect(r).toContain('x = (start + end) / 2')
  })

  it('curves a link, arc deeper than dome', () => {
    const dome = render({ marks: [{ mark: 'link', encoding: {} }] })
    const arc = render({
      marks: [{ mark: 'link', linkShape: 'arc', encoding: {} }],
    })
    expect(dome.r).toContain('geom_curve(')
    expect(dome.r).toContain('curvature = -0.3')
    expect(arc.r).toContain('curvature = -0.6')
  })

  it('labels a text mark from its text field', () => {
    const { r } = render({
      marks: [{ mark: 'text', encoding: { text: 'name' } }],
    })
    expect(r).toContain('geom_text(')
    expect(r).toContain('label = name')
  })
})

describe('a channel scale becomes a ggplot scale', () => {
  it('takes a categorical range as scale_fill_manual', () => {
    const { r } = render({
      marks: [
        {
          mark: 'bar',
          encoding: {
            y: 'score',
            color: {
              field: 'strand',
              scale: 'categorical',
              domain: ['1', '-1'],
              range: ['blue', 'red'],
            },
          },
        },
      ],
    })
    expect(r).toContain('fill = strand')
    expect(r).toContain(
      'scale_fill_manual(values = c("1" = "blue", "-1" = "red"))',
    )
  })

  it('reads a ramp through the same LUT the legend indexes', () => {
    const { r } = render({
      marks: [
        {
          mark: 'bar',
          encoding: {
            y: 'score',
            color: { field: 'score', scale: 'linear', scheme: 'magma' },
          },
        },
      ],
    })
    expect(r).toContain('scale_fill_gradientn(colours = c(')
    // hex, not the LUT's own `rgb(r,g,b)`: grDevices rejects CSS notation at
    // draw time, after every read
    expect(r).toMatch(/colours = c\("#[0-9a-f]{6}"/)
  })

  it('logs a log ramp rather than redrawing it linear', () => {
    const { r } = render({
      marks: [
        {
          mark: 'bar',
          encoding: {
            y: 'score',
            color: { field: 'score', scale: 'log', scheme: 'viridis' },
          },
        },
      ],
    })
    expect(r).toContain('trans = "log10"')
  })

  it('cuts a threshold scale at its domain', () => {
    const { r } = render({
      marks: [
        {
          mark: 'point',
          encoding: {
            y: 'score',
            color: {
              field: 'pip',
              scale: 'threshold',
              domain: ['0.1', '0.5'],
              range: ['#357ebd', '#eea236', '#d43f3a'],
            },
          },
        },
      ],
    })
    expect(r).toContain('scale_colour_stepsn(')
    expect(r).toContain('breaks = c(0.1, 0.5)')
  })

  it('passes an identity colour through untouched', () => {
    const { r } = render({
      marks: [
        {
          mark: 'span',
          encoding: { color: { scale: 'identity', value: 'color' } },
        },
      ],
    })
    expect(r).toContain('fill = color')
    expect(r).toContain('scale_fill_identity()')
  })

  it('colours a point through colour and a bar through fill', () => {
    const point = render({
      marks: [{ mark: 'point', encoding: { y: 'score', color: 'red' } }],
    })
    const bar = render({
      marks: [{ mark: 'bar', encoding: { y: 'score', color: 'red' } }],
    })
    expect(point.r).toContain('colour = "red"')
    expect(bar.r).toContain('fill = "red"')
  })
})

describe('the display stages', () => {
  it('pins x to the region so stacked panels line up', () => {
    const { r } = render(
      { marks: [{ mark: 'bar', encoding: { y: 'score' } }] },
      { start: 1000, end: 2000 },
    )
    expect(r).toContain('coord_cartesian(xlim = c(1000, 2000))')
  })

  it('facets on the display facet field', () => {
    const { r } = render({
      marks: [{ mark: 'bar', encoding: { y: 'score' } }],
      facet: { field: 'strand' },
    })
    expect(r).toContain('facet_wrap(~strand, ncol = 1')
  })

  it('takes a log y scale off scales.y', () => {
    const { r } = render({
      marks: [{ mark: 'bar', encoding: { y: 'score' } }],
      scales: { y: { type: 'log' } },
    })
    expect(r).toContain('scale_y_log10()')
  })

  it('pins a declared y domain', () => {
    const { r } = render({
      marks: [{ mark: 'bar', encoding: { y: 'score' } }],
      scales: { y: { domainMin: 0, domainMax: 50 } },
    })
    expect(r).toContain('ylim = c(0, 50)')
  })

  it('drops the legend where the display hides it', () => {
    const { r } = render({
      marks: [{ mark: 'bar', encoding: { y: 'score' } }],
      showLegend: false,
    })
    expect(r).toContain('theme(legend.position = "none")')
  })
})

describe('what the figure does not show', () => {
  it('names a jexl colour rather than dropping it', () => {
    const { notes, r } = render({
      marks: [
        {
          mark: 'bar',
          encoding: { y: 'score', color: 'jexl:get(feature,"score") > 5' },
        },
      ],
    })
    expect(notes).toEqual(['fill: a jexl callback has no R counterpart'])
    expect(r).not.toContain('jexl')
  })

  it('names a jexl shape, which has no counterpart', () => {
    const { notes } = render({
      marks: [
        { mark: 'point', encoding: { y: 'score', shape: 'jexl:get(f,"t")' } },
      ],
    })
    expect(notes).toContain('shape: a jexl callback has no R counterpart')
  })

  it('names symlog, which ggplot has no counterpart for', () => {
    const { notes } = render({
      marks: [{ mark: 'bar', encoding: { y: 'score' } }],
      scales: { y: { type: 'symlog' } },
    })
    expect(notes).toContain('y: symlog has no ggplot counterpart; drawn linear')
  })

  it('names a density mark as not drawn from the features', () => {
    const { notes } = render({
      marks: [{ mark: 'bar', source: 'density', encoding: { y: 'score' } }],
    })
    expect(notes).toContain(
      'bar: drawn from the density sidecar, not the features',
    )
  })

  /**
   * ggplot keeps one scale per aesthetic and silently replaces the earlier
   * one, so two marks each declaring a fill scale is a figure where the first
   * mark's colouring vanishes. The plot's scale table is keyed by aesthetic,
   * so the second cannot land — it is reported instead.
   */
  it('refuses a second scale on one aesthetic, and says so', () => {
    const { notes, r, plot } = render({
      marks: [
        {
          mark: 'bar',
          encoding: {
            y: 'score',
            color: { field: 'strand', domain: ['1'], range: ['blue'] },
          },
        },
        {
          mark: 'bar',
          encoding: {
            y: 'score',
            color: { field: 'type', domain: ['x'], range: ['red'] },
          },
        },
      ],
    })
    expect(notes).toContain(
      'fill: a second scale on one aesthetic, which ggplot cannot hold',
    )
    expect(Object.keys(plot.scales ?? {})).toEqual(['fill'])
    expect(r.match(/scale_fill_manual/g)).toHaveLength(1)
  })
})

describe('a mark reads the grammar’s own vocabulary', () => {
  it('draws nothing for a bar naming no value, as the display does', () => {
    const { notes, plot } = render({ marks: [{ mark: 'bar', encoding: {} }] })
    expect(notes).toContain('bar: names no value field, so it draws nothing')
    expect(plot.layers).toHaveLength(0)
  })

  it('still draws a span, which stands at no value', () => {
    const { plot } = render({ marks: [{ mark: 'span', encoding: {} }] })
    expect(plot.layers).toHaveLength(1)
  })

  it('reads x2 written as a locus object, not only as a field', () => {
    const { r } = render({
      marks: [{ mark: 'span', encoding: { x2: { pos: 'end' } } }],
    })
    expect(r).toContain('xmax = end')
  })

  it('maps a shape scale onto R pch codes', () => {
    const { r } = render({
      marks: [
        {
          mark: 'point',
          encoding: {
            y: 'score',
            shape: { field: 'type', domain: ['snv', 'del'] },
          },
        },
      ],
    })
    expect(r).toContain('shape = type')
    expect(r).toContain('scale_shape_manual(values = c(snv = 16, del = 25))')
  })

  it('scales a link stroke through the size channel', () => {
    const { r } = render({
      marks: [
        {
          mark: 'link',
          encoding: { size: { field: 'score', range: ['1', '6'] } },
        },
      ],
    })
    expect(r).toContain('linewidth = score')
    expect(r).toContain('scale_linewidth_continuous(range = c(1, 6))')
  })
})
