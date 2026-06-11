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
import { TAG_REGEX, negFlags, posFlags } from '../../shared/util.ts'

import type { FilterBy } from '../../shared/types.ts'
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

const GroupByDialog = observer(function GroupByDialog(props: {
  model: {
    adapterConfig: AnyConfigurationModel
    configuration: AnyConfigurationModel
    filterBy: FilterBy
  } & IAnyStateTreeNode
  handleClose: () => void
}) {
  const { model, handleClose } = props
  const [tag, setGroupByTag] = useState('')
  const [type, setType] = useState('')

  const isInvalid = tag.length === 2 && !TAG_REGEX.test(tag)
  const debouncedTag = useDebounce(tag, 1000)
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

  const submitDisabled =
    !type || loading || (type === 'tag' && (!tagSet || tagSet.length === 0))

  const handleSubmit = () => {
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
      groups.push(...groupsForTag(tag, tagSet, base))
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
      <Typography>
        NOTE: this creates one new session track per group (with "filter by" set
        to that group) rather than changing the current track. Remove them later
        with "Group by... → Remove grouped tracks".
      </Typography>
      <TextField
        fullWidth
        value={type}
        onChange={event => {
          setType(event.target.value)
        }}
        label="Group by..."
        select
      >
        <MenuItem value="strand">Strand</MenuItem>
        <MenuItem value="tag">Tag</MenuItem>
      </TextField>
      {type === 'tag' ? (
        <>
          <Typography color="text.secondary">
            Examples: HP for haplotype, RG for read group, etc.
          </Typography>

          <TextField
            value={tag}
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
            <TagResults tag={tag} tagSet={tagSet} />
          ) : null}
        </>
      ) : null}
    </SubmitDialog>
  )
})

export default GroupByDialog
