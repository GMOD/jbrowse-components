import {
  wiggleAxisViews,
  wiggleRowLabelViews,
  wiggleSidebarViews,
} from './wiggleAxisViews.ts'
import { wiggleDisplayViews } from './wiggleDisplayViews.ts'
import { wiggleColorScaleViews, wiggleScoreKeyViews } from './wiggleKeyViews.ts'
import {
  wiggleAutoscaleViews,
  wiggleDomainViews,
  wigglePlotViews,
  wiggleRowHeightViews,
  wiggleRowsBoxViews,
  wiggleStatsViews,
} from './wigglePlotViews.ts'
import { wiggleResolveViews } from './wiggleResolveViews.ts'
import { wiggleRowHookViews } from './wiggleRowHookViews.ts'

import type {
  WiggleAxisHost,
  WiggleRowLabelHost,
  WiggleSidebarHost,
} from './wiggleAxisViews.ts'
import type { WiggleDisplayViewsHost } from './wiggleDisplayViews.ts'
import type {
  WiggleColorScaleHost,
  WiggleScoreKeyHost,
} from './wiggleKeyViews.ts'
import type {
  WiggleAutoscaleHost,
  WiggleDomainHost,
  WigglePlotHost,
  WiggleRowHeightHost,
  WiggleRowsBoxHost,
  WiggleStatsHost,
} from './wigglePlotViews.ts'
import type { WiggleResolveHost } from './wiggleResolveViews.ts'
import type { WiggleRowHookHost } from './wiggleRowHookViews.ts'
import type { IModelType, ModelProperties } from '@jbrowse/mobx-state-tree'

type ScoreStageOutputs = ReturnType<typeof wiggleRowHookViews> &
  ReturnType<typeof wiggleDomainViews> &
  ReturnType<typeof wiggleResolveViews> &
  ReturnType<typeof wiggleStatsViews> &
  ReturnType<typeof wiggleAutoscaleViews> &
  ReturnType<typeof wiggleRowsBoxViews> &
  ReturnType<typeof wiggleRowHeightViews> &
  ReturnType<typeof wigglePlotViews> &
  ReturnType<typeof wiggleScoreKeyViews> &
  ReturnType<typeof wiggleDisplayViews>

/** What the score stages read that they do not state themselves. */
export type WiggleScoreStageInputs = Omit<
  WiggleRowHookHost &
    WiggleDomainHost &
    WiggleResolveHost &
    WiggleStatsHost &
    WiggleAutoscaleHost &
    WiggleRowsBoxHost &
    WiggleRowHeightHost &
    WigglePlotHost &
    WiggleScoreKeyHost &
    WiggleDisplayViewsHost,
  keyof ScoreStageOutputs
> &
  Pick<WiggleRowHookHost, 'discoveredRows'>

type SidebarStageOutputs = ReturnType<typeof wiggleRowLabelViews> &
  ReturnType<typeof wiggleSidebarViews> &
  ReturnType<typeof wiggleAxisViews> &
  ReturnType<typeof wiggleColorScaleViews>

/** What the sidebar stages read that they do not state themselves. */
export type WiggleSidebarStageInputs = Omit<
  WiggleRowLabelHost &
    WiggleSidebarHost &
    WiggleAxisHost &
    WiggleColorScaleHost,
  keyof SidebarStageOutputs
>

/**
 * Installs the wiggle chain from the row hooks through the render state, in
 * its one order, on a model that already has the row stages.
 */
export function wiggleScoreStages<
  P extends ModelProperties,
  O extends WiggleScoreStageInputs,
  C,
  S,
>(model: IModelType<P, O, C, S>) {
  return model
    .views(self => wiggleRowHookViews(self))
    .views(self => wiggleDomainViews(self))
    .views(self => wiggleResolveViews(self))
    .views(self => wiggleStatsViews(self))
    .views(self => wiggleAutoscaleViews(self))
    .views(self => wiggleRowsBoxViews(self))
    .views(self => wiggleRowHeightViews(self))
    .views(self => wigglePlotViews(self))
    .views(self => wiggleScoreKeyViews(self))
    .views(self => wiggleDisplayViews(self))
}

/**
 * Installs the wiggle sidebar, axis and key, in their one order, on a model
 * that already has the tree's `hierarchy`.
 */
export function wiggleSidebarStages<
  P extends ModelProperties,
  O extends WiggleSidebarStageInputs,
  C,
  S,
>(model: IModelType<P, O, C, S>) {
  return model
    .views(self => wiggleRowLabelViews(self))
    .views(self => wiggleSidebarViews(self))
    .views(self => wiggleAxisViews(self))
    .views(self => wiggleColorScaleViews(self))
}
