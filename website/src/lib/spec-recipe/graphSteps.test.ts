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
      'Track menu → Layout → Force-directed layout',
      'Track menu → Color → Reference position',
      'Track menu → Show... → Show bubble halos (unchecked)',
      'Track menu → Settings → Bubble spread → Open bubbles',
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
      'Graph view menu → Show... → Show deletion edges (checked)',
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
