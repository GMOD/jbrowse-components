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

// A host swaps genome or track set by building a new controller with the same
// `localFiles` dict, since the controller has no setter that rebuilds
// internally. Minting a fresh blobId each time would leave the previous one in
// core's process-global blobMap, which nothing collects.
test('re-registering the same bytes is the same blob', () => {
  const bytes = new Uint8Array([1])
  const first = registerLocalFiles({ 'x.bed': bytes })
  const second = registerLocalFiles({ 'x.bed': bytes })
  expect(second['x.bed']!.blobId).toBe(first['x.bed']!.blobId)
})

// ...but the name is part of the identity: the same bytes under two names are
// two files, and a BlobLocation carries the name it was registered under.
test('the same bytes under a second name are a second blob', () => {
  const bytes = new Uint8Array([1])
  const asBed = registerLocalFiles({ 'x.bed': bytes })
  const asWig = registerLocalFiles({ 'x.bw': bytes })
  expect(asWig['x.bw']!.blobId).not.toBe(asBed['x.bed']!.blobId)
  expect(asWig['x.bw']!.name).toBe('x.bw')
})
