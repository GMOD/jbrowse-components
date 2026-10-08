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

test('one genome step covers Desktop and Web', () => {
  expect(recipe.steps[0]?.title).toContain('JBrowse Desktop start screen')
  expect(recipe.steps[0]?.title).toContain('`jbrowse add-assembly`')
})

test('the dialog has one Steps tab, and the Desktop fallback sits by the buttons', () => {
  const html = recipeDialogHtml(recipe, 'd')
  expect(html.match(/<ol class="spec-steps">/g)).toHaveLength(1)
  expect(html).not.toContain('data-tab-kind="web"')
  expect(html.indexOf('Desktop link does nothing?')).toBeLessThan(
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
  expect(recipeDialogHtml(recipe, 'd', true)).toContain('takes a while')
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
