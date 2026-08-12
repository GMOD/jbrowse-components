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
