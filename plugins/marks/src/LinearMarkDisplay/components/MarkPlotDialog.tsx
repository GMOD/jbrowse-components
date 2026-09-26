import { useMemo, useRef, useState } from 'react'

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
  withListMember,
  withMarkType,
  withScaleMember,
  withoutChannel,
} from '../markEdit.ts'
import { markPlotProblems, markPlotSettingsWritten } from '../markPlot.ts'
import { markProblemIndex } from '../markProblemIndex.ts'
import { MARK_TYPES } from '../markVocabulary.ts'
import { stepWrittenFields, stepsOfMark, withSteps } from '../plotEdit.ts'
import MarkFieldPicker from './MarkFieldPicker.tsx'
import MarkList from './MarkList.tsx'
import { MarkProblemList } from './MarkProblems.tsx'
import MarkScaleRow from './MarkScaleRow.tsx'
import MarkSteps from './MarkSteps.tsx'
import PlotSettings from './PlotSettings.tsx'

import type { DraftMark, EditChannel } from '../markEdit.ts'
import type { MarkPlot, MarkPlotSettings } from '../markPlot.ts'
import type { StepSnapshot } from '../markProblems.ts'
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
 * What the rules say about the draft. A draft the lift refuses holds Apply and
 * says why rather than throwing at the reader.
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

// The steps that run before every mark, as the draft holds them.
function sharedSteps(plot: MarkPlot): StepSnapshot[] {
  const facet = plot.facet
  return [
    ...stepsOfMark({ transform: plot.transform } as DraftMark),
    ...(typeof facet === 'object' && facet !== null
      ? stepsOfMark({
          transform: (facet as { transform?: unknown }).transform,
        } as DraftMark)
      : []),
  ]
}

/**
 * The fields a channel can name: what the scanned features carry, and what
 * the steps before the mark write, since a count or a coverage is a field the
 * features never had.
 */
function fieldsFor(fields: PlotFields, written: readonly string[]): PlotFields {
  const numeric = [...new Set([...fields.numeric, ...written])]
  return { ...fields, numeric }
}

const MarkPlotDialog = observer(function MarkPlotDialog({
  model,
  seed,
  handleClose,
}: {
  model: MarkPlotDialogModel
  seed?: MarkPlot
  handleClose: () => void
}) {
  const [plot, setPlot] = useState<MarkPlot>(() => ({
    ...model.markPlot,
    ...seed,
  }))
  const marks = draftMarks(plot)
  const [selected, setSelected] = useState(0)
  const editing = useRef<{ at: number; channel: EditChannel; base: unknown }>(
    undefined,
  )
  const scanned = model.plotFields ?? NO_FIELDS
  // Once per change, not once per render: the lift builds a whole config tree,
  // and a control's every keystroke re-renders the dialog around it.
  const { problems, error } = useMemo(
    () => readDraft(model, plot),
    [model, plot],
  )
  const at = Math.min(selected, marks.length - 1)
  const mark = marks[at]
  const setMarks = (next: DraftMark[]) => {
    setPlot({ ...plot, marks: next })
  }
  const write = (next: DraftMark) => {
    setMarks(marks.with(at, next))
  }
  const shared = sharedSteps(plot)
  const fields = fieldsFor(
    scanned,
    stepWrittenFields([...shared, ...(mark ? stepsOfMark(mark) : [])]),
  )
  const plotOptions = [...scanned.categorical, ...scanned.numeric]

  return (
    <SubmitDialog
      open
      maxWidth="lg"
      fullWidth
      title="Edit plot"
      submitText="Apply"
      submitDisabled={error !== undefined}
      onCancel={handleClose}
      onSubmit={() => {
        model.applyDisplaySettings(
          markPlotSettingsWritten(plot, model.markPlot),
        )
        handleClose()
      }}
      actions={
        <Button
          onClick={() => {
            model.openPlotJsonDialog(plot)
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
          ? ` Fields are the ones features in ${model.plotScanLocus} carry, and the ones a mark's steps write.`
          : null}
      </Typography>
      <PlotSettings
        plot={plot}
        options={plotOptions}
        problems={problems}
        onChange={setPlot}
      />
      <Divider style={{ margin: '8px 0' }} />
      <div style={{ display: 'flex', gap: 16 }}>
        <div style={{ flex: '0 0 35%' }}>
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
            <MarkSteps
              key={at}
              steps={stepsOfMark(mark)}
              at={at}
              problems={problems}
              onChange={steps => {
                write(withSteps(mark, steps))
              }}
            />
            {editChannels(markTypeOf(mark)).map(channel => (
              <div key={channel}>
                <MarkFieldPicker
                  channel={channel}
                  edit={channelEdit(mark, channel)}
                  fields={fields}
                  problems={problems.under(at, `encoding.${channel}`)}
                  onEditStart={() => {
                    editing.current = {
                      at,
                      channel,
                      base: mark.encoding?.[channel],
                    }
                  }}
                  onEditEnd={() => {
                    editing.current = undefined
                  }}
                  onChange={value => {
                    const held = editing.current
                    write(
                      held?.at === at && held.channel === channel
                        ? withChannel(mark, channel, value, fields, held.base)
                        : withChannel(mark, channel, value, fields),
                    )
                  }}
                />
                <MarkScaleRow
                  key={`${at}-${channel}`}
                  mark={mark}
                  channel={channel}
                  scales={channelScales(channel)}
                  onScale={scale => {
                    write(withChannelScale(mark, channel, scale))
                  }}
                  onMember={(member, value) => {
                    write(withScaleMember(mark, channel, member, value))
                  }}
                  onList={(member, text) => {
                    write(withListMember(mark, channel, member, text))
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
