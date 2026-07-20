import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import { createTestEnvironment } from './testEnv.ts'

import type { SubfeatureInfo } from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { MenuItem } from '@jbrowse/core/ui'

const ctgA = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10_000 }

// Volvox's EDEN locus, copied from test_data/volvox/volvox.sort.gff3 — the
// canonical GFF3 example, and the shape a span-only identity cannot address:
//   gene EDEN   1050..9000
//   mRNA EDEN.1 1050..9000  <- same span as the gene
//   mRNA EDEN.2 1050..9000  <- same span as the gene AND as EDEN.1
//   mRNA EDEN.3 1300..9000
// Only the name separates EDEN.1 from EDEN.2, so a fixture that nests a
// transcript strictly inside its gene tests a case real data rarely produces.
const gene = makeFlatbushItem({
  featureId: 'EDEN',
  type: 'gene',
  name: 'EDEN',
  startBp: 1050,
  endBp: 9000,
})

function makeTranscript(
  overrides: Partial<SubfeatureInfo> = {},
): SubfeatureInfo {
  return {
    kind: 'subfeature',
    featureId: 'EDEN.1',
    type: 'mRNA',
    startBp: 1050,
    endBp: 9000,
    topPx: 0,
    bottomPx: 10,
    parentFeatureId: 'EDEN',
    displayLabel: 'EDEN.1',
    ...overrides,
  }
}

const eden1 = makeTranscript()
const eden2 = makeTranscript({ featureId: 'EDEN.2', displayLabel: 'EDEN.2' })
const eden3 = makeTranscript({
  featureId: 'EDEN.3',
  displayLabel: 'EDEN.3',
  startBp: 1300,
})

type Display = ReturnType<
  ReturnType<typeof createTestEnvironment>['createDisplay']
>['display']

function loadGene(display: Display, subfeatureInfos: SubfeatureInfo[]) {
  display.setRpcData(
    0,
    makeFeatureData({ flatbushItems: [gene], subfeatureInfos }),
    10,
    ctgA,
  )
  // the menu's handlers resolve the refName to store on a highlight through
  // loadedRegions, which fetchRegions populates separately from setRpcData
  display.setLoadedRegion(0, ctgA)
}

// the highlight scopes now live in a "Highlight" submenu, so flatten one level
// of subMenu before matching labels
function flatten(items: MenuItem[]): MenuItem[] {
  return items.flatMap(m => ('subMenu' in m ? flatten(m.subMenu) : [m]))
}

function menuLabels(display: Display) {
  return flatten(display.contextMenuItems()).map(m =>
    'label' in m ? m.label : '',
  )
}

function clickLabel(display: Display, label: string) {
  const item = flatten(display.contextMenuItems()).find(
    m => 'label' in m && m.label === label,
  )
  if (item && 'onClick' in item) {
    item.onClick()
  } else {
    throw new Error(`no clickable menu item labeled "${label}"`)
  }
}

