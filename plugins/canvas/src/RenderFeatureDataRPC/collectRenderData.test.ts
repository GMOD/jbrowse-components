import { createJBrowseTheme } from '@jbrowse/core/ui'

import { collectRenderData } from './collectRenderData.ts'
import { mockDisplayConfig } from './testUtils.ts'

import type { FeatureLayout } from './types.ts'
import type { Feature } from '@jbrowse/core/util'

function mockFeature(opts: {
  type: string
  id: string
  start: number
  end: number
  strand?: number
  phase?: number
  subfeatures?: Feature[]
}): Feature {
  const { strand = 1, subfeatures = [], ...rest } = opts
  const map: Record<string, unknown> = { strand, subfeatures, ...rest }
  return {
    get: (key: string) => map[key],
    id: () => opts.id,
    parent: () => undefined,
  } as unknown as Feature
}

function boxLayout(feature: Feature): FeatureLayout {
  return {
    feature,
    glyphType: 'Box',
    y: 0,
    height: 10,
    totalLayoutHeight: 10,
    children: [],
  }
}

const theme = createJBrowseTheme()
const config = mockDisplayConfig({ color: '#cccc99' })

// Two CDS exons whose 9 coding bases (3 codons) make codon index 1 straddle the
// exon boundary: bases 100,101,102 (codon0) | 103 + 200,201 (codon1) | 202,203,204 (codon2)
function twoExonTranscript() {
  const cds1 = mockFeature({ type: 'CDS', id: 'cds1', start: 100, end: 104 })
  const cds2 = mockFeature({ type: 'CDS', id: 'cds2', start: 200, end: 205 })
  const mRNA = mockFeature({
    type: 'mRNA',
    id: 'tx1',
    start: 100,
    end: 205,
    subfeatures: [cds1, cds2],
  })
  return {
    layout: {
      feature: mRNA,
      glyphType: 'ProcessedTranscript' as const,
      y: 0,
      height: 10,
      totalLayoutHeight: 10,
      children: [boxLayout(cds1), boxLayout(cds2)],
    },
  }
}

describe('collectRenderData peptide overlay', () => {
  it('maps the protein onto CDS exons, splitting a codon at the exon boundary', () => {
    const { layout } = twoExonTranscript()
    const result = collectRenderData(
      [layout],
      0,
      1000,
      config,
      theme,
      false,
      new Map([['tx1', { protein: 'MFK' }]]),
    )

    const overlay = result.aminoAcidOverlay!
    expect(overlay).toBeDefined()

    // codon0 (M) is a full triplet entirely within exon 1
    expect(overlay).toContainEqual(
      expect.objectContaining({
        aminoAcid: 'M',
        proteinIndex: 0,
        startBp: 100,
        endBp: 103,
        isStopOrNonTriplet: false,
      }),
    )
    // codon1 (F) is split: 1 base in exon 1, 2 bases in exon 2 — both partial
    const codon1 = overlay.filter(a => a.proteinIndex === 1)
    expect(codon1).toHaveLength(2)
    expect(codon1.every(a => a.isStopOrNonTriplet)).toBe(true)
    expect(codon1.map(a => [a.startBp, a.endBp]).sort()).toEqual([
      [103, 104],
      [200, 202],
    ])
    // codon2 (K) is a full triplet entirely within exon 2
    expect(overlay).toContainEqual(
      expect.objectContaining({
        aminoAcid: 'K',
        proteinIndex: 2,
        startBp: 202,
        endBp: 205,
        isStopOrNonTriplet: false,
      }),
    )
  })

  it('emits no amino-acid overlay when the transcript has no peptide data', () => {
    const { layout } = twoExonTranscript()
    const result = collectRenderData([layout], 0, 1000, config, theme, false)
    expect(result.aminoAcidOverlay).toBeUndefined()
  })
})

describe('collectRenderData intron chevrons', () => {
  // twoExonTranscript has exons 100-104 and 200-205, so a single intron line
  // spans the 104-200 gap. The line's `direction` drives chevron rendering.
  it('sets intron line direction to the strand when chevrons are enabled', () => {
    const { layout } = twoExonTranscript()
    const cfg = mockDisplayConfig({ displayDirectionalChevrons: true })
    const result = collectRenderData([layout], 0, 1000, cfg, theme, false)
    expect([...result.lineDirections]).toEqual([1])
  })

  it('zeroes intron line direction when chevrons are disabled', () => {
    const { layout } = twoExonTranscript()
    const cfg = mockDisplayConfig({ displayDirectionalChevrons: false })
    const result = collectRenderData([layout], 0, 1000, cfg, theme, false)
    expect([...result.lineDirections]).toEqual([0])
  })
})
