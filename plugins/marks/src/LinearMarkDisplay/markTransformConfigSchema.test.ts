import {
  getConfigurationSchemaDefinition,
  getConfigurationSchemaUnion,
  isSlotDefinitionEntry,
  slotChoices,
} from '@jbrowse/core/configuration'
import {
  DEFAULT_BIN_AS as WORKER_BIN_AS,
  DEFAULT_BIN_FIELD as WORKER_BIN_FIELD,
  DEFAULT_COVERAGE_AS as WORKER_COVERAGE_AS,
  DEFAULT_FLATTEN_FIELD as WORKER_FLATTEN_FIELD,
  DEFAULT_PILEUP_AS as WORKER_PILEUP_AS,
  DEFAULT_PILEUP_FIELDS as WORKER_PILEUP_FIELDS,
} from '@jbrowse/core/util/featureTransforms'
import { asArrayType, isType } from '@jbrowse/mobx-state-tree'

import { markTransformStep } from './markTransformConfigSchema.ts'
import {
  DEFAULT_BIN_AS,
  DEFAULT_BIN_FIELD,
  DEFAULT_COVERAGE_AS,
  DEFAULT_FLATTEN_FIELD,
  DEFAULT_PILEUP_AS,
  DEFAULT_PILEUP_FIELDS,
} from './markVocabulary.ts'

import type { StepSnapshot } from './markProblems.ts'
import type {
  ConfigNodeActions,
  ConfigNodeBrand,
} from '@jbrowse/core/configuration'
import type { TransformStep } from '@jbrowse/core/util/markEncoding'
import type { IAnyType, Instance } from '@jbrowse/mobx-state-tree'

type MutuallyExtends<A, B> = [A] extends [B]
  ? [B] extends [A]
    ? true
    : false
  : false
function assertType<Check extends true>(_check?: Check): void {}

type StepNode = Instance<typeof markTransformStep>

// The rule list's hand-written snapshot of each step, which `jbrowse validate`
// carries a copy of and so cannot read the schema, names what the schema does.
type StepType = StepSnapshot['type']
type SnapshotKeys<T extends StepType> = Exclude<
  keyof Extract<StepSnapshot, { type: T }>,
  'type'
>
type SchemaKeys<T extends StepType> = Exclude<
  keyof Extract<StepNode, { type: T }>,
  'type' | keyof ConfigNodeActions | keyof ConfigNodeBrand<any>
>
type EachStepNamesTheSchemasSlots = {
  [T in StepType]: MutuallyExtends<SnapshotKeys<T>, SchemaKeys<T>>
}[StepType]

test('the step types are the union, the wire and the rule list alike', () => {
  assertType<MutuallyExtends<StepNode['type'], TransformStep['type']>>()
  assertType<MutuallyExtends<StepType, TransformStep['type']>>()
  assertType<EachStepNamesTheSchemasSlots>()
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

// Each step slot's type, default and vocabulary, one line apiece: the line a
// changed default shows up as. `ConfigSlotDefaults.test.ts` reads each
// registered element's own slots and never the steps inside a `transform`.
function slotLines(schema: IAnyType, prefix: string): [string, string][] {
  return Object.entries(getConfigurationSchemaDefinition(schema)!).flatMap(
    ([name, entry]): [string, string][] => {
      if (isSlotDefinitionEntry(entry)) {
        const choices = slotChoices(entry)
        return [
          [
            `${prefix}${name}`,
            `${entry.type} = ${JSON.stringify(entry.defaultValue)}${choices ? ` of ${choices.join(', ')}` : ''}`,
          ],
        ]
      }
      const array = isType(entry) ? asArrayType(entry) : undefined
      return array ? slotLines(array.getChildType(), `${prefix}${name}[].`) : []
    },
  )
}

test('every step slot keeps its type, default and vocabulary', () => {
  const { members } = getConfigurationSchemaUnion(markTransformStep)!
  expect(
    Object.fromEntries(
      Object.entries(members).flatMap(([type, member]) =>
        slotLines(member, `${type}.`),
      ),
    ),
  ).toEqual({
    'filter.expr': 'string = ""',
    'formula.expr': 'string = ""',
    'formula.as': 'string = "value"',
    'bin.step': 'number = 10000',
    'bin.field': 'string = "start"',
    'bin.as': 'stringArray = ["start","end"]',
    'aggregate.groupby': 'stringArray = []',
    'aggregate.ops[].op': 'stringEnum = "count" of count, sum, mean, min, max',
    'aggregate.ops[].field': 'string = ""',
    'aggregate.ops[].as': 'string = ""',
    'coverage.as': 'string = "coverage"',
    'flatten.field': 'string = "subfeatures"',
    'flatten.index': 'string = ""',
    'flatten.keepEmpty': 'boolean = false',
    'pileup.as': 'string = "row"',
    'pileup.fields': 'stringArray = ["start","end"]',
    'pileup.padding': 'number = 0',
  })
})
