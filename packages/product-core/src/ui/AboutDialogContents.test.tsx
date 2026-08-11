import PluginManager from '@jbrowse/core/PluginManager'
import {
  ConfigurationSchema,
  FormatAboutConfigSchemaFactory,
} from '@jbrowse/core/configuration'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { render } from '@testing-library/react'

import AboutDialogContents from './AboutDialogContents.tsx'

import type { AboutConfig } from './util.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'

const corePluginManager = new PluginManager([]).createPluggableElements()
corePluginManager.configure()

const SessionModel = types
  .model('Session', {
    configuration: ConfigurationSchema('Root', {
      formatAbout: FormatAboutConfigSchemaFactory(),
    }),
  })
  .volatile(() => ({
    rpcManager: { call: async () => '@SQ\tSN:ctgA' },
  }))

function makeSession(hideUris = false) {
  return SessionModel.create(
    { configuration: { formatAbout: { hideUris } } },
    { pluginManager: corePluginManager },
  ) as unknown as AbstractSessionModel
}

function renderContents(config: AboutConfig, hideUris = false) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <AboutDialogContents config={config} session={makeSession(hideUris)} />
    </ThemeProvider>,
  )
}

const config = {
  trackId: 't1',
  name: 'Track 1',
  adapter: {
    type: 'BamAdapter',
    bamLocation: { localPath: '/srv/secretdir/x.bam' },
  },
  metadata: { refNames: 'a metadata column that happens to share a name' },
}

test('shows the config, the file info panel and the copy button by default', async () => {
  const { findByText, getByText } = renderContents(config)
  expect(getByText('Copy config')).toBeTruthy()
  expect(await findByText(/SN:ctgA/)).toBeTruthy()
  expect(getByText('/srv/secretdir/x.bam')).toBeTruthy()
})

test('hideUris hides local paths, Copy config and the file header', () => {
  const { queryByText, getByText } = renderContents(config, true)
  expect(queryByText(/secretdir/)).toBeNull()
  expect(queryByText('Copy config')).toBeNull()
  // a file header carries `@SQ UR:` and `@PG CL:` paths of its own
  expect(queryByText('File info')).toBeNull()
  // exposes no locations, so it stays
  expect(getByText('Show ref names')).toBeTruthy()
})

// regression: the metadata card reused the *config* card's omit list, so a
// metadata key named after one of those config fields vanished
test('renders a metadata field named after an omitted config field', () => {
  const { getByText } = renderContents(config)
  expect(getByText(/a metadata column/)).toBeTruthy()
})
