import { lazy } from 'react'

import { ConfigurationReference, getConf } from '@jbrowse/core/configuration'
import { BaseLinearDisplay } from '@jbrowse/core/pluggableElementTypes/models'
import {
  getContainingTrack,
  getContainingView,
  getSession,
  isSessionModelWithWidgets,
} from '@jbrowse/core/util'
import { types } from '@jbrowse/mobx-state-tree'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import MenuOpenIcon from '@mui/icons-material/MenuOpen'

import { syriColors } from '../LinearSyntenyDisplay/drawSyntenyUtils.ts'

import type { SyriType } from '@jbrowse/plugin-comparative-adapters'
import type { AnyConfigurationSchemaType } from '@jbrowse/core/configuration'
import type { MenuItem } from '@jbrowse/core/ui'
import type { Feature } from '@jbrowse/core/util'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

type LGV = LinearGenomeViewModel

const LaunchSyntenyViewDialog = lazy(
  () => import('../LGVSyntenyDisplay/components/LaunchSyntenyViewDialog.tsx'),
)

export interface MultiSyntenyFeature {
  queryGenome: string
  start: number
  end: number
  mateStart: number
  mateEnd: number
  mateRefName: string
  strand: number
  syriType: SyriType | undefined
  identity: number
  featureId: string
}

function stateModelFactory(schema: AnyConfigurationSchemaType) {
  return types
    .compose(
      'MultiLGVSyntenyDisplay',
      BaseLinearDisplay,
      types.model({
        type: types.literal('MultiLGVSyntenyDisplay'),
        configuration: ConfigurationReference(schema),
        rowHeight: types.optional(types.number, 20),
        selectedGenomes: types.optional(types.array(types.string), []),
      }),
    )
    .volatile(() => ({
      genomeRows: new Map<string, MultiSyntenyFeature[]>(),
      allGenomeNames: [] as string[],
    }))
    .views(self => ({
      get displayedGenomes() {
        if (self.selectedGenomes.length > 0) {
          return [...self.selectedGenomes]
        }
        return self.allGenomeNames
      },
      get displayHeight() {
        return Math.max(this.displayedGenomes.length * self.rowHeight, 40)
      },
    }))
    .actions(self => ({
      setGenomeRows(rows: Map<string, MultiSyntenyFeature[]>) {
        self.genomeRows = rows
      },
      setAllGenomeNames(names: string[]) {
        self.allGenomeNames = names
      },
      setRowHeight(h: number) {
        self.rowHeight = h
      },
      setSelectedGenomes(genomes: string[]) {
        self.selectedGenomes.replace(genomes)
      },
      toggleGenome(name: string) {
        const idx = self.selectedGenomes.indexOf(name)
        if (idx >= 0) {
          self.selectedGenomes.splice(idx, 1)
        } else {
          self.selectedGenomes.push(name)
        }
      },
      selectFeature(feature: Feature) {
        const session = getSession(self)
        if (isSessionModelWithWidgets(session)) {
          const featureWidget = session.addWidget(
            'SyntenyFeatureWidget',
            'syntenyFeature',
            {
              featureData: feature.toJSON(),
              view: getContainingView(self),
              track: getContainingTrack(self),
            },
          )
          session.showWidget(featureWidget)
        }
        session.setSelection(feature)
      },
    }))
    .views(self => ({
      contextMenuItems() {
        const feature = self.contextMenuFeature
        if (!feature) {
          return [] as MenuItem[]
        }
        return [
          {
            label: 'Open feature details',
            icon: MenuOpenIcon,
            onClick: () => {
              self.selectFeature(feature)
            },
          },
          {
            label: 'Launch synteny view for this position',
            onClick: () => {
              getSession(self).queueDialog(handleClose => [
                LaunchSyntenyViewDialog,
                {
                  view: getContainingView(self) as LGV,
                  trackId: getConf(getContainingTrack(self), 'trackId'),
                  handleClose,
                  session: getSession(self),
                  feature,
                },
              ])
            },
          },
          {
            label: 'Copy info to clipboard',
            icon: ContentCopyIcon,
            onClick: async () => {
              const { uniqueId, ...rest } = feature.toJSON()
              const session = getSession(self)
              const { default: copy } = await import('copy-to-clipboard')
              copy(JSON.stringify(rest, null, 4))
              session.notify('Copied to clipboard', 'success')
            },
          },
        ] as MenuItem[]
      },
      trackMenuItems() {
        return [
          {
            label: 'Row height',
            subMenu: [10, 15, 20, 30, 50].map(h => ({
              label: `${h}px`,
              type: 'radio' as const,
              checked: self.rowHeight === h,
              onClick: () => {
                self.setRowHeight(h)
              },
            })),
          },
          {
            label: 'Select genomes...',
            onClick: () => {
              // Opens genome selector dialog - TODO: implement
            },
          },
        ] as MenuItem[]
      },
    }))
}

export default stateModelFactory
