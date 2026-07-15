import { isSessionWithAddTracks } from '@jbrowse/core/util'

import { createViewNoWait, doBeforeEach, mockConsole } from './util.tsx'
import chromeSizesConfig from '../../test_data/404_chrom_sizes/config.json' with { type: 'json' }
import brokenTrackConfig from '../../test_data/volvox/config_broken.json' with { type: 'json' }
import brokenOpenConfig from '../../test_data/volvox/config_broken_open.json' with { type: 'json' }
import wrongAssemblyTest from '../../test_data/wrong_assembly.json' with { type: 'json' }

const delay = { timeout: 30000 }

beforeEach(() => {
  doBeforeEach()
})

test('404 sequence file', async () => {
  await mockConsole(async () => {
    const { findAllByText } = createViewNoWait(chromeSizesConfig)
    await findAllByText(
      /HTTP 404 fetching grape.chrom.sizes.nonexist/,
      {},
      delay,
    )
  })
}, 30000)

test('wrong assembly', async () => {
  await mockConsole(async () => {
    const { view, findAllByText } = createViewNoWait(wrongAssemblyTest)
    view.showTrack('volvox_wrong_assembly')
    await findAllByText(/does not match/, {}, delay)
  })
}, 30000)

test('invalid track config surfaces as a snackbar, not a crash', async () => {
  await mockConsole(async () => {
    const { view, findAllByText } = createViewNoWait(brokenTrackConfig)
    const track = view.showTrack('broken_config_demo')

    // showTrack swallows the validation error: nothing is opened and no throw
    // escapes to crash the app
    expect(track).toBeUndefined()
    expect(view.tracks).toHaveLength(0)

    await findAllByText(/invalid configuration/, {}, delay)
  })
}, 30000)

test('adding an invalid sessionTrack config surfaces a snackbar, not a crash', async () => {
  await mockConsole(async () => {
    // adminMode false routes through the typed sessionTracks array, which
    // validates on push (this is the "Copy and open track" crash path)
    const { session, findAllByText } = createViewNoWait(
      brokenTrackConfig,
      false,
    )
    if (!isSessionWithAddTracks(session)) {
      throw new Error('session cannot add tracks')
    }
    const added = session.addTrackConf({
      type: 'FeatureTrack',
      trackId: 'broken_copy',
      name: 'Broken copy',
      assemblyNames: ['volvox'],
      adapter: {
        type: 'Gff3TabixAdapter',
        gffGzLocation: {
          uri: 'volvox.sort.gff3.gz',
          locationType: 'UriLocation',
        },
        index: {
          indexType: 'NOTVALID',
          location: {
            uri: 'volvox.sort.gff3.gz.tbi',
            locationType: 'UriLocation',
          },
        },
      },
    })

    expect(added).toBeUndefined()
    await findAllByText(/invalid configuration/, {}, delay)
  })
}, 30000)

test('a broken track open at session restore is dropped, not a crash', async () => {
  await mockConsole(async () => {
    // The track is open at load but its config can't hydrate. Session load drops
    // it (keeping the invariant that view.tracks only holds usable tracks)
    // rather than crashing.
    const { view } = createViewNoWait(brokenOpenConfig)
    expect(view.tracks).toHaveLength(0)

    // toggling still works with no broken track lingering in the view
    expect(() => view.hideTrack('broken_config_demo')).not.toThrow()
  })
}, 30000)
