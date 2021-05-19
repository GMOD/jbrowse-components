import { lazy } from 'react'
import { types, IAnyStateTreeNode } from 'mobx-state-tree'
import { getSession } from '@jbrowse/core/util'
import PaletteIcon from '@material-ui/icons/Palette'
import FilterListIcon from '@material-ui/icons/FilterList'

const ColorByTagDlg = lazy(() => import('./components/ColorByTag'))
const FilterByTagDlg = lazy(() => import('./components/FilterByTag'))
const ModificationsDlg = lazy(() => import('./components/ColorByModifications'))

const colorBy = types.maybe(
  types.model({
    type: types.string,
    tag: types.maybe(types.string),
  }),
)

const filterBy = types.optional(
  types.model({
    flagInclude: types.optional(types.number, 0),
    flagExclude: types.optional(types.number, 1536),
    readName: types.maybe(types.string),
    tagFilter: types.maybe(
      types.model({ tag: types.string, value: types.string }),
    ),
  }),
  {},
)

const colorSchemeMenu = (
  self: IAnyStateTreeNode & { setColorScheme: (a: { type: string }) => void },
) => ({
  label: 'Color scheme',
  icon: PaletteIcon,
  subMenu: [
    {
      label: 'Normal',
      onClick: () => {
        self.setColorScheme({ type: 'normal' })
      },
    },
    {
      label: 'Mapping quality',
      onClick: () => {
        self.setColorScheme({ type: 'mappingQuality' })
      },
    },
    {
      label: 'Strand',
      onClick: () => {
        self.setColorScheme({ type: 'strand' })
      },
    },
    {
      label: 'Pair orientation',
      onClick: () => {
        self.setColorScheme({ type: 'pairOrientation' })
      },
    },
    {
      label: 'Per-base quality',
      onClick: () => {
        self.setColorScheme({ type: 'perBaseQuality' })
      },
    },

    {
      label: 'Base modifications (MM+MP/ML)',
      onClick: () => {
        getSession(self).setDialogComponent(ModificationsDlg, {
          model: self,
        })
      },
    },

    {
      label: 'Insert size',
      onClick: () => {
        self.setColorScheme({ type: 'insertSize' })
      },
    },
    {
      label: 'Stranded paired-end',
      onClick: () => {
        self.setColorScheme({ type: 'reverseTemplate' })
      },
    },
    {
      label: 'Color by tag...',
      onClick: () => {
        getSession(self).setDialogComponent(ColorByTagDlg, {
          model: self,
        })
      },
    },
  ],
})

const filterByMenu = (self: IAnyStateTreeNode) => ({
  label: 'Filter by',
  icon: FilterListIcon,
  onClick: () => {
    getSession(self).setDialogComponent(FilterByTagDlg, {
      model: self,
    })
  },
})

export { colorBy, filterBy, colorSchemeMenu, filterByMenu }
