import fs from 'fs'
import path from 'path'

import { fireEvent, waitFor } from '@testing-library/react'
import FileSaver from 'file-saver-es'

import { createView, doBeforeEach, setup } from './util'
import volvoxConfig from '../../test_data/volvox/config.json'

// @ts-expect-error
global.Blob = (content, options) => ({ content, options })

// mock from https://stackoverflow.com/questions/44686077
jest.mock('file-saver-es', () => ({ saveAs: jest.fn() }))

setup()

beforeEach(() => {
  jest.clearAllMocks()
  doBeforeEach()
})

const delay = { timeout: 40000 }
const opts = [{}, delay]

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
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    expect(FileSaver.saveAs).toHaveBeenCalled()
  }, delay)

  // @ts-expect-error
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const svg = FileSaver.saveAs.mock.calls[0][0].content[0]
  const dir = path.dirname(module.filename)
  fs.writeFileSync(`${dir}/__image_snapshots__/dotplot_snapshot.svg`, svg)
  expect(svg).toMatchSnapshot()
}, 45000)
