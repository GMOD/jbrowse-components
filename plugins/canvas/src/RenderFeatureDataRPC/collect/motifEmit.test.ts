import { createJBrowseTheme } from '@jbrowse/core/ui'
import createJexlInstance from '@jbrowse/core/util/jexl'

import { findGlyph } from '../glyphs/findGlyph.ts'
import { mockDisplayConfig } from '../testUtils.ts'
import { CUT_SITE_COLOR } from './glyphColors.ts'
import { processFeatureRecord } from './glyphEmitters.ts'
import { createCollector } from './renderContext.ts'

import type { RenderContext } from './renderContext.ts'
import type { Feature } from '@jbrowse/core/util'

function mockFeature(data: Record<string, unknown>): Feature {
  return {
    get: (key: string) => (key === 'subfeatures' ? [] : data[key]),
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

function emit(feature: Feature) {
  const ctx = makeContext()
  const collector = createCollector()
  const layout = findGlyph(feature, ctx.config)({ feature, config: ctx.config })
  processFeatureRecord(layout, ctx, collector)
  return { layout, collector }
}

test('palindromic site draws staggered half-height cuts marking the overhang', () => {
  // EcoRI G^AATTC at 100..106: top cut at 101, bottom at 105 (4bp 5' overhang)
  const { layout, collector } = emit(
    mockFeature({
      uniqueId: 'm1',
      start: 100,
      end: 106,
      strand: 0,
      type: 'motif',
      name: 'EcoRI',
      cutSite: 101,
      cutSiteBottom: 105,
    }),
  )
  expect(layout.glyphType).toBe('Motif')

  expect(collector.rects).toHaveLength(3)
  const [box, top, bottom] = collector.rects
  expect(box).toMatchObject({ start: 100, end: 106 })

  // the two cuts split the box vertically, so the stagger reads as the overhang
  expect(top).toMatchObject({ start: 101, end: 101, color: CUT_SITE_COLOR })
  expect(bottom).toMatchObject({ start: 105, end: 105, color: CUT_SITE_COLOR })
  expect(top!.height).toBeCloseTo(box!.height / 2)
  expect(bottom!.height).toBeCloseTo(box!.height / 2)
  expect(bottom!.y).toBeCloseTo(top!.y + top!.height)
})

test('single known cut draws one full-height tick', () => {
  const { collector } = emit(
    mockFeature({
      uniqueId: 'm2',
      start: 100,
      end: 106,
      strand: 1,
      type: 'motif',
      name: 'BsaI',
      cutSite: 101,
    }),
  )

  expect(collector.rects).toHaveLength(2)
  const [box, cut] = collector.rects
  expect(cut).toMatchObject({ start: 101, end: 101, color: CUT_SITE_COLOR })
  // full height: a half tick would imply a second cut the notation never gave
  expect(cut!.height).toBeCloseTo(box!.height)
})

test('motif with no cut notation draws the site box alone', () => {
  const { collector } = emit(
    mockFeature({
      uniqueId: 'm3',
      start: 100,
      end: 106,
      strand: 1,
      type: 'motif',
      name: 'TATA',
    }),
  )

  expect(collector.rects).toHaveLength(1)
  expect(collector.rects[0]).toMatchObject({ start: 100, end: 106 })
})
