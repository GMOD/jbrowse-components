import { ExpansionPanelActions } from '@material-ui/core'
import JBrowse from './JBrowse'
import { renderRegion } from './render'

const jbrowse = new JBrowse().configure()

test('can render a single region with Pileup + BamAdapter', async () => {
  const testprops = {
    region: { assembly: 'volvox', refName: 'ctgA', start: 0, end: 800 },
    adapterType: 'BamAdapter',
    adapterConfig: {
      _configId: '7Hc9NkuD4x',
      type: 'BamAdapter',
      bamLocation: {
        path: require.resolve('../public/test_data/volvox-sorted.bam'),
      },
      index: {
        _configId: 'sGW8va26pr',
        location: {
          path: require.resolve('../public/test_data/volvox-sorted.bam.bai'),
        },
      },
    },
    rendererType: 'PileupRenderer',
    renderProps: {},
  }

  const result = await renderRegion(jbrowse, testprops)
  expect(Object.keys(result)).toEqual(['features', 'html'])
  expect(result.features.length).toBe(93)
  expect(result.html).toMatchSnapshot()
})
