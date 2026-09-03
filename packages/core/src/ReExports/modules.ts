// eslint-disable-next-line no-restricted-imports
import * as React from 'react'

import { alpha, createTheme, useTheme } from '@mui/material'
import SvgIcon, { createSvgIcon } from '@mui/material/SvgIcon'
import * as MUIUtils from '@mui/material/utils'
import * as mxreact from 'mobx-react'
import * as ReactDom from 'react-dom'
import * as ReactDomClient from 'react-dom/client'

import * as coreUi from '../ui/index.ts'
import { cx, keyframes, makeStyles } from '../util/tss-react/index.ts'
import { BaseFeatureDetail } from './BaseFeatureDetails.tsx'
import { DataGridEntries } from './MuiDataGridReExports.ts'
import { Entries } from './MuiReExports.ts'
import { MUIStyles } from './MuiStylesReExports.ts'
import { lazyMap } from './lazify.tsx'
import reExportsList from './list.ts'
import { sharedModules } from './sharedModules.ts'
import {
  CORE_UI_NAMES,
  MATERIAL_UI_CORE_NAMES,
  MATERIAL_UI_LAB_NAMES,
  MOBX_REACT_NAMES,
  MUI_MATERIAL_NAMES,
  MUI_STYLES_NAMES,
  MUI_UTILS_NAMES,
  REACT_DOM_CLIENT_NAMES,
  REACT_DOM_NAMES,
  TSS_REACT_NAMES,
} from './workerNamespaceNames.ts'

function makeLegacyMakeStyles() {
  return (args: Parameters<ReturnType<typeof makeStyles>>[0]) => {
    const useStyles = makeStyles()(args)
    return () => useStyles().classes
  }
}

// A name real here but missing from workerNamespaceNames.ts (or vice versa)
// would leave the RPC worker's stub for `label` shaped differently from what
// this module actually serves -- silently, since nothing renders in the
// worker to notice. This is what keeps the two in agreement.
function assertNamesMatch(
  label: string,
  real: object,
  expected: readonly string[],
) {
  const realNames = Object.keys(real).sort()
  const expectedNames = [...expected].sort()
  const missing = expectedNames.filter(n => !realNames.includes(n))
  const extra = realNames.filter(n => !expectedNames.includes(n))
  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `${label}'s real exports have drifted from workerNamespaceNames.ts ` +
        `(missing: ${missing.join(', ') || 'none'}; extra: ${extra.join(', ') || 'none'}). ` +
        'The RPC worker stubs this module using that file -- update it to match.',
    )
  }
}

const tssReact = { cx, keyframes, makeStyles }
const legacyMakeStyles = makeLegacyMakeStyles()

const materialUiCoreLib = {
  ...lazyMap(Entries),
  useTheme,
  alpha,
  makeStyles: legacyMakeStyles,
}
const muiMaterialLib = {
  ...lazyMap(Entries),
  alpha,
  useTheme,
  createTheme,
}
const materialUiLabLib = {
  Alert: Entries.Alert,
  Autocomplete: Entries.Autocomplete,
  ToggleButton: Entries.ToggleButton,
  ToggleButtonGroup: Entries.ToggleButtonGroup,
}
// makeStyles is deliberately absent from MUIStyles itself (see
// MuiStylesReExports.ts) and added back here, so the name list checked below
// is this object's, not the raw import's.
const muiStylesLib = { ...MUIStyles, makeStyles: legacyMakeStyles }

assertNamesMatch('react-dom', ReactDom, REACT_DOM_NAMES)
assertNamesMatch('react-dom/client', ReactDomClient, REACT_DOM_CLIENT_NAMES)
assertNamesMatch('mobx-react', mxreact, MOBX_REACT_NAMES)
assertNamesMatch('@mui/material/utils', MUIUtils, MUI_UTILS_NAMES)
assertNamesMatch('tss-react', tssReact, TSS_REACT_NAMES)
assertNamesMatch('@mui/material/styles', muiStylesLib, MUI_STYLES_NAMES)
assertNamesMatch('@jbrowse/core/ui', coreUi, CORE_UI_NAMES)
assertNamesMatch('@mui/material', muiMaterialLib, MUI_MATERIAL_NAMES)
assertNamesMatch('@material-ui/core', materialUiCoreLib, MATERIAL_UI_CORE_NAMES)
assertNamesMatch('@material-ui/lab', materialUiLabLib, MATERIAL_UI_LAB_NAMES)

