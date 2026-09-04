import { suppressTeardownNoise } from '@jbrowse/display-test-utils'
import { isAlive } from '@jbrowse/mobx-state-tree'

import createViewState from './createViewState.ts'
import { destroyViewState } from './destroyViewState.ts'

const assembly = {
  name: 'volvox',
  uri: 'https://jbrowse.org/genomes/volvox/volvox.2bit',
}

suppressTeardownNoise()

test('tears the engine down, and stays a no-op once torn down', () => {
  const state = createViewState({ assembly })
  expect(isAlive(state)).toBe(true)

  destroyViewState(state)
  expect(isAlive(state)).toBe(false)

  // idempotent: a host that destroys on unmount and again on a controller's
  // own destroy() must not have to track which came first
  expect(() => {
    destroyViewState(state)
  }).not.toThrow()
})

// A host that swaps datasets can unmount an engine before anything ever
// rendered it — a fast click through the pathogen dropdown on the Nextstrain
// page, or React StrictMode's mount/cleanup/mount. Nothing about that may
// throw. (destroyViewState materializes the session first for a related reason
// its own comment gives; that guard is not what this reaches, because
// createViewState has already read `session` by the time it returns.)
test('an engine destroyed before it was ever rendered does not throw', () => {
  const state = createViewState({
    assembly,
    tracks: [
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
    ],
    defaultSession: {
      name: 'never rendered',
      view: {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: 'ctgA:1..100',
        tracks: ['volvox_gff3'],
      },
    },
  })
  expect(() => {
    destroyViewState(state)
  }).not.toThrow()
  expect(isAlive(state)).toBe(false)
})
