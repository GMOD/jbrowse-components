import CascadingMenuButton from '@jbrowse/core/ui/CascadingMenuButton'
import { SimpleFeature, assembleLocStringFast } from '@jbrowse/core/util'
import { launchBreakpointSplitView } from '@jbrowse/sv-core'
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown'

import { locationLinkClick } from '../util.ts'

import type {
  AbstractSessionModel,
  SimpleFeatureSerialized,
} from '@jbrowse/core/util'

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
            launchBreakpointSplitView({
              session,
              feature: new SimpleFeature(feature),
              assemblyName,
              stableViewId: `${spreadsheetViewId}_${assemblyName}_breakpointsplitview`,
            })
          },
        },
      ]}
    >
      <ArrowDropDownIcon />
    </CascadingMenuButton>
  )
}
