import { ConfigurationSchema } from '@jbrowse/core/configuration'
import { BaseDisplay } from '@jbrowse/core/pluggableElementTypes'
import MultiRegionDisplayMixin from '@jbrowse/display-kit/MultiRegionDisplayMixin'
import StoredHoverMixin from '@jbrowse/display-kit/StoredHoverMixin'
import TrackHeightMixin from '@jbrowse/display-kit/TrackHeightMixin'
import baseLinearDisplayConfigSchema from '@jbrowse/display-kit/configSchema'
import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import { getMembers, types } from '@jbrowse/mobx-state-tree'

import { stateModelFactory as linearGenomeViewStateModelFactory } from '../LinearGenomeView/index.ts'

import type { ChromeModel } from '@jbrowse/display-kit/DisplayChrome'
import type { Instance } from '@jbrowse/mobx-state-tree'
import type { RenderLifecycleModel } from '@jbrowse/render-core/useRenderingBackend'

// The members external displays read off the foundation they compose, measured
// from their source: jbrowse-plugin-arg (`LinearArgDisplay`, which composes
// all four) and jbrowse-plugin-graphgenomeviewer (`LinearGraphDisplay`, which
// composes BaseDisplay and TrackHeightMixin). A prebuilt plugin reads these by
// name off the host's copy, so renaming one breaks it with no error: the read
// is `undefined`, the call throws. Renaming one here is the ABI change
// PLUGIN_ABI_STABILITY.md describes, and needs its entry there.
const EXTERNAL_READS = [
  'canvasWidthPx',
  'height',
  'hoveredFeature',
  'host',
  'isMinimized',
  'painted',
  'regionPayloads',
  'renderBlocks',
  'renderError',
  'setError',
  'setHeight',
  'setHoveredFeature',
] as const

function Foundation() {
  return types.compose(
    'ExternalFoundation',
    BaseDisplay,
    TrackHeightMixin(),
    MultiRegionDisplayMixin(),
    StoredHoverMixin(),
  )
}

type ExternalReads = Pick<
  Instance<ReturnType<typeof Foundation>>,
  (typeof EXTERNAL_READS)[number]
>

// The other direction: DisplayChrome, served by the host, reads these off a
// plugin's model. A key added here reads `undefined` on every plugin built
// before it, so a new chrome input goes in optional.
const CHROME_REQUIRED = [
  'configuration',
  'displayPhase',
  'error',
  'forceLoad',
  'height',
  'painted',
  'regionTooLargeReason',
  'reload',
  'renderError',
  'renderNow',
  'setOffScreen',
  'setRenderError',
  'startRenderingBackend',
  'stopRenderingBackend',
  'zoomCanReleaseGate',
] as const

type RequiredKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? never : K
}[keyof T]
type SameKeys<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false

const chromeRequiredIsPinned: SameKeys<
  RequiredKeys<ChromeModel & RenderLifecycleModel<unknown>>,
  (typeof CHROME_REQUIRED)[number]
> = true

test('the foundation still has every member an external display reads', () => {
  const { createDisplay } = createDisplayTestEnvironment<ExternalReads>({
    trackType: 'ExternalTrack',
    displayName: 'ExternalFoundation',
    viewModel: linearGenomeViewStateModelFactory,
    configSchema: () =>
      ConfigurationSchema(
        'ExternalFoundation',
        {},
        {
          baseConfiguration: baseLinearDisplayConfigSchema,
          explicitlyTyped: true,
        },
      ),
    stateModel: (_pluginManager, configSchema) =>
      Foundation().props({
        type: types.literal('ExternalFoundation'),
        configuration: configSchema,
      }),
  })
  const { display } = createDisplay()
  const { properties, views, actions, volatile, flowActions } =
    getMembers(display)
  const members = new Set([
    ...Object.keys(properties),
    ...views,
    ...actions,
    ...volatile,
    ...flowActions,
  ])
  expect(EXTERNAL_READS.filter(name => !members.has(name))).toEqual([])
  expect(chromeRequiredIsPinned).toBe(true)
})
