// eslint-disable-next-line no-restricted-imports
import * as React from 'react'

import * as mst from '@jbrowse/mobx-state-tree'
import * as mobx from 'mobx'
import * as ReactJSXRuntime from 'react/jsx-runtime'

import Plugin from '../Plugin.ts'
import * as Configuration from '../configuration/index.ts'
import * as BaseAdapterExports from '../data_adapters/BaseAdapter/index.ts'
import * as dataAdapterCache from '../data_adapters/dataAdapterCache.ts'
import AdapterType from '../pluggableElementTypes/AdapterType.ts'
import DisplayType from '../pluggableElementTypes/DisplayType.ts'
import TrackType from '../pluggableElementTypes/TrackType.ts'
import ViewType from '../pluggableElementTypes/ViewType.ts'
import WidgetType from '../pluggableElementTypes/WidgetType.ts'
import * as pluggableElementTypes from '../pluggableElementTypes/index.ts'
import * as pluggableElementTypeModels from '../pluggableElementTypes/models/index.ts'
import * as corePalette from '../ui/palette.ts'
import * as coreTheme from '../ui/theme.ts'
import Base1DView from '../util/Base1DViewModel.ts'
import * as coreColor from '../util/color/index.ts'
import * as coreIo from '../util/io/index.ts'
import * as coreLayouts from '../util/layouts/index.ts'
import * as coreMstReflection from '../util/mst-reflection.ts'
import * as rxjs from '../util/rxjs.ts'
import * as mstTypes from '../util/types/mst.ts'
import * as trackUtils from './publicTracks.ts'
import * as coreUtil from './publicUtil.ts'

// The part of the runtime plugin ABI that is not UI: what a plugin evaluated in
// the RPC worker can actually use. modules.ts adds the UI on top of it for the
// main thread; workerModules.ts fills the same keys with a stub instead.
export const sharedModules = {
  mobx,
  '@jbrowse/mobx-state-tree': mst,
  'mobx-state-tree': mst,
  react: React,
  'react/jsx-runtime': ReactJSXRuntime,
  '@jbrowse/core/Plugin': Plugin,
  '@jbrowse/core/configuration': Configuration,
  '@jbrowse/core/util/types/mst': mstTypes,
  '@jbrowse/core/ui/theme': coreTheme,
  '@jbrowse/core/ui/palette': corePalette,
  '@jbrowse/core/util': coreUtil,
  '@jbrowse/core/util/color': coreColor,
  '@jbrowse/core/util/layouts': coreLayouts,
  '@jbrowse/core/util/tracks': trackUtils,
  '@jbrowse/core/util/Base1DViewModel': Base1DView,
  '@jbrowse/core/util/io': coreIo,
  '@jbrowse/core/util/mst-reflection': coreMstReflection,
  '@jbrowse/core/util/rxjs': rxjs,
  '@jbrowse/core/pluggableElementTypes': pluggableElementTypes,
  '@jbrowse/core/pluggableElementTypes/ViewType': ViewType,
  '@jbrowse/core/pluggableElementTypes/AdapterType': AdapterType,
  '@jbrowse/core/pluggableElementTypes/DisplayType': DisplayType,
  '@jbrowse/core/pluggableElementTypes/TrackType': TrackType,
  '@jbrowse/core/pluggableElementTypes/WidgetType': WidgetType,
  '@jbrowse/core/pluggableElementTypes/models': pluggableElementTypeModels,
  '@jbrowse/core/data_adapters/BaseAdapter': BaseAdapterExports,
  // `adapterCache` is module-level state, so a plugin that bundles its own copy
  // of this file gets a second cache in the RPC worker — and
  // `freeAdapterResources`, which CoreFreeResources calls on the host's copy
  // when the last track using an adapter config closes, never sees it. The
  // cache is the only strong reference to an adapter, so those adapters and
  // everything they hold live as long as the worker. Serving the module is what
  // makes an external RPC method share the host's cache.
  '@jbrowse/core/data_adapters/dataAdapterCache': dataAdapterCache,
}
