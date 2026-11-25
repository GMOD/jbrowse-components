import { openDialogHtml, recipeButtonHtml } from './html.ts'
import { openRecipe, opensJBrowse } from './recipe.ts'

const snapshotUrl =
  'https://jbrowse.org/code/jb2/main/?config=https://jbrowse.org/ucsc/hg38/config.json&session=encoded-eJyrVkrLz1eyUkpKLFKqBQAdegQ0'

test('a JBrowse link opens a view whether or not its session is a spec', () => {
  expect(opensJBrowse(snapshotUrl)).toBe(true)
  expect(
    opensJBrowse(
      'https://jbrowse.org/code/jb2/main/?config=https://jbrowse.org/demos/alphagenome/config.json',
    ),
  ).toBe(true)
  expect(opensJBrowse('https://genomes.jbrowse.org/ucsc')).toBe(false)
  expect(opensJBrowse('/docs/urlparams/')).toBe(false)
})

test('a snapshot session opens in Web and Desktop under the same button', () => {
  const html = openDialogHtml(openRecipe(snapshotUrl, 'protein/kras_g12c'), 'd')
  expect(html).toContain('Open in JBrowse Web ↗')
  expect(html).toContain('Open in JBrowse Desktop ↗')
  expect(html).toContain('jbrowse://')
  expect(html).toContain('File → Open track...')
  expect(html).not.toContain('rebuild it from your own data')
  expect(recipeButtonHtml('d')).toContain('Open or rebuild this view')
})
