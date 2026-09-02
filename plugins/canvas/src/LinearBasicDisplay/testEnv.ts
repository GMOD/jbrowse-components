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

// The shared display harness wired for `LinearBasicDisplay`. `createDisplay`
// takes extra display-snapshot props so tests can seed persistent state (e.g.
// pinned or hidden features) that a display would otherwise have to be clicked
// into.
export function createTestEnvironment({
  adapterFetchSizeLimit,
  densityAdapter,
}: {
  adapterFetchSizeLimit?: number
  // The sidecar the density tier draws from. Only its presence is read here —
  // nothing resolves it — so any object stands in for one.
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
    // Config-only: the RPC is mocked, so this display only ever reads the
    // adapter's config. Throwing on resolve is what says so.
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
      // `unmeasuredView` leaves the view without a width, i.e. before
      // `view.initialized` — the window where every view-derived getter throws
      // by design. `unplacedView` is measured but carries its regions in the
      // SNAPSHOT, the way a restored session does, which is the only way to a
      // view with no coarse blocks now that every placement settles them. Only
      // a test driving one of those windows wants either.
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

// The feature menu is a tree — the highlight scopes, the show/hide family and
// the copy entries each earn a submenu — but a test names the ROW it wants, not
// the path to it. So flatten before matching, and let a row that moves into or
// out of a submenu stay one test.
function flattenMenuItems(items: MenuItem[]): MenuItem[] {
  return items.flatMap(m =>
    'subMenu' in m ? flattenMenuItems(resolveSubMenu(m)) : [m],
  )
}

// Every label the open context menu offers, submenus included.
export function contextMenuLabels(display: TestDisplay) {
  return flattenMenuItems(display.contextMenuItems()).map(m =>
    'label' in m ? m.label : '',
  )
}

// The context-menu row with this label, submenus included — for a test
// asserting on something other than the label (an icon, a disabled gate).
// Throws rather than answering undefined, so a renamed or dropped row fails
// where the test names it instead of one assertion later.
//
// Left as the whole `MenuItem` union rather than narrowed: `toMatchObject`
// reads through it, and the narrowing would be a second list of which union
// members have which optional field.
function contextMenuItem(display: TestDisplay, label: string) {
  const item = flattenMenuItems(display.contextMenuItems()).find(
    m => 'label' in m && m.label === label,
  )
  if (!item) {
    throw new Error(`no menu item labeled "${label}"`)
  }
  return item
}

// Click the context-menu row with this label.
export function clickContextMenuItem(display: TestDisplay, label: string) {
  const item = contextMenuItem(display, label)
  if (!('onClick' in item)) {
    throw new Error(`menu item "${label}" is not clickable`)
  }
  item.onClick()
}

// Right-click on `item`, resolving `subfeature` when the click landed on one —
// what FeatureComponent's handleContextMenu does, minus the hit test. The click
// position is fixed since only the Menu component reads it.
export function rightClick(
  display: TestDisplay,
  item: FlatbushItem,
  subfeature?: SubfeatureInfo,
  // what the hit resolved beyond the feature itself: only a click on a base at
  // base zoom carries these
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
