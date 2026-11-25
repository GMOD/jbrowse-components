import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { figureRe, figureRenderer } from './figure-html.ts'

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
