import createViewState from './createViewState.ts'

const assembly = {
  name: 'volvox',
  sequence: {
    type: 'ReferenceSequenceTrack',
    trackId: 'volvox_refseq',
    adapter: {
      type: 'FromConfigSequenceAdapter',
      features: [
        { refName: 'ctgA', uniqueId: 'a', start: 0, end: 4, seq: 'cagt' },
      ],
    },
  },
}

test('localFiles reach a loose { trackId, uri } track, index sibling and all', async () => {
  const state = await createViewState({
    assembly,
    tracks: [{ trackId: 'local_sv', uri: 'sv.vcf.gz' }],
    localFiles: {
      'sv.vcf.gz': new Uint8Array([1]),
      'sv.vcf.gz.tbi': new Uint8Array([2]),
    },
  })

  const { adapter } = state.config.tracks[0] as {
    adapter: {
      vcfGzLocation: { locationType: string }
      index: { location: { locationType: string } }
    }
  }
  expect(adapter.vcfGzLocation.locationType).toBe('BlobLocation')
  expect(adapter.index.location.locationType).toBe('BlobLocation')
})

// The RPC worker resolves a bare relative uri against its own script's url, so
// a track written relative to the host page has to carry the page as its base
test('a relative track uri resolves against the host page', async () => {
  const state = await createViewState({
    assembly,
    tracks: [{ trackId: 'sv', uri: 'data/sv.vcf' }],
  })

  const { adapter } = state.config.tracks[0] as {
    adapter: { vcfLocation: { uri: string; baseUri?: string } }
  }
  expect(adapter.vcfLocation.baseUri).toBe(document.baseURI)
})
