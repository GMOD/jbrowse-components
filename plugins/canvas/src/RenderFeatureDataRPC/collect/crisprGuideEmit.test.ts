import { createJBrowseTheme } from '@jbrowse/core/ui'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { CRISPR_CUT_COLOR, CRISPR_PAM_COLOR } from './glyphColors.ts'
import { processFeatureRecord } from './glyphEmitters.ts'
import { createCollector } from './renderContext.ts'
import { findGlyph } from '../glyphs/findGlyph.ts'
import { mockDisplayConfig } from '../testUtils.ts'

import type { RenderContext } from './renderContext.ts'
import type { Feature } from '@jbrowse/core/util'

function mockFeature(
  data: Record<string, unknown>,
  subfeatures: Feature[] = [],
): Feature {
  return {
    get: (key: string) => (key === 'subfeatures' ? subfeatures : data[key]),
    id: () => String(data.uniqueId ?? 'feat'),
    parent: () => undefined,
  } as unknown as Feature
}

function makeContext(): RenderContext {
  return {
    config: mockDisplayConfig(),
    theme: createJBrowseTheme(),
    colorByCDS: false,
    jexl: createJexlInstance(),
  }
}

// plus-strand SpCas9 guide: protospacer 80..100, PAM 100..103, cut at 97
function guideFeature() {
  const pam = mockFeature({
    uniqueId: 'g1-pam',
    start: 100,
    end: 103,
    strand: 1,
    type: 'PAM',
  })
  return mockFeature(
    {
      uniqueId: 'g1',
      start: 80,
      end: 103,
      strand: 1,
      type: 'guide_rna',
      name: 'AAATTTAAATTTAAATTTAA',
      cutSite: 97,
    },
    [pam],
  )
}

test('emits protospacer box, red PAM overpaint, and dark cut tick', () => {
  const feature = guideFeature()
  const ctx = makeContext()
  const collector = createCollector()
  const layout = findGlyph(feature, ctx.config)({ feature, config: ctx.config })
  expect(layout.glyphType).toBe('CrisprGuide')

  processFeatureRecord(layout, ctx, collector)

  expect(collector.rects).toHaveLength(3)
  const [box, pam, cut] = collector.rects

  // protospacer+PAM box spans the whole feature in the config color
  expect(box).toMatchObject({ start: 80, end: 103 })
  expect(box!.color).not.toBe(CRISPR_PAM_COLOR)

  // PAM overpainted red at its own coordinates
  expect(pam).toMatchObject({ start: 100, end: 103, color: CRISPR_PAM_COLOR })

  // cut site: a zero-width dark rect (rect shader widens it to MIN_RECT_WIDTH_PX)
  expect(cut).toMatchObject({ start: 97, end: 97, color: CRISPR_CUT_COLOR })
})

test('registers the PAM as a hoverable subfeature and draws a strand arrow', () => {
  const feature = guideFeature()
  const ctx = makeContext()
  const collector = createCollector()
  const layout = findGlyph(feature, ctx.config)({ feature, config: ctx.config })

  processFeatureRecord(layout, ctx, collector)

  expect(collector.subfeatureInfos).toHaveLength(1)
  expect(collector.subfeatureInfos[0]).toMatchObject({
    type: 'PAM',
    startBp: 100,
    endBp: 103,
    parentFeatureId: 'g1',
  })
  expect(collector.arrows.length).toBeGreaterThanOrEqual(1)
})

test('omits the cut tick when the feature has no cutSite', () => {
  const pam = mockFeature({
    uniqueId: 'g2-pam',
    start: 100,
    end: 103,
    strand: 1,
    type: 'PAM',
  })
  const feature = mockFeature(
    { uniqueId: 'g2', start: 80, end: 103, strand: 1, type: 'guide_rna' },
    [pam],
  )
  const ctx = makeContext()
  const collector = createCollector()
  const layout = findGlyph(feature, ctx.config)({ feature, config: ctx.config })

  processFeatureRecord(layout, ctx, collector)

  // box + PAM only, no cut tick
  expect(collector.rects).toHaveLength(2)
})
