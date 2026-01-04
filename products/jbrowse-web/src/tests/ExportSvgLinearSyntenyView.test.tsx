import fs from 'fs'
import path from 'path'

import { fireEvent, waitFor } from '@testing-library/react'
import { saveAs } from 'file-saver-es'

import {
  createView,
  doBeforeEach,
  exportAndVerifySvg,
  mockConsoleWarn,
  setup,
} from './util'
import volvoxConfig from '../../test_data/volvox/config.json'

// @ts-expect-error
global.Blob = (content, options) => ({ content, options })

jest.mock('file-saver-es', () => ({ saveAs: jest.fn() }))

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

    fireEvent.click(await findByTestId('view_menu_icon', ...opts))
    fireEvent.click((await findAllByText('Export SVG', ...opts))[0]!)
    fireEvent.click(await findByText('Submit', ...opts))

    await exportAndVerifySvg({
      findByTestId,
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

    fireEvent.click(await findByTestId('view_menu_icon', ...opts))
    fireEvent.click((await findAllByText('Export SVG', ...opts))[0]!)

    // Enable gridlines checkbox
    fireEvent.click(await findByText('Show gridlines', ...opts))

    fireEvent.click(await findByText('Submit', ...opts))

    await waitFor(() => {
      expect(saveAs).toHaveBeenCalled()
    }, delay)

    // @ts-expect-error

    const svg = saveAs.mock.calls[0][0].content[0]
    const dir = path.dirname(module.filename)
    fs.writeFileSync(
      `${dir}/__image_snapshots__/synteny_gridlines_snapshot.svg`,
      svg,
    )
    expect(svg).toMatchSnapshot()
  })
}, 45000)
