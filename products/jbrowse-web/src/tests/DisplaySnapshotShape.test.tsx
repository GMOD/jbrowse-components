import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import corePlugins from '../corePlugins.ts'
import { getTestSession } from './util.tsx'

// Documents the serialized shape of display configs that the BaseTrackModel
// persistence reaction relies on. A track's displays are injected by
// baseTrackConfig.preProcessSnapshot with a unique displayId (a
// types.identifier), so they never serialize to `{}` and always retain type +
// displayId — even when every other slot is default.
async function getTrack(trackId: string) {
  const { view } = await getTestSession()
  await view.launchTrack(trackId)
  return view.tracks.find(t => t.trackId === trackId)!
}

interface TrackSnap {
  trackId: string
  displays?: { type?: string; displayId?: string }[]
}

test('getSnapshot(trackConfig).displays keeps type + displayId (not stripped to {})', async () => {
  const track = await getTrack('volvox_filtered_vcf')
  const snap: TrackSnap = getSnapshot(track.configuration)
  expect(snap.displays?.length).toBeGreaterThan(0)
  for (const d of snap.displays!) {
    expect(d).not.toEqual({})
    expect(d.type).toBeTruthy()
    expect(d.displayId).toBe(`${snap.trackId}-${d.type}`)
  }
})

test('getSnapshot(displayConfig) retains displayId (not stripped as an identifier)', async () => {
  const track = await getTrack('volvox_filtered_vcf')
  const displayConf = track.displays[0]!.configuration
  const snap: { type?: string; displayId?: string } = getSnapshot(displayConf)
  expect(snap.type).toBeTruthy()
  expect(snap.displayId).toBeTruthy()
})

// The one thing that actually reaches `DisplayConfigurationReference`'s
// resolve-by-type fallback, and the reason it is not the dead branch its own
// comment used to call it: a renamed display type. A DisplayType `aliases`
// entry rewrites the *config* entry's `type` (preprocessTrackConfigSnapshot)
// and the display model's own `preProcessSnapshot` rewrites the *state model*'s,
// but nothing rewrites the `configuration` id a pre-rename session saved — and
// the stub the track config injects is named for the new type. So the id misses
// and only the type match reconnects the two.
test('a pre-rename session resolves its display config by type', async () => {
  const { session } = await getTestSession()
  const view = (await session.launchView('LinearGenomeView', {
    displayedRegions: [
      { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
    ],
    tracks: [
      {
        type: 'VariantTrack',
        configuration: 'volvox_filtered_vcf',
        displays: [
          {
            type: 'MultiLinearVariantDisplay',
            configuration: 'volvox_filtered_vcf-MultiLinearVariantDisplay',
          },
        ],
      },
    ],
  })) as unknown as {
    tracks: { displays: { type: string; configuration: { type: string } }[] }[]
  }

  const display = view.tracks[0]!.displays[0]!
  expect(display.type).toBe('LinearMultiSampleVariantDisplay')
  // the invariant showTrackGeneric's pickDisplayForView exists to keep, arrived
  // at here through the fallback rather than through the id
  expect(display.configuration.type).toBe(display.type)
})

// A display type nothing registers — a removed one (`LDDisplay`, which a config
// written before the genotype estimator went still names on its VariantTrack),
// a plugin's that
// did not load, a typo — is dropped from the config rather than failing the
// whole track. Dropped, but not silently: the track goes on to render its
// default display, which is not the picture the config asked for, and the only
// thing standing between that and "the browser lost my track setting" is this
// line in the console.
test('a display of a type no plugin registers is dropped with a warning', () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const pluginManager = new PluginManager(
    corePlugins.map(P => new P()),
  ).createPluggableElements()
  pluginManager.configure()
  const conf = pluginManager.pluggableConfigSchemaType('track').create({
    type: 'VariantTrack',
    trackId: 'stale',
    assemblyNames: ['volvox'],
    adapter: { type: 'VcfTabixAdapter', uri: 'x.vcf.gz' },
    displays: [{ type: 'LDDisplay', displayId: 'stale-LDDisplay' }],
  })
  const snap: TrackSnap = getSnapshot(conf)

  expect(snap.displays?.map(d => d.type)).not.toContain('LDDisplay')
  expect(warn).toHaveBeenCalledWith(
    expect.stringContaining('unknown type "LDDisplay" from track "stale"'),
  )
  warn.mockRestore()
})
