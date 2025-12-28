import { lazy } from 'react'

import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { SimpleFeature, assembleLocStringFast } from '@jbrowse/core/util'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'

import { locationLinkClick } from '../util'

import type {
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util'

const BreakpointSplitViewChoiceDialog = lazy(
  () => import('./BreakpointSplitViewChoiceDialog'),
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
          label: 'Open in breakpoint split view',
          onClick: () => {
            session.queueDialog(handleClose => [
              BreakpointSplitViewChoiceDialog,
              {
                handleClose,
                session,
                stableViewId: `${spreadsheetViewId}_${assemblyName}_breakpointsplitview`,
                feature: new SimpleFeature(feature),
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
