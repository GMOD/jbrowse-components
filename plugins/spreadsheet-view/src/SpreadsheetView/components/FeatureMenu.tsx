import { lazy } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { SimpleFeature, assembleLocStringFast } from '@jbrowse/core/util'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'
import { getEnv } from '@jbrowse/mobx-state-tree'

import { locationLinkClick } from '../util'

import type {
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util'

// lazies
const BreakendMultiLevelOptionDialog = lazy(
  () => import('./BreakendMultiLevelOptionDialog'),
)
const BreakendSingleLevelOptionDialog = lazy(
  () => import('./BreakendSingleLevelOptionDialog'),
)

export default function FeatureMenu({
  assemblyName,
  session,
  spreadsheetViewId,
  feature,
}: {
  spreadsheetViewId: string
  assemblyName: string
  session: AbstractSessionModel
  feature: SimpleFeatureSerialized
}) {
  return (
    <CascadingMenuButton
      menuItems={[
        {
          label: 'Open in linear genome view',
          onClick: async () => {
            try {
              await locationLinkClick({
                spreadsheetViewId,
                assemblyName,
                session,
                locString: assembleLocStringFast(feature),
              })
            } catch (e) {
              console.error(e)
              session.notifyError(`${e}`, e)
            }
          },
        },
        {
          label: 'Open in single-level split view',
          onClick: async () => {
            const { pluginManager } = getEnv(session)
            const viewType = pluginManager.getViewType('BreakpointSplitView')!
            session.queueDialog(handleClose => [
              BreakendSingleLevelOptionDialog,
              {
                handleClose,
                session,
                stableViewId: `${spreadsheetViewId}_${assemblyName}_breakpointsplitview_singlelevel`,
                feature: new SimpleFeature(feature),
                viewType,
                assemblyName,
              },
            ])
          },
        },
        {
          label: 'Open in multi-level split view',
          onClick: async () => {
            const { pluginManager } = getEnv(session)
            const viewType = pluginManager.getViewType('BreakpointSplitView')!
            session.queueDialog(handleClose => [
              BreakendMultiLevelOptionDialog,
              {
                handleClose,
                session,
                stableViewId: `${spreadsheetViewId}_${assemblyName}_breakpointsplitview_multilevel`,
                feature: new SimpleFeature(feature),
                viewType,
                assemblyName,
              },
            ])
          },
        },
      ]}
    >
      <ArrowDropDownIcon />
    </CascadingMenuButton>
  )
}
