import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { figureRe, figureRenderer } from './figure-html.ts'
import { videoRecipeDialogHtml } from './spec-recipe/html.ts'
import { openRecipe, opensJBrowse } from './spec-recipe/recipe.ts'

const render = (figure: string) =>
  figure.replaceAll(figureRe, (_match, attrList: string) =>
    figureRenderer(false)(attrList),
  )

const caption = (figure: string) =>
  /<figcaption>([\s\S]*?)<\/figcaption>/.exec(render(figure))?.[1] ?? ''

const tutorials = path.join(__dirname, '../../docs/tutorials')

test('every tutorial figure that opens a JBrowse view gets the one button', () => {
  const stale = readdirSync(tutorials)
    .filter(file => file.endsWith('.md'))
    .flatMap(file =>
      [
        ...readFileSync(path.join(tutorials, file), 'utf8').matchAll(figureRe),
      ]
        .filter(([figure]) =>
          caption(figure).includes('Open this view in JBrowse ↗'),
        )
        .map(([figure]) => `${file}: ${figure.slice(0, 80)}`),
    )
  expect(stale).toEqual([])
})

test('a snapshot-session figure opens through the button', () => {
  const html = render('<Figure src="/img/protein/kras_g12c.png" caption="KRAS" />')
  expect(html).toContain('Open or rebuild this view')
  expect(html).toContain('Open in JBrowse Desktop ↗')
})

test('a figure linking a plain page keeps its own link', () => {
  const html = render(
    '<Figure src="/img/genomes_basics/site_home.png" caption="Home" />',
  )
  expect(html).toContain('Open genomes.jbrowse.org ↗')
  expect(html).not.toContain('Open or rebuild this view')
})

test('a JBrowse link opens a view whether or not its session is a spec', () => {
  expect(
    opensJBrowse(
      'https://jbrowse.org/code/jb2/main/?config=https://jbrowse.org/ucsc/hg38/config.json&session=encoded-eJyrVkrLz1eyUkpKLFKqBQAdegQ0',
    ),
  ).toBe(true)
  expect(
    opensJBrowse(
      'https://jbrowse.org/code/jb2/main/?config=https://jbrowse.org/demos/alphagenome/config.json',
    ),
  ).toBe(true)
  expect(opensJBrowse('https://genomes.jbrowse.org/ucsc')).toBe(false)
  expect(opensJBrowse('?config=test_data/volvox/config.json')).toBe(false)
})

test('a one-view links= figure opens its dialog without a frame picker', () => {
  const html = render(
    '<Figure caption="ZKSCAN1" src="/img/circrna/zkscan1_backsplice.png" links="Open this view=circrna/zkscan1_backsplice" />',
  )
  expect(html).toContain('Open or rebuild this view')
  expect(html).not.toContain('spec-frame-label')
})

test('a video starting from a snapshot session keeps its walkthrough', () => {
  const html = videoRecipeDialogHtml(
    openRecipe(
      'https://jbrowse.org/code/jb2/main/?config=https://jbrowse.org/ucsc/hg38/config.json&session=encoded-eJyrVkrLz1eyUkpKLFKqBQAdegQ0',
    ),
    'v',
    { steps: ['Hover the codon'] },
  )
  expect(html).toContain('Open the session the video starts in ↗')
  expect(html).toContain('Hover the codon')
  expect(html).not.toContain('>Session</label>')
})
