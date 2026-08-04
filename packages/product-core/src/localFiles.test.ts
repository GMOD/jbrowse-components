import { getBlob } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import { BlobFile } from 'generic-filehandle2'

import { registerLocalFiles, resolveLocalFileUris } from './localFiles.ts'

test('registering bytes yields a BlobLocation openable as a filehandle', () => {
  const bytes = new TextEncoder().encode('ctgA\t100\t200\tpeak1\n')
  const locations = registerLocalFiles({ 'peaks.bed': bytes })

  const location = locations['peaks.bed']!
  expect(location.locationType).toBe('BlobLocation')
  expect(location.name).toBe('peaks.bed')
  expect(getBlob(location.blobId)).toBeInstanceOf(File)
  expect(getBlob(location.blobId)!.size).toBe(bytes.length)

  // openLocation discriminates on locationType, so this is what proves the
  // location we mint is one adapters can actually open
  expect(openLocation(location)).toBeInstanceOf(BlobFile)
})

// The byte-range read itself — the reason this beats inlining features — is
// asserted in a real browser rather than here: jsdom's Blob.slice() returns an
// object with no arrayBuffer(), so generic-filehandle2 cannot read from it.
// jbrowse-anywidget's screenshot harness renders a bgzipped+tabixed file
// registered this way, which exercises the seeking path end to end.

test('resolveLocalFileUris swaps a registered name, index sibling included', () => {
  const locations = registerLocalFiles({
    'peaks.bed.gz': new Uint8Array([1]),
    'peaks.bed.gz.tbi': new Uint8Array([2]),
  })

  // the shape guessTrackConf produces: the adapter derived the .tbi sibling
  // from the uri string, and both have to become blobs together
  const resolved = resolveLocalFileUris(
    {
      type: 'FeatureTrack',
      adapter: {
        type: 'BedTabixAdapter',
        bedGzLocation: { uri: 'peaks.bed.gz', locationType: 'UriLocation' },
        index: {
          location: { uri: 'peaks.bed.gz.tbi', locationType: 'UriLocation' },
        },
      },
    },
    locations,
  )

  expect(resolved.adapter.bedGzLocation).toEqual(locations['peaks.bed.gz'])
  expect(resolved.adapter.index.location).toEqual(locations['peaks.bed.gz.tbi'])
})

test('an unregistered uri is left alone, so local and remote can mix', () => {
  const locations = registerLocalFiles({ 'mine.bw': new Uint8Array([1]) })
  const conf = {
    adapter: {
      bigWigLocation: { uri: 'https://example.com/theirs.bw' },
      other: { uri: 'mine.bw' },
    },
  }

  const resolved = resolveLocalFileUris(conf, locations)
  expect(resolved.adapter.bigWigLocation).toEqual({
    uri: 'https://example.com/theirs.bw',
  })
  expect(resolved.adapter.other).toEqual(locations['mine.bw'])
})

test('every registration is a distinct blob, so names never collide', () => {
  const a = registerLocalFiles({ 'x.bed': new Uint8Array([1]) })
  const b = registerLocalFiles({ 'x.bed': new Uint8Array([2]) })
  expect(a['x.bed']!.blobId).not.toBe(b['x.bed']!.blobId)
})
