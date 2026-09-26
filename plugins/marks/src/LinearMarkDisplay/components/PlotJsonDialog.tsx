import { useState } from 'react'

import { MonospaceTextField, SubmitDialog } from '@jbrowse/core/ui'
import { Button, DialogContentText } from '@mui/material'
import { observer } from 'mobx-react'

import {
  MARK_PLOT_EXAMPLES,
  markPlotProblems,
  markPlotSettingsWritten,
  markPlotText,
  parseMarkPlot,
  summarizeMarkPlot,
} from '../markPlot.ts'
import { MarkProblemList } from './MarkProblems.tsx'

import type { MarkPlot, MarkPlotSettings } from '../markPlot.ts'
import type { MarkProblem } from '../markProblems.ts'

export interface PlotJsonDialogModel {
  /** The plot as declared, which the box opens on. */
  markPlot: MarkPlot
  /** Throws for a plot the config schema would refuse. */
  liftMarkPlot: (plot: MarkPlot) => MarkPlotSettings
  applyDisplaySettings: (settings: Record<string, unknown>) => unknown
  /** The form over the same plot, opened on a draft. */
  openMarkPlotDialog?: (seed?: MarkPlot) => void
}

interface Draft {
  plot?: MarkPlot
  problems: MarkProblem[]
  summary?: string
  error?: unknown
}

/**
 * The draft as the box judges it: a parse or a lift failure is the whole
 * answer, and a problem the rule list found is not — a plot that breaks a rule
 * still draws what it can, and an editor that refused it would be stricter
 * than both the loader and the display (ADR-133).
 */
function readDraft(model: PlotJsonDialogModel, text: string): Draft {
  try {
    const plot = parseMarkPlot(text)
    const lifted = model.liftMarkPlot(plot)
    const problems = markPlotProblems(lifted)
    return {
      plot,
      problems,
      summary: summarizeMarkPlot(plot, model.markPlot, problems, lifted),
    }
  } catch (error) {
    return { problems: [], error }
  }
}

const PlotJsonDialog = observer(function PlotJsonDialog({
  model,
  seed,
  handleClose,
}: {
  model: PlotJsonDialogModel
  seed?: MarkPlot
  handleClose: () => void
}) {
  const [text, setText] = useState(() =>
    markPlotText({ ...model.markPlot, ...seed }),
  )
  const { plot, problems, summary, error } = readDraft(model, text)

  return (
    <SubmitDialog
      open
      maxWidth="md"
      fullWidth
      title="Edit marks as JSON"
      submitText="Apply"
      submitDisabled={!plot}
      onCancel={handleClose}
      actions={
        model.openMarkPlotDialog ? (
          <Button
            disabled={!plot}
            onClick={() => {
              model.openMarkPlotDialog?.(plot)
              handleClose()
            }}
          >
            Back to form
          </Button>
        ) : undefined
      }
      onSubmit={() => {
        if (plot) {
          model.applyDisplaySettings(
            markPlotSettingsWritten(plot, model.markPlot),
          )
          handleClose()
        }
      }}
    >
      <DialogContentText>
        <code>marks</code> is the list drawn in order, each a <code>mark</code>{' '}
        and an <code>encoding</code>; <code>transform</code> runs over the
        features before any of them; <code>facet</code> stacks one section per
        value of a field and <code>rows</code> one row per value. A setting left
        out stays as it is, and <code>null</code> clears one;{' '}
        <code>scales.y</code> is the axis every mark stands on.
      </DialogContentText>
      <ul>
        {MARK_PLOT_EXAMPLES.map(({ plot, description }) => (
          <li key={plot}>
            <code>{plot}</code> {description}
          </li>
        ))}
      </ul>
      <MonospaceTextField
        fullWidth
        minRows={12}
        maxRows={30}
        value={text}
        error={error}
        onChange={setText}
        helperText={summary}
        inputTestId="mark-plot-json"
      />
      <MarkProblemList problems={problems} />
    </SubmitDialog>
  )
})

export default PlotJsonDialog
