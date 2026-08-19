import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  ConfigurationSchema,
  FormatAboutConfigSchemaFactory,
} from '@jbrowse/core/configuration'
import {
  PluggableComponent,
  matchesTrackSelector,
  wrapComponent,
} from '@jbrowse/core/ui'
import PluggableComponents from '@jbrowse/core/ui/PluggableComponents'
import { types } from '@jbrowse/mobx-state-tree'
import { render } from '@testing-library/react'

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
  return <div>default</div>
}
function OtherPanel() {
  return <div>other</div>
}

// #region extraAboutPanel
function ExtraAboutPanel(props: AboutPanelProps) {
  return matchesTrackSelector({ trackId: 'volvox_sv_test' }, props) ? (
    <BaseCard title="Extra">…</BaseCard>
  ) : null
}

function addExtraAboutPanel(pluginManager: PluginManager) {
  pluginManager.contributeToExtensionPoint(
    'Core-extraAboutPanel',
    () => ExtraAboutPanel,
  )
}
// #endregion

// #region replaceAbout
function addReplaceAbout(pluginManager: PluginManager) {
  wrapComponent(
    pluginManager,
    'Core-replaceAbout',
    ({ DefaultComponent, ...rest }) =>
      matchesTrackSelector({ trackId: 'volvox_sv_test' }, rest) ? (
        <div>my about dialog</div>
      ) : (
        <DefaultComponent {...rest} />
      ),
  )
}
// #endregion

// #region customizeAbout
function addCustomizeAbout(pluginManager: PluginManager) {
  pluginManager.addToExtensionPoint('Core-customizeAbout', (arg, { config }) =>
    // every track-scoped point scopes itself with the same predicate
    matchesTrackSelector({ trackId: 'volvox_sv_test' }, { config })
      ? { config: { ...arg.config, 'Custom field': 'Custom value' } }
      : arg,
  )
}
// #endregion

function renderPanels(
  pluginManager: PluginManager,
  c: Record<string, unknown>,
) {
  return render(
    <PluggableComponents
      pluginManager={pluginManager}
      name="Core-extraAboutPanel"
      props={propsFor(c)}
    />,
  ).container.textContent
}

function renderAbout(pluginManager: PluginManager, c: Record<string, unknown>) {
  return render(
    <PluggableComponent
      pluginManager={pluginManager}
      name="Core-replaceAbout"
      component={DefaultAboutComponent}
      props={propsFor(c)}
    />,
  ).container.textContent
}

test('extraAboutPanel keeps every plugin panel, in registration order', () => {
  const pluginManager = new PluginManager([])
  addExtraAboutPanel(pluginManager)
  pluginManager.contributeToExtensionPoint(
    'Core-extraAboutPanel',
    () => OtherPanel,
  )

  expect(renderPanels(pluginManager, config)).toBe('Extra…other')
  // the scoped one renders nothing, the unscoped one still shows
  expect(renderPanels(pluginManager, otherConfig)).toBe('other')
})

// the copy the "Copy track" menu item makes carries a suffixed trackId, and a
// selector matching only the id as written is what silently stops applying
test('a panel scoped by trackId still shows on the users copy of that track', () => {
  const pluginManager = new PluginManager([])
  addExtraAboutPanel(pluginManager)

  expect(
    renderPanels(pluginManager, {
      ...config,
      trackId: 'volvox_sv_test-1712000000000',
    }),
  ).toBe('Extra…')
})

test('replaceAbout swaps the dialog body for the track it names', () => {
  const pluginManager = new PluginManager([])
  addReplaceAbout(pluginManager)

  expect(renderAbout(pluginManager, config)).toBe('my about dialog')
  expect(renderAbout(pluginManager, otherConfig)).toBe('default')
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

// the same copy-track normalization the rendering points get; this is the one
// place a hand-written `config.trackId === 'x'` survived the sweep
test('customizeAbout applies to the users copy of the track it names', () => {
  const pluginManager = new PluginManager([]).createPluggableElements()
  pluginManager.configure()
  addCustomizeAbout(pluginManager)

  expect(
    getAboutDialogConfig({
      config: { ...config, trackId: 'volvox_sv_test-1712000000000' },
      session,
      pluginManager,
    }).config,
  ).toMatchObject({ 'Custom field': 'Custom value' })
})
