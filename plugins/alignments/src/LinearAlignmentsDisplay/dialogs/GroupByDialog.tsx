import { useState } from 'react'

import { ErrorBanner, SubmitDialog } from '@jbrowse/core/ui'
import { getContainingView, useDebounce, useFetch } from '@jbrowse/core/util'
import {
  Checkbox,
  FormControlLabel,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { getUniqueTags } from '../../shared/getUniqueTags.ts'
import { GROUP_BY_DIMENSIONS } from '../../shared/groupFeatures.ts'
import { TAG_REGEX } from '../../shared/util.ts'

import type {
  ColorBy,
  FilterBy,
  GroupBy,
  GroupByType,
} from '../../shared/types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// In-track stacked grouping covers every group-key generator, derived straight
// from the shared dimension registry so the menu can't drift from the worker's
// key generators / chain-consistency classification.
const STACK_DIMENSIONS = Object.values(GROUP_BY_DIMENSIONS)
// Linked-read (chain) mode partitions whole chains, so it only offers the
// chain-consistent dimensions where every read of a chain shares one key — the
// same `chainConsistent` flag the worker's partition guard reads.
const CHAIN_STACK_DIMENSIONS = STACK_DIMENSIONS.filter(d => d.chainConsistent)

// What the group-by feature needs from the display model. Shared with the
// track-menu item (getGroupByMenuItem) so the dialog and the menu can't disagree
// about the model surface they depend on.
export type GroupByModel = {
  adapterConfig: AnyConfigurationModel
  configuration: AnyConfigurationModel
  colorBy: ColorBy
  filterBy: FilterBy
  groupBy?: GroupBy
  isChainMode: boolean
  setGroupBy: (groupBy?: GroupBy) => void
  setColorScheme: (colorBy: ColorBy) => void
} & IAnyStateTreeNode

const GroupByDialog = observer(function GroupByDialog(props: {
  model: GroupByModel
  handleClose: () => void
}) {
  const { model, handleClose } = props
  // Pre-fill from the active grouping so reopening the dialog reflects (and can
  // tweak) the current dimension rather than resetting to blank.
  const [groupByTag, setGroupByTag] = useState(model.groupBy?.tag ?? '')
  const [type, setType] = useState(model.groupBy?.type)
  // Grouping by a tag almost always pairs with coloring by it (e.g. HP
  // haplotype), so the checkbox defaults on. The one case it opens unchecked is
  // when reads are already colored by a *different* tag, so reopening doesn't
  // silently clobber that unrelated scheme.
  const [colorByTag, setColorByTag] = useState(
    model.colorBy.type !== 'tag' || model.colorBy.tag === model.groupBy?.tag,
  )

  const isInvalid = groupByTag.length === 2 && !TAG_REGEX.test(groupByTag)
  const debouncedTag = useDebounce(groupByTag, 1000)
  const isValidTag = TAG_REGEX.test(debouncedTag)
  const shouldFetch = type === 'tag' && isValidTag

  const { data: tagSet, error } = useFetch(
    shouldFetch ? ['getUniqueTags', model, debouncedTag] : null,
    () =>
      getUniqueTags({
        self: model,
        tag: debouncedTag,
        blocks: (getContainingView(model) as LinearGenomeViewModel)
          .staticBlocks,
      }),
  )

  // Chain mode keeps each chain whole inside one group, so only the
  // chain-consistent dimensions are offered. The worker also defends against a
  // disallowed value from an old session by degrading to ungrouped.
  const dimensions = model.isChainMode
    ? CHAIN_STACK_DIMENSIONS
    : STACK_DIMENSIONS
  // Stacking partitions in the worker, so it only needs a valid tag name (not a
  // non-empty current-region tag set). Gated on the live value, not the
  // debounced one — the debounce only delays the optional preview fetch, so
  // gating Submit on it would needlessly disable the button for ~1s after a
  // valid tag is typed (handleSubmit acts on the live `groupByTag` anyway).
  const submitDisabled =
    !type || (type === 'tag' && !TAG_REGEX.test(groupByTag))

  const handleSubmit = () => {
    // submitDisabled gates an empty type; the guard also narrows away undefined.
    if (type) {
      model.setGroupBy({
        type,
        tag: type === 'tag' ? groupByTag : undefined,
      })
      if (type === 'tag') {
        if (colorByTag) {
          model.setColorScheme({ type: 'tag', tag: groupByTag })
        } else if (
          // Unchecking turns off tag-coloring only when it's the coloring this
          // dialog turned on (same tag) — otherwise leave an unrelated scheme be.
          model.colorBy.type === 'tag' &&
          model.colorBy.tag === groupByTag
        ) {
          model.setColorScheme({ type: 'normal' })
        }
      }
    }
    handleClose()
  }

  return (
    <SubmitDialog
      open
      title="Group by"
      submitDisabled={submitDisabled}
      onCancel={handleClose}
      onSubmit={handleSubmit}
    >
      <Typography color="text.secondary">
        Renders the reads as stacked sections (one per group) inside this track,
        sharing one coverage scale.
      </Typography>
      {model.isChainMode ? (
        <Typography color="text.secondary">
          In linked-read mode, grouping keeps each chain whole, so only
          per-template dimensions are offered.
        </Typography>
      ) : null}
      <TextField
        fullWidth
        value={type ?? ''}
        onChange={event => {
          // event.target.value is the DOM's untyped string; it always equals
          // one of the MenuItem GroupByType values below (the only options).
          setType(event.target.value as GroupByType)
        }}
        label="Group by..."
        select
      >
        {dimensions.map(d => (
          <MenuItem key={d.type} value={d.type}>
            {d.label}
          </MenuItem>
        ))}
      </TextField>
      {type === 'tag' ? (
        <>
          <Typography color="text.secondary">
            Examples: HP for haplotype, RG for read group, etc.
          </Typography>

          <TextField
            value={groupByTag}
            onChange={event => {
              setGroupByTag(event.target.value)
            }}
            placeholder="Enter tag name"
            error={isInvalid}
            helperText={isInvalid ? 'Not a valid tag' : ''}
            autoComplete="off"
            data-testid="group-tag-name"
            slotProps={{
              htmlInput: {
                maxLength: 2,
                'data-testid': 'group-tag-name-input',
              },
            }}
          />
          {error ? (
            <ErrorBanner error={error} />
          ) : tagSet && tagSet.length > 0 ? (
            // Stacking partitions in the worker, so the value list is only an
            // optional preview — never a blocking spinner.
            <Typography variant="caption" color="text.secondary">
              Found values: {tagSet.join(', ')}
            </Typography>
          ) : null}
          <FormControlLabel
            control={
              <Checkbox
                checked={colorByTag}
                onChange={event => {
                  setColorByTag(event.target.checked)
                }}
              />
            }
            label="Also color reads by this tag"
          />
        </>
      ) : null}
    </SubmitDialog>
  )
})

export default GroupByDialog
