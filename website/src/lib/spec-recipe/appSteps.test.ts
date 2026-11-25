import { framesDialogHtml, recipeDialogHtml } from './html.ts'
import { buildRecipe } from './recipe.ts'

const recipe = buildRecipe(
  `https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-${encodeURIComponent(
    JSON.stringify({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'volvox',
          loc: 'ctgA:1-5000',
          tracks: [{ trackId: 'volvox_cram', height: 300 }],
        },
      ],
    }),
  )}`,
)!

function titles(views: unknown[]) {
  return buildRecipe(
    `https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-${encodeURIComponent(JSON.stringify({ views }))}`,
  )?.steps.map(step => step.title)
}

test("a figure's only view, when not the linear one, is opened from the Add menu after the genome", () => {
  expect(
    titles([{ type: 'CircularView', assembly: 'volvox', tracks: ['volvox_sv'] }])?.slice(0, 2),
  ).toEqual([
    expect.stringMatching(/^Open your genome/),
    'Open the view: **Add → Circular view**.',
  ])
  expect(
    titles([{ type: 'SvInspectorView', assembly: 'volvox', uri: 'sv.vcf' }]),
  ).toContain('Open the view: **Add → SV inspector**.')
  expect(
    titles([{ type: 'LinearGenomeView', assembly: 'volvox' }])?.join('\n'),
  ).not.toContain('Open the view')
})

test('a view with no steps gets no empty "From scratch" list', () => {
  const protein = buildRecipe(
    `https://jbrowse.org/code/jb2/main/?config=test_data/protein3d_config.json&session=spec-${encodeURIComponent(
      JSON.stringify({
        views: [{ type: 'ProteinView', structures: [{ pdbId: '1TUP' }] }],
      }),
    )}`,
  )
  expect(protein?.steps).toEqual([])
  const html = protein ? recipeDialogHtml(protein, 'p') : ''
  expect(html).not.toContain('From scratch')
  expect(html).not.toContain('<ol class="spec-steps"></ol>')
  expect(html).toContain('No steps for this view yet')
})

test('the File → Open track shortcut is offered only on one linear view', () => {
  const quickest = (views: unknown[]) => {
    const built = buildRecipe(
      `https://jbrowse.org/code/jb2/main/?config=test_data/volvox/config.json&session=spec-${encodeURIComponent(JSON.stringify({ views }))}`,
    )
    return built ? recipeDialogHtml(built, 'q').includes('Quickest') : undefined
  }
  const lgv = { type: 'LinearGenomeView', assembly: 'volvox' }
  expect(quickest([lgv])).toBe(true)
  expect(quickest([lgv, lgv])).toBe(false)
  expect(quickest([{ type: 'CircularView', assembly: 'volvox' }])).toBe(false)
})

test('a linear view goes to its region before its tracks go in', () => {
  expect(recipe.steps.map(step => step.title)).toEqual([
    expect.stringMatching(/^Open your genome/),
    'Go to your region in the location box.',
    expect.stringMatching(/^Add your track/),
  ])
})

test('"Add the next track the same way" follows only an ordinary Open track step', () => {
  expect(
    titles([
      {
        type: 'LinearGenomeView',
        assembly: 'volvox',
        tracks: ['volvox_cram', 'arc_track', 'volvox_bam', 'volvox_sv'],
      },
    ]),
  ).toEqual([
    expect.stringMatching(/^Open your genome/),
    expect.stringMatching(/^Add your track: \*\*File/),
    expect.stringMatching(/^Add your track: .*pasted JSON/),
    expect.stringMatching(/^Add your track: \*\*File/),
    expect.stringMatching(/^Add the next track the same way/),
  ])
})

test('one genome step covers Desktop and Web', () => {
  expect(recipe.steps[0]?.title).toContain('JBrowse Desktop')
  expect(recipe.steps[0]?.title).toContain('`jbrowse add-assembly`')
})

test('the app and JSON tabs carry the kinds and label a fence widget gives them', () => {
  const html = recipeDialogHtml(recipe, 'd')
  expect(html).toContain('data-tab-kind="desktop"')
  expect(html).toContain('>In the app</label>')
  expect(html).toContain('data-tab-kind="config"')
  expect(html).not.toContain('data-tab-kind="spec"')
})

test('the dialog has one app tab, and the Desktop popover sits by the buttons', () => {
  const html = recipeDialogHtml(recipe, 'd')
  expect(html.match(/<ol class="spec-steps">/g)).toHaveLength(1)
  expect(html).not.toContain('data-tab-kind="web"')
  expect(html.indexOf('class="desktop-link-pop"')).toBeLessThan(
    html.indexOf('class="spec-tabs"'),
  )
})

test('the dialog opens the view first, then the tabs that rebuild it', () => {
  const html = recipeDialogHtml(recipe, 'd')
  const web = html.indexOf('Open in JBrowse Web')
  const desktop = html.indexOf('Open in JBrowse Desktop')
  const tabs = html.indexOf('class="spec-tabs"')
  expect(web).toBeGreaterThan(-1)
  expect(desktop).toBeGreaterThan(web)
  expect(tabs).toBeGreaterThan(desktop)
  expect(html).not.toContain('class="spec-open"')
  expect(recipeDialogHtml(recipe, 'd', true)).toContain('slow to open')
})

test('several views share one dialog, starting on the view the figure shows', () => {
  const frames = ['Import form', 'Linked reads'].map(label => ({
    label,
    recipe,
    slow: false,
  }))
  const html = framesDialogHtml(frames, 'm', 1)
  expect(html.match(/<dialog /g)).toHaveLength(1)
  expect(html.match(/class="spec-frame-label"/g)).toHaveLength(2)
  expect(html).toMatch(/id="m-f1" class="spec-frame-input" checked/)
  expect(html).not.toMatch(/id="m-f0" class="spec-frame-input" checked/)
  expect(html.match(/Open in JBrowse Web/g)).toHaveLength(2)
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map(m => m[1])
  expect(new Set(ids).size).toBe(ids.length)
})
