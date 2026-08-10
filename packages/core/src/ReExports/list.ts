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

// Per-component MUI subpaths. The legacy `@material-ui/core/*` aliases resolve
// to the same MUI v5 modules, so they're derived from this one list rather than
// maintained as a parallel copy. Keep in sync with the keys of `Entries` in
// MuiReExports.ts (the modules.tsx check enforces this at load time).
const muiComponentSubpaths = [
  '@mui/material/Accordion',
  '@mui/material/AccordionActions',
  '@mui/material/AccordionDetails',
  '@mui/material/AccordionSummary',
  '@mui/material/Alert',
  '@mui/material/AlertTitle',
  '@mui/material/Autocomplete',
  '@mui/material/Avatar',
  '@mui/material/AvatarGroup',
  '@mui/material/Backdrop',
  '@mui/material/Badge',
  '@mui/material/Box',
  '@mui/material/Breadcrumbs',
  '@mui/material/Button',
  '@mui/material/ButtonGroup',
  '@mui/material/Card',
  '@mui/material/CardActions',
  '@mui/material/CardActionArea',
  '@mui/material/CardContent',
  '@mui/material/CardHeader',
  '@mui/material/CardMedia',
  '@mui/material/CircularProgress',
  '@mui/material/Collapse',
  '@mui/material/ClickAwayListener',
  '@mui/material/Chip',
  '@mui/material/Checkbox',
  '@mui/material/Container',
  '@mui/material/Dialog',
  '@mui/material/DialogActions',
  '@mui/material/DialogTitle',
  '@mui/material/DialogContent',
  '@mui/material/DialogContentText',
  '@mui/material/Divider',
  '@mui/material/Drawer',
  '@mui/material/Fab',
  '@mui/material/Fade',
  '@mui/material/FilledInput',
  '@mui/material/FormLabel',
  '@mui/material/FormControl',
  '@mui/material/FormControlLabel',
  '@mui/material/FormHelperText',
  '@mui/material/FormGroup',
  '@mui/material/Grid',
  '@mui/material/Grid2',
  '@mui/material/Grow',
  '@mui/material/Icon',
  '@mui/material/IconButton',
  '@mui/material/Input',
  '@mui/material/InputBase',
  '@mui/material/InputLabel',
  '@mui/material/InputAdornment',
  '@mui/material/Link',
  '@mui/material/LinearProgress',
  '@mui/material/List',
  '@mui/material/ListItem',
  '@mui/material/ListItemAvatar',
  '@mui/material/ListItemButton',
  '@mui/material/ListItemSecondaryAction',
  '@mui/material/ListItemIcon',
  '@mui/material/ListSubheader',
  '@mui/material/ListItemText',
  '@mui/material/Menu',
  '@mui/material/MenuItem',
  '@mui/material/MenuList',
  '@mui/material/Modal',
  '@mui/material/NativeSelect',
  '@mui/material/OutlinedInput',
  '@mui/material/Pagination',
  '@mui/material/PaginationItem',
  '@mui/material/Paper',
  '@mui/material/Popover',
  '@mui/material/Popper',
  '@mui/material/Portal',
  '@mui/material/Radio',
  '@mui/material/RadioGroup',
  '@mui/material/Rating',
  '@mui/material/ScopedCssBaseline',
  '@mui/material/Select',
  '@mui/material/Skeleton',
  '@mui/material/Slider',
  '@mui/material/Snackbar',
  '@mui/material/SnackbarContent',
  '@mui/material/SpeedDial',
  '@mui/material/SpeedDialAction',
  '@mui/material/SpeedDialIcon',
  '@mui/material/Stack',
  '@mui/material/Step',
  '@mui/material/StepButton',
  '@mui/material/StepConnector',
  '@mui/material/StepLabel',
  '@mui/material/StepIcon',
  '@mui/material/Stepper',
  '@mui/material/SvgIcon',
  '@mui/material/Switch',
  '@mui/material/Tab',
  '@mui/material/Table',
  '@mui/material/TableBody',
  '@mui/material/TableCell',
  '@mui/material/TableContainer',
  '@mui/material/TableFooter',
  '@mui/material/TableHead',
  '@mui/material/TablePagination',
  '@mui/material/TableRow',
  '@mui/material/TableSortLabel',
  '@mui/material/Tabs',
  '@mui/material/TextField',
  '@mui/material/TextareaAutosize',
  '@mui/material/ToggleButton',
  '@mui/material/ToggleButtonGroup',
  '@mui/material/Toolbar',
  '@mui/material/Tooltip',
  '@mui/material/Typography',
]

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
