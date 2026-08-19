import { getSnapshot } from '@jbrowse/mobx-state-tree'

import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import {
  clickContextMenuItem,
  createTestEnvironment,
  rightClick,
} from './testEnv.ts'

import type { SubfeatureInfo } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { TestDisplay } from './testEnv.ts'

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }

const gene = makeFlatbushItem({
  featureId: 'EDEN',
  type: 'gene',
  name: 'EDEN',
  startBp: 1050,
  endBp: 9000,
})

const eden1: SubfeatureInfo = {
  kind: 'subfeature',
  featureId: 'EDEN.1',
  type: 'mRNA',
  startBp: 1050,
  endBp: 9000,
  topPx: 0,
  bottomPx: 10,
  parentFeatureId: 'EDEN',
  displayLabel: 'EDEN.1',
}

function loadGene(display: TestDisplay, subfeatureInfos: SubfeatureInfo[]) {
  display.setRpcData(
    0,
    makeFeatureData({ flatbushItems: [gene], subfeatureInfos }),
    ctgA,
  )
  display.setLoadedRegion(0, ctgA)
}

describe('feature "Get sequence" context menu', () => {
  it('opens the feature sequence dialog for the clicked feature', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, session } = createDisplay()
    loadGene(display, [])

    rightClick(display, gene)
    clickContextMenuItem(display, 'Get sequence')

    expect(session.queuedDialogs).toHaveLength(1)
    expect(session.queuedDialogs[0]![1]).toMatchObject({
      parentFeatureId: 'EDEN',
      featureId: 'EDEN',
      displayedRegionIndex: 0,
      assemblyName: 'volvox',
    })
  })

  it('descends to the clicked isoform, as "open feature details" does', () => {
    const { createDisplay } = createTestEnvironment()
    const { display, session } = createDisplay()
    loadGene(display, [eden1])

    rightClick(display, gene, eden1)
    clickContextMenuItem(display, 'Get sequence')

    // the panel needs the gene to fetch (only it is addressable by the RPC) but
    // must render the isoform the user right-clicked
    expect(session.queuedDialogs[0]![1]).toMatchObject({
      parentFeatureId: 'EDEN',
      featureId: 'EDEN.1',
    })
  })

  it('fetches the drawn feature, not whatever the subfeature calls its parent', () => {
    // A subfeature nested below the top level names the container it hangs off,
    // which need not be the drawn record. Only the record is addressable by the
    // RPC, and the panel descends recursively from whatever it fetches, so the
    // id has to come from the FlatbushItem.
    const { createDisplay } = createTestEnvironment()
    const { display, session } = createDisplay()
    const nested: SubfeatureInfo = { ...eden1, parentFeatureId: 'EDEN.1' }
    loadGene(display, [nested])

    rightClick(display, gene, nested)
    clickContextMenuItem(display, 'Get sequence')

    expect(session.queuedDialogs[0]![1]).toMatchObject({
      parentFeatureId: 'EDEN',
      featureId: 'EDEN.1',
    })
  })

  it('publishes sequence panel hovers for the LGV crosshair', () => {
    // the dialog holds its own settings model, but the hovered base has to
    // reach a node the view can find, so it lands on the display
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const pos = { refName: 'ctgA', start: 100, end: 101 }

    display.setSequenceHoverPosition(pos)
    expect(display.sequenceHoverPosition).toEqual(pos)
    expect(getSnapshot(display)).not.toHaveProperty('sequenceHoverPosition')

    display.setSequenceHoverPosition(undefined)
    expect(display.sequenceHoverPosition).toBeUndefined()
  })
})
