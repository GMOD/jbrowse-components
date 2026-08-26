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

// The keep toggle is the whole permanent-plugin surface for installs: a plugin
// lands in the session first, and the pin beside it says how long it lasts. It
// moves rather than copies, because two lists naming one plugin is a duplicate
// PluginManager refuses by name.
test('the keep toggle moves a plugin between the session and the permanent list', async () => {
  const user = userEvent.setup()
  localStorage.clear()
  const definition = {
    name: 'MsaView',
    url: 'https://example.com/msaview.umd.js',
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
  // @ts-expect-error
  getRoot(session).setReloadPluginManagerCallback(() => {})

  const { findByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DialogQueue session={session} />
      <PluginStoreWidget model={model} />
    </ThemeProvider>,
  )

  await user.click(await findByTestId('keepPlugin-MsaView'))
  await waitFor(() => {
    expect(session.permanentPlugins).toEqual([definition])
  })
  expect(getSnapshot(session.sessionPlugins)).toHaveLength(0)

  await user.click(await findByTestId('keepPlugin-MsaView'))
  await waitFor(() => {
    expect(session.permanentPlugins).toEqual([])
  })
  expect(getSnapshot(session.sessionPlugins)).toEqual([definition])
  localStorage.clear()
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

test('offers an update when the store name differs from the plugin class name', async () => {
  const user = userEvent.setup()
  // installed at v1; the runtime plugin registers under its Plugin *class* name
  // ("FooRuntimePlugin"), which is not the store name ("Foo", the UMD global).
  // The store entry must still be matched — by packageName in the pinned url —
  // so the update is offered despite the name divergence.
  const definition = {
    name: 'Foo',
    url: 'https://jbrowse.org/plugins/jbrowse-plugin-foo/1.0.0/dist/jbrowse-plugin-foo.umd.production.min.js',
  }
  class FooRuntimePlugin extends Plugin {
    name = 'FooRuntimePlugin'
    version = '1.0.0'
  }
  const store = {
    plugins: [
      {
        name: 'Foo',
        packageName: 'jbrowse-plugin-foo',
        authors: [],
        description: 'foo',
        location: 'https://example.com',
        license: 'MIT',
        url: 'https://jbrowse.org/plugins/jbrowse-plugin-foo/2.0.0/dist/jbrowse-plugin-foo.umd.production.min.js',
        integrity: 'sha384-new',
        versions: [
          {
            pluginVersion: '2.0.0',
            jbrowseRange: '*',
            url: 'https://jbrowse.org/plugins/jbrowse-plugin-foo/2.0.0/dist/jbrowse-plugin-foo.umd.production.min.js',
            integrity: 'sha384-new',
          },
        ],
      },
    ],
  }
  jest
    .spyOn(global, 'fetch')
    .mockImplementation(async () => new Response(JSON.stringify(store)))

  const session = createTestSession({
    adminMode: true,
    jbrowseConfig: { plugins: [definition] },
    runtimePlugins: [{ plugin: new FooRuntimePlugin(), definition }],
  })
  const model = session.addWidget(
    'PluginStoreWidget',
    'pluginStoreWidget',
  ) as PluginStoreModel
  // @ts-expect-error
  getRoot(session).setReloadPluginManagerCallback(() => {})

  const { findByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DialogQueue session={session} />
      <PluginStoreWidget model={model} />
    </ThemeProvider>,
  )
  // the update button keys off the runtime class name; it only renders when the
  // store entry was matched despite the store-name/class-name divergence
  await user.click(await findByTestId('updatePlugin-FooRuntimePlugin'))
  // the installed definition is swapped to the newer pinned url, and keeps the
  // store's UMD-global name ("Foo") — not the runtime class name — so it loads
  expect(getSnapshot(getParent(session)).jbrowse.plugins).toEqual([
    {
      name: 'Foo',
      url: 'https://jbrowse.org/plugins/jbrowse-plugin-foo/2.0.0/dist/jbrowse-plugin-foo.umd.production.min.js',
      integrity: 'sha384-new',
    },
  ])
})

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
  expect(session.jbrowse.plugins).toHaveLength(1)
  await user.click(await findByTestId('removePlugin-MsaView'))
  await user.click(await findByText('Remove'))
  await waitFor(() => {
    expect(session.jbrowse.plugins).toHaveLength(0)
  })
})

// Tags come from the store manifest as free-form strings, so the widget has to
// discover the vocabulary from whatever it fetched rather than know it up front.
function taggedStore() {
  const entry = (name: string, tags: string[]) => ({
    name,
    packageName: `jbrowse-plugin-${name.toLowerCase()}`,
    authors: [],
    description: `${name} description`,
    location: 'https://example.com',
    license: 'MIT',
    url: `https://jbrowse.org/plugins/jbrowse-plugin-${name.toLowerCase()}/1.0.0/dist/x.umd.js`,
    tags,
  })
  return {
    plugins: [
      entry('MsaView', ['plug-and-play', 'alignment']),
      entry('TView', ['bring-your-own-data', 'alignment']),
      entry('Apollo', ['needs-setup', 'annotation']),
    ],
  }
}

test('filters the available plugin list by tag, ANDing multiple tags', async () => {
  jest
    .spyOn(global, 'fetch')
    .mockImplementation(async () => new Response(JSON.stringify(taggedStore())))
  const { model, session, user } = setup()
  const { findByText, findByTestId, queryByText } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DialogQueue session={session} />
      <PluginStoreWidget model={model} />
    </ThemeProvider>,
  )
  // everything is listed before any tag is picked
  await findByText('MsaView description')
  expect(queryByText('TView description')).not.toBeNull()
  expect(queryByText('Apollo description')).not.toBeNull()

  // one tag narrows to the plugins carrying it
  await user.click(await findByTestId('tagFilter-alignment'))
  await waitFor(() => {
    expect(queryByText('Apollo description')).toBeNull()
  })
  expect(queryByText('MsaView description')).not.toBeNull()
  expect(queryByText('TView description')).not.toBeNull()

  // a second tag narrows further rather than widening — AND, not OR
  await user.click(await findByTestId('tagFilter-plug-and-play'))
  await waitFor(() => {
    expect(queryByText('TView description')).toBeNull()
  })
  expect(queryByText('MsaView description')).not.toBeNull()
  expect(model.tagFilters.slice()).toEqual(['alignment', 'plug-and-play'])

  // clicking a selected tag again deselects it
  await user.click(await findByTestId('tagFilter-plug-and-play'))
  await waitFor(() => {
    expect(queryByText('TView description')).not.toBeNull()
  })

  // and Clear tags drops the rest
  await user.click(await findByText('Clear tags'))
  await waitFor(() => {
    expect(queryByText('Apollo description')).not.toBeNull()
  })
  expect(model.tagFilters.slice()).toEqual([])
})

test('a tag combination matching nothing says so instead of rendering blank', async () => {
  jest
    .spyOn(global, 'fetch')
    .mockImplementation(async () => new Response(JSON.stringify(taggedStore())))
  const { model, session, user } = setup()
  const { findByText, findByTestId } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DialogQueue session={session} />
      <PluginStoreWidget model={model} />
    </ThemeProvider>,
  )
  await findByText('MsaView description')
  await user.click(await findByTestId('tagFilter-alignment'))
  // no plugin is both alignment and annotation; the selected chips must stay
  // clickable so the user can undo it
  await user.click(await findByTestId('tagFilter-annotation'))
  await findByText('No plugins match these filters.')
  expect(model.tagFilters.slice()).toEqual(['alignment', 'annotation'])
  await user.click(await findByTestId('tagFilter-annotation'))
  await findByText('MsaView description')
})
