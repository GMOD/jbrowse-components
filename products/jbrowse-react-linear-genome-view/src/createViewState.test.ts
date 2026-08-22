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
// Withholding `init` is a supported way to build an engine — a host whose own
// picker has not chosen anything yet — so what the view reports in that state
// is part of the contract rather than an accident. `ready` says yes with
// nothing on screen, which is why a host that gates on it alone draws an empty
// box; `status` is where the state has a name.
test('no init input leaves the view with none, in a state that says so', () => {
  const state = createViewState({ assembly, tracks })

  expect(state.session.view.init).toBeUndefined()
  expect(state.session.view.status).toEqual({ type: 'noRegions' })
  expect(state.session.view.ready).toBe(true)
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

// The case a host with no server most likely has: the genome itself is a file
// on disk. The assembly's sequence adapter is the same shape as a track's, so
// it gets the same substitution — without it, `localFiles` can only decorate a
// genome someone else is already hosting.
// ...including through the flat `{ name, uri }` shorthand, which is the form
// every host's docs show and the only one a non-TypeScript host writes. It
// expands inside the *assembly* config schema rather than through an adapter
// type, so a substitution that only knew about adapters ran too early and left
// the sequence pointing at a relative URL — which 404s against the host page.
test('an assembly can come from local files through the flat shorthand', () => {
  const state = createViewState({
    assembly: { name: 'mine', uri: 'genome.fa.gz' },
    localFiles: {
      'genome.fa.gz': new Uint8Array([1]),
      'genome.fa.gz.fai': new Uint8Array([2]),
      'genome.fa.gz.gzi': new Uint8Array([3]),
    },
  })

  const { adapter } = getSnapshot(state.config.assembly.sequence) as {
    adapter: {
      fastaLocation: { locationType: string; name: string }
      faiLocation: { locationType: string }
      gziLocation: { locationType: string }
    }
  }
  expect(adapter.fastaLocation).toMatchObject({
    locationType: 'BlobLocation',
    name: 'genome.fa.gz',
  })
  expect(adapter.faiLocation.locationType).toBe('BlobLocation')
  expect(adapter.gziLocation.locationType).toBe('BlobLocation')
})

test('an assembly can come from local files too', () => {
  const state = createViewState({
    assembly: {
      name: 'mine',
      sequence: {
        type: 'ReferenceSequenceTrack',
        trackId: 'mine-ref',
        adapter: { type: 'BgzipFastaAdapter', uri: 'genome.fa.gz' },
      },
    },
    localFiles: {
      'genome.fa.gz': new Uint8Array([1]),
      'genome.fa.gz.fai': new Uint8Array([2]),
      'genome.fa.gz.gzi': new Uint8Array([3]),
    },
  })

  const { adapter } = getSnapshot(state.config.assembly.sequence) as {
    adapter: {
      fastaLocation: { locationType: string; name: string }
      faiLocation: { locationType: string; name: string }
      gziLocation: { locationType: string; name: string }
    }
  }
  expect(adapter.fastaLocation).toMatchObject({
    locationType: 'BlobLocation',
    name: 'genome.fa.gz',
  })
  // both index siblings, derived by the adapter from the one name given
  expect(adapter.faiLocation.locationType).toBe('BlobLocation')
  expect(adapter.gziLocation.locationType).toBe('BlobLocation')
})

// An adapter declares its shorthand once, on its config schema. That is enough
// for a config loaded from a URL, because MST runs `preProcessSnapshot` on the
// way in — but `localFiles` substitutes *before* MST, off the AdapterType, so an
// adapter whose shorthand the AdapterType could not see left `uri` unexpanded
// and the blob substitution found no location node to replace. Five in-tree
// adapters were in exactly that state, MafTabixAdapter among them, and the
// symptom was a track pointing at a relative URL that 404s against the host
// page — nothing logged. AdapterType now falls back to the schema's hook, so
// the two cannot come apart again.
test('localFiles reach an adapter whose shorthand is only on its config schema', () => {
  const state = createViewState({
    assembly,
    localFiles: {
      'aln.bed.gz': new Uint8Array([1]),
      'aln.bed.gz.tbi': new Uint8Array([2]),
    },
    tracks: [
      {
        type: 'MafTrack',
        trackId: 'local_maf',
        name: 'my local maf',
        assemblyNames: ['volvox'],
        adapter: {
          type: 'MafTabixAdapter',
          uri: 'aln.bed.gz',
          samples: ['sample1'],
        },
      },
    ],
  })

  const { adapter } = getSnapshot(state.config.tracks[0]) as {
    adapter: {
      uri?: string
      bedGzLocation: { locationType: string; name: string }
      index: { location: { locationType: string; name: string } }
    }
  }
  expect(adapter.uri).toBeUndefined()
  expect(adapter.bedGzLocation).toMatchObject({
    locationType: 'BlobLocation',
    name: 'aln.bed.gz',
  })
  expect(adapter.index.location).toMatchObject({
    locationType: 'BlobLocation',
    name: 'aln.bed.gz.tbi',
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

// Pinning is what a bounded view is for -- the JBrowse 1 arrangement, header
// above and tracks scrolling under it -- and it is the reason `height` is a prop
// rather than only a box the host draws: a host box scrolls the whole component,
// so there is nothing inside it to pin against, and the ruler leaves with the
// first track no matter what CSS the host writes. So the condition is the
// resolved height, not the option, and a drawer supplies one too.
test('a bounded view pins its headers, an unbounded one does not', () => {
  const unbounded = createViewState({ assembly, tracks })
  expect(unbounded.effectiveHeight).toBeUndefined()
  expect(unbounded.session.stickyViewHeaders).toBe(false)
  expect(unbounded.session.view.stickyViewHeaders).toBe(false)

  const bounded = createViewState({ assembly, tracks, height: '400px' })
  expect(bounded.effectiveHeight).toBe('400px')
  expect(bounded.session.stickyViewHeaders).toBe(true)
  expect(bounded.session.view.stickyViewHeaders).toBe(true)
})

test('an open drawer bounds the view, and pins it with the older name', () => {
  const state = createViewState({
    assembly,
    tracks,
    drawerViewHeight: '600px',
  })
  expect(state.effectiveHeight).toBeUndefined()
  expect(state.session.stickyViewHeaders).toBe(false)

  const widget = state.session.addWidget(
    'HierarchicalTrackSelectorWidget',
    'hierarchicalTrackSelector',
    { view: state.session.view },
  )
  state.session.showWidget(widget)

  expect(state.effectiveHeight).toBe('600px')
  expect(state.session.stickyViewHeaders).toBe(true)

  // minimizing gives the drawer back its space, so the height it supplied goes
  // with it and there is nothing to pin against again
  state.session.minimizeWidgetDrawer()
  expect(state.effectiveHeight).toBeUndefined()
  expect(state.session.stickyViewHeaders).toBe(false)
})

// The app-shaped File menu, and the two items an embed can honour. Asserted on
// the model rather than through the bar because the bar renders whatever this
// returns -- including nothing, which is what `disableAddTracks` is for: every
// item here is refused by the session guards under it, so a menu would be a row
// of dead ends.
test('the File menu is opt-in, and carries what an embed can honour', () => {
  // no bar unless asked for: this component shipped without one, so a host that
  // says nothing keeps the chrome it already had
  expect(createViewState({ assembly, tracks }).menus()).toEqual([])

  expect(createViewState({ assembly, tracks, menuBar: true }).menus()).toEqual([
    {
      label: 'File',
      menuItems: [
        expect.objectContaining({ label: 'Open track...' }),
        expect.objectContaining({ label: 'Open connection...' }),
      ],
    },
  ])

  // both items are the affordances disableAddTracks exists to remove, so asking
  // for the bar and locking the embed down leaves nothing to draw
  expect(
    createViewState({
      assembly,
      tracks,
      menuBar: true,
      disableAddTracks: true,
    }).menus(),
  ).toEqual([])
})
