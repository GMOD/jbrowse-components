import { lazy } from 'react'
import { types } from 'mobx-state-tree'
import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import PaletteIcon from '@material-ui/icons/Palette'
import FilterListIcon from '@material-ui/icons/FilterList'

const ColorByTagDlg = lazy(() => import('./components/ColorByTag'))
const FilterByTagDlg = lazy(() => import('./components/FilterByTag'))

const colorByModel = types.maybe(
  types.model({
    type: types.string,
    tag: types.maybe(types.string),
  }),
)

const filterByModel = types.optional(
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const colorSchemeMenu = (self: any) => ({
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const filterByMenu = (self: any) => ({
  label: 'Filter by',
  icon: FilterListIcon,
  onClick: () => {
    getSession(self).setDialogComponent(FilterByTagDlg, {
      model: self,
    })
  },
})

async function getUniqueTagValues(
  self: any,
  regions: any,
  tag: string,
  opts: any = {},
) {
  const { rpcManager } = getSession(self)
  const { adapterConfig } = self
  const sessionId = getRpcSessionId(self)
  const values = await rpcManager.call(
    getRpcSessionId(self),
    'PileupGetGlobalValueForTag',
    {
      adapterConfig,
      tag,
      sessionId,
      regions,
      ...opts,
    },
  )
  return values as string[]
}

export {
  colorByModel,
  filterByModel,
  colorSchemeMenu,
  filterByMenu,
  getUniqueTagValues,
}
