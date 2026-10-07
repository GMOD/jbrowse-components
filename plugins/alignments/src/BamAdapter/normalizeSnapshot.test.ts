import { resolveUriLocation } from '@jbrowse/core/util/io'

import cramConfigSchema from '../CramAdapter/configSchema.ts'
import htsgetConfigSchema from '../HtsgetBamAdapter/configSchema.ts'
import bamConfigSchema, { normalizeSnapshot } from './configSchema.ts'

describe('BamAdapter normalizeSnapshot', () => {
  test('expands uri shorthand to bamLocation + bai index', () => {
    expect(
      normalizeSnapshot({ type: 'BamAdapter', uri: 'my.bam' }),
    ).toMatchObject({
      bamLocation: { uri: 'my.bam' },
      index: { indexType: 'BAI', location: { uri: 'my.bam.bai' } },
    })
  })

  test('expands uri shorthand with csi:true to csi index', () => {
    expect(
      normalizeSnapshot({ type: 'BamAdapter', uri: 'my.bam', csi: true }),
    ).toMatchObject({
      bamLocation: { uri: 'my.bam' },
      index: { indexType: 'CSI', location: { uri: 'my.bam.csi' } },
    })
  })

  // A relative shorthand only means anything next to the config that carries
  // it, and the index the shorthand invents has to land beside its data file
  // rather than at the app's own base url. Desktop reaches this by stamping the
  // config's own directory: it opens a config.json from disk and cannot resolve
  // a bare uri, so the whole shorthand rides on baseUri reaching both locations.
  test('carries baseUri onto the file and the index it derives', () => {
    const out = normalizeSnapshot({
      type: 'BamAdapter',
      uri: 'reads.bam',
      baseUri: 'file:///data/proj/',
    }) as unknown as {
      bamLocation: { uri: string; baseUri?: string }
      index: { location: { uri: string; baseUri?: string } }
    }
    expect(
      resolveUriLocation({ ...out.bamLocation, locationType: 'UriLocation' })
        .uri,
    ).toBe('file:///data/proj/reads.bam')
    expect(
      resolveUriLocation({
        ...out.index.location,
        locationType: 'UriLocation',
      }).uri,
    ).toBe('file:///data/proj/reads.bam.bai')
  })

  // the sibling the shorthand invents used to win, so a config naming both a
  // uri and an index that does not sit next to it silently read the one that
  // isn't there
  test('an index named alongside the uri outlives the derived sibling', () => {
    expect(
      normalizeSnapshot({
        type: 'BamAdapter',
        uri: 'my.bam',
        index: { location: { uri: 'elsewhere/my.bam.bai' } },
      }),
    ).toMatchObject({
      bamLocation: { uri: 'my.bam' },
      index: { location: { uri: 'elsewhere/my.bam.bai' } },
    })
  })

  test('passes through a fully-specified snapshot unchanged', () => {
    const snap = {
      type: 'BamAdapter',
      bamLocation: { uri: 'my.bam', locationType: 'UriLocation' },
    }
    expect(normalizeSnapshot(snap)).toBe(snap)
  })
})

// `jbrowse add-track` wrote one on every alignments track until v4.0.0
test.each([
  ['BamAdapter', bamConfigSchema],
  ['CramAdapter', cramConfigSchema],
  ['HtsgetBamAdapter', htsgetConfigSchema],
])('%s loads a pre-v4 sequenceAdapter without naming it', (type, schema) => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  schema.create({
    type,
    sequenceAdapter: { type: 'IndexedFastaAdapter', uri: 'hg38.fa' },
  })
  expect(warn).not.toHaveBeenCalled()
  schema.create({ type, sequenceAdaptor: {} })
  expect(warn).toHaveBeenCalledWith(
    `${type} does not declare sequenceAdaptor: loading without it`,
  )
  warn.mockRestore()
})
