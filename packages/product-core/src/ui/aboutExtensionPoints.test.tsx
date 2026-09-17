import BaseCard from '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail/BaseCard'
import PluginManager from '@jbrowse/core/PluginManager'
import {
  PluggableComponent,
  matchesTrackSelector,
  wrapComponent,
} from '@jbrowse/core/ui'
import PluggableComponents from '@jbrowse/core/ui/PluggableComponents'
import { render } from '@testing-library/react'

import { makeTrackConf } from './aboutTestUtils.ts'

import type { AboutPanelProps } from './util.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'

// The two About points have no consumer in this repo — a track that wants to
// change its own About dialog uses the `formatAbout` config slot instead, so
// these exist for tracks a plugin does not own. That leaves their contracts
// asserted nowhere, which is what this file is for.
//
// The extension points guide generates its examples from the two registration
// functions below, so each is written the way a plugin would write it: at module
// scope, which also keeps oxfmt's formatting and the guide fence's identical.

const config = makeTrackConf({ trackId: 'volvox_sv_test', name: 'Volvox SVs' })
const otherConfig = makeTrackConf({ trackId: 'something_else', name: 'Other' })
// the copy the "Copy track" menu item makes carries a suffixed trackId
const copiedConfig = makeTrackConf({
  trackId: 'volvox_sv_test-1712000000000',
  name: 'Volvox SVs',
})

const session = {} as AbstractSessionModel

function propsFor(c: AnyConfigurationModel): AboutPanelProps {
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

function renderPanels(pluginManager: PluginManager, c: AnyConfigurationModel) {
  return render(
    <PluggableComponents
      pluginManager={pluginManager}
      name="Core-extraAboutPanel"
      props={propsFor(c)}
    />,
  ).container.textContent
}

function renderAbout(pluginManager: PluginManager, c: AnyConfigurationModel) {
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

// a selector matching only the id as written is what silently stops applying
// once someone copies the track
test('a panel scoped by trackId still shows on the users copy of that track', () => {
  const pluginManager = new PluginManager([])
  addExtraAboutPanel(pluginManager)

  expect(renderPanels(pluginManager, copiedConfig)).toBe('Extra…')
})

test('replaceAbout swaps the dialog body for the track it names', () => {
  const pluginManager = new PluginManager([])
  addReplaceAbout(pluginManager)

  expect(renderAbout(pluginManager, config)).toBe('my about dialog')
  expect(renderAbout(pluginManager, otherConfig)).toBe('default')
})
