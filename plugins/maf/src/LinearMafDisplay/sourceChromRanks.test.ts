import { autorun } from 'mobx'

import { testWireRegionData } from '../LinearMafGetAlignmentDataRpc/testWire.ts'
import { emptyMafCoverage } from './components/coverageTestFixture.ts'
import { createMafTestEnvironment } from './testEnv.ts'

// Two blocks on one row, the first from chrA and the second from chrB, so the
// row has a rank order to report.
function loadTwoChromBlocks(display: {
  setSamples: (arg: {
    samples: { id: string; label: string }[]
    treeNewick: undefined
    samplesCanonical: boolean
  }) => void
  setRpcData: (i: number, data: ReturnType<typeof testWireRegionData>) => void
}) {
  display.setSamples({
    samples: [{ id: 'sp1', label: 'sp1' }],
    treeNewick: undefined,
    samplesCanonical: true,
  })
  display.setRpcData(
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

describe('sourceChromRanks', () => {
  it('ranks a row by aligned bp, longest first', () => {
    const { display } = createMafTestEnvironment().createDisplay()
    display.setRowRendering('sourceChrom')
    loadTwoChromBlocks(display)

    const { ranks, maxRank } = display.sourceChromRanks
    expect(ranks.get(0)?.get('chrA')).toBe(0)
    expect(ranks.get(0)?.get('chrB')).toBe(1)
    expect(maxRank).toBe(1)
  })

  // The walk covers every block x row of every loaded region, which on a
  // fine-grained multiz is over a million pairs. It used to be keyed on
  // `renderBlocks`, whose `screenStartPx` moves on every pan tick, so the
  // memo missed on every frame of a pan and re-ranked all of them to produce
  // the identical map. Kept observed by the autorun, because a MobX computed
  // read outside a reaction is not cached at all and would re-run either way.
  it('does not re-rank on a pan', () => {
    const { display, view } = createMafTestEnvironment().createDisplay({
      regions: [
        { assemblyName: 'volvox', start: 0, end: 100_000, refName: 'ctgA' },
      ],
    })
    display.setRowRendering('sourceChrom')
    loadTwoChromBlocks(display)

    let latest = display.sourceChromRanks
    const dispose = autorun(() => {
      latest = display.sourceChromRanks
    })
    const before = latest
    view.horizontalScroll(500)
    expect(view.offsetPx).toBeGreaterThan(0)
    expect(latest).toBe(before)
    dispose()
  })
})
