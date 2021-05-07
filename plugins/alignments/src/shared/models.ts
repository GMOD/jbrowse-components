import { lazy } from 'react'
import { types, IAnyStateTreeNode } from 'mobx-state-tree'
import { getSession } from '@jbrowse/core/util'
import { getRpcSessionId } from '@jbrowse/core/util/tracks'
import { Region } from '@jbrowse/core/util/types'
import PaletteIcon from '@material-ui/icons/Palette'
import FilterListIcon from '@material-ui/icons/FilterList'
import { AnyConfigurationModel } from '@jbrowse/core/configuration/configurationSchema'

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

const colorSchemeMenu = (
  self: IAnyStateTreeNode & { setColorScheme: Function },
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

const setDisplayModeMenu = (
  self: IAnyStateTreeNode & { setDisplayMode: Function },
) => ({
  label: 'Set display mode',
  subMenu: [
    {
      label: 'Normal',
      onClick: () => {
        self.setDisplayMode('normal')
      },
    },
    {
      label: 'Compact',
      onClick: () => {
        self.setDisplayMode('compact')
      },
    },
    {
      label: 'Squish',
      onClick: () => {
        self.setDisplayMode('squish')
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

async function getUniqueTagValues(
  self: IAnyStateTreeNode & { adapterConfig: AnyConfigurationModel },
  regions: Region[],
  tag: string,
  opts: Record<string, unknown> = {},
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
  setDisplayModeMenu,
}
