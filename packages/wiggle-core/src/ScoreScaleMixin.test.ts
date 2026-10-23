import { getConf, setConf } from '@jbrowse/core/configuration'

import type { ScoreScaleHost, ScoreScaleHostPath } from './ScoreScaleMixin.ts'
import type { HostChecksSlotNames } from '@jbrowse/core/configuration'

// Typecheck-only, the way `extensionPoints.test.ts` asserts its guarantee: an
// unused @ts-expect-error fails `pnpm typecheck`. It asks `ScoreScaleHost`
// rather than a composed model on purpose — a test model's own schema is
// concrete and checks the name itself, so asking that passes whatever the mixin
// casts to.
const scoreScalePin: HostChecksSlotNames<ScoreScaleHost> = true

test('the host type checks the member names the mixin reads and writes through it', () => {
  const host = {} as ScoreScaleHost
  const read = () => {
    // @ts-expect-error
    return getConf(host, ['scales', 'y', 'domainMinn'])
  }
  const write = () => {
    // @ts-expect-error
    setConf(host, ['scales', 'y', 'domainMinn'], 0)
  }
  expect([scoreScalePin, read, write]).toHaveLength(3)
})

test('a map path the host schema lacks fails the typecheck', () => {
  const paths = [
    // @ts-expect-error
    ['scales', 'y', 'domainMinn'] as const satisfies ScoreScaleHostPath,
  ]
  expect(paths).toHaveLength(1)
})
