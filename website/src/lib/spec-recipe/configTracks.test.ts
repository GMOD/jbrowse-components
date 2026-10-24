import { agentBrief } from './agent.ts'
import { OWN_FILE, configTracks } from './configTracks.ts'

import type { SessionSpec } from './decode.ts'

const base = 'https://jbrowse.org/code/jb2/main/'
const config = 'test_data/volvox/config.json'

function tracksOf(spec: SessionSpec) {
  return configTracks({ base, config, spec })
}

function lgv(tracks: NonNullable<SessionSpec['views']>[number]['tracks']) {
  return {
    views: [{ type: 'LinearGenomeView', assembly: 'volvox', tracks }],
  }
}

test("a config track's slots become the defaults of a track on the reader's file", () => {
  const [track, ...rest] = tracksOf(
    lgv([{ trackId: 'volvox_cram', height: 300, notASlot: true }]),
  )
  expect(rest).toEqual([])
  expect(track).toEqual({
    type: 'AlignmentsTrack',
    trackId: 'volvox_cram',
    name: expect.any(String),
    assemblyNames: ['volvox'],
    adapter: { type: 'CramAdapter', uri: OWN_FILE },
    displayDefaults: { height: 300 },
  })
})

test('a track the spec only names carries nothing to a config', () => {
  expect(tracksOf(lgv(['volvox_cram', { trackId: 'volvox_cram' }]))).toEqual(
    [],
  )
})

test('a display the track would not open as by default is declared', () => {
  const [track] = tracksOf(
    lgv([
      {
        trackId: 'volvox_test_vcf',
        type: 'LinearMultiSampleVariantDisplay',
        height: 250,
      },
    ]),
  )
  expect(track?.displayDefaults).toBeUndefined()
  expect(track?.displays).toEqual([
    { type: 'LinearMultiSampleVariantDisplay', height: 250 },
  ])
})

test("a session track keeps its own config and takes the spec's settings", () => {
  const own = {
    type: 'FeatureTrack',
    trackId: 'mine',
    name: 'Mine',
    assemblyNames: ['volvox'],
    adapter: { type: 'BedAdapter', uri: 'mine.bed' },
    displayDefaults: { height: 80, showLabels: false },
  }
  expect(
    tracksOf({
      sessionTracks: [own],
      ...lgv([{ trackId: 'mine', displaySnapshot: { height: 120 } }]),
    }),
  ).toEqual([{ ...own, displayDefaults: { height: 120, showLabels: false } }])
})

test("the brief leaves the goal to the reader and names the view's tracks", () => {
  const spec = lgv([{ trackId: 'volvox_cram', height: 300 }])
  const brief = agentBrief({ base, config, spec }, `${base}?config=${config}`)
  const lines = brief.split('\n')
  expect(lines[0]).toMatch(/^My goal: \[/)
  expect(brief).toContain(`Config it loads: ${base}${config}`)
  expect(brief).toMatch(
    /- .*volvox_cram.*AlignmentsTrack, a CRAM file .*drawn as LinearAlignmentsDisplay/,
  )
  expect(brief).toContain('npx @jbrowse/cli validate')
  expect(JSON.parse(brief.slice(brief.indexOf('{')))).toEqual(spec)
})
