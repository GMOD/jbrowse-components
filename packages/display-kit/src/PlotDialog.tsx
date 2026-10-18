import { useState } from 'react'

import { parsePlot, plotOf } from '@jbrowse/core/configuration'
import {
  ExternalLink,
  MonospaceTextField,
  SubmitDialog,
} from '@jbrowse/core/ui'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import {
  Button,
  Collapse,
  DialogContentText,
  Tooltip,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import type {
  AnyConfigurationModel,
  Plot,
  PlotExample,
  PlotWriteOptions,
} from '@jbrowse/core/configuration'

export interface PlotDialogHost {
  plotKeys: string[]
  plot: Plot
  /** A draft as the config would hold it; throws a refusal. */
  liftPlot: (draft: Plot) => AnyConfigurationModel
  /** Throws what a config file would be refused for. */
  plotProblems: (draft: Plot, options?: PlotWriteOptions) => string[]
  /** What applying would write, by setting, `null` for a reset. */
  plotWrites: (
    draft: Plot,
    options?: PlotWriteOptions,
  ) => Record<string, unknown>
  applyPlot: (draft: Plot, options?: PlotWriteOptions) => void
  /** The display type's worked examples, each a button filling the text. */
  plotExamples: readonly PlotExample[]
  /** The display type's page in the config reference. */
  configDocsUrl: string
  /** A form over the same settings, opened on the draft. */
  openPlotForm?: (draft: Plot) => void
}

const EDIT_PLOT_GUIDE = 'https://jbrowse.org/jb2/docs/user_guides/edit_plot/'

const useStyles = makeStyles()(theme => ({
  links: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
  },
  examples: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: theme.spacing(1),
    marginBlock: theme.spacing(1),
  },
}))

// The text is the whole plot: a line deleted from it resets that setting.
const WHOLE: PlotWriteOptions = { whole: true }

// A draft laid over the plot as a settings bag lands, so the text shows
// everything applying it leaves in place, a filter's other tests included.
// A draft the schema refuses lands key by key instead, so the box shows it and
// says why under it.
function plotText(host: PlotDialogHost, draft?: Plot) {
  let plot = host.plot
  if (draft) {
    try {
      plot = plotOf(host.liftPlot(draft))
    } catch {
      plot = { ...host.plot, ...draft }
    }
  }
  return JSON.stringify(plot, null, 2)
}

function readDraft(host: PlotDialogHost, text: string) {
  try {
    const plot = parsePlot(text, host.plotKeys)
    const problems = host.plotProblems(plot, WHOLE)
    const writes = Object.entries(host.plotWrites(plot, WHOLE))
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
  const [text, setText] = useState(() => plotText(model, seed))
  const [showHelp, setShowHelp] = useState(false)
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
          model.applyPlot(plot, WHOLE)
          handleClose()
        }
      }}
    >
      <div className={classes.links}>
        <ExternalLink href={EDIT_PLOT_GUIDE}>User guide</ExternalLink>
        <ExternalLink href={model.configDocsUrl}>Config reference</ExternalLink>
        <Button
          size="small"
          onClick={() => {
            setShowHelp(!showHelp)
          }}
        >
          {showHelp ? 'Hide help' : 'Show help'}
        </Button>
      </div>
      <Collapse in={showHelp}>
        <DialogContentText component="div">
          The plot as a config file writes it, each setting linked to its entry
          in the config reference:
          <ul>
            {model.plotKeys.map(key => (
              <li key={key}>
                <ExternalLink
                  href={`${model.configDocsUrl}#slot-${key.toLowerCase()}`}
                >
                  <code>{key}</code>
                </ExternalLink>
              </li>
            ))}
          </ul>
          The text is the whole plot: a setting or member deleted from it
          returns to its default. An example lands over the plot as it stands,
          so the text keeps what the example leaves alone.
        </DialogContentText>
      </Collapse>
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
                  setText(plotText(model, JSON.parse(example.plot)))
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
