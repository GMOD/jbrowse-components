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
  // the export dialog persists its checkboxes in localStorage, so without this
  // the gridlines test's toggle leaks into whatever test runs after it
  localStorage.clear()
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

// the floating color-by key is a menu-driven setting, so an export taken with
// it on has to carry it — otherwise the figure has no key to its ribbon colors
test('export svg of synteny bakes in the color-by legend', async () => {
  await mockConsoleWarn(async () => {
    const { findByTestId, findAllByText, findByText } = await createView({
      ...volvoxConfig,
      defaultSession: {
        ...syntenySession,
        views: [
          {
            ...syntenySession.views[0],
            colorBy: 'strand',
            showColorLegend: true,
          },
        ],
      },
    })

    const svg = await exportAndVerifySvg({
      findByTestId,
      findAllByText,
      findByText,
      filename: 'synteny_color_legend',
      delay,
    })
    expect(svg).toContain('Strand')
    expect(svg).toContain('forward')
    expect(svg).toContain('reverse')
  })
}, 45000)

// Two volvox rows over volvox_fake_synteny, which pairs ctgA with ctgA and ctgB
// with ctgB. The lower row shows ctgA alone, so all six ctgB alignments lose
// their second endpoint and become the class the stubs mark.
const offscreenMateSession = {
  ...syntenySession,
  views: [
    {
      ...syntenySession.views[0],
      showOffscreenMates: true,
      tracks: [
        {
          id: 's1',
          type: 'SyntenyTrack',
          configuration: 'volvox_fake_synteny',
          minimized: false,
          displays: [
            {
              id: 's1-display',
              type: 'LinearSyntenyDisplay',
              configuration: 'volvox_fake_synteny-LinearSyntenyDisplay',
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
          offsetPx: 0,
          bpPerPx: 100,
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
          tracks: [],
        },
        {
          id: 'view2',
          minimized: false,
          type: 'LinearGenomeView',
          offsetPx: 0,
          bpPerPx: 100,
          displayedRegions: [
            {
              refName: 'ctgA',
              start: 0,
              end: 50001,
              reversed: false,
              assemblyName: 'volvox',
            },
          ],
          tracks: [],
        },
      ],
    },
  ],
}

// `showOffscreenMates` is a menu setting like the color-by legend, so a figure
// taken with it on has to carry it — otherwise the export of a view reporting
// what it cannot draw is the export that does not draw it.
test('export svg of synteny bakes in the off-screen mate stubs', async () => {
  await mockConsoleWarn(async () => {
    const { findByTestId, findAllByText, findByText } = await createView({
      ...volvoxConfig,
      defaultSession: offscreenMateSession,
    })

    const svg = await exportAndVerifySvg({
      findByTestId,
      findAllByText,
      findByText,
      filename: 'synteny_offscreen_mates',
      delay,
    })
    // the top row's ruler prints "ctgB" too, so this asks for the stub layer's
    // own marks: one tick per dropped alignment along the band's top edge, and
    // ONE haloed label for the stretch they form. The ticks are subpaths of a
    // single <path> rather than a <rect> each — they carry alpha, so filling
    // them separately would composite them against each other.
    const strip = /<path d="((?:M[\d.]+,0h[\d.]+v6h-[\d.]+Z)+)"/.exec(svg)
    expect(strip).toBeTruthy()
    expect(strip![1]!.match(/v6h-/g)).toHaveLength(6)
    expect(svg.match(/stroke-linejoin="round"[^>]*>ctgB</g)).toHaveLength(1)
  })
}, 45000)
