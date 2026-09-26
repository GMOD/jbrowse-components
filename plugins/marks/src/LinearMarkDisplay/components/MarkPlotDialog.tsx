import { useMemo, useState } from 'react'

import { SubmitDialog } from '@jbrowse/core/ui'
import { Button, Divider, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import {
  channelEdit,
  channelScales,
  draftMarks,
  editChannels,
  markTypeOf,
  unreadChannels,
  withChannel,
  withChannelScale,
  withMarkType,
  withScaleMember,
  withoutChannel,
} from '../markEdit.ts'
import { markPlotProblems, markPlotSettingsWritten } from '../markPlot.ts'
import { markProblemIndex } from '../markProblemIndex.ts'
import { MARK_TYPES } from '../markVocabulary.ts'
import MarkFieldPicker from './MarkFieldPicker.tsx'
import MarkList from './MarkList.tsx'
import { MarkProblemList } from './MarkProblems.tsx'
import MarkScaleRow from './MarkScaleRow.tsx'

import type { DraftMark } from '../markEdit.ts'
import type { MarkPlot, MarkPlotSettings } from '../markPlot.ts'
import type { MarkType } from '../markVocabulary.ts'
import type { PlotFields } from '../scanPlotFields.ts'

const NO_FIELDS: PlotFields = { numeric: [], categorical: [] }

export interface MarkPlotDialogModel {
  markPlot: MarkPlot
  plotFields: PlotFields | undefined
  plotScanLocus: string | undefined
  liftMarkPlot: (plot: MarkPlot) => MarkPlotSettings
  applyDisplaySettings: (settings: Record<string, unknown>) => unknown
  openPlotJsonDialog: (seed?: MarkPlot) => void
}

/**
 * What the rules say about the draft. The controls write free text — a shape
 * picker takes a name the enumeration does not have — so the lift can refuse,
 * and the form says so and holds Apply rather than throwing at the reader.
 */
function readDraft(model: MarkPlotDialogModel, draft: MarkPlot) {
  try {
    return {
      problems: markProblemIndex(markPlotProblems(model.liftMarkPlot(draft))),
    }
  } catch (error) {
    return { problems: markProblemIndex([]), error }
  }
}

function zoomField(
  label: string,
  value: number | undefined,
  onChange: (value: number | undefined) => void,
) {
  return (
    <TextField
      type="number"
      label={label}
      value={value ?? ''}
      onChange={event => {
        const { value } = event.target
        onChange(value === '' ? undefined : Number(value))
      }}
      slotProps={{ htmlInput: { 'data-testid': label } }}
    />
  )
}

const MarkPlotDialog = observer(function MarkPlotDialog({
  model,
  handleClose,
}: {
  model: MarkPlotDialogModel
  handleClose: () => void
}) {
  const [marks, setMarks] = useState(() => draftMarks(model.markPlot))
  const [selected, setSelected] = useState(0)
  const fields = model.plotFields ?? NO_FIELDS
  const draft: MarkPlot = { marks }
  // Once per change, not once per render: the lift builds a whole config tree,
  // and a control's every keystroke re-renders the dialog around it.
  const { problems, error } = useMemo(
    () => readDraft(model, { marks }),
    [model, marks],
  )
  const at = Math.min(selected, marks.length - 1)
  const mark = marks[at]
  const write = (next: DraftMark) => {
    setMarks(marks.with(at, next))
  }

  return (
    <SubmitDialog
      open
      maxWidth="md"
      fullWidth
      title="Edit plot"
      submitText="Apply"
      submitDisabled={error !== undefined}
      onCancel={handleClose}
      onSubmit={() => {
        model.applyDisplaySettings(
          markPlotSettingsWritten(draft, model.markPlot),
        )
        handleClose()
      }}
      actions={
        <Button
          onClick={() => {
            model.openPlotJsonDialog(draft)
            handleClose()
          }}
        >
          Edit as JSON...
        </Button>
      }
    >
      <Typography color="text.secondary">
        Marks draw in order, a later one over an earlier one.
        {model.plotScanLocus
          ? ` Fields are the ones features in ${model.plotScanLocus} carry.`
          : null}
      </Typography>
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: '0 0 40%' }}>
          <MarkList
            marks={marks}
            selected={at}
            problems={problems}
            onSelect={setSelected}
            onChange={setMarks}
          />
        </div>
        {mark ? (
          <div style={{ flex: 1 }}>
            <TextField
              select
              fullWidth
              label="Mark"
              value={markTypeOf(mark)}
              onChange={event => {
                write(withMarkType(mark, event.target.value as MarkType))
              }}
              slotProps={{
                select: { native: true },
                htmlInput: { 'data-testid': 'mark-type' },
              }}
            >
              {MARK_TYPES.map(type => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </TextField>
            {editChannels(markTypeOf(mark)).map(channel => (
              <div key={channel}>
                <MarkFieldPicker
                  channel={channel}
                  edit={channelEdit(mark, channel)}
                  fields={fields}
                  problems={problems.under(at, `encoding.${channel}`)}
                  onChange={value => {
                    write(withChannel(mark, channel, value, fields))
                  }}
                />
                <MarkScaleRow
                  mark={mark}
                  channel={channel}
                  scales={channelScales(channel)}
                  onScale={scale => {
                    write(withChannelScale(mark, channel, scale))
                  }}
                  onMember={(member, value) => {
                    write(withScaleMember(mark, channel, member, value))
                  }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8 }}>
              {zoomField('minBpPerPx', mark.minBpPerPx, value => {
                write({ ...mark, minBpPerPx: value })
              })}
              {zoomField('maxBpPerPx', mark.maxBpPerPx, value => {
                write({ ...mark, maxBpPerPx: value })
              })}
            </div>
            <MarkProblemList problems={problems.under(at, 'minBpPerPx')} />
            <UnreadChannels mark={mark} onWrite={write} />
          </div>
        ) : (
          <Typography style={{ flex: 1 }} color="text.secondary">
            No marks, so this track draws nothing. Add one.
          </Typography>
        )}
      </div>
      {error ? (
        <Typography color="error" data-testid="mark-plot-error">
          {`${error}`}
        </Typography>
      ) : null}
      <MarkProblemList problems={problems.display} />
    </SubmitDialog>
  )
})

/**
 * Channels the mark still writes that its type stopped reading. They are shown
 * rather than dropped: a form that quietly discarded them would be the failure
 * the whole editor exists to avoid, and the rule list already says what each
 * one costs.
 */
function UnreadChannels({
  mark,
  onWrite,
}: {
  mark: DraftMark
  onWrite: (mark: DraftMark) => void
}) {
  const unread = unreadChannels(mark)
  return unread.length > 0 ? (
    <>
      <Divider />
      <Typography variant="caption" color="text.secondary">
        A {markTypeOf(mark)} does not read these, and they are kept until you
        clear them.
      </Typography>
      {unread.map(channel => (
        <div key={channel}>
          {channel}: {channelEdit(mark, channel).value}
          <Button
            onClick={() => {
              onWrite(withoutChannel(mark, channel))
            }}
          >
            Clear
          </Button>
        </div>
      ))}
    </>
  ) : null
}

export default MarkPlotDialog
