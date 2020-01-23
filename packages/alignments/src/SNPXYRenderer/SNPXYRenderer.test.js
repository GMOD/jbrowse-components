import SimpleFeature from '@gmod/jbrowse-core/util/simpleFeature'
import SNPXYRenderer, { configSchema, ReactComponent } from '.'

function SNPXYPlotRendererPlugin() {
  return new SNPXYRenderer({
    name: 'SNPXYRenderer',
    ReactComponent,
    configSchema,
  })
}
test('several features', async () => {
  const result = await SNPXYPlotRendererPlugin().makeImageData({
    features: [
      new SimpleFeature({
        id: 't1',
        data: {
          start: 1,
          end: 100,
          score: 1,
          snpinfo: [
            { base: 'reference', score: 2, strands: { '-': 1, '+': 1 } },
            { base: 'total', score: 2 },
          ],
        },
      }),
      new SimpleFeature({
        id: 't2',
        data: {
          start: 101,
          end: 200,
          score: 3,
          snpinfo: [
            { base: 'reference', score: 2, strands: { '-': 1, '+': 1 } },
            { base: 'A', score: 1, strands: { '-': 1 } },
            { base: 'total', score: 3 },
          ],
        },
      }),
    ],
    region: { end: 100, start: 1 },
    scaleOpts: { domain: [0, 50], scaleType: 'linear' },
    config: {},
    bpPerPx: 3,
    highResolutionScaling: 1,
    horizontallyFlipped: false,
    height: 100,
  })

  expect(result).toMatchSnapshot({
    imageData: expect.any(Object),
  })
})
