import { DialogQueue } from '@jbrowse/app-core'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getParent, getRoot, getSnapshot } from '@jbrowse/mobx-state-tree'
import { createTestSession } from '@jbrowse/web/src/rootModel'
import { ThemeProvider } from '@mui/material'
import { render, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import PluginStoreWidget from './PluginStoreWidget.tsx'

import type { PluginStoreModel } from '../model.ts'

jest.mock('@jbrowse/web/src/makeWorkerInstance', () => () => {})

const plugins = {
  plugins: [
    {
      name: 'MsaView',
      authors: ['Colin Diesh'],
      description: 'multiple sequence alignment browser plugin for JBrowse 2',
      location: 'https://github.com/GMOD/jbrowse-plugin-msaview',
      url: 'https://unpkg.com/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js',
      license: 'Apache License 2.0',
      image:
        'https://raw.githubusercontent.com/GMOD/jbrowse-plugin-list/main/img/msaview-screenshot-fs8.png',
    },
  ],
}

jest.spyOn(global, 'fetch').mockImplementation(async () => {
  return new Response(JSON.stringify(plugins))
})

function setup(sessionSnapshot?: Record<string, unknown>, adminMode?: boolean) {
  const user = userEvent.setup()
  const session = createTestSession({ sessionSnapshot, adminMode })
  const model = session.addWidget(
    'PluginStoreWidget',
    'pluginStoreWidget',
  ) as PluginStoreModel
  const root = getRoot(session)
  const reloadPluginManagerMock = jest.fn()
  // @ts-expect-error
  root.setReloadPluginManagerCallback(reloadPluginManagerMock)
  return { model, session, user, reloadPluginManagerMock }
}

test('renders with the available plugins', async () => {
  const { model, session } = setup()
  const { container, findByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DialogQueue session={session} />
      <PluginStoreWidget model={model} />
    </ThemeProvider>,
  )
  await findByText('multiple sequence alignment browser plugin for JBrowse 2')
  expect(container).toMatchSnapshot()
})

test('Installs a session plugin', async () => {
  const { user, session, model, reloadPluginManagerMock } = setup()
  const { findByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DialogQueue session={session} />
      <PluginStoreWidget model={model} />
    </ThemeProvider>,
  )
  await user.click(await findByText('Install'))
  await waitFor(() => {
    expect(reloadPluginManagerMock).toHaveBeenCalled()
  })
  expect(getSnapshot(session.sessionPlugins)[0]).toEqual(plugins.plugins[0])
})

test('plugin store admin - adds a custom plugin correctly', async () => {
  const { user, session, model, reloadPluginManagerMock } = setup({}, true)
  const { findByText, findByLabelText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DialogQueue session={session} />
      <PluginStoreWidget model={model} />
    </ThemeProvider>,
  )
  await user.click(await findByText('Add custom plugin'))
  await user.type(await findByLabelText('Plugin URL'), 'msaview.js')
  await user.type(await findByLabelText('Plugin name'), 'MsaView')
  await user.click(await findByText('Submit'))

  await waitFor(() => {
    expect(reloadPluginManagerMock).toHaveBeenCalled()
  })

  expect(getSnapshot(getParent(session)).jbrowse.plugins).toEqual([
    {
      name: 'MsaView',
      umdUrl: 'msaview.js',
    },
  ])
})

test('plugin store admin - removes a custom plugin correctly', async () => {
  const { user, session, model, reloadPluginManagerMock } = setup({}, true)
  session.jbrowse.addPlugin(plugins.plugins[0])
  const { findByText, findByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DialogQueue session={session} />
      <PluginStoreWidget model={model} />
    </ThemeProvider>,
  )
  await user.click(await findByTestId('removePlugin-CanvasPlugin'))
  await user.click(await findByText('Confirm'))
  await waitFor(() => {
    expect(reloadPluginManagerMock).toHaveBeenCalled()
  })
})
