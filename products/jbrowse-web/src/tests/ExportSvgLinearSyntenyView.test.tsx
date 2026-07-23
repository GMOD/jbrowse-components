import './svgExportMocks.ts'

import { fireEvent } from '@testing-library/react'

import volvoxConfig from '../../test_data/volvox/config.json' with { type: 'json' }
import {
  createView,
  doBeforeEach,
  exportAndVerifySvg,
  mockConsoleWarn,
  setup,
} from './util.tsx'

jest.mock('@jbrowse/core/util/FileSaver', () => ({ saveAs: jest.fn() }))

setup()

beforeEach(() => {
  jest.clearAllMocks()
  doBeforeEach()
})

const delay = { timeout: 40000 }
const opts = [{}, delay]

const syntenySession = {
  id: 'session_testing',
  name: 'Integration test example 2/13/2023, 3:23:07 PM',
  margin: 0,
  drawerWidth: 384,
  views: [
    {
      id: 'p1',
      minimized: false,
      type: 'LinearSyntenyView',
      trackSelectorType: 'hierarchical',
      showIntraviewLinks: true,
      linkViews: true,
      interactToggled: false,
      middleComparativeHeight: 174,
      tracks: [
        {
          id: 's1',
          type: 'SyntenyTrack',
          configuration: 'volvox_inv_indels',
          minimized: false,
          displays: [
            {
              id: 's1-display',
              type: 'LinearSyntenyDisplay',
              configuration: 'volvox_inv_indels-LinearSyntenyDisplay',
              height: 100,
            },
          ],
        },
      ],
      views: [
        {
          id: 'view1',
          minimized: false,
          type: 'LinearGenomeView',
          offsetPx: 3677,
          bpPerPx: 0.47741687344913153,
          displayedRegions: [
            {
              refName: 'ctgA',
              start: 0,
              end: 50001,
              reversed: false,
              assemblyName: 'volvox',
            },
            {
              refName: 'ctgB',
              start: 0,
              end: 6079,
              reversed: false,
              assemblyName: 'volvox',
            },
          ],
          tracks: [
            {
              id: 't1',
              type: 'SyntenyTrack',
              configuration: 'volvox_inv_indels',
              minimized: false,
              displays: [
                {
                  id: 't1-display',
                  type: 'LGVSyntenyDisplay',
                  configuration: 'volvox_inv_indels-LGVSyntenyDisplay',
                  showSoftClipping: false,
                  colorBy: {
                    type: 'strand',
                  },
                  filterBy: {
                    flagInclude: 0,
                    flagExclude: 1540,
                  },
                },
              ],
            },
          ],
        },
        {
          id: 'view2',
          minimized: false,
          type: 'LinearGenomeView',
          offsetPx: 3627,
          bpPerPx: 0.47741687344913153,
          displayedRegions: [
            {
              refName: 'ctgA',
              start: 0,
              end: 49186,
              reversed: false,
              assemblyName: 'volvox_random_inv',
            },
          ],
          tracks: [
            {
              id: 't2',
              type: 'SyntenyTrack',
              configuration: 'volvox_inv_indels',
              minimized: false,
              displays: [
                {
                  id: 't2-display',
                  type: 'LGVSyntenyDisplay',
                  configuration: 'volvox_inv_indels-LGVSyntenyDisplay',
                  showSoftClipping: false,
                  colorBy: {
                    type: 'strand',
                  },
                  filterBy: {
                    flagInclude: 0,
                    flagExclude: 1540,
                  },
                },
              ],
            },
          ],
        },
      ],
      viewTrackConfigs: [],
      drawCIGAR: true,
      drawCurves: true,
    },
  ],
  widgets: {
    hierarchicalTrackSelector: {
      id: 'hierarchicalTrackSelector',
      type: 'HierarchicalTrackSelectorWidget',
      collapsed: {},
      view: 'WqWgaqv_gB',
    },
  },
  activeWidgets: {
    hierarchicalTrackSelector: 'hierarchicalTrackSelector',
  },
  minimized: false,
  drawerPosition: 'right',
  sessionThemeName: 'default',
}

test('export svg of synteny', async () => {
  await mockConsoleWarn(async () => {
    const { findByTestId, findAllByText, findByText } = await createView({
      ...volvoxConfig,
      defaultSession: syntenySession,
    })

    await exportAndVerifySvg({
      findByTestId,
      findAllByText,
      findByText,
      filename: 'synteny',
      delay,
    })
  })
}, 45000)

test('export svg of synteny with gridlines', async () => {
  await mockConsoleWarn(async () => {
    const { findByTestId, findAllByText, findByText } = await createView({
      ...volvoxConfig,
      defaultSession: syntenySession,
    })

    await exportAndVerifySvg({
      findByTestId,
      findAllByText,
      findByText,
      filename: 'synteny_gridlines',
      delay,
      beforeSubmit: async () => {
        fireEvent.click(await findByText('Show gridlines', ...opts))
      },
    })
  })
}, 45000)
