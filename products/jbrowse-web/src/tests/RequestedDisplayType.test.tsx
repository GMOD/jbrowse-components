import { getTestSession } from './util.tsx'

// A track config may declare several display configs, each with its own
// displayId. So "open this track with display type X" has to attach X's own
// config node: taking the first *supported* display's node instead gave the
// opened display another schema's defaults.
function twoDisplayTrackConf(trackId: string) {
  return {
    type: 'VariantTrack',
    trackId,
    name: trackId,
    assemblyNames: ['volvox'],
    adapter: {
      type: 'VcfTabixAdapter',
      vcfGzLocation: { uri: 'volvox.filtered.vcf.gz' },
      index: { location: { uri: 'volvox.filtered.vcf.gz.tbi' } },
    },
    displays: [
      {
        type: 'LinearVariantDisplay',
        displayId: `${trackId}_single`,
      },
      {
        type: 'LinearMultiSampleVariantDisplay',
        displayId: `${trackId}_multi`,
      },
    ],
  }
}

test('showTrack with an explicit display type attaches that display’s config', async () => {
  const { session, view } = await getTestSession()
  const added = session.publishTrackConf(
    twoDisplayTrackConf('two_displays'),
  ) as {
    trackId: string
  }
  await view.launchTrack(
    added.trackId,
    {},
    {
      type: 'LinearMultiSampleVariantDisplay',
    },
  )
  const display = view.tracks.find(t => t.trackId === added.trackId)!
    .displays[0]!
  expect(display.type).toBe('LinearMultiSampleVariantDisplay')
  expect(display.configuration.type).toBe('LinearMultiSampleVariantDisplay')
  expect(display.configuration.displayId).toBe('two_displays_multi')
})

test('showTrack with no display type takes the track’s first declared display', async () => {
  const { session, view } = await getTestSession()
  const added = session.publishTrackConf(
    twoDisplayTrackConf('two_displays2'),
  ) as {
    trackId: string
  }
  await view.launchTrack(added.trackId)
  const display = view.tracks.find(t => t.trackId === added.trackId)!
    .displays[0]!
  expect(display.type).toBe('LinearVariantDisplay')
  expect(display.configuration.displayId).toBe('two_displays2_single')
})
