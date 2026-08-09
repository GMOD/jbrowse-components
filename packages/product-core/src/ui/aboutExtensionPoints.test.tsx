import PluginManager from '@jbrowse/core/PluginManager'
import {
  ConfigurationSchema,
  FormatAboutConfigSchemaFactory,
} from '@jbrowse/core/configuration'
import { types } from '@jbrowse/mobx-state-tree'

import { getAboutDialogConfig } from './util.ts'

import type { AboutPanelProps } from './util.ts'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// The three About points have no consumer in this repo — a track that wants to
// change its own About dialog uses the `formatAbout` config slot instead, so
// these exist for tracks a plugin does not own. That leaves their contracts
// asserted nowhere, which is what this file is for.
//
// The extension points guide generates its examples from the three registration
// functions below, so each is written the way a plugin would write it: at module
// scope, which also keeps oxfmt's formatting and the guide fence's identical.

const config = { trackId: 'volvox_sv_test', name: 'Volvox SVs' }
const otherConfig = { trackId: 'something_else', name: 'Other' }

// getAboutDialogConfig reads the session's own formatAbout before handing the
// merged config to the extension point, so the session has to be a real node
const corePluginManager = new PluginManager([]).createPluggableElements()
corePluginManager.configure()
const SessionModel = types.model('Session', {
  configuration: ConfigurationSchema('Root', {
    formatAbout: FormatAboutConfigSchemaFactory(),
  }),
})
const session = SessionModel.create(
  {},
  { pluginManager: corePluginManager },
) as unknown as AbstractSessionModel

function propsFor(c: Record<string, unknown>): AboutPanelProps {
  return { session, config: c }
}

function DefaultAboutComponent() {
  return null
}
function NewAboutComponent() {
  return null
}
function ExtraAboutPanel() {
  return null
}
function OtherPanel() {
  return null
}

// #region extraAboutPanel
function addExtraAboutPanel(pluginManager: PluginManager) {
  pluginManager.contributeToExtensionPoint(
    'Core-extraAboutPanel',
    ({ config }) =>
      config.trackId === 'volvox_sv_test' ? ExtraAboutPanel : undefined,
  )
}
// #endregion

// #region replaceAbout
function addReplaceAbout(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint(
    'Core-replaceAbout',
    (Default, { config }) =>
      config.trackId === 'volvox_sv_test' ? NewAboutComponent : Default,
  )
}
// #endregion

// #region customizeAbout
function addCustomizeAbout(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint('Core-customizeAbout', (arg, { config }) =>
    config.trackId === 'volvox_sv_test'
      ? { config: { ...arg.config, 'Custom field': 'Custom value' } }
      : arg,
  )
}
// #endregion

test('extraAboutPanel keeps every plugin panel, in registration order', () => {
  const pluginManager = new PluginManager([])
  addExtraAboutPanel(pluginManager)
  pluginManager.contributeToExtensionPoint(
    'Core-extraAboutPanel',
    () => OtherPanel,
  )

  expect(
    pluginManager.evaluateExtensionPoint(
      'Core-extraAboutPanel',
      [],
      propsFor(config),
    ),
  ).toEqual([ExtraAboutPanel, OtherPanel])
  // the scoped one drops out, the unscoped one still contributes
  expect(
    pluginManager.evaluateExtensionPoint(
      'Core-extraAboutPanel',
      [],
      propsFor(otherConfig),
    ),
  ).toEqual([OtherPanel])
})

test('replaceAbout swaps the dialog body for the track it names', () => {
  const pluginManager = new PluginManager([])
  addReplaceAbout(pluginManager)

  expect(
    pluginManager.evaluateComponentExtensionPoint(
      'Core-replaceAbout',
      DefaultAboutComponent,
      propsFor(config),
    ),
  ).toBe(NewAboutComponent)
  expect(
    pluginManager.evaluateComponentExtensionPoint(
      'Core-replaceAbout',
      DefaultAboutComponent,
      propsFor(otherConfig),
    ),
  ).toBe(DefaultAboutComponent)
})

test('customizeAbout adds a field to the config the dialog shows', () => {
  const pluginManager = new PluginManager([]).createPluggableElements()
  pluginManager.configure()
  addCustomizeAbout(pluginManager)

  expect(
    getAboutDialogConfig({ config, session, pluginManager }).config,
  ).toMatchObject({ 'Custom field': 'Custom value' })
  expect(
    getAboutDialogConfig({ config: otherConfig, session, pluginManager })
      .config,
  ).not.toHaveProperty('Custom field')
})
