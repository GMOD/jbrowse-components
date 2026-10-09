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

// The bytes and keys every MAF color painted before the color object took
// them over, pinned so the defaults stay what they were.

const IDENTITY_ABGR_HEX =
  'ff540144 ff580545 ff5c0846 ff5f0c47 ff631047 ff671448 ff691748 ff6d1b48 ff6f1e48 ff732148 ff762548 ff782848 ff7a2b47 ff7c2e47 ff7e3146 ff803446 ff823845 ff833a44 ff853e43 ff864042 ff874441 ff88473f ff89493e ff8a4d3d ff8a4f3c ff8b523b ff8c543a ff8c5838 ff8c5a37 ff8d5d36 ff8d6035 ff8d6233 ff8e6532 ff8e6731 ff8e6a30 ff8e6c2f ff8e6f2e ff8e712d ff8e732c ff8e752b ff8e782a ff8e7b29 ff8e7d28 ff8e8027 ff8e8226 ff8e8425 ff8e8624 ff8e8923 ff8d8b22 ff8d8e21 ff8d9121 ff8c9220 ff8b951f ff8b971f ff8a9a1f ff899c1e ff889f1f ff88a11f ff86a320 ff85a521 ff84a822 ff82ab25 ff81ad26 ff7faf29 ff7eb12c ff7cb42f ff7ab633 ff78b837 ff76ba3a ff73bc3f ff71bf43 ff6ec148 ff6bc34d ff69c552 ff66c757 ff63c85d ff5fcb62 ff5ccc68 ff58ce6e ff55d074 ff51d17a ff4dd380 ff49d586 ff45d68d ff41d793 ff3dd99a ff38daa1 ff34dba8 ff30dcae ff2bdeb5 ff27dfbc ff23dfc2 ff1fe1c9 ff1ce1d0 ff19e2d7 ff18e3de ff19e4e4 ff1ae5eb ff1de5f1 ff20e6f7 ff25e7fd'

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
    { offset: 0, color: 'rgb(68,1,84)' },
    { offset: 0.125, color: 'rgb(71,45,123)' },
    { offset: 0.25, color: 'rgb(59,82,139)' },
    { offset: 0.375, color: 'rgb(44,114,142)' },
    { offset: 0.5, color: 'rgb(33,145,141)' },
    { offset: 0.625, color: 'rgb(39,173,129)' },
    { offset: 0.75, color: 'rgb(93,200,99)' },
    { offset: 0.875, color: 'rgb(170,220,50)' },
    { offset: 1, color: 'rgb(253,231,37)' },
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
            color: 'rgb(253,231,37)',
          },
          {
            value: 'mismatch',
            label: 'Divergent (base differs)',
            color: 'rgb(68,1,84)',
          },
        ],
      },
    ])
  })

  test('the X-Y plot keys its one bar color', () => {
    expect(keyOf('xyplot', 16)).toEqual([
      {
        kind: 'categorical',
        id: 'xyplot',
        title: IDENTITY_TITLE,
        entries: [
          {
            value: 'bar',
            label: 'Bar height: full = conserved, flat = divergent',
            color: '#0068d1',
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
