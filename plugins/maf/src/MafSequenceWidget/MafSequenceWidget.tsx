import React, { useEffect, useState } from 'react'

import {
  CascadingMenuButton,
  ErrorMessage,
  LoadingEllipses,
} from '@jbrowse/core/ui'
import { getSession, useLocalStorage } from '@jbrowse/core/util'
import { makeStyles } from '@jbrowse/core/util/tss-react'
import { Button, Paper } from '@mui/material'
import { observer } from 'mobx-react'

import {
  ContentCopy as CopyIcon,
  Difference as DifferenceIcon,
  Download as DownloadIcon,
  FormatColorFill as ColorBackgroundIcon,
  KeyboardArrowDown,
  Label as LabelIcon,
  PlaylistAdd as InsertionsIcon,
  Subject as AllLettersIcon,
  TableRows as TableRowsIcon,
} from '@mui/icons-material'

import SequenceDisplay from './SequenceDisplay.tsx'
import { copyToClipboard, downloadAsFile } from '../util/clipboard.ts'
import { formatFastaSequences } from '../util/formatFastaSequences.ts'

import type { MafSequenceWidgetModel } from './stateModelFactory.ts'
import type { MenuItem } from '@jbrowse/core/ui'

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

  const [showAllLetters, setShowAllLetters] = useLocalStorage(
    'mafSequenceWidget-showAllLetters',
    true,
  )
  const [includeInsertions, setIncludeInsertions] = useLocalStorage(
    'mafSequenceWidget-includeInsertions',
    false,
  )
  const [singleLineFormat, setSingleLineFormat] = useLocalStorage(
    'mafSequenceWidget-singleLineFormat',
    false,
  )
  const [colorBackground, setColorBackground] = useLocalStorage(
    'mafSequenceWidget-colorBackground',
    true,
  )
  const [showSampleNames, setShowSampleNames] = useLocalStorage(
    'mafSequenceWidget-showSampleNames',
    true,
  )
  const [rawSequences, setRawSequences] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>()

  // Fetch from server. Re-runs only when RPC inputs change. The `active`
  // flag drops the result if the effect is torn down (or re-fired) before
  // the promise resolves, avoiding a stale write to rawSequences.
  useEffect(() => {
    if (!adapterConfig || !samples || !regions) {
      return
    }
    const active = { current: true }
    setLoading(true)
    setError(undefined)
    session.rpcManager
      .call('MafSequenceWidget', 'MafGetSequences', {
        sessionId: 'MafSequenceWidget',
        adapterConfig,
        samples,
        showAllLetters,
        includeInsertions,
        regions,
      })
      .then(fastaSequence => {
        if (active.current) {
          setRawSequences(fastaSequence)
          setLoading(false)
        }
      })
      .catch((e: unknown) => {
        if (active.current) {
          console.error(e)
          setError(e)
          setLoading(false)
        }
      })
    return () => {
      active.current = false
    }
  }, [
    adapterConfig,
    samples,
    regions,
    showAllLetters,
    includeInsertions,
    session,
  ])

  if (!adapterConfig || !samples || !regions) {
    return (
      <Paper className={classes.root}>
        <div>No sequence data available</div>
      </Paper>
    )
  }

  const formattedSequence = formatFastaSequences(
    rawSequences,
    samples,
    singleLineFormat,
  )

  const sequenceTooLarge = formattedSequence.length > 5_000_000

  const menuItems: MenuItem[] = [
    {
      label: 'Show all letters',
      icon: AllLettersIcon,
      type: 'radio',
      checked: showAllLetters,
      onClick: () => {
        setShowAllLetters(true)
      },
    },
    {
      label: 'Show only differences',
      icon: DifferenceIcon,
      type: 'radio',
      checked: !showAllLetters,
      onClick: () => {
        setShowAllLetters(false)
      },
    },
    {
      label: 'Include insertions',
      icon: InsertionsIcon,
      type: 'checkbox',
      checked: includeInsertions,
      onClick: () => {
        setIncludeInsertions(!includeInsertions)
      },
    },
    {
      label: 'Single line format',
      icon: TableRowsIcon,
      type: 'checkbox',
      checked: singleLineFormat,
      onClick: () => {
        setSingleLineFormat(!singleLineFormat)
      },
    },
    {
      label: 'Color background',
      icon: ColorBackgroundIcon,
      type: 'checkbox',
      checked: colorBackground,
      onClick: () => {
        setColorBackground(!colorBackground)
      },
    },
    {
      label: 'Show sample names',
      icon: LabelIcon,
      type: 'checkbox',
      checked: showSampleNames,
      onClick: () => {
        setShowSampleNames(!showSampleNames)
      },
    },
    { type: 'divider' },
    {
      label: 'Copy to clipboard',
      icon: CopyIcon,
      disabled: loading || !formattedSequence,
      onClick: () => {
        copyToClipboard(
          formattedSequence,
          () => {
            session.notify('Sequence copied to clipboard', 'info')
          },
          e => {
            session.notifyError(`${e}`, e)
          },
        ).catch((e: unknown) => {
          console.error(e)
        })
      },
    },
    {
      label: 'Download as FASTA',
      icon: DownloadIcon,
      disabled: loading || !formattedSequence,
      onClick: () => {
        downloadAsFile(
          formattedSequence,
          'sequence.fasta',
          () => {
            session.notify('Sequence downloaded', 'info')
          },
          e => {
            session.notifyError(`${e}`, e)
          },
        )
      },
    },
  ]

  return (
    <Paper className={classes.root}>
      <div className={classes.controls}>
        <CascadingMenuButton
          menuItems={menuItems}
          ButtonComponent={props => (
            <Button
              {...props}
              variant="contained"
              size="small"
              endIcon={<KeyboardArrowDown />}
            >
              Actions
            </Button>
          )}
        />
      </div>

      {error ? (
        <ErrorMessage error={error} />
      ) : (
        <>
          {loading ? (
            <LoadingEllipses />
          ) : sequenceTooLarge ? (
            <div>
              Reference sequence too large to display, use the Download button
            </div>
          ) : (
            <SequenceDisplay
              model={model}
              sequences={rawSequences}
              colorBackground={colorBackground}
              showSampleNames={showSampleNames}
            />
          )}
        </>
      )}
    </Paper>
  )
})

export default MafSequenceWidget
