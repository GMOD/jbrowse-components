import { useState } from 'react'

import {
  ErrorBanner,
  LabeledCheckbox,
  LoadingEllipses,
  SubmitDialog,
  TagTextField,
} from '@jbrowse/core/ui'
import { getContainingView, statusProgressLabel } from '@jbrowse/core/util'
import { useDebounce } from '@jbrowse/core/util/hooks'
import { useFetch } from '@jbrowse/core/util/useFetch'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { COMMON_READ_TAGS } from '../../shared/commonTags.ts'
import { getUniqueTags } from '../../shared/getUniqueTags.ts'
import { MAX_GROUPS } from '../../shared/groupFeatures.ts'

import type { ColorBy, FilterBy, GroupBy } from '../../shared/types.ts'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

// Exactly what this dialog reads. `getGroupByMenuItem` extends it with the
// radio-building fields (GroupByMenuModel in ../menus/sortGroup.ts) and hands the
// same node straight through, so the two can't disagree about the tag/color
// surface while the dialog stays free of menu-only state.
export type GroupByDialogModel = {
  id: string
  // Both read by `getUniqueTags`, not here: they describe the fetch its tag scan
  // runs, and it has to be the same read set the worker will partition — the
  // display's filter is in `rpcProps`, so a value only filtered-out reads carry
  // never becomes a section.
  adapterConfig: Record<string, unknown>
  filterBy: FilterBy
  colorBy: ColorBy
  groupBy?: GroupBy
  setGroupBy: (groupBy?: GroupBy) => void
  setColorScheme: (colorBy: ColorBy) => void
} & IAnyStateTreeNode

// Reads are currently colored by exactly this tag.
function isColoringByTag(colorBy: ColorBy, tag: string) {
  return colorBy.type === 'tag' && colorBy.tag === tag
}

// Whether "also color by this tag" should be ticked, absent an explicit click:
// yes when the reads already carry that tag's colors, and yes when they carry no
// tag colors at all (grouping by a tag usually pairs with coloring by it). No
// only when a DIFFERENT tag's colors are in force, which the checkbox would
// replace.
//
// Derived from the tag in the box rather than seeded once from the model: the
// box is where the tag is chosen, so a state read at open time describes a tag
// the user hasn't typed yet. Typing the tag the reads are already colored by
// then left the box unticked over colors that were on — and, since unticking
// means "don't color by this tag", submitting turned those colors off.
function defaultColorByTag(colorBy: ColorBy, tag: string) {
  return colorBy.type !== 'tag' || isColoringByTag(colorBy, tag)
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
// dimension is a direct radio in the Group-by menu. Tag is fragment-level, so
// this works in linked-read mode too (no per-mode gating needed).
const GroupByDialog = observer(function GroupByDialog(props: {
  model: GroupByDialogModel
  handleClose: () => void
}) {
  const { model, handleClose } = props
  // Pre-fill from the active grouping so reopening tweaks it rather than resets.
  const [groupByTag, setGroupByTag] = useState(model.groupBy?.tag ?? '')
  // Undefined until the box is actually clicked, so until then it tracks the tag
  // being typed (`defaultColorByTag`); a click pins the answer, since from then
  // on it is the user's and not a default.
  const [colorByTagChoice, setColorByTagChoice] = useState<boolean>()
  const colorByTag =
    colorByTagChoice ?? defaultColorByTag(model.colorBy, groupByTag)
  const debouncedTag = useDebounce(groupByTag, 1000)
  // Keyed by the display's id, never the node itself: useFetch JSON-stringifies
  // its key, and an MST node stringifies to its whole snapshot — so the key both
  // cost a full serialization per render and changed on any unrelated model edit,
  // re-running this RPC over the visible blocks.
  const {
    data: tagSet,
    error,
    isLoading: loadingTags,
    status,
  } = useFetch(
    debouncedTag ? (['getUniqueTags', model.id, debouncedTag] as const) : null,
    // this is a full scan of every visible block, re-issued on every settled
    // keystroke, so forwarding the token is what keeps a superseded tag's scan
    // from running to completion behind the one the user actually wants
    (_name, _id, _tag, stopToken, statusCallback) =>
      getUniqueTags({
        self: model,
        tag: debouncedTag,
        blocks: (getContainingView(model) as LinearGenomeViewModel)
          .staticBlocks,
        opts: { stopToken, statusCallback },
      }),
  )

  // The fetch lags the field by the debounce, so its values describe
  // `debouncedTag`; only trust them once it matches what Submit would apply.
  const values = debouncedTag === groupByTag ? tagSet : undefined
  // `tag` is the one dimension whose cardinality the data decides, so it's the
  // one that can flood the track with sections. The values are already in hand
  // here, so refuse at the point of choice — the worker's MAX_GROUPS cap would
  // silently return 39 sections plus an opaque "N more values" one.
  //
  // `>=`, not `>`: the scan reports only the values reads actually carry (it
  // drops the '' sentinel), and reads LACKING the tag take a section of their own
  // besides. So exactly MAX_GROUPS distinct values is already over the cap the
  // moment one read is untagged, which is the overflow merge this exists to
  // prevent. One value of headroom is the price of not knowing whether any read
  // is untagged without a second scan.
  const tooManyValues = values !== undefined && values.length >= MAX_GROUPS

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
      ) : loadingTags ? (
        <LoadingEllipses
          message={
            statusProgressLabel(status) || 'Scanning reads for tag values'
          }
        />
      ) : tooManyValues ? (
        <Typography variant="caption" color="error">
          {debouncedTag} takes {values.length} distinct values here — too many
          to stack, and each section costs its own render pass. Color reads by
          this tag instead, or group by a low-cardinality one (HP, RG).
        </Typography>
      ) : values?.length ? (
        // Fewer than MAX_GROUPS of them, since that many blocks Submit above.
        <Typography variant="caption" color="text.secondary">
          Found values: {values.join(', ')}
        </Typography>
      ) : null}
      <div>
        <LabeledCheckbox
          checked={colorByTag}
          onChange={val => {
            setColorByTagChoice(val)
          }}
          label="Also color reads by this tag"
        />
      </div>
    </SubmitDialog>
  )
})

export default GroupByDialog
