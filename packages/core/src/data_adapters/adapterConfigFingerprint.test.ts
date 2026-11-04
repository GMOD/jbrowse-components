import { fingerprintAdapterConfig } from './adapterConfigFingerprint.ts'
import { adapterConfigCacheKey, withAdapterId } from './dataAdapterCache.ts'

const keyOf = (conf: Record<string, unknown>) =>
  fingerprintAdapterConfig(conf).key

function multiWiggle(firstUris: string) {
  return {
    type: 'MultiWiggleAdapter',
    subadapters: Array.from({ length: 80 }, (_, i) => ({
      type: 'BigWigAdapter',
      source: `sample${i}`,
      bigWigLocation: {
        uri: `https://example.org/${i < 5 ? firstUris : 'shared'}/sample${i}.bw`,
        locationType: 'UriLocation',
      },
    })),
  }
}

test('configs differing anywhere get different keys, however large', () => {
  expect(adapterConfigCacheKey(multiWiggle('one'))).not.toBe(
    adapterConfigCacheKey(multiWiggle('two')),
  )
})

test('adjacent fields do not run together', () => {
  expect(keyOf({ a: 'b', c: 'd' })).not.toBe(keyOf({ a: 'bc-d' }))
  expect(keyOf({ a: { b: 'c' } })).not.toBe(keyOf({ x: { b: 'c' } }))
  expect(keyOf({ a: ['b', 'c'] })).not.toBe(keyOf({ a: ['bc'] }))
  expect(keyOf({ a: 1 })).not.toBe(keyOf({ a: '1' }))
})

test('a clone has the key of its original', () => {
  const conf = multiWiggle('one')
  expect(keyOf(structuredClone(conf))).toBe(keyOf(conf))
})

test('withAdapterId stamps the key the config already had', () => {
  const conf = multiWiggle('one')
  expect(adapterConfigCacheKey(withAdapterId(conf))).toBe(
    adapterConfigCacheKey(conf),
  )
})

test('credentials are not identity, but are told apart', () => {
  const location = { uri: 'https://example.org/a.bam' }
  const signed = (token: string) => ({
    type: 'BamAdapter',
    bamLocation: {
      ...location,
      internetAccountPreAuthorization: { authInfo: { token } },
    },
  })
  const plain = fingerprintAdapterConfig({
    type: 'BamAdapter',
    bamLocation: location,
  })
  const first = fingerprintAdapterConfig(signed('t1'))
  const renewed = fingerprintAdapterConfig(signed('t2'))
  expect(first.key).toBe(plain.key)
  expect(renewed.key).toBe(plain.key)
  expect(first.credentials).not.toBe(renewed.credentials)
})

test('a FileHandleLocation hashes as the BlobLocation the worker receives', () => {
  expect(
    keyOf({
      type: 'Gff3Adapter',
      gffLocation: {
        locationType: 'FileHandleLocation',
        name: 'a.gff3',
        handleId: 'h1',
      },
    }),
  ).toBe(
    keyOf({
      type: 'Gff3Adapter',
      gffLocation: {
        locationType: 'BlobLocation',
        name: 'a.gff3',
        blobId: 'fh-blob-h1',
      },
    }),
  )
})