describe('transcript highlight context menu', () => {
  it('offers both scopes for an isoform sharing its gene span (EDEN.1)', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    loadGene(display, [eden1, eden2, eden3])

    display.openContextMenu(gene, 0, 0, 0, eden1)

    // the entry must survive EDEN.1's span being identical to EDEN's
    expect(menuLabels(display)).toContain('mRNA EDEN.1')
    expect(menuLabels(display)).toContain('Whole gene')
  })

  it('boxes EDEN.1 alone, not its gene, despite the identical span', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    loadGene(display, [eden1, eden2, eden3])

    display.openContextMenu(gene, 0, 0, 0, eden1)
    clickLabel(display, 'mRNA EDEN.1')

    expect([...display.highlightedFeatureIdSet]).toEqual(['EDEN.1'])
    // the packer keys on top-level ids, so the parent gene is what gets pinned
    expect([...display.layoutPinnedFeatureIdSet]).toEqual(['EDEN'])
  })

  it('distinguishes EDEN.1 from EDEN.2, which share an exact span', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    loadGene(display, [eden1, eden2, eden3])

    display.openContextMenu(gene, 0, 0, 0, eden2)
    clickLabel(display, 'mRNA EDEN.2')

    // only the name separates these two; a span-keyed highlight boxes both
    expect([...display.highlightedFeatureIdSet]).toEqual(['EDEN.2'])
  })

  it('highlights a nested isoform (EDEN.3) without touching its siblings', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    loadGene(display, [eden1, eden2, eden3])

    display.openContextMenu(gene, 0, 0, 0, eden3)
    clickLabel(display, 'mRNA EDEN.3')

    expect([...display.highlightedFeatureIdSet]).toEqual(['EDEN.3'])
  })

  it('the whole-gene scope boxes the gene even when an isoform was clicked', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    loadGene(display, [eden1, eden2, eden3])

    display.openContextMenu(gene, 0, 0, 0, eden1)
    clickLabel(display, 'Whole gene')

    // the gene, and none of its three isoforms
    expect([...display.highlightedFeatureIdSet]).toEqual(['EDEN'])
  })

  it('toggles the isoform highlight back off', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    loadGene(display, [eden1, eden2, eden3])

    display.openContextMenu(gene, 0, 0, 0, eden1)
    clickLabel(display, 'mRNA EDEN.1')
    clickLabel(display, 'Remove mRNA highlight')

    expect(display.highlightedFeatureIdSet.size).toBe(0)
    expect(display.featureHighlights.length).toBe(0)
  })

  it('keeps the single feature-level entry when no subfeature was clicked', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    loadGene(display, [eden1, eden2, eden3])

    display.openContextMenu(gene, 0, 0, 0)

    expect(menuLabels(display)).toContain('Highlight feature')
    expect(menuLabels(display)).not.toContain('Whole gene')
  })

  it('names each scope by its own type, not a hardcoded transcript/gene', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    // subfeatureInfos carries non-transcripts too — a transposon's LTR parts
    const repeat = makeFlatbushItem({
      featureId: 'repeat-1',
      type: 'repeat_region',
      startBp: 1050,
      endBp: 9000,
    })
    const ltr = makeTranscript({
      featureId: 'ltr-1',
      type: 'LTR',
      displayLabel: 'LTR_5',
      parentFeatureId: 'repeat-1',
    })
    display.setRpcData(
      0,
      makeFeatureData({ flatbushItems: [repeat], subfeatureInfos: [ltr] }),
      10,
      ctgA,
    )
    display.setLoadedRegion(0, ctgA)

    display.openContextMenu(repeat, 0, 0, 0, ltr)

    expect(menuLabels(display)).toContain('LTR LTR_5')
    expect(menuLabels(display)).toContain('Whole repeat_region')
  })

  it('falls back to a generic label for an unnamed subfeature', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const unnamed = makeTranscript({ displayLabel: undefined })
    loadGene(display, [unnamed])

    display.openContextMenu(gene, 0, 0, 0, unnamed)

    expect(menuLabels(display)).toContain('This mRNA')
  })

  it('falls back to span alone for an unnamed subfeature, boxing its twins', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const unnamed = makeTranscript({ displayLabel: undefined })
    loadGene(display, [unnamed, eden2])

    display.openContextMenu(gene, 0, 0, 0, unnamed)
    clickLabel(display, 'This mRNA')

    // no name to tell it from its same-span sibling, so both get boxed. Deliberate:
    // requiring a name here would resolve to nothing and make the click dead.
    expect([...display.highlightedFeatureIdSet]).toEqual(['EDEN.1', 'EDEN.2'])
  })

  it('boxes the clicked isoform on hover while the menu is open', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    loadGene(display, [eden1, eden2, eden3])

    display.openContextMenu(gene, 0, 0, 0, eden1)

    expect(display.subfeatureIdUnderMouse).toBe('EDEN.1')
    expect(display.featureIdUnderMouse).toBe('EDEN')
  })

  it('leaves the text-search highlight path matching fuzzily', () => {
    const { createDisplay } = createTestEnvironment()
    // an unscoped highlight is what trix produces: span-first, name as rescue
    const { display } = createDisplay({
      featureHighlights: [
        { refName: 'ctgA', start: 1050, end: 9000, name: 'EDEN' },
      ],
    })
    loadGene(display, [eden1, eden2, eden3])

    // still resolves to the gene by span, unaffected by the new subfeature scope
    expect([...display.highlightedFeatureIdSet]).toEqual(['EDEN'])
  })

  it('scopes an isoform highlight down from a search highlight on its gene', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({
      featureHighlights: [
        { refName: 'ctgA', start: 1050, end: 9000, name: 'EDEN' },
      ],
    })
    loadGene(display, [eden1, eden2, eden3])

    display.openContextMenu(gene, 0, 0, 0, eden1)

    // the search highlight boxes the gene, so EDEN.1 is NOT highlighted and the
    // menu offers to add it — the click must not be swallowed as a duplicate
    // just because the search highlight's span happens to equal EDEN.1's
    clickLabel(display, 'mRNA EDEN.1')

    expect([...display.highlightedFeatureIdSet]).toEqual(['EDEN', 'EDEN.1'])
    expect(menuLabels(display)).toContain('Remove mRNA highlight')
  })

  it('removing an isoform highlight spares the gene highlight boxing its parent', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({
      featureHighlights: [
        { refName: 'ctgA', start: 1050, end: 9000, name: 'EDEN' },
      ],
    })
    loadGene(display, [eden1, eden2, eden3])

    display.openContextMenu(gene, 0, 0, 0, eden1)
    clickLabel(display, 'mRNA EDEN.1')
    clickLabel(display, 'Remove mRNA highlight')

    // the gene highlight fuzzily MATCHES EDEN.1's span (identical to the gene's)
    // but boxes the gene, not the isoform — so it must survive. Removal asks what
    // is actually boxed, never re-runs the heuristic matcher.
    expect([...display.highlightedFeatureIdSet]).toEqual(['EDEN'])
    expect(display.featureHighlights.length).toBe(1)
  })
})
