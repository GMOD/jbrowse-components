import { getSnapshot } from '@jbrowse/mobx-state-tree'

import createViewState from './createViewState.ts'

const assembly = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
}

const tracks = [
  {
    type: 'FeatureTrack',
    trackId: 'volvox_gff3',
    name: 'Volvox genes',
    assemblyNames: ['volvox'],
    adapter: {
      type: 'Gff3TabixAdapter',
      uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
    },
  },
]

// The three inputs all land on the same `init` blob, which is what lets a host
// that holds its own engine say what `<LinearGenomeView init>` says. These read
// the blob rather than the applied result: applying it is the view's own
// afterAttach autorun, which waits on a real assembly load and is covered in
// plugin-linear-genome-view's own tests.
test('init reaches the view, with the assembly name filled in', () => {
  const state = createViewState({
    assembly,
    tracks,
    init: { loc: 'ctgA:1..100', tracks: ['volvox_gff3'], tracklist: true },
  })

  expect(state.session.view.init).toEqual({
    assembly: 'volvox',
    loc: 'ctgA:1..100',
    tracks: ['volvox_gff3'],
    tracklist: true,
    highlight: undefined,
  })
})

test('location and highlight are shorthands on the same blob', () => {
  const state = createViewState({
    assembly,
    location: 'ctgA:1..100',
    highlight: ['ctgA:5..10'],
  })

  expect(state.session.view.init).toMatchObject({
    assembly: 'volvox',
    loc: 'ctgA:1..100',
    highlight: ['ctgA:5..10'],
  })
})

// A host migrating from `location` to `init` may end up passing both — from a
// wrapper that always forwards its own `location` prop, say. The shorthand is
// the more specific statement, so it wins rather than being silently dropped.
test('location wins over init.loc, and does not disturb the rest of init', () => {
  const state = createViewState({
    assembly,
    tracks,
    location: 'ctgA:200..300',
    init: { loc: 'ctgA:1..100', tracks: ['volvox_gff3'] },
  })

  expect(state.session.view.init).toMatchObject({
    loc: 'ctgA:200..300',
    tracks: ['volvox_gff3'],
  })
})

// Without an init of any kind the view has none, which is what shows the import
// form — the state a bare `createViewState({ assembly })` is supposed to land in
test('no init input leaves the view with none', () => {
  const state = createViewState({ assembly, tracks })

  expect(state.session.view.init).toBeUndefined()
})

// `localFiles` is only worth having if it survives all the way into the built
// config, and every step between here and there is a place it silently doesn't:
// the `{ type, uri }` shorthand has to be expanded before substitution or the
// adapter is replaced by a bare location, and the `uri` that drove the
// expansion has to be dropped afterwards or the config schema's own
// preProcessSnapshot rebuilds a UriLocation over the blob when MST creates the
// tree. Both failures leave a track pointing at a relative URL that 404s
// against the host page, with nothing logged — so this reads the tree.
test('localFiles reach the built config, index sibling and all', () => {
  const state = createViewState({
    assembly,
    localFiles: {
      'volvox-sorted.bam': new Uint8Array([1]),
      'volvox-sorted.bam.bai': new Uint8Array([2]),
    },
    tracks: [
      {
        type: 'AlignmentsTrack',
        trackId: 'local_bam',
        name: 'my local bam',
        assemblyNames: ['volvox'],
        // the shorthand form, which is what every doc and example writes
        adapter: { type: 'BamAdapter', uri: 'volvox-sorted.bam' },
      },
    ],
  })

  const { adapter } = getSnapshot(state.config.tracks[0]) as {
    adapter: {
      type: string
      uri?: string
      bamLocation: { locationType: string; name: string }
      index: { location: { locationType: string; name: string } }
    }
  }
  expect(adapter.type).toBe('BamAdapter')
  expect(adapter.uri).toBeUndefined()
  expect(adapter.bamLocation).toMatchObject({
    locationType: 'BlobLocation',
    name: 'volvox-sorted.bam',
  })
  // never registered by the caller as an index, only as a name: the adapter's
  // own expansion is what asked for `<uri>.bai`
  expect(adapter.index.location).toMatchObject({
    locationType: 'BlobLocation',
    name: 'volvox-sorted.bam.bai',
  })
})

test('a remote track alongside a local one is untouched', () => {
  const state = createViewState({
    assembly,
    localFiles: { 'mine.bam': new Uint8Array([1]) },
    tracks,
  })

  const { adapter } = getSnapshot(state.config.tracks[0]) as {
    adapter: { gffGzLocation: { locationType: string; uri: string } }
  }
  expect(adapter.gffGzLocation).toMatchObject({
    locationType: 'UriLocation',
    uri: 'https://jbrowse.org/code/jb2/main/test_data/volvox/volvox.sort.gff3.gz',
  })
})
