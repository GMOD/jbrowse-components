import { frameFor } from './frameFor.ts'
import { fieldsRead, markPlot } from './markToPlot.ts'
import { renderPlot } from './rplot.ts'

import type { DisplaySpec } from './markToPlot.ts'
import type { RFrame } from './rplot.ts'

/**
 * The frames come from `frameFor`, never hand-written. A fixture that declares
 * its own columns can declare ones no reader produces — this file did, with
 * `row` and `color`, and every test in it then rendered against a frame the
 * real pipeline cannot build.
 */
const bigwig = frameFor({ type: 'BigWigAdapter', uri: 'volvox.bw' })
const gff = frameFor({ type: 'Gff3TabixAdapter', uri: 'volvox.gff3.gz' })

function render(
  display: DisplaySpec,
  regions = [{ start: 100, end: 200 }],
  frame: RFrame = bigwig,
) {
  const { plot, notes } = markPlot({ display, frame, regions })
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

  it('puts a span with no row on one band, as the schema says', () => {
    const { r } = render({ marks: [{ mark: 'span', encoding: {} }] })
    expect(r).toContain('ymin = 0, ymax = 0 + 0.8')
  })

  it('stacks a span on the row a pileup step wrote', () => {
    const { r } = render({
      transform: [{ type: 'pileup' }],
      marks: [{ mark: 'span', encoding: { row: 'row' } }],
    })
    expect(r).toContain('ymin = row, ymax = row + 0.8')
  })

  it('draws a point at x, where both backends append the glyph', () => {
    const { r } = render({
      marks: [{ mark: 'point', encoding: { y: 'score' } }],
    })
    expect(r).toContain('geom_point(aes(x = start, y = score))')
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
    const { r } = render(
      { marks: [{ mark: 'text', encoding: { text: 'name' } }] },
      [{ start: 0, end: 100 }],
      gff,
    )
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
              field: 'score',
              scale: 'threshold',
              domain: ['0.1', '0.5'],
              range: ['#357ebd', '#eea236', '#d43f3a'],
            },
          },
        },
      ],
    })
    expect(r).toContain('cut(score, breaks = c(-Inf, 0.1, 0.5, Inf)')
    expect(r).toContain('scale_colour_manual(')
    // the literal declared colours, not a gradient re-interpolated through them
    expect(r).toContain('"#357ebd"')
    expect(r).toContain('"#eea236"')
    expect(r).toContain('"#d43f3a"')
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
      [{ start: 1000, end: 2000 }],
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
            color: { field: 'strand', domain: ['+'], range: ['blue'] },
          },
        },
        {
          mark: 'bar',
          encoding: {
            y: 'score',
            color: { field: 'seqnames', domain: ['ctgA'], range: ['red'] },
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
    const { r } = render(
      {
        marks: [
          {
            mark: 'point',
            encoding: {
              y: 'start',
              shape: { field: 'type', domain: ['snv', 'del'] },
            },
          },
        ],
      },
      [{ start: 0, end: 100 }],
      gff,
    )
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

describe('a channel drawn as a constant', () => {
  it('paints the colour value where the scale is none', () => {
    const { r, plot } = render({
      marks: [
        {
          mark: 'bar',
          encoding: {
            y: 'score',
            color: { field: 'strand', scale: 'none', value: 'tomato' },
          },
        },
      ],
    })
    expect(r).toContain('fill = "tomato"')
    expect(r).not.toContain('fill = strand')
    expect(plot.scales?.fill).toBeUndefined()
  })

  it('draws the shape value where the scale is none', () => {
    const { r, plot } = render({
      marks: [
        {
          mark: 'point',
          encoding: {
            y: 'score',
            shape: { field: 'strand', scale: 'none', value: 'diamond' },
          },
        },
      ],
    })
    expect(r).toContain('shape = 18')
    expect(plot.scales?.shape).toBeUndefined()
  })

  it('sizes a point by the mark’s own diameter', () => {
    const { r } = render({
      marks: [{ mark: 'point', size: 8, encoding: { y: 'score' } }],
    })
    expect(r).toMatch(/size = 2\.11/)
  })
})

describe('the facet runs its own steps over each section', () => {
  it('packs each section on its own rows and keeps the key', () => {
    const { r, plot, notes } = render(
      {
        facet: { field: 'strand', transform: [{ type: 'pileup' }] },
        marks: [{ mark: 'span', encoding: { row: 'row' } }],
      },
      undefined,
      gff,
    )
    const statements = plot.layers[0]!.frame.statements
    expect(statements).toContain('split(df, addNA(df$strand), drop = TRUE)')
    expect(statements).toContain('disjointBins')
    expect(statements).toContain('df$strand <- key')
    expect(r).toContain('facet_wrap(~strand')
    expect(notes).toEqual([])
  })

  it('orders the sections by the declared domain', () => {
    const { r } = render(
      {
        facet: { field: 'strand', domain: ['-', '+'] },
        marks: [{ mark: 'span' }],
      },
      undefined,
      gff,
    )
    expect(r).toContain('factor(strand, levels = c("-", "+"))')
  })

  it('refuses a facet on a field no stage produces', () => {
    const { r, notes } = render(
      { facet: 'HP', marks: [{ mark: 'span' }] },
      undefined,
      gff,
    )
    expect(r).not.toContain('facet_wrap')
    expect(notes).toContain(
      'facet: reads HP, which no stage produces, so it is not drawn',
    )
  })
})

describe('rows, filters and rules', () => {
  it('draws one panel per row value', () => {
    const { r } = render(
      { rows: 'strand', marks: [{ mark: 'span' }] },
      undefined,
      gff,
    )
    expect(r).toContain('facet_wrap(~strand')
  })

  it('lets the facet draw beside rows and says so', () => {
    const { r, notes } = render(
      { facet: 'type', rows: 'strand', marks: [{ mark: 'span' }] },
      undefined,
      gff,
    )
    expect(r).toContain('facet_wrap(~type')
    expect(notes).toContain('rows: the facet draws, so the rows are not drawn')
  })

  it('reports a row tint and jexl filters rather than dropping them', () => {
    const { notes } = render({
      rowColor: { field: 'name', domain: ['a'], range: ['red'] },
      jexlFilters: ['get(feature,"score") > 5'],
      marks: [{ mark: 'bar', encoding: { y: 'score' } }],
    })
    expect(notes).toContain(
      'rowColor: the tint beside a row label has no ggplot counterpart',
    )
    expect(notes).toContain(
      'jexlFilters: 1 jexl filter(s) have no R counterpart, so the figure shows unfiltered rows',
    )
  })

  it('draws a y rule as a reference line with its label', () => {
    const { r } = render({
      scales: {
        y: { rules: [{ value: 30, color: 'red', label: 'significant' }] },
      },
      marks: [{ mark: 'bar', encoding: { y: 'score' } }],
    })
    expect(r).toContain(
      'geom_hline(yintercept = 30, colour = "red", linetype = "dashed")',
    )
    expect(r).toContain('label = "significant"')
  })

  it('rules in the chrome’s colour where none is named', () => {
    const { r } = render({
      scales: { y: { rules: [{ value: 2 }] } },
      marks: [{ mark: 'bar', encoding: { y: 'score' } }],
    })
    expect(r).toContain('geom_hline(yintercept = 2, colour = "#787878"')
  })
})

describe('a log axis', () => {
  it('leaves a zero bound to the data and says so', () => {
    const { r, notes } = render({
      scales: { y: { type: 'log', domainMin: 0, domainMax: 50 } },
      marks: [{ mark: 'point', encoding: { y: 'score' } }],
    })
    expect(r).toContain('ylim = c(NA, 50)')
    expect(notes).toContain(
      'y: a log axis cannot pin 0, so that end follows the data',
    )
  })

  it('grows a bar from the panel bottom rather than from a log of zero', () => {
    const { r } = render({
      scales: { y: { type: 'log' } },
      marks: [{ mark: 'bar', encoding: { y: 'score' } }],
    })
    expect(r).toContain('ymin = -Inf')
    expect(r).toContain('scale_y_log10()')
  })
})

describe('what the display asks the file for', () => {
  it('names every plain field a channel, a step, the facet or the rows reads', () => {
    expect(
      fieldsRead({
        facet: 'HP',
        rows: 'source',
        transform: [{ type: 'bin', field: 'pos' }],
        marks: [
          {
            mark: 'point',
            transform: [
              {
                type: 'aggregate',
                groupby: ['gene'],
                ops: [{ op: 'mean', field: 'depth' }],
              },
            ],
            encoding: {
              y: 'INFO.DP',
              color: { field: 'gbkey' },
              shape: { field: 'jexl:get(feature,"x")' },
              text: 'Note',
            },
          },
        ],
      }).sort(),
    ).toEqual(
      [
        'HP',
        'INFO.DP',
        'Note',
        'depth',
        'gbkey',
        'gene',
        'pos',
        'source',
      ].sort(),
    )
  })

  it('leaves out what a step writes, so a reader is never asked for it', () => {
    expect(
      fieldsRead({
        transform: [{ type: 'pileup' }, { type: 'coverage', as: 'depth' }],
        marks: [{ mark: 'bar', encoding: { y: 'depth', row: 'row' } }],
      }),
    ).toEqual([])
  })
})

describe('a column name R would misparse', () => {
  it('is backticked in the aes and the steps', () => {
    const { r } = render(
      {
        marks: [{ mark: 'point', encoding: { y: 'read-depth' } }],
      },
      undefined,
      frameFor({
        type: 'Gff3TabixAdapter',
        uri: 'x.gff3.gz',
        fields: ['read-depth'],
      }),
    )
    expect(r).toContain('y = `read-depth`')
  })
})
