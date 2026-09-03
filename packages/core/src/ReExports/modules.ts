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

function makeLegacyMakeStyles() {
  return (args: Parameters<ReturnType<typeof makeStyles>>[0]) => {
    const useStyles = makeStyles()(args)
    return () => useStyles().classes
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
const muiStylesLib = { ...MUIStyles, makeStyles: legacyMakeStyles }

const lazyBaseTooltip = lazyMap({
  BaseTooltip: React.lazy(() => import('../ui/BaseTooltip.tsx')),
})

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

  // BaseTooltip is deliberately absent from the *source* barrel ui/index.ts: the
  // re-export alone held @floating-ui (~266KB) on the startup path, since eager
  // plugin entries import that barrel. That is a fact about ui/index.ts, and it
  // leaked into the ABI, where it is only a trap -- served at its own path but
  // not on the namespace, so `import { BaseTooltip } from '@jbrowse/core/ui'`,
  // the spelling the docs give for every other component, compiled and then
  // yielded undefined at runtime. Serving the same React.lazy on both keeps the
  // two spellings honest and holds the startup path either way, since the barrel
  // itself is untouched. (Published apollo 1.1.1 reads it off the namespace,
  // which is how the trap was found; react-msaview takes the deep path.)
  '@jbrowse/core/ui': { ...coreUi, ...lazyBaseTooltip },
  '@jbrowse/core/ui/BaseTooltip': lazyBaseTooltip.BaseTooltip,

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
