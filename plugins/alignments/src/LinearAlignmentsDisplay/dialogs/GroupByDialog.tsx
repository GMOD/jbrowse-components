import { useState } from 'react'

import { ErrorBanner, LoadingEllipses, SubmitDialog } from '@jbrowse/core/ui'
import {
  type SessionWithAddTracks,
  getContainingTrack,
  getContainingView,
  getSession,
  useDebounce,
  useFetch,
} from '@jbrowse/core/util'
import { getSnapshot, isStateTreeNode } from '@jbrowse/mobx-state-tree'
import { MenuItem, TextField, Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { getUniqueTags } from '../../shared/getUniqueTags.ts'
import { GROUP_BY_DIMENSIONS } from '../../shared/groupFeatures.ts'
import { TAG_REGEX, negFlags, posFlags } from '../../shared/util.ts'

import type { FilterBy, GroupBy, GroupByType } from '../../shared/types.ts'
import type { AnyConfigurationModel } from '@jbrowse/core/configuration'
import type { IAnyStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { LinearGenomeViewModel } from '@jbrowse/plugin-linear-genome-view'

function TagResults({ tag, tagSet }: { tag: string; tagSet: string[] }) {
  if (tagSet.length === 0) {
    return (
      <Typography color="warning.main">
        No values found for tag {tag} in the current region
      </Typography>
    )
  }
  return (
    <div>
      <div>Found unique {tag} values:</div>
      <div>{tagSet.join(', ')}</div>
    </div>
  )
}

interface TrackConf {
  trackId: string
  name: string
  category?: string[]
  [key: string]: unknown
}

type DisplayModel = IAnyStateTreeNode

// Deterministic so re-grouping by the same key replaces (addTrackConf dedupes by
// trackId) rather than spawning duplicates, and so the "-sessionTrack" suffix +
// parent prefix let the track menu find and remove these groups again.
function createTrackId(baseId: string, suffix: string) {
  return `${baseId}-${suffix}-sessionTrack`
}

// Builds the display state to copy from the parent display to a group-by
// subtrack, replacing only filterBy. All flat keys (both plain MST fields and
// config overrides) are preserved; preProcessSnapshot on the new display routes
// them correctly.
function buildSubtrackDisplayConfig(
  displayModel: DisplayModel,
  filterBy: FilterBy,
): Record<string, unknown> {
  // getSnapshot on a fully-generic IAnyStateTreeNode can't recover its snapshot
  // type; a model node's snapshot is structurally a record of its fields
  const {
    displayId: _id,
    type: _type,
    configuration: _conf,
    ...rest
  } = getSnapshot<Record<string, unknown>>(displayModel)
  return { ...rest, filterBy }
}

interface Group {
  label: string
  filterBy: FilterBy
}

// Each group composes with the parent's active filterBy: tag grouping keeps the
// parent flags/readName and only sets tagFilter; strand grouping keeps the
// parent tagFilter/readName and only swaps the strand flags. '*' is the untagged
// sentinel that filterTagValue understands.
function groupsForTag(tag: string, tagSet: string[], base: FilterBy): Group[] {
  return [...[...tagSet].sort(), undefined].map(value => ({
    label: `${tag}:${value ?? 'untagged'}`,
    filterBy: { ...base, tagFilter: { tag, value: value ?? '*' } },
  }))
}

function groupsForStrand(base: FilterBy): Group[] {
  return [
    { label: '(-)', filterBy: { ...base, ...negFlags } },
    { label: '(+)', filterBy: { ...base, ...posFlags } },
  ]
}

function createGroupTracks({
  groups,
  trackConf,
  session,
  view,
  displayModel,
}: {
  groups: Group[]
  trackConf: TrackConf
  session: SessionWithAddTracks
  view: LinearGenomeViewModel
  displayModel: DisplayModel
}) {
  const category = [
    ...(trackConf.category ?? []),
    `${trackConf.name} (grouped)`,
  ]
  for (const { label, filterBy } of groups) {
    const trackId = createTrackId(trackConf.trackId, label)
    session.addTrackConf({
      ...trackConf,
      trackId,
      name: `${trackConf.name} (${label})`,
      category,
      displays: [
        {
          displayId: `${trackId}-LinearAlignmentsDisplay`,
          type: 'LinearAlignmentsDisplay',
          ...buildSubtrackDisplayConfig(displayModel, filterBy),
        },
      ],
    })
    view.showTrack(trackId)
  }
}

// In-track stacked grouping covers every group-key generator, derived straight
// from the shared dimension registry so the menu can't drift from the worker's
// key generators / chain-consistency classification.
const STACK_DIMENSIONS = Object.values(GROUP_BY_DIMENSIONS)
// The legacy split-into-tracks path only wires strand + tag, so it offers the
// narrower set.
const SPLIT_DIMENSIONS = STACK_DIMENSIONS.filter(
  d => d.type === 'strand' || d.type === 'tag',
)
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
  filterBy: FilterBy
  groupBy?: GroupBy
  isChainMode: boolean
  setGroupBy: (groupBy?: GroupBy) => void
} & IAnyStateTreeNode

const GroupByDialog = observer(function GroupByDialog(props: {
  model: GroupByModel
  handleClose: () => void
}) {
  const { model, handleClose } = props
  // Pre-fill from the active in-track grouping so reopening the dialog reflects
  // (and can tweak) the current dimension rather than resetting to blank.
  const [groupByTag, setGroupByTag] = useState(model.groupBy?.tag ?? '')
  const [type, setType] = useState<string>(model.groupBy?.type ?? '')
  // 'stack' renders the groups as stacked sections in this one track (the
  // default in-track experience); 'split' is the legacy one-session-track-per-
  // group path, kept for old sessions and very high group counts.
  const [mode, setMode] = useState<'stack' | 'split'>('stack')

  const isInvalid = groupByTag.length === 2 && !TAG_REGEX.test(groupByTag)
  const debouncedTag = useDebounce(groupByTag, 1000)
  const isValidTag = TAG_REGEX.test(debouncedTag)
  const shouldFetch = type === 'tag' && isValidTag

  const {
    data: tagSet,
    error,
    isLoading: loading,
  } = useFetch(
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
  // chain-consistent dimensions are offered (stack only; chain has no split
  // path). The worker also defends against a disallowed value from an old
  // session by degrading to ungrouped.
  const dimensions =
    mode === 'split'
      ? SPLIT_DIMENSIONS
      : model.isChainMode
        ? CHAIN_STACK_DIMENSIONS
        : STACK_DIMENSIONS
  // Stacking partitions in the worker, so it only needs a valid tag name (not a
  // non-empty current-region tag set the way the split path does to build its
  // group tracks).
  const tagBlocksSubmit =
    type === 'tag' &&
    (mode === 'stack' ? !isValidTag : loading || !tagSet || tagSet.length === 0)
  const submitDisabled = !type || tagBlocksSubmit

  const handleSubmit = () => {
    if (mode === 'stack') {
      model.setGroupBy({
        type: type as GroupByType,
        tag: type === 'tag' ? groupByTag : undefined,
      })
      handleClose()
      return
    }

    const track = getContainingTrack(model)
    // Track configurations always carry trackId + name (schema
    // invariant); MST's getSnapshot widens to Record<string, any>.
    const trackConf = (
      isStateTreeNode(track.configuration)
        ? structuredClone(getSnapshot(track.configuration))
        : track.configuration
    ) as TrackConf
    const session = getSession(model) as SessionWithAddTracks
    const view = getContainingView(model) as LinearGenomeViewModel
    const base = model.filterBy

    const groups: Group[] = []
    if (type === 'tag' && tagSet) {
      groups.push(...groupsForTag(groupByTag, tagSet, base))
    } else if (type === 'strand') {
      groups.push(...groupsForStrand(base))
    }
    if (groups.length) {
      createGroupTracks({
        groups,
        trackConf,
        session,
        view,
        displayModel: model,
      })
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
      <TextField
        fullWidth
        value={mode}
        onChange={event => {
          const next = event.target.value as 'stack' | 'split'
          setMode(next)
          // 'split' only supports strand/tag; drop an unsupported selection.
          if (next === 'split' && type !== 'strand' && type !== 'tag') {
            setType('')
          }
        }}
        label="Mode"
        select
      >
        <MenuItem value="stack">Stack groups in this track</MenuItem>
        <MenuItem value="split">Split into separate tracks (legacy)</MenuItem>
      </TextField>
      <Typography color="text.secondary">
        {mode === 'stack'
          ? 'Renders the reads as stacked sections (one per group) inside this track, sharing one coverage scale.'
          : 'Creates one new session track per group. Remove them later with "Group by... → Remove grouped tracks".'}
      </Typography>
      {mode === 'stack' && model.isChainMode ? (
        <Typography color="text.secondary">
          In linked-read mode, grouping keeps each chain whole, so only
          per-template dimensions are offered.
        </Typography>
      ) : null}
      <TextField
        fullWidth
        value={type}
        onChange={event => {
          setType(event.target.value)
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
          ) : loading ? (
            <LoadingEllipses message="Loading unique tags" />
          ) : tagSet ? (
            <TagResults tag={groupByTag} tagSet={tagSet} />
          ) : null}
        </>
      ) : null}
    </SubmitDialog>
  )
})

export default GroupByDialog
