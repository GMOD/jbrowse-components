import { recipeDialogHtml } from './html.ts'
import { buildRecipe } from './recipe.ts'

function stepsOf(spec: unknown) {
  const recipe = buildRecipe(
    `https://jbrowse.org/code/jb2/main/?config=test_data/graphgenomeview/hprc.json&session=spec-${encodeURIComponent(JSON.stringify(spec))}`,
  )!
  return {
    unmapped: recipe.unmapped,
    titles: recipe.steps.flatMap(s => [
      s.title,
      ...(s.substeps ?? []).map(sub => sub.title),
    ]),
  }
}

const lgv = (track: object) => ({
  views: [
    {
      type: 'LinearGenomeView',
      assembly: 'hg38',
      loc: 'chr6:32,500,000-32,560,000',
      tracks: [track],
    },
  ],
})

test("a graph track's pane settings are track menu steps", () => {
  const { titles, unmapped } = stepsOf(
    lgv({
      trackId: 'hprc_minigraph_segments',
      type: 'LinearGraphDisplay',
      pane: {
        layoutMode: 'force',
        colorScheme: 'reference-position',
        showBubbles: false,
        bubbleSpread: 'open',
      },
    }),
  )
  expect(titles).toEqual(
    expect.arrayContaining([
      'Track menu → Layout → Force-directed',
      'Track menu → Color → Reference position',
      'Track menu → Show → Show bubble halos (unchecked)',
      'Track menu → Graph settings... → Bubble spread → Open bubbles',
    ]),
  )
  expect(unmapped).toEqual([])
})

test('the same names on a standalone view name its toolbar', () => {
  const { titles } = stepsOf({
    views: [
      {
        type: 'GraphGenomeView',
        gfaLocation: { uri: 'x.gfa' },
        layoutMode: 'force',
        showDeletionEdges: true,
      },
    ],
  })
  expect(titles).toEqual(
    expect.arrayContaining([
      'Graph view toolbar → Layout → Force-directed layout',
      'Graph view menu → Show → Show links that skip reference (checked)',
    ]),
  )
})

test('a pane on any other display is not a graph setting', () => {
  const { unmapped } = stepsOf(
    lgv({
      trackId: 'hprc_minigraph_segments',
      type: 'LinearBasicDisplay',
      pane: { layoutMode: 'force' },
    }),
  )
  expect(unmapped).toEqual(['layoutMode'])
})

const graphFigure = buildRecipe(
  `https://jbrowse.org/code/jb2/main/?config=test_data/graphgenomeview/hprc.json&session=spec-${encodeURIComponent(
    JSON.stringify({
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'hg38',
          tracks: [
            { trackId: 'hg38_ncbiRefSeq_ucsc', height: 70 },
            'hprc_minigraph_segments',
          ],
        },
      ],
    }),
  )}`,
)

test('a graph track is added through the pangenome graph form, from its plugin', () => {
  const graph = graphFigure?.steps.find(step =>
    step.example?.includes('HPRC v2.1 graph'),
  )
  expect(graph?.title).toContain(
    'choose **Add pangenome graph track**, and set **File type** to **Indexed GFA',
  )
  expect(graph?.note).toContain('GraphGenomeView plugin')
})

test('the CLI tab names a styled track it cannot rebuild and drops the styled claim', () => {
  expect(graphFigure?.cli?.missing).toEqual(['HPRC v2.1 graph (rGFA segments)'])
  const html = graphFigure ? recipeDialogHtml(graphFigure, 'g') : ''
  expect(html).toContain('is not among them')
  expect(html).not.toContain('styled</a> as in the figure')
})
