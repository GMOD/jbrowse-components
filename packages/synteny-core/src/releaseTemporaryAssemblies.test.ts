import { types } from '@jbrowse/mobx-state-tree'

import { releaseTemporaryAssemblies } from './releaseTemporaryAssemblies.ts'

interface Conf {
  name?: string
  trackId?: string
  assemblyNames?: string[]
}

// `isSessionModel` asks for `rpcManager` and `configuration` and nothing else,
// and `isViewModel` is not consulted here — `getSession` walks parents until one
// answers. So the smallest honest tree is a two-node one, with the two lists as
// frozen plain configs: `readConfObject` reads a plain object by the same slot
// walk it reads a config node by.
function makeSession({
  temporaryAssemblies = [] as Conf[],
  sessionTracks = [] as Conf[],
  viewAssemblyNames = [] as string[],
}) {
  const View = types
    .model('View', { assemblyNames: types.frozen<string[]>() })
    .views(() => ({
      get width() {
        return 800
      },
    }))
    .actions(() => ({ setWidth() {} }))
  return types
    .model('Session', {
      rpcManager: types.frozen({}),
      configuration: types.frozen({}),
      temporaryAssemblies: types.array(types.frozen<Conf>()),
      sessionTracks: types.array(types.frozen<Conf>()),
      view: View,
    })
    .actions(self => ({
      removeTemporaryAssembly(name: string) {
        const found = self.temporaryAssemblies.find(a => a.name === name)
        if (found) {
          self.temporaryAssemblies.remove(found)
        }
      },
      deleteTrackConf(conf: Conf) {
        self.sessionTracks.remove(conf)
      },
    }))
    .create({
      rpcManager: {},
      configuration: {},
      temporaryAssemblies,
      sessionTracks,
      view: { assemblyNames: viewAssemblyNames },
    })
}

const HG38_TRACK = { trackId: 'my-genes', assemblyNames: ['hg38'] }
const SEGMENTS_TRACK = {
  trackId: 'derivative-segments-1',
  assemblyNames: ['der_chr3_1'],
}

test('gives back the temporary assemblies the view brought in', () => {
  const session = makeSession({
    temporaryAssemblies: [{ name: 'der_chr3_1' }],
    viewAssemblyNames: ['hg38', 'der_chr3_1'],
  })
  releaseTemporaryAssemblies(session.view)
  expect(session.temporaryAssemblies).toHaveLength(0)
})

// The segment labels of "Reconstruct derivative allele" are a FromConfigAdapter
// track over the synthetic derivative axis, so releasing the axis and keeping
// the track left a dead config in the snapshot the user saves and shares — one
// more per launch, since the stamp in its id defeats the dedupe.
test('takes the session tracks only that assembly could draw', () => {
  const session = makeSession({
    temporaryAssemblies: [{ name: 'der_chr3_1' }],
    sessionTracks: [HG38_TRACK, SEGMENTS_TRACK],
    viewAssemblyNames: ['hg38', 'der_chr3_1'],
  })
  releaseTemporaryAssemblies(session.view)
  expect(session.sessionTracks.map(t => t.trackId)).toEqual(['my-genes'])
})

// The sharp edge, and the reason the released set is an INTERSECTION rather than
// `self.assemblyNames`: a read-vs-ref pair is [the real reference, the synthetic
// read], so half of every one of these lists is a permanent assembly every other
// view shares. Swept over the raw list, closing one synteny view deleted the
// user's own hg38 session tracks.
test('never touches a track on a real assembly the view also names', () => {
  const session = makeSession({
    temporaryAssemblies: [{ name: 'der_chr3_1' }],
    sessionTracks: [HG38_TRACK],
    viewAssemblyNames: ['hg38', 'der_chr3_1'],
  })
  releaseTemporaryAssemblies(session.view)
  expect(session.sessionTracks.map(t => t.trackId)).toEqual(['my-genes'])
})

// A view over two real assemblies — an ordinary configured synteny view — brings
// nothing in and so may take nothing out, tracks included.
test('a view holding no temporary assembly changes nothing', () => {
  const session = makeSession({
    sessionTracks: [HG38_TRACK, { trackId: 'x', assemblyNames: ['mm39'] }],
    viewAssemblyNames: ['hg38', 'mm39'],
  })
  releaseTemporaryAssemblies(session.view)
  expect(session.sessionTracks).toHaveLength(2)
})

// A track spanning the released axis AND a permanent assembly is still drawable
// on the permanent one, so it is not this view's to delete.
test('keeps a track that also names an assembly staying behind', () => {
  const session = makeSession({
    temporaryAssemblies: [{ name: 'der_chr3_1' }],
    sessionTracks: [
      { trackId: 'synteny', assemblyNames: ['hg38', 'der_chr3_1'] },
    ],
    viewAssemblyNames: ['der_chr3_1'],
  })
  releaseTemporaryAssemblies(session.view)
  expect(session.sessionTracks).toHaveLength(1)
})

// `every` is true of nothing, so an assembly-less track config would be swept by
// any route it reaches.
test('a track naming no assembly is nobody to delete', () => {
  const session = makeSession({
    temporaryAssemblies: [{ name: 'der_chr3_1' }],
    sessionTracks: [
      { trackId: 'bare' },
      { trackId: 'empty', assemblyNames: [] },
    ],
    viewAssemblyNames: ['der_chr3_1'],
  })
  releaseTemporaryAssemblies(session.view)
  expect(session.sessionTracks).toHaveLength(2)
})
