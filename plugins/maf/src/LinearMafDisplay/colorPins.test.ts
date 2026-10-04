import { resolvePalette } from '@jbrowse/core/ui/palette'

import { testWireRegionData } from '../LinearMafGetAlignmentDataRpc/testWire.ts'
import { identitySpans } from '../LinearMafRenderer/identity.ts'
import { packMafCellColorConfig } from '../LinearMafRenderer/resolveCellColor.ts'
import { getMafColorPalette } from '../LinearMafRenderer/util.ts'
import { emptyMafCoverage } from './components/coverageTestFixture.ts'
import { encodeSourceChromSpans } from './components/drawSourceChrom.ts'
import { createMafTestEnvironment, stageDetailRegion } from './testEnv.ts'

import type { MafBlock } from '../LinearMafRenderer/mafRenderingBackendTypes.ts'
import type { RowRendering } from './rowRenderings.ts'

// The bytes and keys every MAF colour painted before the colour object took
// them over, pinned so the defaults stay what they were.

const IDENTITY_ABGR_HEX =
  'ff3843c7 ff3a44c6 ff3b46c5 ff3d47c3 ff3f49c2 ff404ac1 ff424cc0 ff444dbf ff454fbe ff4750bc ff4952bb ff4a53ba ff4c55b9 ff4e56b8 ff5057b6 ff5159b5 ff535ab4 ff555cb3 ff565db2 ff585fb1 ff5a60af ff5b62ae ff5d63ad ff5f65ac ff6066ab ff6268aa ff6469a8 ff656aa7 ff676ca6 ff696da5 ff6a6fa4 ff6c70a2 ff6e72a1 ff6f73a0 ff71759f ff73769e ff74789d ff76799b ff787a9a ff7a7c99 ff7b7d98 ff7d7f97 ff7f8095 ff808294 ff828393 ff848592 ff858691 ff878890 ff89898e ff8a8b8d ff8c8c8c ff8d8b8a ff8d8a88 ff8e8a86 ff8f8985 ff908883 ff908781 ff91877f ff92867d ff92857b ff938479 ff948478 ff958376 ff958274 ff968172 ff978170 ff98806e ff987f6c ff997e6b ff9a7e69 ff9a7d67 ff9b7c65 ff9c7b63 ff9d7b61 ff9d7a5f ff9e795e ff9f785c ff9f775a ffa07758 ffa17656 ffa27554 ffa27452 ffa37450 ffa4734f ffa4724d ffa5714b ffa67149 ffa77047 ffa76f45 ffa86e43 ffa96e42 ffaa6d40 ffaa6c3e ffab6b3c ffac6b3a ffac6a38 ffad6936 ffae6835 ffaf6833 ffaf6731 ffb0662f'

const RANK_ABGR_HEX = [
  'ffcb8c4d',
  'ff2b86ee',
  'ff5e45de',
  'ffc4649c',
  'ff6b9b3b',
  'ff6b9b3b',
  'ff6b9b3b',
]

// FNV-1a over the bytes of the 65,536-entry (reference, aligned) table.
const BASE_TABLE_FNV = {
  'light-false': '206ab465',
  'light-true': 'd83f86f2',
  'dark-false': 'b6c55a3c',
  'dark-true': '17fb4e0c',
}

function fnv1a(a: Uint32Array) {
  let h = 0x811c9dc5
  for (const x of new Uint8Array(a.buffer, a.byteOffset, a.byteLength)) {
    h = Math.imul(h ^ x, 0x01000193) >>> 0
  }
  return h.toString(16)
}

function hex(colors: SpanColor) {
  return [...(colors as Uint32Array)].map(c => c.toString(16))
}

type SpanColor = ReturnType<typeof identitySpans>['color']

test('the identity ramp paints every hundredth as it did', () => {
  const step = Uint8Array.from({ length: 101 }, (_, i) => i)
  const zeros = new Uint32Array(101)
  const spans = identitySpans({
    x: zeros,
    x2: zeros,
    row: zeros,
    step,
    count: 101,
  })
  expect(hex(spans.color)).toEqual(IDENTITY_ABGR_HEX.split(' '))
})

test('each source chromosome rank paints as it did, clamped at the fifth', () => {
  const blocks: MafBlock[] = Array.from({ length: 7 }, (_, rank) => ({
    startBp: rank,
    endBp: rank + 1,
    refSeqBytes: new Uint8Array(0),
    rows: [{ rowIndex: 0, chr: `c${rank}`, alignmentBytes: new Uint8Array(0) }],
    empties: [],
  }))
  const ranks = new Map([
    [0, new Map(blocks.map((_, rank) => [`c${rank}`, rank]))],
  ])
  expect(hex(encodeSourceChromSpans(blocks, ranks).color)).toEqual(
    RANK_ABGR_HEX,
  )
})

