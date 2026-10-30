import { readConfObject } from '@jbrowse/core/configuration'

import configSchema from './configSchema.ts'

test('uri expands to dataDirLocation', () => {
  const conf = configSchema.create({
    connectionId: 'jb1',
    uri: 'https://example.com/jbrowse/data/',
  })
  expect(readConfObject(conf, 'dataDirLocation')).toEqual({
    uri: 'https://example.com/jbrowse/data/',
    locationType: 'UriLocation',
  })
})
