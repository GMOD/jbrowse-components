import { MUI_COMPONENT_NAMES } from './muiComponentNames.ts'

/**
 * Used by plugin build systems to determine if a module is provided by JBrowse
 * globally and thus doesn't need to be bundled. A check in ./modules.tsx makes
 * sure this is in sync with the re-exported modules.
 *
 * Using this instead of just Object.keys(modules) allows this file to be
 * easily used by downstream tooling like simple esbuild scripts, rollup
 * configs, etc. without actually importing all the modules in modules.tsx,
 * which a Object.keys(modules) would do
 */

// Per-component MUI subpaths, and the legacy `@material-ui/core/*` aliases
// below, both derived from the one name list — see muiComponentNames.ts for why
// that list is its own MUI-free module.
const muiComponentSubpaths = MUI_COMPONENT_NAMES.map(n => `@mui/material/${n}`)

export default [
  'mobx',
  '@jbrowse/mobx-state-tree',
  'mobx-state-tree',
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  'mobx-react',
  '@mui/x-data-grid',
  '@mui/material/utils',
  '@material-ui/core/utils',
  'tss-react',
  'tss-react/mui',
  '@material-ui/core',
  '@mui/material',

  '@mui/material/styles',
  '@material-ui/core/styles',

  ...muiComponentSubpaths.map(p =>
    p.replace('@mui/material/', '@material-ui/core/'),
  ),
  ...muiComponentSubpaths,

  '@material-ui/lab/ToggleButton',
  '@material-ui/lab/ToggleButtonGroup',
  '@material-ui/lab/Autocomplete',
  '@material-ui/lab/Alert',
  '@material-ui/lab',

  // The `@jbrowse/core` subpaths below are the ones a plugin may import and get
  // the host's copy of. Each carries a `#reexport <what it provides>` line,
  // which renders the table in the dependencies-and-re-exports guide
  // (website/scripts/api-docs/generateReExportDocs.ts) — so the guide stops
  // restating this list, which is what left it five paths short. A new subpath
  // needs the tag or the generator fails.
  //
  // Only the `@jbrowse/core` entries are tagged: the framework and MUI ones
  // above are described by category in the guide's prose, not one row each.

  // #reexport The base `Plugin` class your plugin extends
  '@jbrowse/core/Plugin',
  // #reexport `ViewType`, `AdapterType`, `DisplayType`, `TrackType`, `WidgetType` in one import, for the `install` method that registers several
  '@jbrowse/core/pluggableElementTypes',
  // #reexport Just the `ViewType` class, registered with `addViewType`
  '@jbrowse/core/pluggableElementTypes/ViewType',
  // #reexport Just the `AdapterType` class, registered with `addAdapterType`
  '@jbrowse/core/pluggableElementTypes/AdapterType',
  // #reexport Just the `DisplayType` class, registered with `addDisplayType`
  '@jbrowse/core/pluggableElementTypes/DisplayType',
  // #reexport Just the `TrackType` class, registered with `addTrackType`
  '@jbrowse/core/pluggableElementTypes/TrackType',
  // #reexport Just the `WidgetType` class, registered with `addWidgetType`
  '@jbrowse/core/pluggableElementTypes/WidgetType',
  // #reexport Base MST models for tracks and displays to compose with
  '@jbrowse/core/pluggableElementTypes/models',
  // #reexport `ConfigurationSchema`, `ConfigurationReference`, `readConfObject`, `getConf`
  '@jbrowse/core/configuration',
  // #reexport Reusable MST types like `ElementId` and `Region`
  '@jbrowse/core/util/types/mst',
  // #reexport Shared UI components — dialogs, menus, error and loading states
  '@jbrowse/core/ui',
  // #reexport The JBrowse MUI theme
  '@jbrowse/core/ui/theme',
  // #reexport The same colors and `resolvePalette` without Material UI in the module graph, for worker and renderer code
  '@jbrowse/core/ui/palette',
  // #reexport The hover tooltip, kept out of the `ui` barrel so @floating-ui stays off the startup path
  '@jbrowse/core/ui/BaseTooltip',
  // #reexport Core helpers: `getSession`, `getContainingView`, `Feature`, region and coordinate utilities
  '@jbrowse/core/util',
  // #reexport Color parsing and manipulation helpers
  '@jbrowse/core/util/color',
  // #reexport Feature layout (packing) helpers
  '@jbrowse/core/util/layouts',
  // #reexport Track and adapter config helpers
  '@jbrowse/core/util/tracks',
  // #reexport The 1D (bp↔px) view model the linear views are built on
  '@jbrowse/core/util/Base1DViewModel',
  // #reexport `openLocation` and the file-handle helpers
  '@jbrowse/core/util/io',
  // #reexport Helpers for inspecting MST types
  '@jbrowse/core/util/mst-reflection',
  // #reexport The RxJS re-exports an adapter's `getFeatures` stream is built from
  '@jbrowse/core/util/rxjs',
  // #reexport `FeatureDetails`, `BaseCard` and the other feature-detail building blocks
  '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail',
  // #reexport `BaseFeatureDataAdapter` and the adapter base classes
  '@jbrowse/core/data_adapters/BaseAdapter',
  // #reexport `getAdapter`, the worker-side adapter cache an RPC method resolves its adapter through
  '@jbrowse/core/data_adapters/dataAdapterCache',
]
