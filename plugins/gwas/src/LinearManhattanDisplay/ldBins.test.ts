import { NO_CATEGORY_COLOR } from '@jbrowse/core/util/color'
import { cssColorToABGR } from '@jbrowse/core/util/colorBits'
import { encodeFeatures } from '@jbrowse/core/util/markEncoding'
import SimpleFeature from '@jbrowse/core/util/simpleFeature'
import { withPreset } from '@jbrowse/display-kit/colorScale'

import { MANHATTAN_FIELD_PRESETS } from './colorConfigSchema.ts'
import { LD_PALETTE, ldLegend } from './ldBins.ts'

function ldColor(written: { domain?: string[]; range?: string[] }) {
  return withPreset(
    { field: 'ld', scale: 'threshold', domain: [], range: [], ...written },
    MANHATTAN_FIELD_PRESETS,
  )
}

function painted(
  color: { domain?: string[]; range?: string[] },
  r2s: number[],
) {
  const features = r2s.map(
    (ld, i) =>
      new SimpleFeature({
        uniqueId: String(i),
        refName: '1',
        start: i,
        end: i + 1,
        ...(Number.isNaN(ld) ? {} : { ld }),
      }),
  )
  const { color: packed } = encodeFeatures(
    features,
    {
      color: {
        field: 'ld',
        scale: 'threshold',
        domain: [...ldColor(color).domain],
        range: [...ldColor(color).range],
      },
    },
    ['color'],
  )
  return [...packed]
}

// The key reads its colours from the same cuts and palette the encoder's
// threshold paints the points from, so a swatch is a colour that was drawn.
test('each key row is the colour its r² paints', () => {
  const rows = ldLegend(ldColor({}))
  const byLabel = new Map(rows.map(r => [r.label, cssColorToABGR(r.color)]))
  expect(painted({}, [1, 0.9, 0.7, 0.5, 0.3, 0.1, Number.NaN])).toEqual(
    [
      'Index SNP',
      '≥ 0.8',
      '0.6 – 0.8',
      '0.4 – 0.6',
      '0.2 – 0.4',
      '< 0.2',
      'No LD data',
    ].map(label => byLabel.get(label)),
  )
})

test('the index diamond is the top bin at the default cuts, and the no-data grey is the no-value grey', () => {
  const [index, ...rest] = ldLegend(ldColor({}))
  expect(index).toMatchObject({ shape: 'diamond', color: LD_PALETTE.at(-1) })
  expect(rest.at(-1)).toMatchObject({ color: NO_CATEGORY_COLOR })
})

// The grey means "absent from the LD data", so a bin past the palette's end
// cannot borrow it — the points in that bin are in the data.
test('a cut past the palette takes a colour, not the no-data grey', () => {
  const custom = { domain: ['0.2', '0.4', '0.6', '0.8', '0.9'] }
  const bins = ldLegend(ldColor(custom)).slice(1, -1)
  expect(bins).toHaveLength(6)
  expect(bins.map(s => s.color)).not.toContain(NO_CATEGORY_COLOR)
  const [top, next] = painted(custom, [0.95, 0.85])
  expect(top).not.toBe(next)
})

test('a config moves the cuts and recolours the bins', () => {
  const custom = { domain: ['0.5'], range: ['#000080', '#800000'] }
  expect(painted(custom, [0.49, 0.5])).toEqual(
    ['#000080', '#800000'].map(c => cssColorToABGR(c)),
  )
  expect(ldLegend(ldColor(custom)).map(s => s.label)).toEqual([
    'Index SNP',
    '≥ 0.5',
    '< 0.5',
    'No LD data',
  ])
})

test('cuts written high to low are read ascending, on the points and in the key', () => {
  const custom = {
    domain: ['0.8', '0.2'],
    range: ['#000080', '#008000', '#800000'],
  }
  expect(painted(custom, [0.5])).toEqual([cssColorToABGR('#008000')])
  expect(ldLegend(ldColor(custom)).map(s => s.label)).toEqual([
    'Index SNP',
    '≥ 0.8',
    '0.2 – 0.8',
    '< 0.2',
    'No LD data',
  ])
})
