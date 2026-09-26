import { categoricalPalette } from '@jbrowse/core/ui/colors'

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
  regions = [{ refName: 'ctgA', start: 100, end: 200 }],
  frame: RFrame = bigwig,
) {
  const { plot, notes } = markPlot({ display, frame, regions })
  return { r: renderPlot('p', plot), notes, plot }
}

describe('a mark becomes a geom', () => {
  it('draws a bar from the origin to the value field', () => {
    const { r } = render({
      marks: [
        {
          mark: 'bar',
          encoding: { y: 'score', color: { value: 'steelblue' } },
        },
      ],
    })
    expect(r).toContain('aes(xmin = start, xmax = end, ymin = 0, ymax = score)')
    expect(r).toContain('fill = "steelblue"')
  })

  it('paints the browser’s blue where no colour is written', () => {
    const { r } = render({ marks: [{ mark: 'bar', encoding: { y: 'score' } }] })
    expect(r).toContain('fill = "#0068d1"')
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
    expect(r).toContain('ymin = 0, ymax = 1')
  })

  it('stacks a span on the row a pileup step wrote, naming none itself', () => {
    const { r } = render({
      transform: [{ type: 'pileup' }],
      marks: [{ mark: 'span', encoding: {} }],
    })
    expect(r).toContain('ymin = row, ymax = row + 1')
  })

  it('centres a span in its row at its row proportion', () => {
    const { r } = render({
      transform: [{ type: 'pileup' }],
      marks: [{ mark: 'span', rowProportion: 0.8 }],
    })
    expect(r).toContain('ymin = row + 0.1, ymax = row + 0.9')
  })

  it('stands a point at the middle of its interval', () => {
    const { r } = render({
      marks: [{ mark: 'point', encoding: { y: 'score' } }],
    })
    expect(r).toContain('geom_point(aes(x = (start + end) / 2, y = score)')
  })

  it('plots the depth a coverage step wrote where y is left unwritten', () => {
    const { r, notes } = render({
      transform: [{ type: 'coverage' }],
      marks: [{ mark: 'bar' }],
    })
    expect(r).toContain('ymax = coverage')
    expect(notes).toEqual([])
  })

  it('plots the one summary an aggregate wrote where y is left unwritten', () => {
    const { r } = render({
      marks: [
        {
          mark: 'point',
          transform: [
            { type: 'bin', step: 1000 },
            { type: 'aggregate', ops: [{ op: 'max', field: 'score' }] },
          ],
        },
      ],
    })
    expect(r).toContain('y = max_score')
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

  it('holds a step line across each span through the step_path helper', () => {
    const { r, plot } = render({
      marks: [{ mark: 'line', encoding: { y: 'score', size: 2 } }],
    })
    expect(plot.layers[0]!.frame.statements).toContain(
      'df_path1 <- step_path(df, "start", "end", "score",\n  origin = 0, by = c(".region"))',
    )
    expect(r).toContain('geom_path(')
    expect(r).toContain('aes(x = .x, y = .y, group = .group)')
    // 2 px, in ggplot's linewidth unit
    expect(r).toContain('linewidth = 0.7')
  })

  it('keeps a step line within its facet section', () => {
    const { plot } = render(
      {
        facet: 'type',
        marks: [{ mark: 'line', encoding: { y: 'score' } }],
      },
      undefined,
      gff,
    )
    expect(plot.layers[0]!.frame.statements).toContain(
      'by = c(".region", "type")',
    )
  })

  it('joins the span centres of a linear line, one line per region', () => {
    const { r } = render({
      marks: [
        { mark: 'line', interpolate: 'linear', encoding: { y: 'score' } },
      ],
    })
    expect(r).toContain('geom_line(')
    expect(r).toContain(
      'aes(x = (start + end) / 2, y = score, group = .region)',
    )
  })

  it('draws a rule across its interval at its value', () => {
    const { r } = render({
      marks: [{ mark: 'rule', encoding: { y: 'score', size: 3 } }],
    })
    expect(r).toContain('aes(x = start, xend = end, y = score, yend = score)')
    expect(r).toContain('linewidth = 1.05')
  })

  it('labels a text mark from its text field', () => {
    const { r } = render(
      { marks: [{ mark: 'text', encoding: { text: 'name' } }] },
      [{ refName: 'ctgA', start: 0, end: 100 }],
      gff,
    )
    expect(r).toContain('geom_text(')
    expect(r).toContain('label = name')
    expect(r).toContain('y = 0.5')
    expect(r).not.toContain('colour =')
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
    // keyed by its text, so strand's numbers reach a discrete scale
    expect(r).toContain('fill = as.character(strand)')
    expect(r).toContain(
      'scale_fill_manual(values = c("1" = "blue", "-1" = "red"), name = "strand")',
    )
  })

  it('continues a short range into the palette, as the browser does', () => {
    const { r } = render({
      marks: [
        {
          mark: 'bar',
          encoding: {
            y: 'score',
            color: {
              field: 'strand',
              domain: ['1', '0', '-1'],
              range: ['blue'],
            },
          },
        },
      ],
    })
    expect(r).toContain(
      `"1" = "blue", "0" = "${categoricalPalette[0]}", "-1" = "${categoricalPalette[1]}"`,
    )
  })

  it('walks the palette in the data\u2019s order for an unlisted domain', () => {
    const { r } = render({
      marks: [{ mark: 'bar', encoding: { y: 'score', color: 'seqnames' } }],
    })
    expect(r).toContain(
      `discrete_scale("fill", palette = function(n) rep_len(c("${categoricalPalette[0]}", `,
    )
  })

  it('paints strand in its preset colours and names, as the browser keys it', () => {
    const { r } = render({
      marks: [{ mark: 'bar', encoding: { y: 'score', color: 'strand' } }],
    })
    expect(r).toContain(
      'values = c("1" = "tomato", "-1" = "cornflowerblue", "0" = "goldenrod")',
    )
    expect(r).toContain(
      'labels = c("Forward strand", "Reverse strand", "No strand")',
    )
  })

  it('reads score through a ramp where its scale is unset', () => {
    const { r } = render({
      marks: [{ mark: 'bar', encoding: { y: 'score', color: 'score' } }],
    })
    expect(r).toContain('fill = score')
    expect(r).toContain('scale_fill_gradientn(')
  })

  it('turns a diverging ramp at its mid wherever the data puts the ends', () => {
    const { r } = render({
      marks: [
        {
          mark: 'bar',
          encoding: {
            y: 'score',
            color: { field: 'score', scheme: 'RdBu', domainMid: 0 },
          },
        },
      ],
    })
    expect(r).toContain('scales::rescale_mid(x, to, from, mid = 0)')
    expect(r).not.toContain('limits =')
  })

  it('cuts a threshold scale with no cuts into one bin, not a syntax error', () => {
    const { r } = render({
      marks: [
        {
          mark: 'point',
          encoding: {
            y: 'score',
            color: { field: 'score', scale: 'threshold' },
          },
        },
      ],
    })
    expect(r).toContain('breaks = c(-Inf, Inf), labels = c("any value")')
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
      marks: [
        { mark: 'point', encoding: { y: 'score', color: { value: 'red' } } },
      ],
    })
    const bar = render({
      marks: [
        { mark: 'bar', encoding: { y: 'score', color: { value: 'red' } } },
      ],
    })
    expect(point.r).toContain('colour = "red"')
    expect(bar.r).toContain('fill = "red"')
  })
})

