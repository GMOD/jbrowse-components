import { useState } from 'react'

import { LabeledCheckbox, SubmitDialog } from '@jbrowse/core/ui'
import { Button, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import type { LaneChoice, LaneSelectionModel } from '../menus.ts'

export interface LaneSelectionDialogModel extends Omit<
  LaneSelectionModel,
  'openLaneSelection'
> {
  hiddenLanes: readonly string[]
  setHiddenLanes: (names: string[]) => void
  /** whether two spellings name one lane, as the stack compares them */
  isSameLane: (a: string, b: string) => boolean
}

function matchesFilter(lane: LaneChoice, filter: string) {
  const needle = filter.trim().toLowerCase()
  return (
    needle === '' ||
    lane.name.toLowerCase().includes(needle) ||
    (lane.label ?? '').toLowerCase().includes(needle) ||
    (lane.group ?? '').toLowerCase().includes(needle)
  )
}

/**
 * Lanes in the order the universe gives them, cut into runs by `group` so a
 * sample's haplotypes sit under one heading; lanes without a group form runs
 * headed by nothing.
 */
export function laneRuns(lanes: LaneChoice[]) {
  const runs: { group: string | undefined; lanes: LaneChoice[] }[] = []
  for (const lane of lanes) {
    const last = runs.at(-1)
    if (last && last.group === lane.group) {
      last.lanes.push(lane)
    } else {
      runs.push({ group: lane.group, lanes: [lane] })
    }
  }
  return runs
}

function laneCaption(lane: LaneChoice) {
  const alias =
    lane.label !== undefined && lane.label !== lane.name
      ? ` (${lane.label})`
      : ''
  return `${lane.name}${alias}`
}

/**
 * Which lanes to draw, out of every lane the source offers. Opens on the lanes
 * the stack draws: the selection in force, or every lane, less the hidden ones.
 * Submit unhides what is ticked and writes the ticked set back, keeping chosen
 * lanes this window does not place; ticking every lane writes no selection at
 * all, so lanes the source places later are not shut out. Reset drops the
 * selection and unhides every lane.
 */
const LaneSelectionDialog = observer(function LaneSelectionDialog({
  model,
  handleClose,
}: {
  model: LaneSelectionDialogModel
  handleClose: () => void
}) {
  const { laneUniverse, laneSelection, hiddenLanes } = model
  const among = (names: readonly string[], name: string) =>
    names.some(other => model.isSameLane(other, name))
  const [chosen, setChosen] = useState(
    () =>
      new Set(
        laneUniverse
          .filter(
            lane =>
              (laneSelection === undefined ||
                among(laneSelection, lane.name)) &&
              !among(hiddenLanes, lane.name),
          )
          .map(lane => lane.name),
      ),
  )
  const [filter, setFilter] = useState('')
  const shown = laneUniverse.filter(lane => matchesFilter(lane, filter))
  const setShown = (ticked: boolean) => {
    const next = new Set(chosen)
    for (const lane of shown) {
      if (ticked) {
        next.add(lane.name)
      } else {
        next.delete(lane.name)
      }
    }
    setChosen(next)
  }
  const unplaced = laneUniverse.some(lane => !lane.placed)
  return (
    <SubmitDialog
      open
      maxWidth="sm"
      fullWidth
      title="Choose lanes"
      submitText="Draw these lanes"
      submitDisabled={chosen.size === 0}
      onSubmit={() => {
        const ticked = laneUniverse
          .filter(lane => chosen.has(lane.name))
          .map(lane => lane.name)
        const stillHidden = hiddenLanes.filter(name => !among(ticked, name))
        // an unticked lane that stays hidden needs no selection to keep it out
        const kept = laneUniverse
          .filter(
            lane => chosen.has(lane.name) || among(stillHidden, lane.name),
          )
          .map(lane => lane.name)
        const offWindow = (laneSelection ?? []).filter(
          name => !laneUniverse.some(lane => model.isSameLane(lane.name, name)),
        )
        model.setHiddenLanes(stillHidden)
        model.setSelectedLanes(
          kept.length === laneUniverse.length
            ? undefined
            : [...kept, ...offWindow],
        )
        handleClose()
      }}
      onCancel={() => {
        handleClose()
      }}
      onReset={() => {
        model.setHiddenLanes([])
        model.setSelectedLanes(undefined)
        handleClose()
      }}
      resetText="Every lane"
    >
      <Typography variant="body2" gutterBottom>
        {chosen.size} of {laneUniverse.length} lanes chosen
        {unplaced
          ? '. A lane in grey places nothing in the current window'
          : ''}
      </Typography>
      <TextField
        fullWidth
        size="small"
        placeholder="Filter lanes"
        value={filter}
        onChange={event => {
          setFilter(event.target.value)
        }}
      />
      <div style={{ margin: '8px 0' }}>
        <Button
          size="small"
          onClick={() => {
            setShown(true)
          }}
        >
          Tick shown
        </Button>
        <Button
          size="small"
          onClick={() => {
            setShown(false)
          }}
        >
          Untick shown
        </Button>
      </div>
      <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
        {laneRuns(shown).map(run => (
          <div key={run.lanes[0]!.name}>
            {run.group === undefined ? null : (
              <Typography variant="subtitle2">{run.group}</Typography>
            )}
            {run.lanes.map(lane => (
              <div
                key={lane.name}
                style={{
                  paddingLeft: run.group === undefined ? 0 : 16,
                  opacity: lane.placed ? 1 : 0.6,
                }}
              >
                <LabeledCheckbox
                  size="small"
                  label={laneCaption(lane)}
                  checked={chosen.has(lane.name)}
                  onChange={ticked => {
                    const next = new Set(chosen)
                    if (ticked) {
                      next.add(lane.name)
                    } else {
                      next.delete(lane.name)
                    }
                    setChosen(next)
                  }}
                />
              </div>
            ))}
          </div>
        ))}
      </div>
    </SubmitDialog>
  )
})

export default LaneSelectionDialog
