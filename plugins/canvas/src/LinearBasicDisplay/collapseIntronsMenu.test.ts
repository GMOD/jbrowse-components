import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { isFeature } from '@jbrowse/core/util'
import { waitFor } from '@testing-library/react'

import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { isGeneLikeType } from './collapseIntronsMenu.ts'
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

// What GetCanvasFeatureDetails returns for the whole gene: two isoforms, each
// spliced, with no exon shared between them — so the three scopes (each isoform
// and their union) produce distinguishable region counts.
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
  display.setLoadedRegion(0, ctgA)
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

function subMenu(item: MenuItem): MenuItem[] | undefined {
  return 'subMenu' in item ? resolveSubMenu(item) : undefined
}

function subMenuLabels(item: MenuItem) {
  return subMenu(item)?.map(m => ('label' in m ? m.label : undefined))
}

function clickSubMenu(item: MenuItem, label: string) {
  const row = subMenu(item)?.find(m => 'label' in m && m.label === label)
  if (!row || !('onClick' in row)) {
    throw new Error(`no clickable submenu row labeled "${label}"`)
  }
  row.onClick()
}

// the queued dialog's props, once the fetch behind the click has resolved
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
  it('collapses the whole gene when the click resolved no transcript', async () => {
    const { display, session } = setup([])
    rightClick(display, gene)

    const item = collapseItem(display)
    expect(subMenuLabels(item)).toBeUndefined()
    if (!('onClick' in item)) {
      throw new Error('expected a clickable item')
    }
    item.onClick()

    const props = await queuedDialogProps(session)
    expect(transcriptIds(props)).toEqual(['EDEN.1', 'EDEN.2'])
    expect(props.featureName).toBe('EDEN')
  })

  it('offers both scopes when the click landed on a transcript', () => {
    const { display } = setup([eden1])
    rightClick(display, gene, eden1)

    expect(subMenuLabels(collapseItem(display))).toEqual([
      'This transcript (EDEN.1)',
      'All transcripts',
    ])
  })

  it('scopes to the clicked transcript, keeping the gene as the solo target', async () => {
    const { display, session } = setup([eden1])
    rightClick(display, gene, eden1)
    clickSubMenu(collapseItem(display), 'This transcript (EDEN.1)')

    const props = await queuedDialogProps(session)
    expect(transcriptIds(props)).toEqual(['EDEN.1'])
    expect(props.featureName).toBe('EDEN.1')
    // solo matches the top-level drawn id, so it stays the gene even here
    expect(props.featureId).toBe('EDEN')
  })

  it('still reaches the union from a transcript click', async () => {
    const { display, session } = setup([eden1])
    rightClick(display, gene, eden1)
    clickSubMenu(collapseItem(display), 'All transcripts')

    const props = await queuedDialogProps(session)
    expect(transcriptIds(props)).toEqual(['EDEN.1', 'EDEN.2'])
  })

  it('leaves a non-transcript subpart hit as a whole-gene collapse', () => {
    const matureProtein = isoform('EDEN.1.p1', 'mature_protein_region_of_CDS')
    const { display } = setup([matureProtein])
    rightClick(display, gene, matureProtein)

    expect(subMenuLabels(collapseItem(display))).toBeUndefined()
  })
})

describe('isGeneLikeType', () => {
  it.each([
    'gene',
    'protein_coding_gene',
    'pseudogene',
    'ncRNA_gene',
    'V_gene_segment',
    'mRNA',
    'lnc_RNA',
    'tRNA',
    'transcript',
    'pseudogenic_transcript',
  ])('offers a collapse on %s', type => {
    expect(isGeneLikeType(type)).toBe(true)
  })

  it.each([
    'intergenic_region',
    'exon',
    'CDS',
    'mature_protein_region_of_CDS',
    'repeat_region',
    undefined,
  ])('withholds it from %s', type => {
    expect(isGeneLikeType(type)).toBe(false)
  })
})

// `labels.name` is a jexl slot, so a track can name its features by any
// attribute -- and then the glyph's label, the hover and this menu's own
// transcript row all read that, while the record's `name` is a different string
// underneath. Titling the collapsed view from the record opened a view named
// after something the user has never seen on this track.
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
    display.setLoadedRegion(0, ctgA)
    return { display, session }
  }

  it('titles the gene scope with the drawn gene label', async () => {
    const { display, session } = setupLabelled([])
    rightClick(display, labelled)

    const item = collapseItem(display)
    if (!('onClick' in item)) {
      throw new Error('expected a clickable item')
    }
    item.onClick()

    expect((await queuedDialogProps(session)).featureName).toBe('dystrophin')
  })

  it('titles the transcript scope with the drawn isoform label', async () => {
    const { display, session } = setupLabelled([labelledIsoform])
    rightClick(display, labelled, labelledIsoform)
    clickSubMenu(collapseItem(display), 'This transcript (dystrophin-201)')

    expect((await queuedDialogProps(session)).featureName).toBe(
      'dystrophin-201',
    )
  })
})
