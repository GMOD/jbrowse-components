import { getConf, readConfObject } from '@jbrowse/core/configuration'

import configSchemaFactory from './configSchema.ts'

import type stateModelFactory from './model.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

// The compile-time half is `assertType` (see
// packages/core/src/configuration/configTypeNarrowing.test.ts for the idiom),
// checked by `pnpm typecheck` rather than jest: a plain typecheck cannot catch a
// read silently widening to `any`, since `any` is assignable to everything.

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
function assertType<Check extends true>(_check?: Check): void {}

// never called — instantiating the display needs a whole session, and tsc
// checks the body regardless
export function typeGuards(
  model: Instance<ReturnType<typeof stateModelFactory>>,
) {
  const own = getConf(model, 'showInsertionGlyphs')
  assertType<Equal<typeof own, boolean>>()

  const shared = getConf(model, 'renderingMode')
  assertType<Equal<typeof shared, 'alleleCount' | 'phased'>>()

  // @ts-expect-error a slot name outside the schema stays a hard error
  getConf(model, 'notARealSlot')
}

test('showInsertionGlyphs defaults on', () => {
  const conf = configSchemaFactory().create({
    type: 'LinearMultiSampleVariantDisplay',
    displayId: 'regular',
  })
  expect(readConfObject(conf, 'showInsertionGlyphs')).toBe(true)
})
