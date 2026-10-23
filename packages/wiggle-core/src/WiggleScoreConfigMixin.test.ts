import { getConf, setConf } from '@jbrowse/core/configuration'

import type { WiggleScoreConfigHost } from './WiggleScoreConfigMixin.ts'
import type { YFieldConfigHost } from './YFieldConfigMixin.ts'
import type {
  ConfigurationSchemaForModel,
  ConfigurationSlotPath,
  HostChecksSlotNames,
} from '@jbrowse/core/configuration'

// Typecheck-only: an unused @ts-expect-error fails `pnpm typecheck`.
const scoreConfigPin: HostChecksSlotNames<WiggleScoreConfigHost> = true
const yFieldPin: HostChecksSlotNames<YFieldConfigHost> = true

test('both hosts check the slot names their mixin reads', () => {
  const score = {} as WiggleScoreConfigHost
  const field = {} as YFieldConfigHost
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
  expect([scoreConfigPin, yFieldPin, reads, writes]).toHaveLength(4)
})

// `LinearMarkDisplay` composes the base against a y channel with no `field`,
// where the read would answer `undefined` with no diagnostic anywhere.
test('the score-config host cannot reach the y field', () => {
  const score = {} as WiggleScoreConfigHost
  const field = {} as YFieldConfigHost
  const reads = () => [
    getConf(field, ['encoding', 'y', 'field']),
    // @ts-expect-error
    getConf(score, ['encoding', 'y', 'field']),
  ]
  expect([reads]).toHaveLength(1)
})

type HostPath = ConfigurationSlotPath<
  ConfigurationSchemaForModel<WiggleScoreConfigHost['configuration']>
>

test('a y scale path the host schema lacks fails the typecheck', () => {
  const paths = [
    ['encoding', 'y', 'scale', 'domainMin'] as const satisfies HostPath,
    // @ts-expect-error
    ['encoding', 'y', 'scale', 'domainMinn'] as const satisfies HostPath,
  ]
  expect(paths).toHaveLength(2)
})