const libs = {
  ...sharedModules,
  'mobx-react': mxreact,
  'react-dom': ReactDom,
  'react-dom/client': ReactDomClient,
  // Only lazy component entries are re-exported. The grid *hooks*
  // (useGridApiContext/useGridApiRef/useGridRootProps) are intentionally left
  // out: statically importing them here pulled the entire ~1.2 MB
  // @mui/x-data-grid package into the eager first-paint graph, defeating the
  // lazy import('@mui/x-data-grid') in MuiDataGridReExports. First-party code
  // that needs the hooks imports them directly from '@mui/x-data-grid'.
  '@mui/x-data-grid': {
    ...lazyMap(DataGridEntries),
  },

  '@mui/material/utils': MUIUtils,
  '@material-ui/core/utils': MUIUtils,
  'tss-react': tssReact,
  'tss-react/mui': tssReact,

  '@material-ui/core': materialUiCoreLib,
  '@mui/material': muiMaterialLib,
  ...lazyMap(Entries, '@mui/material/'),
  ...lazyMap(Entries, '@material-ui/core/'),

  // @mui/icons-material — bundled into external plugins — reads the
  // `createSvgIcon` *named* export from @mui/material/SvgIcon, but lazyMap
  // exposes only the component (its default). SvgIcon is a primitive that's
  // eagerly loaded in practice, so expose it directly with createSvgIcon
  // attached: a default import still lands on a usable component (rollup-plugin-
  // external-globals substitutes the value itself, esbuild's globalExternals
  // reads `.default`), while the named import and icons-material's CJS
  // `require(...).createSvgIcon` both find the util. A shallow copy carries the
  // forwardRef's $$typeof/render so the shared SvgIcon export isn't mutated.
  // Overrides the lazy entry above; verified against both bundlers.
  // GMOD/jbrowse-components#5606.
  '@mui/material/SvgIcon': Object.assign({}, SvgIcon, { createSvgIcon }),

  '@mui/material/styles': muiStylesLib,
  '@material-ui/core/styles': muiStylesLib,

  // these are core in @mui/material, but used to be in @material-ui/lab
  '@material-ui/lab/ToggleButton': Entries.ToggleButton,
  '@material-ui/lab/ToggleButtonGroup': Entries.ToggleButtonGroup,
  '@material-ui/lab/Autocomplete': Entries.Autocomplete,
  '@material-ui/lab/Alert': Entries.Alert,
  '@material-ui/lab': materialUiLabLib,

  '@jbrowse/core/ui': coreUi,
  // BaseTooltip is deliberately absent from the '@jbrowse/core/ui' barrel: the
  // re-export alone held @floating-ui (~266KB) on the startup path, since eager
  // plugin entries import that barrel. Serving it as its own module behind
  // React.lazy keeps it off that path while leaving external plugins a way to
  // reach it -- published apollo deep-imports this exact path, and react-msaview
  // (bundled by tview and msaview) reads it too, so dropping it from the barrel
  // with no ABI home is what broke them.
  ...lazyMap(
    { BaseTooltip: React.lazy(() => import('../ui/BaseTooltip.tsx')) },
    '@jbrowse/core/ui/',
  ),

  '@jbrowse/core/BaseFeatureWidget/BaseFeatureDetail': BaseFeatureDetail,

  // `adapterCache` is module-level state, so a plugin that bundles its own copy
  // of this file gets a second cache in the RPC worker — and `freeAdapterResources`,
  // which CoreFreeResources calls on the host's copy when the last track using
  // an adapter config closes, never sees it. The cache is the only strong
  // reference to an adapter (see the comment on that function), so those
  // adapters and everything they hold live as long as the worker. Serving the
  // module is what makes an external RPC method share the host's cache.
}

const libsList = Object.keys(libs)

// make sure that all the items in the ReExports/list array (used by build
// systems and such) are included here, and vice versa
const inLibsOnly = libsList.filter(mod => !reExportsList.includes(mod))
if (inLibsOnly.length > 0) {
  throw new Error(
    `The following modules are in the modules libs, but not the re-exports list: ${inLibsOnly.join(
      ', ',
    )}`,
  )
}
const inReExportsOnly = reExportsList.filter(mod => !libsList.includes(mod))
if (inReExportsOnly.length) {
  throw new Error(
    `The following modules are in the re-exports list, but not the modules libs: ${inReExportsOnly.join(
      ', ',
    )}`,
  )
}

export default libs
