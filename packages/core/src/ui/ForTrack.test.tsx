import { render } from '@testing-library/react'

import ForTrack from './ForTrack.tsx'

import type { TrackSelector } from './extensionSelectors.ts'

function shown(
  select: TrackSelector,
  subject: {
    model?: { type?: string; trackId?: string; trackType?: string }
    config?: { trackId?: string; type?: string }
  },
) {
  return render(
    <ForTrack {...subject} select={select} fallback={<div>default</div>}>
      <div>mine</div>
    </ForTrack>,
  ).container.textContent
}

test('an empty selector matches everything', () => {
  expect(shown({}, { model: { trackId: 'anything' } })).toBe('mine')
})

test('every field given has to match', () => {
  const select = { trackType: 'VariantTrack', trackId: 'volvox.inv.vcf' }
  expect(shown(select, { model: { ...select } })).toBe('mine')
  expect(shown(select, { model: { trackType: 'VariantTrack' } })).toBe(
    'default',
  )
})

test('a field can name several accepted values', () => {
  const select = { trackType: ['VariantTrack', 'AlignmentsTrack'] }
  expect(shown(select, { model: { trackType: 'AlignmentsTrack' } })).toBe(
    'mine',
  )
  expect(shown(select, { model: { trackType: 'FeatureTrack' } })).toBe(
    'default',
  )
})

test('widgetType matches the widget model type, not the track type', () => {
  const select = { widgetType: 'AlignmentsFeatureWidget' }
  expect(shown(select, { model: { type: 'AlignmentsFeatureWidget' } })).toBe(
    'mine',
  )
  expect(shown(select, { model: { type: 'BaseFeatureWidget' } })).toBe(
    'default',
  )
})

// the reason the framework owns the matching: copyTrackSnapshot appends
// `-${Date.now()}`, and copying a copy appends again
test('a bare trackId matches the users copies of that track', () => {
  const select = { trackId: 'volvox.inv.vcf' }
  expect(shown(select, { model: { trackId: 'volvox.inv.vcf' } })).toBe('mine')
  expect(
    shown(select, { model: { trackId: 'volvox.inv.vcf-1712000000000' } }),
  ).toBe('mine')
  expect(
    shown(select, {
      model: { trackId: 'volvox.inv.vcf-1712000000000-1712000000001' },
    }),
  ).toBe('mine')
})

test('a bare trackId does not match an unrelated longer id', () => {
  const select = { trackId: 'volvox.inv.vcf' }
  expect(shown(select, { model: { trackId: 'volvox.inv.vcf-extra' } })).toBe(
    'default',
  )
  expect(shown(select, { model: { trackId: 'volvox.inv.vcf2' } })).toBe(
    'default',
  )
})

test('a regex trackId is matched as written', () => {
  expect(
    shown({ trackId: /^volvox\./ }, { model: { trackId: 'volvox.bam' } }),
  ).toBe('mine')
  expect(
    shown({ trackId: /^volvox\./ }, { model: { trackId: 'other.bam' } }),
  ).toBe('default')
})

// the About points hand over a track config rather than a widget model, and a
// config's `type` is the track type
test('a track config is selected on the same fields as a model', () => {
  const select = { trackType: 'VariantTrack', trackId: 'volvox.inv.vcf' }
  expect(
    shown(select, {
      config: { type: 'VariantTrack', trackId: 'volvox.inv.vcf' },
    }),
  ).toBe('mine')
  expect(
    shown(select, {
      config: { type: 'FeatureTrack', trackId: 'volvox.inv.vcf' },
    }),
  ).toBe('default')
})

test('a config copy of the selected track still matches', () => {
  expect(
    shown(
      { trackId: 'volvox.inv.vcf' },
      { config: { trackId: 'volvox.inv.vcf-1712000000000' } },
    ),
  ).toBe('mine')
})

test('nothing renders when a panel omits the fallback', () => {
  expect(
    render(
      <ForTrack select={{ trackType: 'VariantTrack' }} model={{}}>
        <div>mine</div>
      </ForTrack>,
    ).container.textContent,
  ).toBe('')
})
