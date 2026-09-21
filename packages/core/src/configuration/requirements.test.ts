import { types } from '@jbrowse/mobx-state-tree'

import { ConfigurationSchema } from './configurationSchema.ts'
import { requirementProblems } from './requirements.ts'

const Color = ConfigurationSchema(
  'RequirementColor',
  {
    value: { type: 'color', defaultValue: '' },
    field: { type: 'string', defaultValue: '' },
  },
  { shorthand: 'value' },
)
const Encoding = ConfigurationSchema('RequirementEncoding', {
  y: { type: 'string', defaultValue: '' },
  color: Color,
})
const Mark = ConfigurationSchema(
  'RequirementMark',
  {
    shape: { type: 'string', defaultValue: 'bar' },
    source: { type: 'string', defaultValue: 'features' },
    encoding: Encoding,
  },
  {
    requires: [
      {
        id: 'value',
        when: { shape: ['bar', 'point'] },
        slots: ['encoding.y'],
        message: 'a bar or point names a y',
      },
      {
        id: 'density-colour',
        when: { shape: ['span'], source: ['density'] },
        slots: ['encoding.color'],
        message: 'a density span names a colour',
      },
    ],
  },
)

test('a snapshot meeting every requirement has no problems', () => {
  expect(requirementProblems(Mark, { encoding: { y: 'score' } })).toEqual([])
  expect(requirementProblems(Mark, { shape: 'span' })).toEqual([])
})

test('a when value that is the slot default fires for an absent slot', () => {
  expect(requirementProblems(Mark, {})).toEqual([
    { id: 'value', slot: 'encoding.y', message: 'a bar or point names a y' },
  ])
  expect(requirementProblems(Mark, { encoding: { y: '' } })).toEqual([
    { id: 'value', slot: 'encoding.y', message: 'a bar or point names a y' },
  ])
})

test('every when slot has to hold a listed value', () => {
  expect(
    requirementProblems(Mark, { shape: 'span', source: 'density' }),
  ).toEqual([
    {
      id: 'density-colour',
      slot: 'encoding.color',
      message: 'a density span names a colour',
    },
  ])
  expect(requirementProblems(Mark, { shape: 'span' })).toEqual([])
})

test('a sub-schema names a value through the slot a string lifts into', () => {
  const span = { shape: 'span', source: 'density' }
  expect(
    requirementProblems(Mark, { ...span, encoding: { color: 'red' } }),
  ).toEqual([])
  expect(
    requirementProblems(Mark, {
      ...span,
      encoding: { color: { value: 'red' } },
    }),
  ).toEqual([])
  expect(
    requirementProblems(Mark, {
      ...span,
      encoding: { color: { field: 'strand' } },
    }),
  ).toHaveLength(1)
})

test('a type that is not a configuration schema has no requirements', () => {
  expect(requirementProblems(types.model({}), {})).toEqual([])
})
