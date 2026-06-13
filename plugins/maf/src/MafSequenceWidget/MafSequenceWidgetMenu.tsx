import { CascadingMenuButton } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import { Button } from '@mui/material'
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

import { copyToClipboard, downloadAsFile } from '../util/clipboard.ts'

import type { MafSequenceWidgetModel } from './stateModelFactory.ts'
import type { MafSequenceSettings } from './useMafSequenceSettings.ts'

const MafSequenceWidgetMenu = observer(function MafSequenceWidgetMenu({
  model,
  settings,
  formattedSequence,
  loading,
}: {
  model: MafSequenceWidgetModel
  settings: MafSequenceSettings
  formattedSequence: string
  loading: boolean
}) {
  const session = getSession(model)
  const {
    showAllLetters,
    setShowAllLetters,
    includeInsertions,
    setIncludeInsertions,
    singleLineFormat,
    setSingleLineFormat,
    colorBackground,
    setColorBackground,
    showSampleNames,
    setShowSampleNames,
  } = settings

  return (
    <CascadingMenuButton
      menuItems={() => [
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
      ]}
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
  )
})

export default MafSequenceWidgetMenu
