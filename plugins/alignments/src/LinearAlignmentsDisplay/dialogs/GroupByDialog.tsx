import { useState } from 'react'

import { ErrorBanner, SubmitDialog, TagTextField } from '@jbrowse/core/ui'
import { getContainingView, useDebounce, useFetch } from '@jbrowse/core/util'
import {
  Checkbox,
  FormControlLabel,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material'
import { observer } from 'mobx-react'

import { COMMON_READ_TAGS } from '../../shared/commonTags.ts'
import { getUniqueTags } from '../../shared/getUniqueTags.ts'
import {
  GROUP_BY_DIMENSIONS,
  isChainGroupableType,
} from '../../shared/groupFeatures.ts'

import type {
  ColorBy,
  FilterBy,
  GroupBy,
  GroupByType,
} from '../../shared/types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Menu order = registry order. Chain mode partitions whole chains, so it only
// offers the chain-consistent dimensions (every read of a chain shares one key).
const STACK_DIMENSIONS = Object.values(GROUP_BY_DIMENSIONS)
const CHAIN_STACK_DIMENSIONS = STACK_DIMENSIONS.filter(d => d.chainConsistent)

// Shared with the track-menu item (getGroupByMenuItem) so the two can't disagree
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

// A stored per-read dimension (e.g. strand) has no MenuItem in chain mode and
// would render the select blank, so drop it to unset.
function initialGroupType(model: GroupByModel) {
  const stored = model.groupBy?.type
  return model.isChainMode && !isChainGroupableType(stored) ? undefined : stored
}

// Reads are currently colored by exactly this tag.
function isColoringByTag(colorBy: ColorBy, tag: string) {
  return colorBy.type === 'tag' && colorBy.tag === tag
}

// The scheme to apply after grouping by `tag`: color by it when checked; when
// unchecked, undo only the coloring this dialog set (same tag), else leave the
// existing scheme (undefined) alone.
function nextColorScheme(
  colorBy: ColorBy,
  tag: string,
  alsoColorByTag: boolean,
): ColorBy | undefined {
  return alsoColorByTag
    ? { type: 'tag', tag }
    : isColoringByTag(colorBy, tag)
      ? { type: 'normal' }
      : undefined
}

// Tag-specific options; mounts only in tag mode, so its debounce + preview fetch
// never run for the other dimensions.
function TagGroupSection(props: {
  model: GroupByModel
  tag: string
  setTag: (tag: string) => void
  colorByTag: boolean
  setColorByTag: (value: boolean) => void
}) {
  const { model, tag, setTag, colorByTag, setColorByTag } = props
  const debouncedTag = useDebounce(tag, 1000)
  const { data: tagSet, error } = useFetch(
    debouncedTag ? ['getUniqueTags', model, debouncedTag] : null,
    () =>
      getUniqueTags({
        self: model,
        tag: debouncedTag,
        blocks: (getContainingView(model) as LinearGenomeViewModel)
          .staticBlocks,
      }),
  )
  return (
    <>
      <TagTextField
        // Seed from `tag` (parent state), not model.groupBy, so remounting on a
        // dimension switch restores the last typed value and stays in lockstep
        // with what Submit reads.
        defaultValue={tag}
        quickPicks={COMMON_READ_TAGS}
        onValueChange={value => {
          setTag(value ?? '')
        }}
        data-testid="group-tag-name"
        inputTestId="group-tag-name-input"
      />
      {error ? (
        <ErrorBanner error={error} />
      ) : tagSet?.length ? (
        <Typography variant="caption" color="text.secondary">
          Found values: {tagSet.join(', ')}
        </Typography>
      ) : null}
      <div>
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
      </div>
    </>
  )
}

const GroupByDialog = observer(function GroupByDialog(props: {
  model: GroupByModel
  handleClose: () => void
}) {
  const { model, handleClose } = props
  // Pre-fill from the active grouping so reopening tweaks it rather than resets.
  const [groupByTag, setGroupByTag] = useState(model.groupBy?.tag ?? '')
  const [type, setType] = useState(() => initialGroupType(model))
  // Defaults on (grouping by a tag usually pairs with coloring by it) unless
  // reads are already colored by a different tag.
  const [colorByTag, setColorByTag] = useState(() => {
    const { colorBy } = model
    return (
      colorBy.type !== 'tag' ||
      isColoringByTag(colorBy, model.groupBy?.tag ?? '')
    )
  })

  // Worker only needs a valid tag name; groupByTag holds a valid tag or ''.
  const submitDisabled = !type || (type === 'tag' && groupByTag === '')

  const handleSubmit = () => {
    if (type) {
      model.setGroupBy({ type, tag: type === 'tag' ? groupByTag : undefined })
      if (type === 'tag') {
        const scheme = nextColorScheme(model.colorBy, groupByTag, colorByTag)
        if (scheme) {
          model.setColorScheme(scheme)
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
          // Always one of the MenuItem GroupByType values below.
          setType(event.target.value as GroupByType)
        }}
        label="Group by..."
        select
      >
        {(model.isChainMode ? CHAIN_STACK_DIMENSIONS : STACK_DIMENSIONS).map(
          d => (
            <MenuItem key={d.type} value={d.type}>
              {d.label}
            </MenuItem>
          ),
        )}
      </TextField>
      {type === 'tag' ? (
        <TagGroupSection
          model={model}
          tag={groupByTag}
          setTag={setGroupByTag}
          colorByTag={colorByTag}
          setColorByTag={setColorByTag}
        />
      ) : null}
    </SubmitDialog>
  )
})

export default GroupByDialog
