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
  'the band letters every record at %s on one line, ID then description',
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
      records.map(([id, , , description]) => `${id} ${description}`).sort(),
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