describe('the display stages', () => {
  it('pins x to the region so stacked panels line up', () => {
    const { r } = render(
      { marks: [{ mark: 'bar', encoding: { y: 'score' } }] },
      [{ refName: 'ctgA', start: 1000, end: 2000 }],
    )
    expect(r).toContain('coord_cartesian(xlim = c(1000, 2000), expand = FALSE)')
    expect(r).toContain('x = "ctgA (bp)"')
  })

  it('labels a shared axis as one, and pins it to the layout', () => {
    const { r } = render(
      { marks: [{ mark: 'bar', encoding: { y: 'score' } }] },
      [
        { refName: 'ctgA', start: 0, end: 100 },
        { refName: 'ctgB', start: 0, end: 100 },
      ],
    )
    expect(r).toContain(
      'xlim = c(min(regions$cum_start), max(regions$cum_end))',
    )
    expect(r).toContain('x = "bp, regions end to end"')
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

  it('names a jexl constant colour too', () => {
    const { notes } = render({
      marks: [
        {
          mark: 'bar',
          encoding: { y: 'score', color: { value: 'jexl:"red"' } },
        },
      ],
    })
    expect(notes).toEqual(['fill: a jexl callback has no R counterpart'])
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
      [{ refName: 'ctgA', start: 0, end: 100 }],
      gff,
    )
    expect(r).toContain('shape = as.character(type)')
    expect(r).toContain(
      'scale_shape_manual(values = c(snv = 16, del = 25), name = "type")',
    )
  })

  it('cycles the shape list over a domain the config leaves unlisted', () => {
    const { r } = render(
      {
        marks: [
          { mark: 'point', encoding: { y: 'start', shape: { field: 'type' } } },
        ],
      },
      undefined,
      gff,
    )
    expect(r).toContain(
      'discrete_scale("shape", palette = function(n) rep_len(c(16, 25, 18), n), name = "type")',
    )
  })

  it('reads a bare string on the size channel as a link’s field', () => {
    const { r } = render({
      marks: [{ mark: 'link', encoding: { size: 'score' } }],
    })
    expect(r).toContain('linewidth = score')
    expect(r).toContain('scale_linewidth_continuous(range = c(0.35, 2.11))')
  })

  it('reads a bare string on the shape channel as a field', () => {
    const { r } = render(
      { marks: [{ mark: 'point', encoding: { y: 'start', shape: 'type' } }] },
      undefined,
      gff,
    )
    expect(r).toContain('shape = as.character(type)')
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
    expect(r).toContain('scale_linewidth_continuous(range = c(0.35, 2.11))')
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
      marks: [{ mark: 'point', encoding: { y: 'score', size: 8 } }],
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
        facet: { field: 'strand', domain: ['-1', '1'] },
        marks: [{ mark: 'span' }],
      },
      undefined,
      gff,
    )
    expect(r).toContain('factor(strand, levels = c("-1", "1"))')
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
      filter: ['jexl:get(feature,"score") > 5'],
      marks: [{ mark: 'bar', encoding: { y: 'score' } }],
    })
    expect(notes).toContain(
      'rowColor: the tint beside a row label has no ggplot counterpart',
    )
    expect(notes).toContain(
      'filter: 1 jexl expression(s) have no R counterpart, so the figure shows unfiltered rows',
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

  it('rules in the chrome’s colour where none is named, a bare number too', () => {
    const { r } = render({
      scales: { y: { rules: [{ value: 2 }, 5] } },
      marks: [{ mark: 'bar', encoding: { y: 'score' } }],
    })
    expect(r).toContain('geom_hline(yintercept = 2, colour = "#787878"')
    expect(r).toContain('geom_hline(yintercept = 5, colour = "#787878"')
  })

  it('reaches 0 on the value axis unless zero is written off', () => {
    const on = render({ marks: [{ mark: 'point', encoding: { y: 'score' } }] })
    const off = render({
      scales: { y: { zero: false } },
      marks: [{ mark: 'point', encoding: { y: 'score' } }],
    })
    const spans = render({ marks: [{ mark: 'span' }] })
    expect(on.r).toContain('expand_limits(y = 0)')
    expect(off.r).not.toContain('expand_limits')
    expect(spans.r).not.toContain('expand_limits')
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

describe('a step reading what no stage produced', () => {
  it('is skipped and reported, where R would die on it after every read', () => {
    const { notes, plot } = render({
      transform: [{ type: 'bin', field: 'pos' }, { type: 'pileup' }],
      marks: [{ mark: 'span', encoding: { row: 'row' } }],
    })
    expect(notes).toEqual([
      'transform: bin reads pos, which no stage produces, so it is skipped',
    ])
    expect(plot.layers[0]!.frame.statements).not.toContain('floor(')
    expect(plot.layers[0]!.frame.statements).toContain('disjointBins')
  })

  it('leaves out an aggregate op naming no field', () => {
    const { notes, plot } = render({
      transform: [
        {
          type: 'aggregate',
          groupby: ['strand'],
          ops: [{ op: 'mean' }, { op: 'count' }],
        },
      ],
      marks: [{ mark: 'bar', encoding: { y: 'count' } }],
    })
    expect(notes).toEqual([
      'transform: aggregate mean names no field, so it is left out',
    ])
    expect(plot.layers).toHaveLength(1)
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
