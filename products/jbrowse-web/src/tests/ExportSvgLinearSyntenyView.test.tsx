import './svgExportMocks.ts'

import { act, fireEvent } from '@testing-library/react'

import volvoxConfig from '../../test_data/volvox/config.json' with { type: 'json' }
import {
  createView,
  doBeforeEach,
  exportAndVerifySvg,
  mockConsoleWarn,
  setup,
} from './util.tsx'

import type { LinearSyntenyViewModel } from '@jbrowse/plugin-linear-comparative-view'

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

// The fixture session used to carry a view-level `drawCurves: true`; that
// property is gone, so the curves the snapshots were captured with are asked
// for the way the settings checkbox now asks — a config-slot write on the
// view's synteny displays. The snapshots staying byte-identical is the
// equivalence check.
function curveRibbons(view: unknown) {
  act(() => {
    ;(view as LinearSyntenyViewModel).setDrawCurves(true)
  })
}

test('export svg of synteny', async () => {
  await mockConsoleWarn(async () => {
    const { findByTestId, findAllByText, findByText, view } = await createView({
      ...volvoxConfig,
      defaultSession: syntenySession,
    })
    curveRibbons(view)

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
    const { findByTestId, findAllByText, findByText, view } = await createView({
      ...volvoxConfig,
      defaultSession: syntenySession,
    })
    curveRibbons(view)

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
    const { findByTestId, findAllByText, findByText, view } = await createView({
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
    curveRibbons(view)

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
// with ctgB. The lower row shows ctgA alone, so every ctgB alignment loses its
// second endpoint and becomes the class the stubs mark.
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
    const { findByTestId, findAllByText, findByText, view } = await createView({
      ...volvoxConfig,
      defaultSession: offscreenMateSession,
    })
    curveRibbons(view)

    // Both rows were saved at 100 bp/px, zoomed out past either row's own
    // fit-to-width (77.12 and 68.76 here). `sameScale` is off, so no shared
    // ceiling exists and nothing should re-clamp them: the session opens where
    // it was left. Dropping the `sameScale` term from the clamp autorun's
    // guard drags both rows down to those fits, which widens ctgA from 499.01
    // to 527.5 in the export below.
    //
    // Asserted here rather than left to that export's whole-page snapshot: a
    // 4KB SVG string drifts red for reasons that have nothing to do with the
    // clamp, and the first `-u` answering one of those would accept this too.
    const syntenyView = view as unknown as LinearSyntenyViewModel
    expect(syntenyView.views.map(v => v.bpPerPx)).toEqual([100, 100])

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
    // Seven, one per distinct ctgB endpoint. The file's six ctgB rows hold
    // four alignments: a self-diagonal, two written from both ends, and
    // ctgB:0-5929/ctgB:150-6079 written from one. Reading the query column
    // alone found six endpoints and missed 150-6079, whose row has no mirror
    // to supply it — see PairwiseAdapterBase.facingSides. Reading both columns
    // finds it, and createSideDedupe keeps the mirrored pairs at one each.
    expect(strip![1]!.match(/v6h-/g)).toHaveLength(7)
    expect(svg.match(/stroke-linejoin="round"[^>]*>ctgB</g)).toHaveLength(1)
  })
}, 45000)
