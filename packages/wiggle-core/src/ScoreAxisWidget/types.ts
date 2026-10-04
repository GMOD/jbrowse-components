import type { AutoscalePeer } from '../autoscaleGroup.ts'
import type { ScoreRulesModel, ScoreScaleModel } from '../scoreMenuItems.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'

/** What the widget edits: a display's value scale and the guides it owns. */
export type ScoreAxisDisplay = ScoreScaleModel &
  Partial<ScoreRulesModel> &
  Partial<AutoscalePeer> & {
    id: string
    configuration: AnyConfigurationModel
    grid: boolean
    setGrid: (grid: boolean) => void
  }
