import { ActionLink } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { launchBreakpointSplitView, navToLoc } from '@jbrowse/sv-core'

import type { AlignmentFeatureWidgetModel } from './stateModelFactory.ts'
import type { Feature } from '@jbrowse/core/util'
import type { ReactNode } from 'react'

// Navigates the widget's associated view to a locstring.
export function NavToLocLink({
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
}

// Opens a breakpoint split view for a read+mate (or read+supplementary) feature.
export function LaunchBreakpointSplitViewLink({
  model,
  assemblyName,
  feature,
  children,
}: {
  model: AlignmentFeatureWidgetModel
  assemblyName: string
  feature: Feature
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
        })
      }}
    >
      {children}
    </ActionLink>
  )
}
