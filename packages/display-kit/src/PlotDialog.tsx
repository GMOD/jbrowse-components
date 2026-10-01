import { useState } from 'react'

import { PLOT_VOCABULARY, parsePlot } from '@jbrowse/core/configuration'
import {
  ExternalLink,
  MonospaceTextField,
  SubmitDialog,
} from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, DialogContentText, Tooltip, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { Plot, PlotExample } from '@jbrowse/core/configuration'

export interface PlotDialogHost {
  plotKeys: string[]
  plot: Plot
  /** Throws what a config file would be refused for. */
  plotProblems: (draft: Plot) => string[]
  /** What applying would write, by setting, `null` for a reset. */
  plotWrites: (draft: Plot) => Record<string, unknown>
  applyPlot: (draft: Plot) => void
  /** The display type's worked examples, each a button filling the text. */
  plotExamples: readonly PlotExample[]
  /** The display type's page in the config reference. */
  configDocsUrl: string
  /** A form over the same settings, opened on the draft. */
  openPlotForm?: (draft: Plot) => void
}

const EDIT_PLOT_GUIDE = 'https://jbrowse.org/jb2/docs/user_guides/edit_plot/'

const useStyles = makeStyles()(theme => ({
  examples: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBlock: theme.spacing(1),
  },
}))

// An example over the plot as it stands, so the text shows everything that
// applying it would leave in place.
function withExample(plot: Plot, example: PlotExample) {
  return JSON.stringify({ ...plot, ...JSON.parse(example.plot) }, null, 2)
}

function readDraft(host: PlotDialogHost, text: string) {
  try {
    const plot = parsePlot(text, host.plotKeys)
    const problems = host.plotProblems(plot)
    const writes = Object.entries(host.plotWrites(plot))
    const sets = writes.filter(([, v]) => v !== null).map(([k]) => k)
    const clears = writes.filter(([, v]) => v === null).map(([k]) => k)
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
  const { classes } = useStyles()
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
              <code>{key}</code>, {PLOT_VOCABULARY[key]}
            </li>
          ))}
        </ul>
        A setting left out stays as it is, an object replaces the setting whole,
        and <code>null</code> resets it.{' '}
        <ExternalLink href={model.configDocsUrl}>
          Every setting this display takes
        </ExternalLink>
        {' · '}
        <ExternalLink href={EDIT_PLOT_GUIDE}>How Edit plot works</ExternalLink>
      </DialogContentText>
      {model.plotExamples.length ? (
        <div className={classes.examples}>
          <Typography variant="body2" color="text.secondary">
            Examples:
          </Typography>
          {model.plotExamples.map(example => (
            <Tooltip key={example.plot} title={<code>{example.plot}</code>}>
              <Button
                size="small"
                variant="outlined"
                sx={{ textTransform: 'none' }}
                onClick={() => {
                  setText(withExample(model.plot, example))
                }}
              >
                {example.description}
              </Button>
            </Tooltip>
          ))}
        </div>
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
