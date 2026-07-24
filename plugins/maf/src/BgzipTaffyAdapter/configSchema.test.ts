import { readConfObject } from '@jbrowse/core/configuration'

import configSchema from './configSchema.ts'

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
})
