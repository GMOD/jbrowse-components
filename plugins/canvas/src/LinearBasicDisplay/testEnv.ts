import { densityAdapterConfigSchemaFields } from '@jbrowse/core/data_adapters/BaseAdapter'
import { resolveSubMenu } from '@jbrowse/core/ui/menuItems'
import { createDisplayTestEnvironment } from '@jbrowse/display-test-utils'
import { linearGenomeViewStateModelFactory } from '@jbrowse/plugin-linear-genome-view'

import configSchemaFactory from './configSchema.ts'
import stateModelFactory from './model.ts'

import type {
  FlatbushItem,
  SubfeatureInfo,
} from '../RenderFeatureDataRPC/rpcTypes.ts'
import type { LinearBasicDisplayModel } from './model.ts'
import type { MenuItem } from '@jbrowse/core/ui'

export function createTestEnvironment({
  adapterFetchSizeLimit,
  densityAdapter,
}: {
  adapterFetchSizeLimit?: number
  densityAdapter?: Record<string, unknown>
} = {}) {
  const adapterConfig =
    adapterFetchSizeLimit === undefined && densityAdapter === undefined
      ? undefined
      : {
          type: 'TestAdapter',
          ...(adapterFetchSizeLimit === undefined
            ? {}
            : { fetchSizeLimit: adapterFetchSizeLimit }),
          ...(densityAdapter === undefined ? {} : { densityAdapter }),
        }
  const env = createDisplayTestEnvironment<LinearBasicDisplayModel>({
    trackType: 'FeatureTrack',
    // The RPC is mocked, so the display only ever reads the adapter's config;
    // throwing on resolve says so.
    adapter: {
      name: 'TestAdapter',
      configOnly: true,
      slots: {
        fetchSizeLimit: { type: 'number', defaultValue: 5_000_000 },
        ...densityAdapterConfigSchemaFields,
      },
      config: adapterConfig,
    },
    displayName: 'LinearBasicDisplay',
    configSchema: pm => configSchemaFactory(pm),
    stateModel: (_pm, schema) => stateModelFactory(schema),
    viewModel: linearGenomeViewStateModelFactory,
    viewRegionEnd: 10_000,
  })

  return {
    ...env,
    createDisplay: (
      displaySnapshot?: Record<string, unknown>,
      // `unmeasuredView` leaves the view before `view.initialized`, where
      // every view-derived getter throws; `unplacedView` carries its regions
      // in the snapshot like a restored session, the only way to a view with
      // no coarse blocks.
      createOpts?: { unmeasuredView?: boolean; unplacedView?: boolean },
    ) =>
      env.createDisplay({
        displaySnapshot,
        skipWidth: createOpts?.unmeasuredView,
        regionsInSnapshot: createOpts?.unplacedView,
      }),
  }
}

export type TestDisplay = ReturnType<
  ReturnType<typeof createTestEnvironment>['createDisplay']
>['display']

// Flattened so a test names the row it wants, and a row moving into or out of
// a submenu stays one test.
function flattenMenuItems(items: MenuItem[]): MenuItem[] {
  return items.flatMap(m =>
    'subMenu' in m ? flattenMenuItems(resolveSubMenu(m)) : [m],
  )
}

export function contextMenuLabels(display: TestDisplay) {
  return flattenMenuItems(display.contextMenuItems()).map(m =>
    'label' in m ? m.label : '',
  )
}

// Throws rather than answering undefined, so a renamed row fails where the
// test names it.
function contextMenuItem(display: TestDisplay, label: string) {
  const item = flattenMenuItems(display.contextMenuItems()).find(
    m => 'label' in m && m.label === label,
  )
  if (!item) {
    throw new Error(`no menu item labeled "${label}"`)
  }
  return item
}

export function clickContextMenuItem(display: TestDisplay, label: string) {
  const item = contextMenuItem(display, label)
  if (!('onClick' in item)) {
    throw new Error(`menu item "${label}" is not clickable`)
  }
  item.onClick()
}

export function rightClick(
  display: TestDisplay,
  item: FlatbushItem,
  subfeature?: SubfeatureInfo,
  resolved?: { hgvsLabel?: string; tooltipText?: string },
) {
  display.openContextMenu({
    item,
    subfeature,
    ...resolved,
    displayedRegionIndex: 0,
    clientX: 0,
    clientY: 0,
  })
}
