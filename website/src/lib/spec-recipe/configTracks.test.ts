import { agentBrief } from './agent.ts'
import { OWN_FILE, configTracks } from './configTracks.ts'
import { buildRecipe } from './recipe.ts'

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

test('a multi-wiggle takes one BigWig of the reader\'s per row', () => {
  const [track] = tracksOf(lgv([{ trackId: 'volvox_microarray_multi', height: 200 }]))
  expect(track?.adapter).toEqual({
    type: 'MultiWiggleAdapter',
    bigWigs: [`${OWN_FILE}_1`, `${OWN_FILE}_2`],
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
        trackId: 'gff3tabix_genes',
        type: 'LinearMultiRowFeatureDisplay',
        height: 250,
      },
    ]),
  )
  expect(track?.displayDefaults).toBeUndefined()
  expect(track?.displays).toEqual([
    { type: 'LinearMultiRowFeatureDisplay', height: 250 },
  ])
})

const chromhmm = {
  base,
  config: 'test_data/config_demo.json',
  spec: {
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'hg19',
        tracks: ['broad_chromhmm_multirow_hg19'],
      },
    ],
  },
}

test("a config track's own displays carry over, without their displayId, though the spec sets nothing", () => {
  const [track] = configTracks(chromhmm)
  expect(track?.adapter).toEqual({ type: 'BigBedAdapter', uri: OWN_FILE })
  expect(track?.displays).toEqual([
    expect.objectContaining({
      type: 'LinearMultiRowFeatureDisplay',
      rows: expect.objectContaining({ field: 'cellType' }),
    }),
  ])
  expect(track?.displays?.[0]).not.toHaveProperty('displayId')
})

test("the spec's settings go over a config track's own display", () => {
  const [track] = configTracks({
    ...chromhmm,
    spec: {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg19',
          tracks: [{ trackId: 'broad_chromhmm_multirow_hg19', height: 240 }],
        },
      ],
    },
  })
  expect(track?.displays).toEqual([
    expect.objectContaining({
      type: 'LinearMultiRowFeatureDisplay',
      rows: expect.objectContaining({ field: 'cellType' }),
      height: 240,
    }),
  ])
})

test("the steps walk a config track's own display settings", () => {
  const recipe = buildRecipe(
    `${base}?config=${chromhmm.config}&session=spec-${encodeURIComponent(JSON.stringify(chromhmm.spec))}`,
  )
  const track = recipe?.steps[1]
  expect(track?.substeps?.map(step => step.title)).toContain(
    'Track menu → One row per → Attribute...',
  )
  expect(track?.note).toContain('`encoding.color`')
  expect(recipe?.unmapped).toEqual([])
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
  const brief = agentBrief({ base, config, spec })
  const lines = brief.split('\n')
  expect(lines[0]).toMatch(/^My goal: \[/)
  expect(brief).toContain(`Config it loads: ${base}${config}`)
  expect(brief).toMatch(
    /- .*volvox_cram.*AlignmentsTrack, a CRAM file .*drawn as LinearAlignmentsDisplay/,
  )
  expect(brief).toContain('npx @jbrowse/cli validate')
  expect(JSON.parse(brief.slice(brief.indexOf('{')))).toEqual(spec)
})
