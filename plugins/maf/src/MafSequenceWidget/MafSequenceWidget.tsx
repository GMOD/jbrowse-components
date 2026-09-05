import { isRegionRefused } from '@jbrowse/core/rpc/byteBudget'
import { ErrorMessage, LoadingEllipses } from '@jbrowse/core/ui'
import {
  getBpDisplayStr,
  getSession,
  statusProgressLabel,
  toLocale,
} from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { useFetch } from '@jbrowse/core/util/useFetch'
import { Paper } from '@mui/material'
import { observer } from 'mobx-react'

import { formatFastaSequences } from '../util/formatFastaSequences.ts'
import MafSequenceWidgetMenu from './MafSequenceWidgetMenu.tsx'
import SequenceDisplay from './SequenceDisplay.tsx'
import { useMafSequenceSettings } from './useMafSequenceSettings.ts'

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
  const { adapterConfig, byteLimit, samples, regions } = model
  const settings = useMafSequenceSettings()
  const { showAllLetters, includeInsertions, singleLineFormat } = settings

  // Keyed on the RPC inputs, so it refetches when they change and a null key
  // skips the call until the inputs are present. useFetch drops stale
  // resolutions for us, so no manual cancellation flag is needed.
  const { data, error, status } = useFetch(
    adapterConfig && samples && regions
      ? ([
          'MafGetSequences',
          adapterConfig,
          samples,
          regions,
          showAllLetters,
          includeInsertions,
          byteLimit,
        ] as const)
      : null,
    // Read the key tuple (not the outer scope): the null-key ternary above has
    // already narrowed away `undefined` for these inputs. useFetch spreads an
    // array key across the fetcher's parameters, so these are positional — a
    // single array-destructured parameter would bind only the leading key name
    // and slice characters out of it.
    (
      _name,
      adapterConfig,
      samples,
      regions,
      showAllLetters,
      includeInsertions,
      byteLimit,
      stopToken,
      statusCallback,
    ) =>
      session.rpcManager.call('MafSequenceWidget', 'MafGetSequences', {
        adapterConfig,
        samples,
        showAllLetters,
        includeInsertions,
        regions,
        byteLimit,
        stopToken,
        statusCallback,
      }),
  )
  const loading = !data && !error
  // The worker measures the alignment index before it reads, and answers this
  // instead of a payload when the span is over the display's budget. Refusing
  // is the point — the read it declined preallocates one byte per sample per
  // base, so it is the download AND the worker's heap that were unbounded.
  const refused = data && isRegionRefused(data) ? data : undefined
  const fasta = data && !isRegionRefused(data) ? data : undefined
  const rawSequences = fasta?.rows ?? []
  const colToGenomePos = fasta?.colToGenomePos ?? []

  // Rebuilding the full FASTA string is expensive on large alignments, but the
  // React Compiler memoizes this derivation, so no manual useMemo is needed.
  const formattedSequence = formatFastaSequences(
    rawSequences,
    samples,
    singleLineFormat,
  )
  const sequenceTooLarge = formattedSequence.length > MAX_DISPLAY_LENGTH
  const region = regions?.[0]

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
        <LoadingEllipses message={statusProgressLabel(status)} />
      ) : refused ? (
        <div>
          Too much alignment to fetch
          {region ? ` over ${getBpDisplayStr(region.end - region.start)}` : ''}
          {refused.bytes === undefined
            ? ''
            : ` (${toLocale(refused.bytes)} bytes)`}
          . Zoom in, or use &ldquo;Force load&rdquo; on the track and reopen
          this.
        </div>
      ) : sequenceTooLarge ? (
        <div>
          {/* "Reference sequence" and "the Download button" both came over from
              `GetSequenceDialog`, where the first is accurate and the second
              names a control that exists. Here it is every sample's row, not
              the reference's, and the control is a menu item — so the message
              described neither what was too big nor where to go next.
              `region` is the widget's single selection (`openSubsequenceWidget`
              passes exactly one), read defensively so the message degrades
              rather than throws if one is ever absent. */}
          Alignment too large to display ({samples.length} samples
          {region ? ` over ${getBpDisplayStr(region.end - region.start)}` : ''}
          ). Use &ldquo;Download as FASTA&rdquo; in the menu above.
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
