import { CascadingMenuButton } from '@jbrowse/core/ui'
import { getSession } from '@jbrowse/core/util'
import ContentCopy from '@mui/icons-material/ContentCopy'
import Difference from '@mui/icons-material/Difference'
import DownloadIcon from '@mui/icons-material/Download'
import ColorBackgroundIcon from '@mui/icons-material/FormatColorFill'
import KeyboardArrowDown from '@mui/icons-material/KeyboardArrowDown'
import LabelIcon from '@mui/icons-material/Label'
import InsertionsIcon from '@mui/icons-material/PlaylistAdd'
import AllLettersIcon from '@mui/icons-material/Subject'
import TableRowsIcon from '@mui/icons-material/TableRows'
import { Button } from '@mui/material'
import { observer } from 'mobx-react'

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
          icon: Difference,
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
          icon: ContentCopy,
          disabled: loading || !formattedSequence,
          onClick: () => {
            // copyToClipboard handles its own errors via onError and never
            // rejects, so `void` rather than a dead `.catch`.
            void copyToClipboard(
              formattedSequence,
              () => {
                session.notify('Sequence copied to clipboard', 'info')
              },
              e => {
                session.notifyError(`${e}`, e)
              },
            )
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
