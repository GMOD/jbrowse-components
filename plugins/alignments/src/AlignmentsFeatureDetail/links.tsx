import { ActionLink } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { launchBreakpointSplitView, navToLoc } from '@jbrowse/sv-core'
import { observer } from 'mobx-react'

import type { AlignmentFeatureWidgetModel } from './stateModelFactory.ts'
import type { Feature } from '@jbrowse/core/util'
import type { PanelStop } from '@jbrowse/sv-core'
import type { ReactNode } from 'react'

// Navigates the widget's associated view to a locstring.
export const NavToLocLink = observer(function NavToLocLink({
  model,
  loc,
  children,
}: {
  model: AlignmentFeatureWidgetModel
  loc: string
  children: ReactNode
}) {
  return (
    <ActionLink
      onClick={() => {
        navToLoc(loc, model)
      }}
    >
      {children}
    </ActionLink>
  )
})

// Opens a breakpoint split view for a read+mate feature, or a split read's
// segments when `stops` names them.
export const LaunchBreakpointSplitViewLink = observer(
  function LaunchBreakpointSplitViewLink({
    model,
    assemblyName,
    feature,
    stops,
    children,
  }: {
    model: AlignmentFeatureWidgetModel
    assemblyName: string
    feature: Feature
    stops?: PanelStop[]
    children: ReactNode
  }) {
    return (
      <ActionLink
        onClick={() => {
          launchBreakpointSplitView({
            session: getSession(model),
            view: model.view,
            assemblyName,
            feature,
            stops,
          })
        }}
      >
        {children}
      </ActionLink>
    )
  },
)
