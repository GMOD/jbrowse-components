import { isFeature } from '@jbrowse/core/util'
import { waitFor } from '@testing-library/react'

import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment, rightClick } from './testEnv.ts'

import type { SubfeatureInfo } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }

const gene = makeFlatbushItem({
  featureId: 'EDEN',
  type: 'gene',
  name: 'EDEN',
  startBp: 1050,
  endBp: 9000,
})

function isoform(featureId: string, type: string): SubfeatureInfo {
  return {
    kind: 'subfeature',
    featureId,
    type,
    startBp: 1050,
    endBp: 9000,
    topPx: 0,
    bottomPx: 10,
    parentFeatureId: 'EDEN',
    displayLabel: featureId,
  }
}

const eden1 = isoform('EDEN.1', 'mRNA')

const fullGene = {
  uniqueId: 'EDEN',
  refName: 'ctgA',
  start: 1050,
  end: 9000,
  type: 'gene',
  name: 'EDEN',
  subfeatures: [
    {
      uniqueId: 'EDEN.1',
      refName: 'ctgA',
      start: 1050,
      end: 3902,
      type: 'mRNA',
      name: 'EDEN.1',
      subfeatures: [
        {
          uniqueId: 'e1',
          refName: 'ctgA',
          start: 1050,
          end: 1500,
          type: 'exon',
        },
        {
          uniqueId: 'e2',
          refName: 'ctgA',
          start: 3000,
          end: 3902,
          type: 'exon',
        },
      ],
    },
    {
      uniqueId: 'EDEN.2',
      refName: 'ctgA',
      start: 5000,
      end: 7600,
      type: 'mRNA',
      name: 'EDEN.2',
      subfeatures: [
        {
          uniqueId: 'e3',
          refName: 'ctgA',
          start: 5000,
          end: 5500,
          type: 'exon',
        },
        {
          uniqueId: 'e4',
          refName: 'ctgA',
          start: 7000,
          end: 7600,
          type: 'exon',
        },
      ],
    },
  ],
}

type Env = ReturnType<typeof createTestEnvironment>
type Display = ReturnType<Env['createDisplay']>['display']
type Session = ReturnType<Env['createDisplay']>['session']

function setup(subfeatureInfos: SubfeatureInfo[]) {
  const { createDisplay } = createTestEnvironment()
  const { display, session, mockRpcCall } = createDisplay()
  mockRpcCall.mockResolvedValue({ feature: fullGene })
  display.setRpcData(
    0,
    makeFeatureData({ flatbushItems: [gene], subfeatureInfos }),
    ctgA,
  )
  return { display, session }
}

function collapseItem(display: Display) {
  const items: MenuItem[] = display.contextMenuItems()
  const item = items.find(m => 'label' in m && m.label === 'Collapse introns')
  if (!item) {
    throw new Error('no "Collapse introns" menu item')
  }
  return item
}

function clickCollapse(display: Display) {
  const item = collapseItem(display)
  if (!('onClick' in item)) {
    throw new Error('expected a clickable item')
  }
  item.onClick()
}

async function queuedDialogProps(session: Session) {
  await waitFor(() => {
    expect(session.queuedDialogs).toHaveLength(1)
  })
  return session.queuedDialogs[0]![1]
}

function transcriptIds(props: Record<string, unknown>) {
  const { transcripts } = props
  return Array.isArray(transcripts)
    ? transcripts.filter(isFeature).map(t => t.id())
    : []
}

