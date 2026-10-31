import { resolvePalette } from '@jbrowse/core/ui/palette'
import { measureText } from '@jbrowse/core/util'
import { paintFeatureBand } from '@jbrowse/plugin-features/band'

import { getCachedABGR } from '../shared/variantWebglUtils.ts'
import { recordsBandSurface } from './components/RecordsBandOverlay.tsx'
import { getTooltipRows } from './components/getTooltipRows.ts'
import { KIT, TAS2R46, recordsDisplayAt } from './recordsBand.fixture.ts'

import type { LinearMultiSampleVariantDisplayModel } from './model.ts'
import type { BandRecord } from './recordsBand.fixture.ts'
import type { Ctx2D } from '@jbrowse/core/util/paintLayer'

interface TextBox {
  text: string
  left: number
  right: number
  top: number
  bottom: number
}

// What the band hands `fillText`, as boxes: the painter's own output, so this
// sees a collision whichever stage let it through.
function paintedText(display: LinearMultiSampleVariantDisplayModel) {
  const boxes: TextBox[] = []
  const fontSize = display.recordsFontSize
  const ctx = new Proxy(
    {},
    {
      get: (_, key) =>
        key === 'fillText'
          ? (text: string, x: number, y: number) => {
              boxes.push({
                text,
                left: x,
                right: x + measureText(text, fontSize),
                top: y - fontSize + 0.5,
                bottom: y,
              })
            }
          : () => {},
      set: () => true,
    },
  ) as Ctx2D
  paintFeatureBand(
    ctx,
    display.recordsLaidOutDataMap,
    display.renderBlocks,
    display.host.visibleRegions,
    {
      canvasWidth: display.canvasWidthPx,
      bandHeight: display.topBands.recordsHeight,
      scrollY: display.recordsScrollTop,
      ...display.recordsRenderedLabels,
      fontSize,
      palette: resolvePalette(),
    },
  )
  return boxes
}

function collisions(boxes: TextBox[]) {
  const out: [string, string][] = []
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]!
      const b = boxes[j]!
      if (
        a.left < b.right &&
        b.left < a.right &&
        a.top < b.bottom &&
        b.top < a.bottom
      ) {
        out.push([a.text, b.text])
      }
    }
  }
  return out
}

// A one-row lane named only what cleared the record before it; a stacked band
// names every record, nested ones included, and still overprints nothing.
test.each([
  ['KIT', KIT, 51],
  ['TAS2R46', TAS2R46, 20],
])(
  'the band letters every record at %s on one line: ID, description, carriers',
  (_, records, bpPerPx) => {
    const { display } = recordsDisplayAt(records, bpPerPx)
    const boxes = paintedText(display)
    expect(collisions(boxes)).toEqual([])
    expect(
      boxes
        .map(b => b.text)
        .filter(t => t.startsWith('>'))
        .sort(),
    ).toEqual(
      records
        .map(([id, , , description]) => `${id} ${description} 100%`)
        .sort(),
    )
  },
)

test('a description costs no label row', () => {
  const one: BandRecord[] = [['sv1', 2000, 9000, '<DEL> 7Kbp']]
  const both = recordsDisplayAt(one, 10).display
  const names = recordsDisplayAt(one, 10, {
    labels: { description: { show: false } },
  }).display
  expect(both.topBands.recordsHeight).toBe(names.topBands.recordsHeight)
})

// The band is the structural variants: an SNV or small indel files under no
// SV class and takes no row.
test('the band lays out only the SV records', () => {
  const { display } = recordsDisplayAt(
    [
      ['rs1', 1000, 1001, 'A -> G', ''],
      ['sv1', 2000, 9000, '<DEL> 7Kbp', 'DEL'],
      ['rs2', 3000, 3002, 'AT -> A', ''],
      ['sv2', 4000, 4001, '<INS> 300bp', 'INS'],
    ],
    10,
  )
  expect(
    display.recordsLaidOutDataMap
      .get(0)!
      .flatbushItems.map(i => i.featureId)
      .sort(),
  ).toEqual(['sv1', 'sv2'])
})

