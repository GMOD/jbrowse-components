import { recipeDialogHtml } from './html.ts'
import { buildRecipe } from './recipe.ts'

function recipeOf(spec: unknown, config = 'test_data/volvox/config.json') {
  return buildRecipe(
    `https://jbrowse.org/code/jb2/main/?config=${config}&session=spec-${encodeURIComponent(JSON.stringify(spec))}`,
  )!
}

const twoTracks = recipeOf({
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'volvox',
      loc: 'ctgA:1-5000',
      tracks: [
        { trackId: 'volvox_cram', height: 300, pileup: { softClips: { show: true } } },
        { trackId: 'volvox_filtered_vcf', height: 90 },
      ],
    },
  ],
})

test("a track's settings sit under the step that adds it", () => {
  const adds = twoTracks.steps.filter(s => s.example?.includes('“'))
  expect(adds.map(s => s.substeps?.map(sub => sub.title))).toEqual([
    [expect.stringContaining('Soft clipping')],
    undefined,
  ])
})

test('only the first track step says how a track is added', () => {
  const [first, second] = twoTracks.steps.filter(s => s.example?.includes('“'))
  expect(first?.title).toContain('File → Open track...')
  expect(second?.title).toMatch(/^Add the next track the same way\./)
})

test('the Spec tab names the config by a url a reader can open', () => {
  expect(recipeDialogHtml(twoTracks, 'd')).toContain(
    'href="https://jbrowse.org/code/jb2/main/test_data/volvox/config.json"',
  )
})

test("the mismatches' quality fade is the checkbox under Mismatches", () => {
  const recipe = recipeOf({
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: 'ctgA:1-5000',
        tracks: [
          {
            trackId: 'volvox_cram',
            pileup: { mismatches: { encoding: { opacity: 'baseQuality' } } },
          },
        ],
      },
    ],
  })
  const add = recipe.steps.find(s => s.example?.includes('“'))
  expect(add?.substeps?.map(sub => sub.title)).toEqual([
    expect.stringContaining('Fade low quality mismatches (checked)'),
  ])
  expect(recipe.unmapped).toEqual([])
})

test("a track's height is layout, and gets no step", () => {
  expect(recipeDialogHtml(twoTracks, 'd')).not.toContain('px here')
  expect(twoTracks.unmapped).toEqual([])
})

test('nested steps render as a list inside their step', () => {
  expect(recipeDialogHtml(twoTracks, 'd')).toMatch(
    /<li>[^]*?<ol class="spec-substeps"><li><span class="spec-step-title">Track menu/,
  )
})

test("a reference sequence track is checked in the selector, not added", () => {
  const recipe = recipeOf({
    views: [
      {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        loc: 'ctgA:1-100',
        tracks: ['volvox_refseq'],
      },
    ],
  })
  expect(recipe.steps.map(s => s.title)).toContain(
    'Show the sequence: check **Reference sequence (volvox)** in the track selector.',
  )
})

test("a synteny row's steps sit under the row", () => {
  const recipe = recipeOf(
    {
      views: [
        {
          type: 'LinearSyntenyView',
          views: [
            { assembly: 'grape', loc: 'Pp01' },
            { assembly: 'peach', loc: 'chr1' },
          ],
          tracks: [['grape_peach_synteny_mcscan']],
        },
      ],
    },
    'test_data/config_dotplot.json',
  )
  const row = recipe.steps.find(s => s.title === 'Row 2 (peach)')
  expect(row?.substeps?.[0]?.example).toBe('This figure is at chr1.')
})

test('only the first row of a synteny view says how a track is added', () => {
  const recipe = recipeOf({
    views: [
      {
        type: 'LinearSyntenyView',
        views: ['volvox', 'volvox_del'].map(assembly => ({
          assembly,
          loc: 'ctgA',
          tracks: ['volvox_cram'],
        })),
      },
    ],
  })
  const [first, second] = recipe.steps
    .filter(s => s.title.startsWith('Row'))
    .map(row => row.substeps?.[0]?.title)
  expect(first).toContain('**Add track**')
  expect(second).toMatch(/^Add the next track the same way\./)
})
