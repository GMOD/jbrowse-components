import { getConf, setConf } from '@jbrowse/core/configuration'

import type { ScoreScaleHost } from './ScoreScaleMixin.ts'
import type { HostChecksSlotNames } from '@jbrowse/core/configuration'

// Typecheck-only, the way `extensionPoints.test.ts` asserts its guarantee: an
// unused @ts-expect-error fails `pnpm typecheck`. It asks `ScoreScaleHost`
// rather than a composed model on purpose — a test model's own schema is
// concrete and checks the name itself, so asking that passes whatever the mixin
// casts to.
const scoreScalePin: HostChecksSlotNames<ScoreScaleHost> = true

test('the host type checks the slot names the mixin reads through it', () => {
  const host = {} as ScoreScaleHost
  const read = () => {
    // @ts-expect-error
    return getConf(host, 'scaleTyp')
  }
  const write = () => {
    // @ts-expect-error
    setConf(host, 'scaleTyp', 'linear')
  }
  expect([scoreScalePin, read, write]).toHaveLength(3)
})
