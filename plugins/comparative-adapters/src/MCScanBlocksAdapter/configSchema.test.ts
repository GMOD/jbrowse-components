import { readConfObject } from '@jbrowse/core/configuration'

import configSchema from './configSchema.ts'

describe('MCScanBlocksAdapter configSchema', () => {
  test('uri shorthand sets the anchor mcscanBlocksLocation', () => {
    const conf = configSchema.create({
      type: 'MCScanBlocksAdapter',
      uri: 'grape.blocks.gz',
    })
    expect(readConfObject(conf, 'mcscanBlocksLocation')).toEqual({
      uri: 'grape.blocks.gz',
      locationType: 'UriLocation',
    })
  })

  test('uri leaves the per-column bedLocations for the caller to supply', () => {
    const bedLocations = [{ uri: 'grape.bed' }, { uri: 'peach.bed' }]
    const conf = configSchema.create({
      type: 'MCScanBlocksAdapter',
      uri: 'grape.blocks.gz',
      bedLocations,
    })
    expect(readConfObject(conf, 'bedLocations')).toEqual(bedLocations)
  })
})
