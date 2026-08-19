import PluginManager from '@jbrowse/core/PluginManager'
import { ConfigurationSchema } from '@jbrowse/core/configuration'
import DisplayType from '@jbrowse/core/pluggableElementTypes/DisplayType'
import { createJBrowseTheme } from '@jbrowse/core/ui'
import { types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import DisplayDefaultsSection from './DisplayDefaultsSection.tsx'

import type { DisplayDefaultsSession } from './DisplayDefaultsSection.tsx'

const configSchema = ConfigurationSchema('TestDisplay', {
  showSoftClipping: { type: 'maybeBoolean', promotedBase: false },
})

// A plugin manager holding one registered display type, so the section has a
// real `displayName` and a real `promotedBase` to read.
function makePluginManager() {
  const pluginManager = new PluginManager([])
  pluginManager.addDisplayType(
    () =>
      new DisplayType({
        name: 'TestDisplay',
        displayName: 'Test track',
        configSchema,
        stateModel: types.model('TestDisplay', {}),
        trackType: 'TestTrack',
        viewType: 'TestView',
        ReactComponent: () => null,
      }),
  )
  return pluginManager.createPluggableElements().configure()
}

function stubSession(
  defaults: { displayType: string; slot: string; value: unknown }[],
  setDisplayTypeDefault = jest.fn(),
): DisplayDefaultsSession {
  return {
    getDisplayTypeDefaults: () => defaults,
    setDisplayTypeDefault,
  }
}

function renderSection(session: DisplayDefaultsSession) {
  return render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <DisplayDefaultsSection
        session={session}
        pluginManager={makePluginManager()}
      />
    </ThemeProvider>,
  )
}

// The empty state is the one place the app tells someone who has never used the
// pin that it exists, so it is a rendered row rather than nothing.
test('says what a pin does when nothing is pinned', () => {
  const { getByText } = renderSection(stubSession([]))
  expect(getByText(/None set/)).toBeTruthy()
})

test('names the display type and states what the pin overrides', () => {
  const { getByText } = renderSection(
    stubSession([
      { displayType: 'TestDisplay', slot: 'showSoftClipping', value: true },
    ]),
  )
  // the display type's authored name, and the slot's own — a slot has no menu
  // label to borrow
  expect(getByText('Test track › showSoftClipping')).toBeTruthy()
  // the Default column is the slot's promotedBase, read off the schema: what
  // clearing this pin puts every following track back to
  expect(getByText('false')).toBeTruthy()
  expect(getByText('true')).toBeTruthy()
})

test('clearing a row clears exactly that display type and slot', () => {
  const setDisplayTypeDefault = jest.fn()
  const { getByRole } = renderSection(
    stubSession(
      [{ displayType: 'TestDisplay', slot: 'showSoftClipping', value: true }],
      setDisplayTypeDefault,
    ),
  )
  fireEvent.click(getByRole('button', { name: 'Reset this preference' }))
  expect(setDisplayTypeDefault).toHaveBeenCalledWith(
    'TestDisplay',
    'showSoftClipping',
    undefined,
  )
})

// A default left behind by a plugin that is no longer installed resolves
// nowhere and draws no pin, so this section is the only thing that can show it.
test('still lists a default whose display type is gone', () => {
  const { getByText } = renderSection(
    stubSession([
      { displayType: 'RetiredDisplay', slot: 'showLegend', value: false },
    ]),
  )
  expect(getByText('RetiredDisplay › showLegend')).toBeTruthy()
  expect(getByText('(default)')).toBeTruthy()
})
