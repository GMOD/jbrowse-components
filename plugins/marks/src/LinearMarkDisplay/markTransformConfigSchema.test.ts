import { getTypeNamesFromExplicitlyTypedUnion } from '@jbrowse/core/configuration'
import {
  DEFAULT_BIN_AS as WORKER_BIN_AS,
  DEFAULT_BIN_FIELD as WORKER_BIN_FIELD,
  DEFAULT_COVERAGE_AS as WORKER_COVERAGE_AS,
  DEFAULT_FLATTEN_FIELD as WORKER_FLATTEN_FIELD,
  DEFAULT_PILEUP_AS as WORKER_PILEUP_AS,
  DEFAULT_PILEUP_FIELDS as WORKER_PILEUP_FIELDS,
} from '@jbrowse/core/util/featureTransforms'

import { markTransformStep } from './markTransformConfigSchema.ts'
import {
  DEFAULT_BIN_AS,
  DEFAULT_BIN_FIELD,
  DEFAULT_COVERAGE_AS,
  DEFAULT_FLATTEN_FIELD,
  DEFAULT_PILEUP_AS,
  DEFAULT_PILEUP_FIELDS,
  TRANSFORM_TYPES,
} from './markVocabulary.ts'

import type { StepSnapshot } from './markProblems.ts'
import type { TransformTypeName } from './markVocabulary.ts'
import type {
  ConfigNodeActions,
  ConfigNodeBrand,
} from '@jbrowse/core/configuration'
import type { TransformStep } from '@jbrowse/core/util/markEncoding'
import type { Instance } from '@jbrowse/mobx-state-tree'

type MutuallyExtends<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false
function assertType<Check extends true>(_check?: Check): void {}

type StepNode = Instance<typeof markTransformStep>

// The rule list's hand-written snapshot of each step, which `jbrowse validate`
// carries a copy of and so cannot read the schema, names what the schema does.
type SnapshotKeys<T extends TransformTypeName> = Exclude<
  keyof Extract<StepSnapshot, { type: T }>,
  'type'
>
type SchemaKeys<T extends TransformTypeName> = Exclude<
  keyof Extract<StepNode, { type: T }>,
  'type' | keyof ConfigNodeActions | keyof ConfigNodeBrand<any>
>
type EachStepNamesTheSchemasSlots = {
  [T in TransformTypeName]: MutuallyExtends<SnapshotKeys<T>, SchemaKeys<T>>
}[TransformTypeName]

test('the step types are the vocabulary, the wire and the rule list alike', () => {
  assertType<MutuallyExtends<StepNode['type'], TransformStep['type']>>()
  assertType<MutuallyExtends<TransformTypeName, TransformStep['type']>>()
  assertType<MutuallyExtends<StepSnapshot['type'], TransformTypeName>>()
  assertType<EachStepNamesTheSchemasSlots>()
  expect(getTypeNamesFromExplicitlyTypedUnion(markTransformStep)).toEqual([
    ...TRANSFORM_TYPES,
  ])
})

test("a step's defaults are the ones the worker reads for a slot the wire leaves off", () => {
  expect({
    binField: DEFAULT_BIN_FIELD,
    binAs: [...DEFAULT_BIN_AS],
    coverageAs: DEFAULT_COVERAGE_AS,
    flattenField: DEFAULT_FLATTEN_FIELD,
    pileupAs: DEFAULT_PILEUP_AS,
    pileupFields: [...DEFAULT_PILEUP_FIELDS],
  }).toEqual({
    binField: WORKER_BIN_FIELD,
    binAs: WORKER_BIN_AS,
    coverageAs: WORKER_COVERAGE_AS,
    flattenField: WORKER_FLATTEN_FIELD,
    pileupAs: WORKER_PILEUP_AS,
    pileupFields: WORKER_PILEUP_FIELDS,
  })
})
