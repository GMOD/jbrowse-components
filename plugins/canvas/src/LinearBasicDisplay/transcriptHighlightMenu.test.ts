import {
  makeFeatureData,
  makeFlatbushItem,
} from '../RenderFeatureDataRPC/testUtils.ts'
import {
  clickContextMenuItem,
  contextMenuLabels,
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

function loadGene(display: TestDisplay, subfeatureInfos: SubfeatureInfo[]) {
  display.setRpcData(
    0,
    makeFeatureData({ flatbushItems: [gene], subfeatureInfos }),
    ctgA,
  )
}

describe('transcript highlight context menu', () => {
  it('offers both scopes for an isoform sharing its gene span (EDEN.1)', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    loadGene(display, [eden1, eden2, eden3])

    rightClick(display, gene, eden1)

    expect(contextMenuLabels(display)).toContain('mRNA (EDEN.1)')
    expect(contextMenuLabels(display)).toContain('Whole gene (EDEN)')
  })

  it('boxes EDEN.1 alone, not its gene, despite the identical span', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    loadGene(display, [eden1, eden2, eden3])

    rightClick(display, gene, eden1)
    clickContextMenuItem(display, 'mRNA (EDEN.1)')

    expect([...display.highlightedFeatureIdSet]).toEqual(['EDEN.1'])
    expect([...display.layoutPinnedFeatureIdSet]).toEqual([])
  })

  it('distinguishes EDEN.1 from EDEN.2, which share an exact span', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    loadGene(display, [eden1, eden2, eden3])

    rightClick(display, gene, eden2)
    clickContextMenuItem(display, 'mRNA (EDEN.2)')

    expect([...display.highlightedFeatureIdSet]).toEqual(['EDEN.2'])
  })

  it('highlights a nested isoform (EDEN.3) without touching its siblings', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    loadGene(display, [eden1, eden2, eden3])

    rightClick(display, gene, eden3)
    clickContextMenuItem(display, 'mRNA (EDEN.3)')

    expect([...display.highlightedFeatureIdSet]).toEqual(['EDEN.3'])
  })

  it('the whole-gene scope boxes the gene even when an isoform was clicked', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    loadGene(display, [eden1, eden2, eden3])

    rightClick(display, gene, eden1)
    clickContextMenuItem(display, 'Whole gene (EDEN)')

    expect([...display.highlightedFeatureIdSet]).toEqual(['EDEN'])
  })

  it('toggles the isoform highlight back off', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    loadGene(display, [eden1, eden2, eden3])

    rightClick(display, gene, eden1)
    clickContextMenuItem(display, 'mRNA (EDEN.1)')
    clickContextMenuItem(display, 'Remove mRNA (EDEN.1) highlight')

    expect(display.highlightedFeatureIdSet.size).toBe(0)
    expect(display.featureHighlights.length).toBe(0)
  })

  it('keeps the single feature-level entry when no subfeature was clicked', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    loadGene(display, [eden1, eden2, eden3])

    rightClick(display, gene)

    expect(contextMenuLabels(display)).toContain('Highlight feature')
    expect(contextMenuLabels(display)).not.toContain('Whole gene (EDEN)')
  })

  it('names each scope by its own type, not a hardcoded transcript/gene', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
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
      ctgA,
    )

    rightClick(display, repeat, ltr)

    expect(contextMenuLabels(display)).toContain('LTR (LTR_5)')
    expect(contextMenuLabels(display)).toContain('Whole repeat_region')
  })

  it('falls back to a generic label for an unnamed subfeature', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const unnamed = makeTranscript({ displayLabel: undefined })
    loadGene(display, [unnamed])

    rightClick(display, gene, unnamed)

    expect(contextMenuLabels(display)).toContain('This mRNA')
  })

  it('boxes only the clicked subfeature even when unnamed, not its same-span twin', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    const unnamed = makeTranscript({ displayLabel: undefined })
    loadGene(display, [unnamed, eden2])

    rightClick(display, gene, unnamed)
    clickContextMenuItem(display, 'This mRNA')

    expect([...display.highlightedFeatureIdSet]).toEqual(['EDEN.1'])
  })

  it('boxes the clicked isoform while the menu is open', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay()
    loadGene(display, [eden1, eden2, eden3])

    rightClick(display, gene, eden1)

    expect(display.hoverBoxSubfeature?.featureId).toBe('EDEN.1')
    expect(display.hoverBoxFeature?.featureId).toBe('EDEN')
  })

  it('leaves the text-search highlight path matching fuzzily', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({
      featureHighlights: [
        { refName: 'ctgA', start: 1050, end: 9000, name: 'EDEN' },
      ],
    })
    loadGene(display, [eden1, eden2, eden3])

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

    rightClick(display, gene, eden1)

    clickContextMenuItem(display, 'mRNA (EDEN.1)')

    expect([...display.highlightedFeatureIdSet]).toEqual(['EDEN', 'EDEN.1'])
    expect(contextMenuLabels(display)).toContain(
      'Remove mRNA (EDEN.1) highlight',
    )
  })

  it('removing an isoform highlight spares the gene highlight boxing its parent', () => {
    const { createDisplay } = createTestEnvironment()
    const { display } = createDisplay({
      featureHighlights: [
        { refName: 'ctgA', start: 1050, end: 9000, name: 'EDEN' },
      ],
    })
    loadGene(display, [eden1, eden2, eden3])

    rightClick(display, gene, eden1)
    clickContextMenuItem(display, 'mRNA (EDEN.1)')
    clickContextMenuItem(display, 'Remove mRNA (EDEN.1) highlight')

    expect([...display.highlightedFeatureIdSet]).toEqual(['EDEN'])
    expect(display.featureHighlights.length).toBe(1)
  })
})
