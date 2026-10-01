import { useState } from 'react'

import { parsePlot, plotChanges } from '@jbrowse/core/configuration'
import { MonospaceTextField, SubmitDialog } from '@jbrowse/core/ui'
import { Button, DialogContentText } from '@mui/material'
import { observer } from 'mobx-react'

import type { Plot } from '@jbrowse/core/configuration'

export interface PlotDialogHost {
  plotKeys: string[]
  plot: Plot
  /** Throws what a config file would be refused for. */
  plotProblems: (draft: Plot) => string[]
  applyPlot: (draft: Plot) => void
  /** One line each above the text, where a display has worked examples. */
  plotExamples?: readonly { plot: string; description: string }[]
  /** A form over the same settings, opened on the draft. */
  openPlotForm?: (draft: Plot) => void
}

const KEY_PROSE: Record<string, string> = {
  marks: 'the marks drawn in order, each a mark and an encoding',
  transform: 'the steps run over the features before any mark',
  facet: 'one section per value of a field',
  rows: 'the rows: their field or order, labels, focus and tree',
  rowColor: 'the colour of each row label',
  color: 'the colour',
  baseColor: 'the per-base layer over the reads',
  arcColor: 'the colour of the arcs between mates',
  ribbonColor: 'the colour of the ribbons between lanes',
  laneLayers: 'the layers drawn over each lane',
  scales: 'the axes, scales.y the value axis',
  filter: 'the jexl: expressions a feature has to pass',
  filterBy: 'the read flags and tags a read has to pass',
}

function readDraft(host: PlotDialogHost, text: string) {
  try {
    const plot = parsePlot(text, host.plotKeys)
    const problems = host.plotProblems(plot)
    const { sets, clears } = plotChanges(plot, host.plot)
    const summary =
      [
        sets.length ? `Sets ${sets.join(', ')}` : '',
        clears.length ? `Resets ${clears.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('. ') || 'No changes'
    return { plot, problems, summary }
  } catch (error) {
    return { problems: [], error }
  }
}

const PlotDialog = observer(function PlotDialog({
  model,
  seed,
  handleClose,
}: {
  model: PlotDialogHost
  seed?: Plot
  handleClose: () => void
}) {
  const [text, setText] = useState(() =>
    JSON.stringify({ ...model.plot, ...seed }, null, 2),
  )
  const { plot, problems, summary, error } = readDraft(model, text)
  const { openPlotForm } = model

  return (
    <SubmitDialog
      open
      maxWidth="md"
      fullWidth
      title="Edit plot"
      submitText="Apply"
      submitDisabled={!plot}
      onCancel={handleClose}
      actions={
        openPlotForm ? (
          <Button
            disabled={!plot}
            onClick={() => {
              openPlotForm(plot!)
              handleClose()
            }}
          >
            Back to form
          </Button>
        ) : undefined
      }
      onSubmit={() => {
        if (plot) {
          model.applyPlot(plot)
          handleClose()
        }
      }}
    >
      <DialogContentText component="div">
        The plot as a config file writes it:
        <ul>
          {model.plotKeys.map(key => (
            <li key={key}>
              <code>{key}</code>, {KEY_PROSE[key] ?? key}
            </li>
          ))}
        </ul>
        A setting left out stays as it is, an object replaces the setting whole,
        and <code>null</code> resets it.
      </DialogContentText>
      {model.plotExamples?.length ? (
        <ul>
          {model.plotExamples.map(({ plot, description }) => (
            <li key={plot}>
              <code>{plot}</code> {description}
            </li>
          ))}
        </ul>
      ) : null}
      <MonospaceTextField
        fullWidth
        minRows={8}
        maxRows={30}
        value={text}
        error={error}
        onChange={setText}
        helperText={summary}
        inputTestId="plot-json"
      />
      {problems.length ? (
        <ul data-testid="plot-problems">
          {problems.map(problem => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
    </SubmitDialog>
  )
})

export default PlotDialog
