import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { rowsConfigSchema } from '@jbrowse/display-kit/rowsConfigSchema'

import { writeMembers } from './index.ts'

const Color = ConfigurationSchema(
  'WriteMembersColor',
  {
    field: { type: 'string', defaultValue: '' },
    value: { type: 'string', defaultValue: '' },
  },
  { shorthand: 'value', writes: 'whole' },
)

const Display = ConfigurationSchema('WriteMembersDisplay', {
  rows: rowsConfigSchema,
  color: Color,
})

function viewWith(snapshot: Record<string, unknown>) {
  const configuration = Display.create(snapshot)
  const showTrack = jest.fn()
  const view = {
    tracks: [
      {
        configuration: { trackId: 't' },
        displays: [],
        activeDisplay: { configuration },
      },
    ],
    showTrack,
  }
  return { view, showTrack }
}

test('a field write leaves the arrangement out, for the keyed merge to drop', () => {
  const { view } = viewWith({ rows: { field: 'source', sort: ['b', 'a'] } })
  expect(writeMembers(view, 't', ['rows.field=tissue'])).toEqual({
    rows: { field: 'tissue' },
  })
})

test('a member of an object written whole carries the rest of it', () => {
  const { view } = viewWith({ color: { field: 'score' } })
  expect(writeMembers(view, 't', ['color.value=red'])).toEqual({
    color: { field: 'score', value: 'red' },
  })
})

test('a member under a namespace that sits in an object written whole carries the rest', () => {
  const Encoding = ConfigurationSchema('WriteMembersEncoding', { color: Color })
  const Nested = ConfigurationSchema('WriteMembersNested', {
    encoding: Encoding,
  })
  const configuration = Nested.create({
    encoding: { color: { field: 'score' } },
  })
  const view = {
    tracks: [
      {
        configuration: { trackId: 't' },
        displays: [],
        activeDisplay: { configuration },
      },
    ],
    showTrack: jest.fn(),
  }
  expect(writeMembers(view, 't', ['encoding.color.value=red'])).toEqual({
    encoding: { color: { field: 'score', value: 'red' } },
  })
})