// With no genotype rows the band is the only drawing of the records, so it
// draws every one the filter admitted, and names no carriers.
test('a sites-only display lays out every record, SNVs included', () => {
  const { display } = recordsDisplayAt(
    [
      ['rs1', 1000, 1001, 'A -> G', ''],
      ['sv1', 2000, 9000, '<DEL> 7Kbp', 'DEL'],
    ],
    10,
    {},
    false,
  )
  const data = display.recordsLaidOutDataMap.get(0)!
  expect(data.flatbushItems.map(i => i.featureId).sort()).toEqual([
    'rs1',
    'sv1',
  ])
  // with no rows, labelled as a feature track letters them: the name, and
  // the description under it
  const labels = data.floatingLabelsData.get('sv1')
  expect(labels?.nameLabel?.text).toBe('sv1')
  expect(labels?.descriptionLabel?.text).toBe('<DEL> 7Kbp')
})

test('an SNV-only region gives the band no height', () => {
  const { display } = recordsDisplayAt(
    [
      ['rs1', 1000, 1001, 'A -> G', ''],
      ['rs2', 3000, 3002, 'AT -> A', ''],
    ],
    10,
  )
  expect(display.topBands.recordsHeight).toBe(0)
  expect(display.rowsTopOffset).toBe(0)
})

// The cells paint the genotype colors, which name no record, so the records
// take their SV class's, and the key names the classes the band holds.
test('under the genotype colors each record takes its SV class color, keyed', () => {
  const { display } = recordsDisplayAt(
    [
      ['sv1', 2000, 9000, '<DEL> 7Kbp', 'DEL'],
      ['sv2', 4000, 4001, '<INV> 300bp', 'INV'],
      ['rs1', 5000, 5001, 'A -> G', ''],
    ],
    10,
  )
  const colors = [...display.recordsRenderDataMap.get(0)!.rectColors]
  expect(colors).toEqual([getCachedABGR('#e41a1c'), getCachedABGR('#ff7f00')])
  const [key] = display.colorScales
  expect(key).toMatchObject({
    title: 'SV type',
    entries: [
      { label: 'Deletion', color: '#e41a1c' },
      { label: 'Inversion', color: '#ff7f00' },
    ],
  })
})

test('labels off letters nothing and reserves no label rows', () => {
  const labelled = recordsDisplayAt(KIT, 51).display
  const { display } = recordsDisplayAt(KIT, 51, {
    labels: { name: { show: false }, description: { show: false } },
  })
  expect(paintedText(display)).toEqual([])
  expect(display.topBands.recordsHeight).toBeLessThan(
    labelled.topBands.recordsHeight,
  )
})

// LinearBasicDisplay's label density rule: names go past 0.2 records per
// on-screen pixel and descriptions past 0.1, so a dense window packs boxes
// alone instead of fitting a label for each record.
test.each([
  [1000, 2, 'nothing', false, false, [undefined, undefined]],
  [300, 6, 'names', true, false, ['r0', undefined]],
  [100, 6, 'names and descriptions', true, true, ['r0', 'A -> G']],
])(
  '%i records %ibp apart over 1960px letter %s',
  (count, spacing, _, names, descriptions, firstLabels) => {
    const records: BandRecord[] = Array.from({ length: count }, (_, i) => [
      `r${i}`,
      i * spacing,
      i * spacing + 1,
      'A -> G',
      '',
    ])
    const { display } = recordsDisplayAt(records, 1, {}, false)
    const { name, description } = display.recordsLabels
    expect(display.recordsVisibleLabels).toEqual({
      name: names ? name : '',
      description: descriptions ? description : '',
    })
    const labels = display.recordsLaidOutDataMap
      .get(0)!
      .floatingLabelsData.get('r0')
    expect([labels?.nameLabel?.text, labels?.descriptionLabel?.text]).toEqual(
      firstLabels,
    )
  },
)

