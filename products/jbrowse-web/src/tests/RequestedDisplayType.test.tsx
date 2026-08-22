import { getTestSession } from './util.tsx'

// A track config may declare several display configs, each with its own
// displayId (the HPRC2 pangenome VCF declares the matrix display and the regular
// one). So "open this track with display type X" has to attach X's own config
// node: taking the first *supported* display's node instead gave the opened
// display another schema's defaults — the regular multi-sample variant display
// inherited the matrix display's 20px connector-line zone, which offset its
// clustering tree from the rows it labels.
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
        type: 'LinearMultiSampleVariantMatrixDisplay',
        displayId: `${trackId}_matrix`,
      },
      {
        type: 'LinearMultiSampleVariantDisplay',
        displayId: `${trackId}_regular`,
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
  view.showTrack(
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
  expect(display.configuration.displayId).toBe('two_displays_regular')
  // the matrix schema raises this slot's default to 20; the regular display's
  // own default is 0, i.e. no connector-line zone
  expect(display.lineZoneHeight).toBe(0)
})

test('showTrack with no display type takes the track’s first declared display', async () => {
  const { session, view } = await getTestSession()
  const added = session.publishTrackConf(
    twoDisplayTrackConf('two_displays2'),
  ) as {
    trackId: string
  }
  view.showTrack(added.trackId)
  const display = view.tracks.find(t => t.trackId === added.trackId)!
    .displays[0]!
  expect(display.type).toBe('LinearMultiSampleVariantMatrixDisplay')
  expect(display.configuration.displayId).toBe('two_displays2_matrix')
})
