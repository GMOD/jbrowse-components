import { getConf, readConfObject } from '@jbrowse/core/configuration'

import matrixConfigFactory from '../LinearMultiSampleVariantMatrixDisplay/configSchema.ts'
import configSchemaFactory from './configSchema.ts'

import type matrixStateModelFactory from '../LinearMultiSampleVariantMatrixDisplay/model.ts'
import type stateModelFactory from './model.ts'
import type { Instance } from '@jbrowse/mobx-state-tree'

// `showInsertionGlyphs` belongs to this display alone: it widens a cell to say
// how long an insertion is, and only this display draws cells at genomic
// positions where a width means anything. It used to sit in the *shared* schema
// because the base model factory's `configSchema` param is typed to
// `SharedVariantConfigModel`, which made an own-slot `getConf` read a compile
// error. Redeclaring `configuration` in the subclass compose fixed that
// (`types.compose` overrides props rather than intersecting them), so the slot
// could move to where it applies.
//
// Both halves need guarding. The runtime half below is ordinary jest; the
// compile-time half is `assertType` (see
// packages/core/src/configuration/configTypeNarrowing.test.ts for the idiom) and
// is checked by `pnpm typecheck`, not by jest — a plain typecheck cannot catch a
// read silently widening to `any`, since `any` is assignable to everything.

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false
function assertType<Check extends true>(_check?: Check): void {}

// never called — instantiating either display needs a whole session, and tsc
// checks the body regardless
export function typeGuards(
  model: Instance<ReturnType<typeof stateModelFactory>>,
  matrix: Instance<ReturnType<typeof matrixStateModelFactory>>,
) {
  // the own slot narrows to its declared type rather than widening to `any`
  const own = getConf(model, 'showInsertionGlyphs')
  assertType<Equal<typeof own, boolean>>()

  // redeclaring `configuration` must not cost the shared slots their narrowing
  const shared = getConf(model, 'renderingMode')
  assertType<Equal<typeof shared, 'alleleCount' | 'phased'>>()

  // @ts-expect-error a slot name outside the schema stays a hard error
  getConf(model, 'notARealSlot')

  // @ts-expect-error the matrix display no longer sees a slot it never honored
  getConf(matrix, 'showInsertionGlyphs')
}

describe('showInsertionGlyphs is a regular-display slot', () => {
  it('defaults on for the regular display', () => {
    const conf = configSchemaFactory().create({
      type: 'LinearMultiSampleVariantDisplay',
      displayId: 'regular',
    })
    expect(readConfObject(conf, 'showInsertionGlyphs')).toBe(true)
  })

  it('is absent from the matrix display schema', () => {
    const conf = matrixConfigFactory().create({
      type: 'LinearMultiSampleVariantMatrixDisplay',
      displayId: 'matrix',
    })
    // reading a slot this schema doesn't declare is the point of the assertion,
    // and `readConfObject` now rejects an undeclared name the same way `getConf`
    // does (line 49 above) — so the error is the compile-time half of the same
    // guard, and the runtime half still has to show it answers `undefined`
    // rather than throwing.
    // @ts-expect-error
    expect(readConfObject(conf, 'showInsertionGlyphs')).toBeUndefined()
  })
})
