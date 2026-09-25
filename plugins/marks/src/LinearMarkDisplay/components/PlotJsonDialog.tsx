import { useState } from 'react'

import { MonospaceTextField, SubmitDialog } from '@jbrowse/core/ui'
import { DialogContentText } from '@mui/material'
import { observer } from 'mobx-react'

import {
  markPlotProblems,
  markPlotSettingsWritten,
  markPlotText,
  parseMarkPlot,
  summarizeMarkPlot,
} from '../markPlot.ts'
import { problemText } from '../markProblems.ts'

import type { MarkPlot, MarkPlotSettings } from '../markPlot.ts'
import type { MarkProblem } from '../markProblems.ts'

export interface PlotJsonDialogModel {
  /** The plot as declared, which the box opens on. */
  markPlot: MarkPlot
  markPlotExamples: { plot: string; description: string }[]
  /** Throws for a plot the config schema would refuse. */
  liftMarkPlot: (plot: MarkPlot) => MarkPlotSettings
  applyDisplaySettings: (settings: Record<string, unknown>) => unknown
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
    const problems = markPlotProblems(model.liftMarkPlot(plot))
    return {
      plot,
      problems,
      summary: summarizeMarkPlot(plot, model.markPlot, problems),
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
        out stays as it is, and <code>null</code> clears one.
      </DialogContentText>
      <ul>
        {model.markPlotExamples.map(({ plot, description }) => (
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
      {problems.length > 0 ? (
        <ul data-testid="mark-plot-problems">
          {problems.map(problem => (
            <li key={`${problem.rule}-${problem.mark}-${problem.slot}`}>
              {problemText(problem)}
            </li>
          ))}
        </ul>
      ) : null}
    </SubmitDialog>
  )
})

export default PlotJsonDialog
