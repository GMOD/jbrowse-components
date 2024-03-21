import { fireEvent, waitFor } from '@testing-library/react'
import fs from 'fs'
import path from 'path'
import FileSaver from 'file-saver'
import volvoxConfig from '../../test_data/volvox/config.json'

// locals
import { hts, createView, setup, doBeforeEach, mockConsoleWarn } from './util'

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

  await waitFor(() => expect(FileSaver.saveAs).toHaveBeenCalled(), delay)

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
        activeWidgets: {
          hierarchicalTrackSelector: 'hierarchicalTrackSelector',
        },
        drawerPosition: 'right',
        drawerWidth: 384,
        id: 'session_testing',
        margin: 0,
        minimized: false,
        name: 'Integration test example 2/13/2023, 3:23:07 PM',

        sessionThemeName: 'default',
        views: [
          {
            drawCIGAR: true,
            drawCurves: true,
            id: 'p1',
            interactToggled: false,
            linkViews: true,
            middleComparativeHeight: 174,
            minimized: false,
            showIntraviewLinks: true,
            trackSelectorType: 'hierarchical',
            tracks: [
              {
                configuration: 'volvox_inv_indels',
                displays: [
                  {
                    configuration: 'volvox_inv_indels-LinearSyntenyDisplay',
                    height: 100,
                    id: 's1-display',
                    type: 'LinearSyntenyDisplay',
                  },
                ],
                id: 's1',
                minimized: false,
                type: 'SyntenyTrack',
              },
            ],
            type: 'LinearSyntenyView',
            viewTrackConfigs: [],
            views: [
              {
                bpPerPx: 0.47741687344913153,
                displayedRegions: [
                  {
                    assemblyName: 'volvox',
                    end: 50001,
                    refName: 'ctgA',
                    reversed: false,
                    start: 0,
                  },
                  {
                    assemblyName: 'volvox',
                    end: 6079,
                    refName: 'ctgB',
                    reversed: false,
                    start: 0,
                  },
                ],
                id: 'view1',
                minimized: false,
                offsetPx: 3677,
                tracks: [
                  {
                    configuration: 'volvox_inv_indels',
                    displays: [
                      {
                        colorBy: {
                          type: 'strand',
                        },
                        configuration: 'volvox_inv_indels-LGVSyntenyDisplay',
                        filterBy: {
                          flagExclude: 1540,
                          flagInclude: 0,
                        },
                        id: 't1-display',
                        showSoftClipping: false,
                        type: 'LGVSyntenyDisplay',
                      },
                    ],
                    id: 't1',
                    minimized: false,
                    type: 'SyntenyTrack',
                  },
                ],
                type: 'LinearGenomeView',
              },
              {
                bpPerPx: 0.47741687344913153,
                displayedRegions: [
                  {
                    assemblyName: 'volvox_random_inv',
                    end: 49186,
                    refName: 'ctgA',
                    reversed: false,
                    start: 0,
                  },
                ],
                id: 'view2',
                minimized: false,
                offsetPx: 3627,
                tracks: [
                  {
                    configuration: 'volvox_inv_indels',
                    displays: [
                      {
                        colorBy: {
                          type: 'strand',
                        },
                        configuration: 'volvox_inv_indels-LGVSyntenyDisplay',
                        filterBy: {
                          flagExclude: 1540,
                          flagInclude: 0,
                        },
                        id: 't2-display',
                        showSoftClipping: false,
                        type: 'LGVSyntenyDisplay',
                      },
                    ],
                    id: 't2',
                    minimized: false,
                    type: 'SyntenyTrack',
                  },
                ],
                type: 'LinearGenomeView',
              },
            ],
          },
        ],
        widgets: {
          hierarchicalTrackSelector: {
            collapsed: {},
            id: 'hierarchicalTrackSelector',
            type: 'HierarchicalTrackSelectorWidget',
            view: 'WqWgaqv_gB',
          },
        },
      },
    })

    fireEvent.click(await findByTestId('view_menu_icon', ...opts))
    fireEvent.click((await findAllByText('Export SVG', ...opts))[0])
    fireEvent.click(await findByText('Submit', ...opts))

    await waitFor(() => expect(FileSaver.saveAs).toHaveBeenCalled(), delay)

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

  await waitFor(() => expect(FileSaver.saveAs).toHaveBeenCalled(), delay)

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
      drawerWidth: 384,
      id: 'yvVuWHcq2',
      margin: 0,
      name: 'Integration test example 2/13/2023, 3:23:07 PM',
      views: [
        {
          assemblyNames: ['volvox_random_inv', 'volvox'],
          borderSize: 20,
          cursorMode: 'crosshair',
          drawCigar: true,
          fontSize: 15,
          height: 600,
          htextRotation: -90,
          hview: {
            bpPerPx: 10.643835752380955,
            displayedRegions: [
              {
                assemblyName: 'volvox_random_inv',
                end: 49186,
                refName: 'ctgA',
                reversed: false,
                start: 0,
              },
            ],
            id: 'FZRhMPvDfS',
            interRegionPaddingWidth: 0,
            minimumBlockWidth: 0,
            offsetPx: 1173,
          },
          id: 'JEjDwC61c',
          minimized: false,
          tickSize: 5,
          trackSelectorType: 'hierarchical',
          tracks: [
            {
              configuration: 'volvox_inv_indels',
              displays: [
                {
                  configuration: 'volvox_inv_indels-DotplotDisplay',
                  id: 'Exx5MRmlTg',
                  type: 'DotplotDisplay',
                },
              ],
              id: 'TCFk0NeAVI',
              minimized: false,
              type: 'SyntenyTrack',
            },
          ],
          type: 'DotplotView',
          viewTrackConfigs: [],
          vtextRotation: 0,
          vview: {
            bpPerPx: 20.505395171396007,
            displayedRegions: [
              {
                assemblyName: 'volvox',
                end: 50001,
                refName: 'ctgA',
                reversed: false,
                start: 0,
              },
              {
                assemblyName: 'volvox',
                end: 6079,
                refName: 'ctgB',
                reversed: false,
                start: 0,
              },
            ],
            id: 'DpNpiCTp4t',
            interRegionPaddingWidth: 0,
            minimumBlockWidth: 0,
            offsetPx: 681,
          },
        },
      ],
    },
  })

  fireEvent.click(await findByTestId('view_menu_icon', ...opts))
  fireEvent.click(await findByText('Export SVG', ...opts))
  fireEvent.click(await findByText('Submit', ...opts))

  await waitFor(() => expect(FileSaver.saveAs).toHaveBeenCalled(), delay)

  // @ts-expect-error
  const svg = FileSaver.saveAs.mock.calls[0][0].content[0]
  const dir = path.dirname(module.filename)
  fs.writeFileSync(`${dir}/__image_snapshots__/dotplot_snapshot.svg`, svg)
  expect(svg).toMatchSnapshot()
}, 45000)
