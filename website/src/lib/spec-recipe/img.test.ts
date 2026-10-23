import { imgRecipe } from './img.ts'

const config = 'https://jbrowse.org/demos/cgiab/config.json'

test('a linear view is flags, with each track setting in one JSON argument', () => {
  const recipe = imgRecipe(
    {
      sessionTracks: [{ trackId: 'mine', type: 'VariantTrack' }],
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38',
          loc: 'chr2:135,787,850-135,876,467',
          highlight: ['chr2:1-2'],
          tracks: [
            'genes',
            {
              trackId: 'mine',
              type: 'LinearMultiSampleVariantDisplay',
              clusterRegion: 'chr2:1-100',
              height: 520,
            },
          ],
        },
      ],
    },
    config,
    1500,
  )!
  expect(recipe.command).toContain("cat > tracks.json <<'JSON'")
  expect(recipe.command).toContain(
    `--track mine display:LinearMultiSampleVariantDisplay '{"clusterRegion":"chr2:1-100","height":520}'`,
  )
  expect(recipe.command).toContain('--assembly GRCh38 --loc chr2:135,787,850-135,876,467')
  expect(recipe.command).toContain('--width 1500 --out figure.svg')
  expect(recipe.command).toContain(`--view '{"highlight":["chr2:1-2"]}'`)
})

// jbrowse-img reads no dotted key in its JSON argument
test("a track's band and filter members reach the command nested", () => {
  const { command } = imgRecipe(
    {
      views: [
        {
          type: 'LinearGenomeView',
          assembly: 'GRCh38',
          loc: 'chr2:1-100',
          tracks: [
            {
              trackId: 'reads',
              coverage: { height: 90 },
              filter: [
                { field: 'split', equal: true },
                { field: 'junction.reads', gte: 3 },
              ],
            },
          ],
        },
      ],
    },
    config,
    1500,
  )!
  expect(command).toContain(
    `--track reads '{"coverage":{"height":90},"filter":[{"field":"split","equal":true},{"field":"junction.reads","gte":3}]}'`,
  )
})

test('a comparative view renders its own spec through its subcommand', () => {
  const view = { type: 'DotplotView', views: [{ assembly: 'a' }, { assembly: 'b' }] }
  const { command } = imgRecipe({ views: [view] }, config, undefined)!
  expect(command).toContain('npx @jbrowse/img dotplot --config')
  expect(command).toContain('--spec session.json')
  expect(command).toContain(JSON.stringify({ views: [view] }, null, 2))
})

test('a figure of two views gets no command', () => {
  const view = { type: 'LinearGenomeView', assembly: 'a', loc: 'x:1-2' }
  expect(imgRecipe({ views: [view, view] }, config, 1500)).toBeUndefined()
})
