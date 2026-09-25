import { getConf, setConf } from '@jbrowse/core/configuration'

import { liftScatterPointSize } from './WiggleScoreConfigMixin.ts'

import type { ScoreFieldConfigHost } from './ScoreFieldConfigMixin.ts'
import type { WiggleScoreConfigHost } from './WiggleScoreConfigMixin.ts'
import type { HostChecksSlotNames } from '@jbrowse/core/configuration'

// Typecheck-only: an unused @ts-expect-error fails `pnpm typecheck`.
const scoreConfigPin: HostChecksSlotNames<WiggleScoreConfigHost> = true
const scoreFieldPin: HostChecksSlotNames<ScoreFieldConfigHost> = true

test('both hosts check the slot names their mixin reads', () => {
  const score = {} as WiggleScoreConfigHost
  const field = {} as ScoreFieldConfigHost
  const reads = () => [
    // @ts-expect-error
    getConf(score, 'displayCrossHatche'),
    // @ts-expect-error
    getConf(field, 'scoreFields'),
  ]
  const writes = () => {
    // @ts-expect-error
    setConf(score, 'displayCrossHatche', true)
    // @ts-expect-error
    setConf(field, 'scoreFields', 'score')
  }
  expect([scoreConfigPin, scoreFieldPin, reads, writes]).toHaveLength(4)
})

// `LinearMarkDisplay` composes the base against a schema with no `scoreField`,
// where the read would answer `undefined` with no diagnostic anywhere.
test('the score-config host cannot reach scoreField', () => {
  const score = {} as WiggleScoreConfigHost
  const field = {} as ScoreFieldConfigHost
  const reads = () => [
    getConf(field, 'scoreField'),
    // @ts-expect-error
    getConf(score, 'scoreField'),
  ]
  expect([reads]).toHaveLength(1)
})

test('a v4 scatterPointSize becomes the size slot', () => {
  expect(liftScatterPointSize({ scatterPointSize: 5, height: 100 })).toEqual({
    size: 5,
    height: 100,
  })
})

// `migrateRetiredDisplays` rebuilds the track snapshot only where an entry
// changed identity, so returning the same object is what keeps a v5 config off
// that path.
test('an entry with no v4 scatterPointSize is left as it was', () => {
  const entry = { size: 5 }
  expect(liftScatterPointSize(entry)).toBe(entry)
})
