import {
  ConfigurationSchema,
  applyConfSettings,
  plotOf,
  readConfObject,
  setConf,
} from '@jbrowse/core/configuration'

import {
  ROW_ANNOTATION_NO_FIELD,
  ROW_ANNOTATION_ON_NAME,
} from './rowAnnotationConfigSchema.ts'
import { rowsConfigSchema } from './rowsConfigSchema.ts'

import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { Instance } from '@jbrowse/mobx-state-tree'

const Display = ConfigurationSchema(
  'RowAnnotationHost',
  { rows: rowsConfigSchema },
  { explicitlyTyped: true, explicitIdentifier: 'displayId' },
)

function annotationsOf(conf: Instance<typeof Display>) {
  const annotations: AnyConfigurationModel[] = conf.rows.annotations
  return annotations.map(annotation => ({
    field: readConfObject(annotation, 'field'),
    domain: readConfObject(annotation, ['scale', 'domain']),
    range: readConfObject(annotation, ['scale', 'range']),
    title: readConfObject(annotation, ['legend', 'title']),
  }))
}

const SEX = {
  field: 'sex',
  scale: { domain: ['female', 'male'], range: ['#d95f02', '#1b9e77'] },
}

function warningsOf(load: () => unknown) {
  const spy = jest.spyOn(console, 'warn').mockImplementation(() => {})
  load()
  const warnings = spy.mock.calls.map(([message]) => message)
  spy.mockRestore()
  return warnings
}

test('rows.annotations is empty by default', () => {
  expect(annotationsOf(Display.create({ displayId: 'd' }))).toEqual([])
})

test('rows.annotations lists RowAnnotation entries, a string being the field', () => {
  const conf = Display.create({
    displayId: 'a',
    rows: {
      annotations: [
        'superpopulation',
        { ...SEX, legend: { title: 'Sex (reported)' } },
      ],
    },
  })
  expect(annotationsOf(conf)).toEqual([
    { field: 'superpopulation', domain: [], range: [], title: undefined },
    {
      field: 'sex',
      domain: SEX.scale.domain,
      range: SEX.scale.range,
      title: 'Sex (reported)',
    },
  ])
})

test('a settings write sets rows.annotations, and a field change keeps it', () => {
  const conf = Display.create({ displayId: 'w', rows: { field: 'source' } })
  applyConfSettings(conf, { rows: { annotations: ['superpopulation', SEX] } })
  applyConfSettings(conf, { rows: 'tissue' })
  expect(annotationsOf(conf).map(a => a.field)).toEqual([
    'superpopulation',
    'sex',
  ])
  expect(plotOf(conf).rows).toMatchObject({
    annotations: ['superpopulation', SEX],
  })
})

test('a lone field or channel writes rows.annotations as a list of one, beside the other members', () => {
  const conf = Display.create({ displayId: 'd' })
  expect(
    applyConfSettings(conf, { rows: { annotations: 'sex', color: 'group' } })
      .failed,
  ).toEqual([])
  expect(annotationsOf(conf).map(a => a.field)).toEqual(['sex'])
  expect(conf.rows.color.field).toBe('group')
  applyConfSettings(conf, { rows: { annotations: SEX } })
  expect(annotationsOf(conf).map(a => a.field)).toEqual(['sex'])
  applyConfSettings(conf, { rows: { annotations: '' } })
  expect(annotationsOf(conf)).toEqual([])
})

// An annotation on `name` would restate the label, and one with no field
// colors by nothing: refused at every door, as rows.filter refuses a name.
describe('an entry with no field, or on name', () => {
  test('loads without each, naming each refusal once', () => {
    let conf = Display.create({ displayId: 'before' })
    const warnings = warningsOf(() => {
      conf = Display.create({
        displayId: 'load',
        rows: {
          annotations: [
            'name',
            { field: 'name', scale: { unknown: '#ccc' } },
            { scale: { range: ['#f00'] } },
            { field: '' },
            'sex',
          ],
        },
      })
    })
    expect(warnings).toEqual([
      `${ROW_ANNOTATION_ON_NAME}: loading without it`,
      `${ROW_ANNOTATION_NO_FIELD}: loading without it`,
    ])
    expect(annotationsOf(conf).map(a => a.field)).toEqual(['sex'])
  })

  test.each([
    ['name', ROW_ANNOTATION_ON_NAME],
    [{ scale: { range: ['#f00'] } }, ROW_ANNOTATION_NO_FIELD],
  ])('%j is refused on a write, which keeps the list', (entry, message) => {
    const conf = Display.create({
      displayId: 'write',
      rows: { annotations: ['sex'] },
    })
    expect(() => {
      setConf(conf, ['rows', 'annotations'], ['group', entry])
    }).toThrow(message)
    expect(annotationsOf(conf).map(a => a.field)).toEqual(['sex'])
  })

  test('a field written as name on one entry is refused, naming the annotations', () => {
    const conf = Display.create({
      displayId: 'member',
      rows: { annotations: ['sex'] },
    })
    expect(() => {
      setConf(conf, ['rows', 'annotations', '0', 'field'], 'name')
    }).toThrow(/field: field 'name' is the row itself.*rows\.annotations/)
  })
})

test("a misshapen scale names the annotations' path", () => {
  expect(() =>
    Display.create({
      displayId: 'scale',
      rows: { annotations: [{ field: 'sex', scale: 'ordinal' }] },
    }),
  ).toThrow(/^rows\.annotations\.scale is an object/)
})
