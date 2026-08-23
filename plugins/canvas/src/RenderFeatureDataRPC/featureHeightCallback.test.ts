import createJexlInstance from '@jbrowse/core/util/jexl'

import { collectRenderData } from './collectRenderData.ts'
import { findGlyph } from './glyphs/findGlyph.ts'
import { mockDisplayConfig } from './testUtils.ts'

import type { DisplayConfig } from './renderConfig.ts'
import type { Feature } from '@jbrowse/core/util'

// `featureHeight` is declared with `contextVariable: ['feature']`, so it can hold
// a `jexl:` expression like the color slots beside it. Layout used to read it as
// a bare number, which flowed the expression STRING into every height: the
// Float32Array pack turned each box into NaN (nothing painted) and
// `flatbushItems[].bottomPx` carried the expression text into the row packer.
// These pin the resolution and the degradation, since "renders nothing" is the
// one outcome a per-feature height must never have.

const jexl = createJexlInstance()

function mockFeature(opts: {
  type: string
  id: string
  start: number
  end: number
  subfeatures?: Feature[]
}): Feature {
  const map: Record<string, unknown> = {
    strand: 1,
    subfeatures: [],
    ...opts,
  }
  return {
    get: (key: string) => map[key],
    id: () => opts.id,
    parent: () => undefined,
  } as unknown as Feature
}

function render(feature: Feature, config: DisplayConfig) {
  const layout = findGlyph(feature, config)({ feature, config, jexl })
  return collectRenderData({
    layouts: [layout],
    regionStart: 0,
    regionEnd: 1000,
    config,
    colorByCDS: false,
    jexl,
  })
}

const gene = mockFeature({ type: 'gene', id: 'g1', start: 100, end: 200 })
const other = mockFeature({ type: 'CDS', id: 'c1', start: 300, end: 400 })

describe('featureHeight as a per-feature callback', () => {
  it('evaluates the expression against each feature', () => {
    const config = mockDisplayConfig({
      featureHeight: `jexl:get(feature,'type')=='gene'?20:8`,
    })

    expect([...render(gene, config).rectHeights]).toEqual([20])
    expect([...render(other, config).rectHeights]).toEqual([8])
  })

  it('carries the resolved height into the hit box the row packer reads', () => {
    const config = mockDisplayConfig({
      featureHeight: `jexl:get(feature,'type')=='gene'?20:8`,
    })
    const item = render(gene, config).flatbushItems[0]!

    // both were the raw expression string before, which the packer then compared
    // and scaled as if it were a number
    expect(item.featureHeightPx).toBe(20)
    expect(item.bottomPx).toBe(20)
  })

  it('falls back to the slot default when an expression returns a non-number', () => {
    const config = mockDisplayConfig({
      featureHeight: `jexl:'tall'`,
    })

    expect([...render(gene, config).rectHeights]).toEqual([10])
  })

  // The subtlest way this breaks again: `layoutSubfeatures` lays each transcript
  // out through `findGlyph(child)({...args, feature: child})`, so the jexl only
  // reaches a gene's transcripts by riding along in that spread. Rebuild those
  // args by hand and the expression stops resolving — but every height silently
  // becomes the fallback 10 and the track still DRAWS, so nothing else here
  // notices. Assert against the expression's own values, not the fallback.
  it('resolves the expression for nested transcripts, not just top-level', () => {
    const config = mockDisplayConfig({
      featureHeight: `jexl:get(feature,'type')=='mRNA'?24:6`,
    })
    const gene = mockFeature({
      type: 'gene',
      id: 'gene1',
      start: 100,
      end: 900,
      subfeatures: [
        mockFeature({
          type: 'mRNA',
          id: 'mrna1',
          start: 100,
          end: 500,
          subfeatures: [
            mockFeature({ type: 'CDS', id: 'cds1', start: 100, end: 300 }),
          ],
        }),
      ],
    })

    const layout = findGlyph(gene, config)({ feature: gene, config, jexl })

    // 24, not 10: the transcript resolved the callback against ITSELF
    expect(layout.children.map(c => c.height)).toEqual([24])
  })

  it('leaves a plain numeric slot on the fast path', () => {
    // no jexl passed at all: the number never reaches the callback reader, which
    // is what keeps the common config free of a per-feature evaluation
    const config = mockDisplayConfig({ featureHeight: 14 })
    const layout = findGlyph(gene, config)({ feature: gene, config })

    expect(layout.height).toBe(14)
  })
})
