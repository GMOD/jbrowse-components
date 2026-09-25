// The framework half of the runtime plugin ABI: the singletons a plugin must
// share with the host (React, MobX, MST) and Material UI. The @jbrowse half is
// generated from the exports maps — scripts/generateReExports.ts — and
// modules.ts joins the two. The worker's copy of this half is generated from
// it (frameworkWorkerModules.generated.ts), so a key added here is served in
// both realms by the next `pnpm autogen`.
import { ThemeProvider, alpha, createTheme, useTheme } from '@mui/material'
import SvgIcon, { createSvgIcon } from '@mui/material/SvgIcon'
import * as MUIUtils from '@mui/material/utils'
import * as mxreact from 'mobx-react'
import * as ReactDom from 'react-dom'
import * as ReactDomClient from 'react-dom/client'

import { cx, keyframes, makeStyles } from '../util/tss-react/index.ts'
import { DataGridEntries } from './MuiDataGridReExports.ts'
import { Entries } from './MuiReExports.ts'
import { MUIStyles } from './MuiStylesReExports.ts'
import frameworkShared from './frameworkShared.ts'
import { lazyMap } from './lazify.tsx'

function makeLegacyMakeStyles() {
  return (args: Parameters<ReturnType<typeof makeStyles>>[0]) => {
    const useStyles = makeStyles()(args)
    return () => useStyles().classes
  }
}

const tssReact = { cx, keyframes, makeStyles }
const legacyMakeStyles = makeLegacyMakeStyles()

const muiMaterialLib = {
  ...lazyMap(Entries),
  alpha,
  useTheme,
  createTheme,
  ThemeProvider,
}
const muiStylesLib = { ...MUIStyles, makeStyles: legacyMakeStyles }

const libs = {
  ...frameworkShared,
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
  'tss-react': tssReact,
  'tss-react/mui': tssReact,

  '@mui/material': muiMaterialLib,
  ...lazyMap(Entries, '@mui/material/'),

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
}

export default libs
