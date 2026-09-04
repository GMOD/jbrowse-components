import { readConfObject } from '@jbrowse/core/configuration'

import mafConfigSchema from '../BgzipMafAdapter/configSchema.ts'
import configSchema from './configSchema.ts'

import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'

describe('BgzipTaffyAdapter configSchema', () => {
  test('uri shorthand resolves tafGzLocation and the sibling .tai index', () => {
    const conf = configSchema.create({
      type: 'BgzipTaffyAdapter',
      uri: 'https://example.com/aln.taf.gz',
    })
    expect(readConfObject(conf, 'tafGzLocation')).toEqual({
      uri: 'https://example.com/aln.taf.gz',
      locationType: 'UriLocation',
    })
    expect(readConfObject(conf, 'taiLocation')).toEqual({
      uri: 'https://example.com/aln.taf.gz.tai',
      locationType: 'UriLocation',
    })
  })

  test('explicit tafGzLocation/taiLocation still pass through unchanged', () => {
    const conf = configSchema.create({
      type: 'BgzipTaffyAdapter',
      tafGzLocation: { uri: 'a.taf.gz' },
      taiLocation: { uri: 'custom.tai' },
    })
    expect(readConfObject(conf, 'taiLocation')).toEqual({
      uri: 'custom.tai',
      locationType: 'UriLocation',
    })
  })

  // MST drops an undeclared key, so an `nhUri` the shorthand ignored loaded
  // the track with no tree and no message.
  test.each<[string, AnyConfigurationSchemaType, string]>([
    ['BgzipTaffyAdapter', configSchema, 'tafGzLocation'],
    ['BgzipMafAdapter', mafConfigSchema, 'mafGzLocation'],
  ])('%s uri shorthand carries nhUri to nhLocation', (type, schema, gzSlot) => {
    const conf = schema.create({
      type,
      uri: 'https://example.com/aln.gz',
      nhUri: 'https://example.com/aln.nh',
    })
    expect(readConfObject(conf, gzSlot)).toEqual({
      uri: 'https://example.com/aln.gz',
      locationType: 'UriLocation',
    })
    expect(readConfObject(conf, 'nhLocation')).toEqual({
      uri: 'https://example.com/aln.nh',
      locationType: 'UriLocation',
    })
  })
})
