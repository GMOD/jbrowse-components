import { useState } from 'react'

import { ErrorBanner, LoadingEllipses, TagTextField } from '@jbrowse/core/ui'
import { statusProgressLabel } from '@jbrowse/core/util'
import { useDebounce } from '@jbrowse/core/util/hooks'
import { useFetch } from '@jbrowse/core/util/useFetch'
import GroupByDialogShell from '@jbrowse/display-kit/GroupByDialog'
import { colorsWithGrouping } from '@jbrowse/display-kit/groupByMenu'
import { Typography } from '@mui/material'
import { observer } from 'mobx-react'

import { COMMON_READ_TAG_PICKS } from '../../shared/commonTags.ts'
import { TAG_FIELD_PREFIX, fieldTag } from '../../shared/facetLabels.ts'
import { getUniqueTags } from '../../shared/getUniqueTags.ts'
import { tagGroupingVerdict } from './tagGroupingVerdict.ts'

import type { InsertSizeBand } from '../../shared/insertSizeStats.ts'
import type { BaseLayer, Facet } from '../../shared/types.ts'
import type { ColorSlots } from '@jbrowse/core/util/colorScale'
import type { FieldPredicate } from '@jbrowse/core/util/fieldPredicate'
import type { GroupByPlotHost } from '@jbrowse/display-kit/GroupByDialog'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'

export interface GroupByDialogModel extends IStateTreeNode, GroupByPlotHost {
  id: string
  // `getUniqueTags` reads these four: its scan is the render fetch's
  // download, over the same read set the worker partitions and under the same
  // byte budget.
  adapterConfig: Record<string, unknown>
  readPredicates: FieldPredicate[]
  pinnedInsertSizeBand: InsertSizeBand | undefined
  resolvedByteLimit: () => number | undefined
  colorField: string | undefined
  writtenColor: ColorSlots
  baseLayer: BaseLayer | undefined
  facet?: Facet
}

// Group reads into stacked sections by a tag value (HP, RG, ...). Tag is
// fragment-level, so this works in linked-read mode too.
const GroupByDialog = observer(function GroupByDialog({
  model,
  handleClose,
}: {
  model: GroupByDialogModel
  handleClose: () => void
}) {
  const [groupByTag, setGroupByTag] = useState(
    fieldTag(model.facet?.field) ?? '',
  )
  const field = groupByTag ? `${TAG_FIELD_PREFIX}${groupByTag}` : undefined
  // Short: the box emits only a valid two-letter tag, so there are no
  // half-typed keystrokes to swallow.
  const debouncedTag = useDebounce(groupByTag, 300)
  // Keyed by the display's id: useFetch stringifies its key, and an MST node
  // stringifies to its whole snapshot.
  const {
    data: tagSet,
    error,
    isLoading,
    status,
  } = useFetch(
    debouncedTag ? (['getUniqueTags', model.id, debouncedTag] as const) : null,
    (_name, _id, _tag, signal, statusCallback) =>
      getUniqueTags({
        self: model,
        tag: debouncedTag,
        opts: { signal, statusCallback },
      }),
  )
  // The scan lags the box by the debounce and its own round trip; Apply is
  // held until it describes the tag in the box, or the verdict's refusal
  // could be clicked past.
  const scanPending =
    groupByTag !== '' && (isLoading || debouncedTag !== groupByTag)
  const verdict = tagGroupingVerdict(
    groupByTag,
    scanPending ? undefined : tagSet,
  )

  return (
    <GroupByDialogShell
      model={model}
      handleClose={handleClose}
      title="Group by tag"
      blurb="Renders the reads as stacked sections — one per distinct value of the tag — inside this track, sharing one coverage scale."
      colorLabel="Also color reads by this tag"
      field={field}
      colorsByDefault={colorsWithGrouping({
        value: model.writtenColor.value,
        colorField: model.colorField,
        field,
        underBaseLayer: !!model.baseLayer,
      })}
      pending={scanPending}
      blocks={verdict?.blocks}
    >
      <TagTextField
        defaultValue={groupByTag}
        quickPicks={COMMON_READ_TAG_PICKS}
        onValueChange={value => {
          setGroupByTag(value ?? '')
        }}
        data-testid="group-tag-name"
        inputTestId="group-tag-name-input"
      />
      {scanPending ? (
        <LoadingEllipses
          message={
            statusProgressLabel(status) || 'Scanning reads for tag values'
          }
        />
      ) : error ? (
        <ErrorBanner error={error} />
      ) : verdict ? (
        <Typography variant="caption" color={verdict.color}>
          {verdict.text}
        </Typography>
      ) : null}
    </GroupByDialogShell>
  )
})

export default GroupByDialog
