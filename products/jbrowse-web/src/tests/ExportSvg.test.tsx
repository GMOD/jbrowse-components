import fs from 'fs'
import path from 'path'
import { fireEvent, waitFor } from '@testing-library/react'
import FileSaver from 'file-saver'

// locals
import { hts, createView, setup, doBeforeEach, mockConsoleWarn } from './util'
import volvoxConfig from '../../test_data/volvox/config.json'

// @ts-expect-error
global.Blob = (content, options) => ({ content, options })

// mock from https://stackoverflow.com/questions/44686077
jest.mock('file-saver', () => ({ saveAs: jest.fn() }))

setup()

beforeEach(() => {
  jest.clearAllMocks()
  doBeforeEach()
})

const delay = { timeout: 40000 }
const opts = [{}, delay]

test('export svg of lgv', async () => {
  const { view, findByTestId, findByText } = await createView()

  view.setNewView(0.1, 1)
  fireEvent.click(
    await findByTestId(hts('volvox_alignments_pileup_coverage'), ...opts),
  )

  fireEvent.click(await findByTestId('view_menu_icon', ...opts))
  fireEvent.click(await findByText('Export SVG', ...opts))
  fireEvent.click(await findByText('Submit', ...opts))

  await waitFor(() => {
    expect(FileSaver.saveAs).toHaveBeenCalled()
  }, delay)

  // @ts-expect-error
  const svg = FileSaver.saveAs.mock.calls[0][0].content[0]
  const dir = path.dirname(module.filename)
  fs.writeFileSync(`${dir}/__image_snapshots__/lgv_snapshot.svg`, svg)
  expect(svg).toMatchSnapshot()
}, 45000)

test('export svg of synteny', async () => {
  await mockConsoleWarn(async () => {
    const { findByTestId, findAllByText, findByText } = await createView({
      ...volvoxConfig,
      defaultSession: {
        id: 'session_testing',
        name: 'Integration test example 2/13/2023, 3:23:07 PM',
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
      },
    })

    fireEvent.click(await findByTestId('view_menu_icon', ...opts))
    fireEvent.click((await findAllByText('Export SVG', ...opts))[0]!)
    fireEvent.click(await findByText('Submit', ...opts))

    await waitFor(() => {
      expect(FileSaver.saveAs).toHaveBeenCalled()
    }, delay)

    // @ts-expect-error
    const svg = FileSaver.saveAs.mock.calls[0][0].content[0]
    const dir = path.dirname(module.filename)
    fs.writeFileSync(`${dir}/__image_snapshots__/synteny_snapshot.svg`, svg)
    expect(svg).toMatchSnapshot()
  })
}, 45000)

test('export svg of circular', async () => {
  const { findByTestId, findByText } = await createView({
    ...volvoxConfig,
    defaultSession: {
      name: 'Integration Test Circular',
      views: [{ id: 'integration_test_circular', type: 'CircularView' }],
    },
  })
  // try opening a track before opening the actual view
  fireEvent.click(await findByText('File', ...opts))
  fireEvent.click(await findByText(/Open track/, ...opts))
  fireEvent.click(await findByText('Open', ...opts))

  // open a track selector for the circular view
  fireEvent.click(await findByTestId('circular_track_select', ...opts))

  // wait for the track selector to open and then click the
  // checkbox for the chord test track to toggle it on
  fireEvent.click(await findByTestId(hts('volvox_sv_test'), ...opts))

  fireEvent.click(await findByTestId('view_menu_icon', ...opts))
  fireEvent.click(await findByText('Export SVG', ...opts))
  fireEvent.click(await findByText('Submit', ...opts))

  await waitFor(() => {
    expect(FileSaver.saveAs).toHaveBeenCalled()
  }, delay)

  // @ts-expect-error
  const svg = FileSaver.saveAs.mock.calls[0][0].content[0]
  const dir = path.dirname(module.filename)
  fs.writeFileSync(`${dir}/__image_snapshots__/circular_snapshot.svg`, svg)
  expect(svg).toMatchSnapshot()
}, 45000)

test('export svg of dotplot', async () => {
  const { findByTestId, findByText } = await createView({
    ...volvoxConfig,
    defaultSession: {
      id: 'yvVuWHcq2',
      name: 'Integration test example 2/13/2023, 3:23:07 PM',
      margin: 0,
      drawerWidth: 384,
      views: [
        {
          id: 'JEjDwC61c',
          minimized: false,
          type: 'DotplotView',
          height: 600,
          borderSize: 20,
          tickSize: 5,
          vtextRotation: 0,
          htextRotation: -90,
          fontSize: 15,
          trackSelectorType: 'hierarchical',
          assemblyNames: ['volvox_random_inv', 'volvox'],
          drawCigar: true,
          hview: {
            id: 'FZRhMPvDfS',
            displayedRegions: [
              {
                refName: 'ctgA',
                start: 0,
                end: 49186,
                reversed: false,
                assemblyName: 'volvox_random_inv',
              },
            ],
            bpPerPx: 10.643835752380955,
            offsetPx: 1173,
            interRegionPaddingWidth: 0,
            minimumBlockWidth: 0,
          },
          vview: {
            id: 'DpNpiCTp4t',
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
            bpPerPx: 20.505395171396007,
            offsetPx: 681,
            interRegionPaddingWidth: 0,
            minimumBlockWidth: 0,
          },
          cursorMode: 'crosshair',
          tracks: [
            {
              id: 'TCFk0NeAVI',
              type: 'SyntenyTrack',
              configuration: 'volvox_inv_indels',
              minimized: false,
              displays: [
                {
                  id: 'Exx5MRmlTg',
                  type: 'DotplotDisplay',
                  configuration: 'volvox_inv_indels-DotplotDisplay',
                },
              ],
            },
          ],
          viewTrackConfigs: [],
        },
      ],
    },
  })

  fireEvent.click(await findByTestId('view_menu_icon', ...opts))
  fireEvent.click(await findByText('Export SVG', ...opts))
  fireEvent.click(await findByText('Submit', ...opts))

  await waitFor(() => {
    expect(FileSaver.saveAs).toHaveBeenCalled()
  }, delay)

  // @ts-expect-error
  const svg = FileSaver.saveAs.mock.calls[0][0].content[0]
  const dir = path.dirname(module.filename)
  fs.writeFileSync(`${dir}/__image_snapshots__/dotplot_snapshot.svg`, svg)
  expect(svg).toMatchSnapshot()
}, 45000)