describe('collapse introns context menu', () => {
  it('is a single row, not a scope submenu', () => {
    const { display } = setup([eden1])
    rightClick(display, gene, eden1)

    expect(collapseItem(display)).not.toHaveProperty('subMenu')
  })

  it('hands the dialog every transcript when the click resolved none', async () => {
    const { display, session } = setup([])
    rightClick(display, gene)
    clickCollapse(display)

    const props = await queuedDialogProps(session)
    expect(transcriptIds(props)).toEqual(['EDEN.1', 'EDEN.2'])
    expect(props.featureName).toBe('EDEN')
    expect(props.initialTranscriptId).toBeUndefined()
  })

  it('preselects the clicked transcript without narrowing the dialog to it', async () => {
    const { display, session } = setup([eden1])
    rightClick(display, gene, eden1)
    clickCollapse(display)

    const props = await queuedDialogProps(session)
    expect(transcriptIds(props)).toEqual(['EDEN.1', 'EDEN.2'])
    expect(props.initialTranscriptId).toBe('EDEN.1')
    expect(props.featureId).toBe('EDEN')
    expect(props.featureName).toBe('EDEN')
  })

  it('passes a non-transcript subpart hit through as a preselection miss', async () => {
    const matureProtein = isoform('EDEN.1.p1', 'mature_protein_region_of_CDS')
    const { display, session } = setup([matureProtein])
    rightClick(display, gene, matureProtein)
    clickCollapse(display)

    const props = await queuedDialogProps(session)
    expect(props.initialTranscriptId).toBe('EDEN.1.p1')
    expect(transcriptIds(props)).toEqual(['EDEN.1', 'EDEN.2'])
  })
})

// The gate is a type test, so these ask the menu itself rather than
// re-asserting the predicate core already pins.
describe('which right-clicked features are offered a collapse', () => {
  function offersCollapse(type: string | undefined) {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const item = makeFlatbushItem({
      featureId: 'f1',
      type,
      startBp: 1050,
      endBp: 9000,
    })
    display.setRpcData(0, makeFeatureData({ flatbushItems: [item] }), ctgA)
    rightClick(display, item)
    const items: MenuItem[] = display.contextMenuItems()
    return items.some(m => 'label' in m && m.label === 'Collapse introns')
  }

  it.each(['gene', 'mRNA', 'lnc_RNA', 'cDNA_match', 'EST_match', 'match'])(
    'offers it on %s',
    type => {
      expect(offersCollapse(type)).toBe(true)
    },
  )

  it.each([
    'exon',
    'match_part',
    'repeat_region',
    'intergenic_region',
    undefined,
  ])('withholds it from %s', type => {
    expect(offersCollapse(type)).toBe(false)
  })
})

describe('the collapsed view is titled the way the track labels', () => {
  const labelled = makeFlatbushItem({
    featureId: 'EDEN',
    type: 'gene',
    name: 'dystrophin',
    startBp: 1050,
    endBp: 9000,
  })
  const labelledIsoform = {
    ...isoform('EDEN.1', 'mRNA'),
    displayLabel: 'dystrophin-201',
  }

  function setupLabelled(subfeatureInfos: SubfeatureInfo[]) {
    const { createDisplay } = createTestEnvironment()
    const { display, session, mockRpcCall } = createDisplay()
    mockRpcCall.mockResolvedValue({ feature: fullGene })
    display.setRpcData(
      0,
      makeFeatureData({ flatbushItems: [labelled], subfeatureInfos }),
      ctgA,
    )
    return { display, session }
  }

  it('titles the gene scope with the drawn gene label', async () => {
    const { display, session } = setupLabelled([])
    rightClick(display, labelled)
    clickCollapse(display)

    expect((await queuedDialogProps(session)).featureName).toBe('dystrophin')
  })

  it('titles a transcript click with the drawn gene label it is scoped under', async () => {
    const { display, session } = setupLabelled([labelledIsoform])
    rightClick(display, labelled, labelledIsoform)
    clickCollapse(display)

    expect((await queuedDialogProps(session)).featureName).toBe('dystrophin')
  })

  it('carries the drawn isoform label through to the dialog', async () => {
    const { display, session } = setupLabelled([labelledIsoform])
    rightClick(display, labelled, labelledIsoform)
    clickCollapse(display)

    const { transcriptLabels } = await queuedDialogProps(session)
    expect(transcriptLabels).toEqual(new Map([['EDEN.1', 'dystrophin-201']]))
  })
})
