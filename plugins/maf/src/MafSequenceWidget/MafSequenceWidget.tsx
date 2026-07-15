import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import { getSession, useFetch } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import MafSequenceWidgetMenu from './MafSequenceWidgetMenu.tsx'
import SequenceDisplay from './SequenceDisplay.tsx'
import { useMafSequenceSettings } from './useMafSequenceSettings.ts'
import { formatFastaSequences } from '../util/formatFastaSequences.ts'

import type { MafSequenceWidgetModel } from './stateModelFactory.ts'

const MAX_DISPLAY_LENGTH = 5_000_000

const useStyles = makeStyles()(theme => ({
  root: {
    padding: theme.spacing(2),
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    marginBottom: theme.spacing(2),
  },
}))

const MafSequenceWidget = observer(function MafSequenceWidget({
  model,
}: {
  model: MafSequenceWidgetModel
}) {
  const { classes } = useStyles()
  const session = getSession(model)
  const { adapterConfig, samples, regions } = model
  const settings = useMafSequenceSettings()
  const { showAllLetters, includeInsertions, singleLineFormat } = settings

  // Fetch from server via SWR: keyed on the RPC inputs, so it refetches when
  // they change, dedupes/caches across reopens, and a null key skips the call
  // until the inputs are present. SWR drops stale resolutions for us, so no
  // manual cancellation flag is needed.
  const { data, error } = useFetch(
    adapterConfig && samples && regions
      ? ([
          'MafGetSequences',
          adapterConfig,
          samples,
          regions,
          showAllLetters,
          includeInsertions,
        ] as const)
      : null,
    // Destructure from the key tuple (not the outer scope): the null-key
    // ternary above has already narrowed away `undefined` for these inputs.
    ([, adapterConfig, samples, regions, showAllLetters, includeInsertions]) =>
      session.rpcManager.call('MafSequenceWidget', 'MafGetSequences', {
        adapterConfig,
        samples,
        showAllLetters,
        includeInsertions,
        regions,
      }),
  )
  const loading = !data && !error
  const rawSequences = data?.rows ?? []
  const colToGenomePos = data?.colToGenomePos ?? []

  // Rebuilding the full FASTA string is expensive on large alignments, but the
  // React Compiler memoizes this derivation, so no manual useMemo is needed.
  const formattedSequence = formatFastaSequences(
    rawSequences,
    samples,
    singleLineFormat,
  )
  const sequenceTooLarge = formattedSequence.length > MAX_DISPLAY_LENGTH

  return !adapterConfig || !samples || !regions ? (
    <Paper className={classes.root}>
      <div>No sequence data available</div>
    </Paper>
  ) : (
    <Paper className={classes.root}>
      <div className={classes.controls}>
        <MafSequenceWidgetMenu
          model={model}
          settings={settings}
          formattedSequence={formattedSequence}
          loading={loading}
        />
      </div>

      {error ? (
        <ErrorMessage error={error} />
      ) : loading ? (
        <LoadingEllipses />
      ) : sequenceTooLarge ? (
        <div>
          Reference sequence too large to display, use the Download button
        </div>
      ) : (
        <SequenceDisplay
          model={model}
          sequences={rawSequences}
          colToGenomePos={colToGenomePos}
          colorBackground={settings.colorBackground}
          showSampleNames={settings.showSampleNames}
        />
      )}
    </Paper>
  )
})

export default MafSequenceWidget
