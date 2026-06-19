import { DialogQueue } from '@jbrowse/app-core'
import Plugin from '@jbrowse/core/Plugin'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { getParent, getRoot, getSnapshot } from '@jbrowse/mobx-state-tree'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { render, waitFor } from '@testing-library/react'
import { userEvent } from '@testing-library/user-event'

import PluginStoreWidget from './PluginStoreWidget.tsx'

import type { PluginStoreModel } from '../model.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

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
  // installs the resolved, installable definition (name + url) rather than the
  // full store metadata entry
  expect(getSnapshot(session.sessionPlugins)[0]).toEqual({
    name: plugins.plugins[0]!.name,
    url: plugins.plugins[0]!.url,
  })
})

test('removeSessionPlugin removes a plugin that carries a cjsUrl', () => {
  const { session } = setup()
  const plugin = {
    name: 'MsaView',
    url: 'https://example.com/msaview.umd.js',
    cjsUrl: 'https://example.com/msaview.cjs.js',
  }
  session.addSessionPlugin(plugin)
  expect(getSnapshot(session.sessionPlugins)).toHaveLength(1)

  // mirrors what InstalledPlugin passes: pluginManager metadata carries only
  // the resolved url, not the cjsUrl, so removal must match on url alone
  session.removeSessionPlugin({ name: plugin.name, url: plugin.url })
  expect(getSnapshot(session.sessionPlugins)).toHaveLength(0)
})

test('uninstalls a session plugin through the full UI flow', async () => {
  const user = userEvent.setup()
  // a store-style definition carrying both a web (url) and desktop (cjsUrl)
  // build, loaded into the plugin manager so it appears as installed
  const definition = {
    name: 'MsaView',
    url: 'https://example.com/msaview.umd.js',
    cjsUrl: 'https://example.com/msaview.cjs.js',
  }
  class MsaViewPlugin extends Plugin {
    name = 'MsaView'
    version = '1.0.0'
  }
  const session = createTestSession({
    sessionSnapshot: { sessionPlugins: [definition] },
    runtimePlugins: [{ plugin: new MsaViewPlugin(), definition }],
  })
  const model = session.addWidget(
    'PluginStoreWidget',
    'pluginStoreWidget',
  ) as PluginStoreModel
  // the debounced autosave reloads the plugin manager after removal; give it a
  // no-op so it doesn't hit the default "unimplemented" handler post-teardown
  // @ts-expect-error
  getRoot(session).setReloadPluginManagerCallback(() => {})

  const { findByText, findByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DialogQueue session={session} />
      <PluginStoreWidget model={model} />
    </ThemeProvider>,
  )

  // the loaded session plugin shows an uninstall button
  expect(getSnapshot(session.sessionPlugins)).toHaveLength(1)
  await user.click(await findByTestId('removePlugin-MsaView'))
  await user.click(await findByText('Remove'))

  await waitFor(() => {
    expect(getSnapshot(session.sessionPlugins)).toHaveLength(0)
  })
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
}, 20000)

test('plugin store admin - removes a custom plugin correctly', async () => {
  const user = userEvent.setup()
  const definition = {
    name: 'MsaView',
    url: 'https://example.com/msaview.umd.js',
  }
  class MsaViewPlugin extends Plugin {
    name = 'MsaView'
    version = '1.0.0'
  }
  const session = createTestSession({
    adminMode: true,
    jbrowseConfig: { plugins: [definition] },
    runtimePlugins: [{ plugin: new MsaViewPlugin(), definition }],
  })
  const model = session.addWidget(
    'PluginStoreWidget',
    'pluginStoreWidget',
  ) as PluginStoreModel
  // @ts-expect-error
  getRoot(session).setReloadPluginManagerCallback(() => {})

  const { findByText, findByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DialogQueue session={session} />
      <PluginStoreWidget model={model} />
    </ThemeProvider>,
  )
  expect(getSnapshot(session.jbrowse).plugins).toHaveLength(1)
  await user.click(await findByTestId('removePlugin-MsaView'))
  await user.click(await findByText('Remove'))
  await waitFor(() => {
    expect(getSnapshot(session.jbrowse).plugins).toHaveLength(0)
  })
})
