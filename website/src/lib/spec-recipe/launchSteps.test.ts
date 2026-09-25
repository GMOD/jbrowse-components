import { recipeDialogHtml } from './html.ts'
import { buildRecipe } from './recipe.ts'

function syntenyRecipe(collapseEmptyRows: boolean) {
  const spec = {
    views: [
      {
        type: 'LinearSyntenyView',
        views: [{ assembly: 'grape' }, { assembly: 'peach' }],
        tracks: [['grape_peach_synteny_mcscan']],
        collapseEmptyRows,
      },
    ],
  }
  const recipe = buildRecipe(
    `https://jbrowse.org/code/jb2/main/?config=test_data/config_dotplot.json&session=spec-${encodeURIComponent(JSON.stringify(spec))}`,
  )!
  return { recipe, titles: recipe.steps.map(step => step.title) }
}

test('the launch dialog default takes no step', () => {
  const { recipe, titles } = syntenyRecipe(true)
  expect(titles.some(t => t.includes('Collapse panels'))).toBe(false)
  expect(recipe.unmapped).not.toContain('collapseEmptyRows')
})

test('a launch dialog setting comes before Launch', () => {
  const { titles } = syntenyRecipe(false)
  const collapse = titles.findIndex(t => t.includes('Collapse panels'))
  expect(collapse).toBeGreaterThan(-1)
  expect(titles.at(-1)).toBe('Click **Launch**.')
  expect(collapse).toBe(titles.length - 2)
})

test('a step note renders its bold and code', () => {
  const html = recipeDialogHtml(syntenyRecipe(true).recipe, 'd')
  expect(html).toContain('<strong>Quick start</strong>')
  expect(html).not.toContain('**')
})
