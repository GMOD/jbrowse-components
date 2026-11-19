import Plugin from '@jbrowse/core/Plugin'
import { addViewMenuItems } from '@jbrowse/core/pluggableElementTypes'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import Rubberband from './Rubberband.tsx'

import type PluginManager from '@jbrowse/core/PluginManager'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

class KeepOpenRowPlugin extends Plugin {
  name = 'KeepOpenRowPlugin'

  install(pluginManager: PluginManager) {
    addViewMenuItems(pluginManager, 'LinearGenomeView', {
      menu: 'rubberBandLaunchMenuItems',
      items: () => ({
        type: 'checkbox',
        label: 'Keep me open',
        checked: false,
        onClick: () => {},
      }),
    })
  }
}

test('a keep-open row in the range menu leaves the menu up', async () => {
  const session = createTestSession({
    runtimePlugins: [
      {
        plugin: new KeepOpenRowPlugin(),
        definition: { name: 'KeepOpenRow', umdUrl: 'keep-open-row.js' },
      },
    ],
  })
  session.addAssemblyConf({
    name: 'volMyt1',
    sequence: {
      trackId: 'sequenceConfigId',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'firstId',
            start: 0,
            end: 1000,
            seq: 'cattgttgcg'.repeat(100),
          },
        ],
      },
    },
  })
  const model = session.addView('LinearGenomeView', {
    displayedRegions: [
      { refName: 'ctgA', start: 0, end: 1000, assemblyName: 'volMyt1' },
    ],
  })
  model.setWidth(800)
  await waitFor(() => {
    expect(model.initialized).toBe(true)
  })

  render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <Rubberband model={model} />
    </ThemeProvider>,
  )
  fireEvent.mouseDown(screen.getByTestId('rubberband_controls'), {
    button: 0,
    clientX: 100,
  })
  fireEvent.mouseMove(window, { clientX: 200 })
  fireEvent.mouseUp(window, { button: 0, clientX: 200, clientY: 10 })

  fireEvent.click(await screen.findByText('Launch'))
  fireEvent.click(await screen.findByText('Keep me open'))
  expect(screen.getByText('Zoom to region')).toBeTruthy()
})
