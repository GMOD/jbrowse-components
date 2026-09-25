import { recipeDialogHtml } from './html.ts'
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

test('Web steps open the genome through config.json, Desktop steps through the start screen', () => {
  expect(recipe.steps[0]?.title).toContain('JBrowse Desktop start screen')
  expect(recipe.webSteps[0]?.title).toContain('`jbrowse add-assembly`')
  expect(recipe.webSteps[0]?.example).toBe(recipe.steps[0]?.example)
  expect(recipe.webSteps.slice(1)).toEqual(recipe.steps.slice(1))
})

test('the dialog has a Desktop and a Web tab, each with its own steps', () => {
  const html = recipeDialogHtml(recipe, 'd')
  expect(html).toContain('data-tab-kind="desktop"')
  expect(html).toContain('data-tab-kind="web"')
  expect(html).toContain('Open this view in JBrowse Web')
  expect(html.match(/<ol class="spec-steps">/g)).toHaveLength(2)
})