// Past the label density the records are unlabelled, so LinearBasicDisplay's
// density collapse piles sub-pixel ones stacked past its depth (25) into one
// faded row, as it draws a dense variant track: 1000 SNVs a base apart at
// 20bp/px pile 40 deep.
test('dense sub-pixel records with no labels collapse into one faded row', () => {
  const records: BandRecord[] = Array.from({ length: 1000 }, (_, i) => [
    `r${i}`,
    i,
    i + 1,
    'A -> G',
    '',
  ])
  const { display } = recordsDisplayAt(records, 20, {}, false)
  expect(display.recordsVisibleLabels).toEqual({ name: '', description: '' })
  const data = display.recordsLaidOutDataMap.get(0)!
  expect(new Set(data.flatbushItems.map(i => i.topPx)).size).toBe(1)
  expect(new Set(data.rectDensityFade)).toEqual(new Set([1]))
})

// With no rows the fit and height measure the records on screen, as
// LinearBasicDisplay's do; over rows every fetched record, so the rows under
// the band hold still as a pan brings records on and off screen.
describe('records buffered off screen', () => {
  const sparse: BandRecord[] = [['sv1', 100, 900, '<DEL>', 'DEL']]
  const offScreenPile: BandRecord[] = Array.from({ length: 200 }, (_, i) => [
    `far${i}`,
    5000,
    5000 + 10 * (i + 1),
    '<DEL>',
    'DEL',
  ])
  const both = [...sparse, ...offScreenPile]

  test('with no rows, size nothing', () => {
    const grow = { heightMode: 'grow' }
    const alone = recordsDisplayAt(sparse, 1, {}, false, grow).display
    const { display } = recordsDisplayAt(both, 1, {}, false, grow)
    expect([...display.recordsOnScreenIds]).toEqual(['sv1'])
    expect(display.height).toBe(alone.height)
  })

  test('over rows, size the band', () => {
    const alone = recordsDisplayAt(sparse, 1).display
    const { display } = recordsDisplayAt(both, 1)
    expect(display.recordsMeasureIds).toBeUndefined()
    expect(display.topBands.recordsHeight).toBeGreaterThan(
      alone.topBands.recordsHeight,
    )
  })
})

describe('the pointer over the band', () => {
  function recordAt(display: LinearMultiSampleVariantDisplayModel, id: string) {
    const item = display.recordsLaidOutDataMap
      .get(0)!
      .flatbushItems.find(i => i.featureId === id)!
    const bpPerPx = display.view.bpPerPx
    return {
      x:
        ((item.startBp + item.endBp) / 2 - display.view.offsetPx * bpPerPx) /
        bpPerPx,
      y: (item.topPx + item.bottomPx) / 2,
    }
  }

  test('a hover over a nested record names it, with no sample rows', () => {
    const { display } = recordsDisplayAt(KIT, 51)
    const { x, y } = recordAt(display, '>7495>7496')
    const hit = recordsBandSurface(display).getHit(x, y)!
    expect(hit.fields.featureName).toBe('>7495>7496')
    expect(getTooltipRows(hit.fields).map(r => r.key)).not.toContain('genotype')
  })

  test('a click opens the record with no sample card', () => {
    const { display } = recordsDisplayAt(KIT, 51)
    const { x, y } = recordAt(display, '>7494>7499')
    const surface = recordsBandSurface(display)
    const feature = surface.enrich(surface.getHit(x, y)!)!
    expect(feature.id()).toBe('>7494>7499')
    expect(feature.get('clickedSample')).toBeUndefined()
  })

  test('a hovered record lights the box the band painted', () => {
    const { display } = recordsDisplayAt(KIT, 51)
    const { x, y } = recordAt(display, '>7495>7496')
    const surface = recordsBandSurface(display)
    surface.onHover?.(surface.getHit(x, y))
    const [ink] = display.hoverInk
    const item = display.recordsLaidOutDataMap
      .get(0)!
      .flatbushItems.find(i => i.featureId === '>7495>7496')!
    expect(ink).toMatchObject({
      top: item.topPx,
      height: item.bottomPx - item.topPx,
    })
  })
})
