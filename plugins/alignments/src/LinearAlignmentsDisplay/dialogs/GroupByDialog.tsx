import { useState } from 'react'

import { ErrorBanner, SubmitDialog, TagTextField } from '@jbrowse/core/ui'
import { getContainingView } from '@jbrowse/core/util'
import { useDebounce } from '@jbrowse/core/util/hooks'
import { useFetch } from '@jbrowse/core/util/useFetch'
import { Checkbox, FormControlLabel, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { COMMON_READ_TAGS } from '../../shared/commonTags.ts'
import { getUniqueTags } from '../../shared/getUniqueTags.ts'
import { MAX_GROUPS } from '../../shared/groupFeatures.ts'

import type { ColorBy, FilterBy, GroupBy } from '../../shared/types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Shared with the track-menu item (getGroupByMenuItem) so the two can't disagree
// about the model surface they depend on. The menu reads `isChainMode`/`groupBy`
// to build its radios; this dialog (tag grouping only — every other dimension is
// a direct menu radio) reads the tag/color fields.
export type GroupByModel = {
  adapterConfig: AnyConfigurationModel
  configuration: AnyConfigurationModel
  colorBy: ColorBy
  filterBy: FilterBy
  groupBy?: GroupBy
  isChainMode: boolean
  collapseGroupRows: boolean
  setGroupBy: (groupBy?: GroupBy) => void
  setCollapseGroupRows: (flag: boolean) => void
  setColorScheme: (colorBy: ColorBy) => void
} & IAnyStateTreeNode

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

// Group reads into stacked sections by a tag value (HP, RG, ...). Tag is the one
// group-by dimension needing extra input, so it gets a dialog; every other
// dimension is a direct radio in the Group-by menu. Tag is chain-consistent, so
// this works in linked-read mode too (no per-mode gating needed).
const GroupByDialog = observer(function GroupByDialog(props: {
  model: GroupByModel
  handleClose: () => void
}) {
  const { model, handleClose } = props
  // Pre-fill from the active grouping so reopening tweaks it rather than resets.
  const [groupByTag, setGroupByTag] = useState(model.groupBy?.tag ?? '')
  // Defaults on (grouping by a tag usually pairs with coloring by it) unless
  // reads are already colored by a different tag.
  const [colorByTag, setColorByTag] = useState(() => {
    const { colorBy } = model
    return (
      colorBy.type !== 'tag' ||
      isColoringByTag(colorBy, model.groupBy?.tag ?? '')
    )
  })
  const debouncedTag = useDebounce(groupByTag, 1000)
  const { data: tagSet, error } = useFetch<string[]>(
    debouncedTag ? ['getUniqueTags', model, debouncedTag] : null,
    () =>
      getUniqueTags({
        self: model,
        tag: debouncedTag,
        blocks: (getContainingView(model) as LinearGenomeViewModel)
          .staticBlocks,
      }),
  )

  // The fetch lags the field by the debounce, so its values describe
  // `debouncedTag`; only trust them once it matches what Submit would apply.
  const values = debouncedTag === groupByTag ? tagSet : undefined
  // `tag` is the one dimension whose cardinality the data decides, so it's the
  // one that can flood the track with sections. The values are already in hand
  // here, so refuse at the point of choice — the worker's MAX_GROUPS cap would
  // silently return 39 sections plus an opaque "N more values" one.
  const tooManyValues = values !== undefined && values.length > MAX_GROUPS

  const handleSubmit = () => {
    model.setGroupBy({ type: 'tag', tag: groupByTag })
    const scheme = nextColorScheme(model.colorBy, groupByTag, colorByTag)
    if (scheme) {
      model.setColorScheme(scheme)
    }
    handleClose()
  }

  return (
    <SubmitDialog
      open
      title="Group by tag"
      // Worker only needs a valid tag name; groupByTag holds a valid tag or ''.
      submitDisabled={groupByTag === '' || tooManyValues}
      onCancel={handleClose}
      onSubmit={handleSubmit}
    >
      <Typography color="text.secondary">
        Renders the reads as stacked sections — one per distinct value of the
        tag — inside this track, sharing one coverage scale.
      </Typography>
      <TagTextField
        // Seed from `groupByTag` (parent state) so it stays in lockstep with
        // what Submit reads.
        defaultValue={groupByTag}
        quickPicks={COMMON_READ_TAGS}
        onValueChange={value => {
          setGroupByTag(value ?? '')
        }}
        data-testid="group-tag-name"
        inputTestId="group-tag-name-input"
      />
      {error ? (
        <ErrorBanner error={error} />
      ) : tooManyValues ? (
        <Typography variant="caption" color="error">
          {debouncedTag} takes {values.length} distinct values here — too many to
          stack, and each section costs its own render pass. Color reads by this
          tag instead, or group by a low-cardinality one (HP, RG).
        </Typography>
      ) : values?.length ? (
        // At most MAX_GROUPS of them, since more than that blocks Submit above.
        <Typography variant="caption" color="text.secondary">
          Found values: {values.join(', ')}
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
    </SubmitDialog>
  )
})

export default GroupByDialog