test.each(['light', 'dark'] as const)(
  'the %s theme base table is the bytes it was',
  mode => {
    const palette = getMafColorPalette(
      resolvePalette({ configTheme: { palette: { mode } } }),
    )
    for (const colorMatches of [false, true]) {
      expect(
        fnv1a(
          packMafCellColorConfig({ ...palette, colorMatches }).packedByRefAln,
        ),
      ).toBe(BASE_TABLE_FNV[`${mode}-${colorMatches}`])
    }
  },
)

function keyOf(
  rendering: RowRendering | 'rampBars',
  bpPerPx: number,
  stage?: (display: ReturnType<typeof makeDisplay>['display']) => void,
) {
  const { display, view } = makeDisplay()
  display.setRowIdentityAutoZoom(false)
  if (rendering === 'rampBars') {
    display.setRowRendering('identity')
    display.setYField('identity')
  } else {
    display.setRowRendering(rendering)
  }
  view.zoomTo(bpPerPx)
  view.setCoarseDynamicBlocks(view.dynamicBlocks, view.bpPerPx)
  stage?.(display)
  return JSON.parse(JSON.stringify(display.colorScales)) as unknown
}

function makeDisplay() {
  return createMafTestEnvironment({ annotationAdapter: {} }).createDisplay()
}

function stageTwoChromosomes(
  display: ReturnType<typeof makeDisplay>['display'],
) {
  display.setSamples({
    samples: [{ id: 'sp1', label: 'sp1' }],
    treeNewick: undefined,
    samplesCanonical: true,
  })
  stageDetailRegion(
    display,
    0,
    testWireRegionData(
      [
        {
          startBp: 100,
          refSeq: 'AAAAAAAAAA',
          rows: [{ sampleId: 'sp1', seq: 'AAAAAAAAAA', chr: 'chrA' }],
        },
        {
          startBp: 200,
          refSeq: 'AAA',
          rows: [{ sampleId: 'sp1', seq: 'AAA', chr: 'chrB' }],
        },
      ],
      { coverage: emptyMafCoverage(0), refSampleId: undefined },
    ),
  )
}

const IDENTITY_TITLE = 'Per-base identity to reference'

const HEATMAP_RAMP = {
  kind: 'ramp',
  id: 'heatmap',
  title: IDENTITY_TITLE,
  domain: [0, 1],
  stops: [
    { offset: 0, color: 'rgb(199,67,56)' },
    { offset: 0.5, color: 'rgb(140,140,140)' },
    { offset: 1, color: 'rgb(47,102,176)' },
  ],
}

describe('each field keys as it did', () => {
  test.each(['mismatch', 'base'] as const)('%s keys nothing', rendering => {
    expect(keyOf(rendering, 0.5)).toEqual([])
  })

  test('identity zoomed out keys the ramp', () => {
    expect(keyOf('identity', 16)).toEqual([HEATMAP_RAMP])
  })

  test('identity at one base a cell keys its two ends', () => {
    expect(keyOf('identity', 1)).toEqual([
      {
        kind: 'categorical',
        id: 'heatmap-base',
        title: IDENTITY_TITLE,
        entries: [
          {
            value: 'match',
            label: 'Conserved (base matches)',
            color: 'rgb(47,102,176)',
          },
          {
            value: 'mismatch',
            label: 'Divergent (base differs)',
            color: 'rgb(199,67,56)',
          },
        ],
      },
    ])
  })

  test('the X-Y plot keys its one bar colour', () => {
    expect(keyOf('xyplot', 16)).toEqual([
      {
        kind: 'categorical',
        id: 'xyplot',
        title: IDENTITY_TITLE,
        entries: [
          {
            value: 'bar',
            label: 'Bar height: full = conserved, flat = divergent',
            color: 'rgb(47,102,176)',
          },
        ],
      },
    ])
  })

  test('identity bars on the ramp key the ramp', () => {
    expect(keyOf('rampBars', 16)).toEqual([HEATMAP_RAMP])
  })

  test('chromosome keys one entry per rank in view', () => {
    expect(keyOf('chromosome', 16, stageTwoChromosomes)).toEqual([
      {
        kind: 'categorical',
        id: 'sourceChrom',
        title: 'Source chromosome',
        entries: [
          {
            value: 'Main chromosome',
            label: 'Main chromosome',
            color: 'hsl(210, 55%, 55%)',
          },
          {
            value: '2nd source',
            label: '2nd source',
            color: 'hsl(28, 85%, 55%)',
          },
        ],
      },
    ])
  })

  test('codon keys its three composited fills', () => {
    const palette = resolvePalette()
    expect(keyOf('codon', 0.5)).toEqual([
      {
        kind: 'categorical',
        id: 'codon',
        title: 'Codon change',
        entries: [
          {
            value: 'Nonsynonymous',
            label: 'Nonsynonymous',
            color: getMafColorPalette(palette).codonFill.nonsyn,
          },
          {
            value: 'Synonymous',
            label: 'Synonymous',
            color: getMafColorPalette(palette).codonFill.syn,
          },
          {
            value: 'Stop gained',
            label: 'Stop gained',
            color: getMafColorPalette(palette).codonFill.stop,
          },
        ],
      },
    ])
  })
})
