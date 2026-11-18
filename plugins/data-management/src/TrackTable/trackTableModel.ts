import { getConf } from '@jbrowse/core/configuration'
import {
  coarseStripHTML,
  getEnv,
  localStorageGetJSON,
  localStorageSetJSON,
  measureGridWidth,
} from '@jbrowse/core/util'
import { trackCatalogEntry } from '@jbrowse/core/util/tracks'
import { types } from '@jbrowse/mobx-state-tree'
import { observable } from 'mobx'

import { trackNameCollator } from '../shared/collator.ts'
import { configScopedKey } from '../shared/configScopedKey.ts'
import { buildSearchText, searchMatcher } from '../shared/searchText.ts'
import { measureNameColumnWidth } from '../shared/trackGridUtils.ts'
import {
  facetLabel,
  getRowStr,
  isMetadataFacet,
  metadataFacet,
} from './components/util.ts'
import {
  countFacetValues,
  filterRowsByFacets,
  rowSearchText,
} from './facetFilters.ts'
import { getRootKeys, trackTypeShortName } from './tableUtil.ts'

import type { AnyTrackConfig } from '@jbrowse/core/configuration'
import type { AbstractSessionModel } from '@jbrowse/core/util'
import type { Instance } from '@jbrowse/mobx-state-tree'

// how many of the default columns' facets get a chip of their own
const LEADING_FACETS = 3

/**
 * A column the user showed or hid in Manage columns, overriding whether the
 * table would have shown it.
 */
export interface ColumnChoice {
  field: string
  show: boolean
}

interface ColumnChoicesOwner {
  columnChoices: ColumnChoice[]
  setColumnChoices: (choices: ColumnChoice[]) => void
}

// Column choices are config+assembly scoped: the metadata columns differ per
// dataset, so a choice shouldn't carry over to an unrelated config.
function columnChoicesKey(assemblyNames: string[]) {
  return configScopedKey('facet-columnChoices', assemblyNames)
}

function readColumnChoices(assemblyNames: string[]): ColumnChoice[] {
  const stored = localStorageGetJSON<unknown>(
    columnChoicesKey(assemblyNames),
    [],
  )
  return Array.isArray(stored)
    ? stored.flatMap((c: Partial<ColumnChoice> | null) =>
        typeof c?.field === 'string' && typeof c.show === 'boolean'
          ? [{ field: c.field, show: c.show }]
          : [],
      )
    : []
}

function trackFields(
  track: AnyTrackConfig,
  trackTypeNames: Map<string, string>,
) {
  const type = String(track.type)
  const metadata = (track.metadata ?? {}) as Record<string, unknown>
  return {
    kind:
      typeof metadata.kind === 'string' && metadata.kind
        ? metadata.kind
        : (trackTypeNames.get(type) ?? type),
    adapter: (track.adapter as { type?: string } | undefined)?.type,
    metadata,
  }
}

// A field groups tracks when at least two of its values are each shared by
// two or more tracks, and it has no more values than half the tracks that have
// one: a constant flag, a lone exception to one, or a per-track description
// gives a column or a facet nothing to group by. A field whose every value
// holds a link says where tracks came from, so it never groups them, even when
// tracks share a source.
function groupsTracks(values: string[]) {
  const counts = new Map<string, number>()
  for (const value of values) {
    if (value !== '') {
      counts.set(value, (counts.get(value) ?? 0) + 1)
    }
  }
  const present = values.filter(v => v !== '').length
  const shared = [...counts.values()].filter(n => n >= 2).length
  return (
    shared >= 2 &&
    counts.size <= present / 2 &&
    ![...counts.keys()].every(value => value.includes('://'))
  )
}

// Two fields mirror each other when each value of one always comes with the
// same value of the other, both ways (a file format that always says what the
// track kind says): the second column repeats the first.
function mirrors(a: string[], b: string[]) {
  const forward = new Map<string, string>()
  const backward = new Map<string, string>()
  return a.every((value, i) => {
    const other = b[i]!
    const seenForward = forward.get(value)
    const seenBackward = backward.get(other)
    forward.set(value, other)
    backward.set(other, value)
    return (
      (seenForward === undefined || seenForward === other) &&
      (seenBackward === undefined || seenBackward === value)
    )
  })
}

// A field varies when at least two tracks differ from its most common value:
// not a constant, nor a constant with one exception such as the reference
// sequence among tracks of one kind.
function varies(values: string[]) {
  const counts = new Map<string, number>()
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return values.length - Math.max(0, ...counts.values()) >= 2
}

/**
 * #stateModel TrackTableModel
 * #internal table-selector UI state owned by the hierarchical track selector
 * widget — kept out of the website docs
 * #category widget
 */
export function trackTableModelFactory() {
  return types
    .model('TrackTableModel', {
      /**
       * #property
       */
      filterText: types.optional(types.string, ''),
    })
    .volatile(() => ({
      /**
       * #volatile
       */
      assemblyNames: [] as string[],
      /**
       * #volatile
       */
      useShoppingCart: false,
      /**
       * #volatile
       * the trackIds the tree's text search keeps while the drawer shows the
       * tree, which matches only what a tree row shows; the facet counts
       * follow it. Undefined while the table does the search
       */
      getTextKeptIds: undefined as (() => Set<string> | undefined) | undefined,
      /**
       * #volatile
       */
      filters: observable.map<string, string[]>(),
      /**
       * #volatile
       * Field id the grid is sorted by; empty string keeps natural order.
       */
      sortField: '',
      /**
       * #volatile
       */
      sortAscending: true,
      /**
       * #volatile
       * Supplier for the tracks the grid shows. Called from inside the row
       * computeds so they track the live config tree: a track added or deleted
       * while the selector is open flows through instead of leaving a stale row
       * pointing at a destroyed config.
       */
      getTracks: (() => []) as () => AnyTrackConfig[],
      /**
       * #volatile
       * Supplier for the tracks the columns and facets are chosen from, when
       * that is more than the grid shows: the drawer passes every track, so
       * switching to Favorites or Recent keeps the same columns.
       */
      getColumnTracks: undefined as (() => AnyTrackConfig[]) | undefined,
      /**
       * #volatile
       * what the user showed or hid in Manage columns, loaded from a
       * config+assembly scoped localStorage entry in setTrackSource
       */
      columnChoices: [] as ColumnChoice[],
      /**
       * #volatile
       * the table holding this one's column choices, when another does: a
       * folder dialog's table shares the drawer's, so neither overwrites the
       * other's choice under their common localStorage key
       */
      columnChoicesOwner: undefined as ColumnChoicesOwner | undefined,
      /**
       * #volatile
       */
      session: undefined as AbstractSessionModel | undefined,
    }))
    .actions(self => ({
      /**
       * #action
       */
      setTrackSource(
        getTracks: () => AnyTrackConfig[],
        session: AbstractSessionModel,
        assemblyNames: string[],
        getColumnTracks?: () => AnyTrackConfig[],
      ) {
        self.getTracks = getTracks
        self.getColumnTracks = getColumnTracks
        self.session = session
        self.assemblyNames = assemblyNames
        self.columnChoices = readColumnChoices(assemblyNames)
      },
      /**
       * #action
       */
      shareColumnChoices(owner: ColumnChoicesOwner) {
        self.columnChoicesOwner = owner
      },
      /**
       * #action
       */
      setColumnChoices(choices: ColumnChoice[]) {
        self.columnChoices = choices
        localStorageSetJSON(columnChoicesKey(self.assemblyNames), choices)
      },
      /**
       * #action
       */
      setFilter(key: string, value: string[]) {
        if (value.length) {
          self.filters.set(key, value)
        } else {
          self.filters.delete(key)
        }
      },
      /**
       * #action
       */
      setSort(field: string, ascending: boolean) {
        self.sortField = field
        self.sortAscending = ascending
      },
      /**
       * #action
       */
      setUseShoppingCart(f: boolean) {
        self.useShoppingCart = f
      },
      /**
       * #action
       */
      setFilterText(str: string) {
        self.filterText = str
      },
      /**
       * #action
       */
      setTextKeptIdsSource(getTextKeptIds: () => Set<string> | undefined) {
        self.getTextKeptIds = getTextKeptIds
      },
    }))
    .actions(self => ({
      /**
       * #action
       * records the user's Manage columns choice, which beats the default
       * either way; hiding the sorted column drops the sort
       */
      setColumnVisible(field: string, show: boolean) {
        const owner = self.columnChoicesOwner ?? self
        owner.setColumnChoices([
          ...owner.columnChoices.filter(c => c.field !== field),
          { field, show },
        ])
        if (!show && self.sortField === field) {
          self.sortField = ''
        }
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the config's `hierarchical.table.columns`
       */
      get configuredColumns() {
        const { session } = self
        const columns: unknown = session
          ? getConf(session, ['hierarchical', 'table', 'columns'])
          : []
        return Array.isArray(columns)
          ? columns.filter((c): c is string => typeof c === 'string')
          : []
      },
      /**
       * #getter
       * each track type's name for the kind column, when a track's config
       * sets no `metadata.kind`
       */
      get trackTypeNames() {
        const { session } = self
        return new Map(
          session
            ? getEnv(session)
                .pluginManager.getTrackElements()
                .map(t => [t.name, trackTypeShortName(t.displayName)])
            : [],
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Builds row objects from track configs. Cached and only recomputes when
       * the track list changes, not on every filterText keystroke.
       */
      get allRows() {
        const session = self.session
        return session
          ? self.getTracks().map(track => {
              const { name, category, description } = trackCatalogEntry(
                track,
                session,
              )
              return {
                id: track.trackId,
                conf: track,
                name,
                category: category.join(', '),
                description,
                ...trackFields(track, self.trackTypeNames),
              }
            })
          : []
      },
    }))
    .views(self => ({
      /**
       * #getter
       * each row's text for the table's own search, and its name's for
       * listing name matches first; the tree searches through getTextKeptIds,
       * so it never builds these
       */
      get searchTexts() {
        return self.allRows.map(row => ({
          row,
          text: rowSearchText(row),
          name: buildSearchText([row.name]),
        }))
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the rows the columns and facets are chosen from
       */
      get columnRows() {
        const { getColumnTracks } = self
        return getColumnTracks
          ? getColumnTracks().map(track => ({
              category: ((track.category as string[] | undefined) ?? []).join(
                ', ',
              ),
              ...trackFields(track, self.trackTypeNames),
            }))
          : self.allRows
      },
      /**
       * #getter
       * the rows the open mode's text search keeps
       */
      get rows() {
        const kept = self.getTextKeptIds?.()
        const matches = searchMatcher(self.filterText)
        return kept
          ? self.allRows.filter(row => kept.has(row.id))
          : matches
            ? self.searchTexts.flatMap(({ row, text }) =>
                matches(text) ? [row] : [],
              )
            : self.allRows
      },
    }))
    .views(self => ({
      /**
       * #getter
       */
      get metadataKeys() {
        return [
          ...new Set(
            self.columnRows.flatMap(row =>
              getRootKeys(row.metadata).filter(key => key !== 'kind'),
            ),
          ),
        ]
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the fields a column or a chip can group tracks by (category, kind and
       * each metadata key), each with its value on every column row
       */
      get groupableFieldValues() {
        const rows = self.columnRows
        return new Map(
          ['category', 'kind', ...self.metadataKeys.map(metadataFacet)].map(
            field => [field, rows.map(row => getRowStr(field, row))] as const,
          ),
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * Every field a column can show, in column order: the ones that say most
       * about a track first, `metadata.<key>` ids next, the adapter last.
       */
      get fields() {
        return [
          'name',
          'description',
          'category',
          'kind',
          ...self.metadataKeys.map(metadataFacet),
          'adapter',
        ]
      },
      /**
       * #getter
       * The fields that sort tracks into groups (see groupsTracks), the ones
       * most tracks have first: what the table shows beside the name when the
       * config names no columns, and what the filter chips offer.
       */
      get groupingFields() {
        const ranked = [...self.groupableFieldValues]
          .map(([field, values]) => ({ field, values }))
          .filter(({ values }) => groupsTracks(values))
          .map(entry => ({
            ...entry,
            coverage: entry.values.filter(v => v !== '').length,
          }))
          .sort((a, b) => b.coverage - a.coverage)
        const kept: typeof ranked = []
        for (const entry of ranked) {
          if (!kept.some(k => mirrors(entry.values, k.values))) {
            kept.push(entry)
          }
        }
        return kept.map(({ field }) => field)
      },
    }))
    .views(self => ({
      /**
       * #getter
       * kind and category when no field groups them but they still vary, so a
       * small track list says what each track is and where the tree files it;
       * one that repeats a column already chosen is left out
       */
      get fallbackColumns() {
        const valuesOf = (field: string) =>
          self.groupableFieldValues.get(field) ?? []
        const chosen = self.groupingFields.map(valuesOf)
        const fallback: string[] = []
        for (const field of ['kind', 'category']) {
          const values = valuesOf(field)
          if (
            !self.groupingFields.includes(field) &&
            varies(values) &&
            !chosen.some(c => mirrors(values, c))
          ) {
            fallback.push(field)
            chosen.push(values)
          }
        }
        return fallback
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the columns shown beside the name, most important first, as far as the
       * width allows: the config's `hierarchical.table.columns`, then the
       * grouping fields it leaves out, then the fallback columns
       */
      get defaultColumns() {
        const known = new Set(self.fields)
        return [
          ...new Set([
            ...self.configuredColumns.filter(f => f !== 'name' && known.has(f)),
            ...self.groupingFields,
            ...self.fallbackColumns,
          ]),
        ]
      },
      /**
       * #getter
       * The columns the user showed in Manage columns, which show however
       * narrow the table, and those they hid, which never do.
       */
      get chosenColumns() {
        const known = new Set(self.fields)
        const choices = (self.columnChoicesOwner ?? self).columnChoices.filter(
          c => known.has(c.field),
        )
        return {
          shown: choices.filter(c => c.show).map(c => c.field),
          hidden: new Set(choices.filter(c => !c.show).map(c => c.field)),
        }
      },
      /**
       * #getter
       * The non-metadata field names, used to detect when a metadata key
       * collides with one (so the header can show "x (from metadata)").
       */
      get nonMetadataFieldSet() {
        return new Set(self.fields.filter(f => !isMetadataFacet(f)))
      },
      /**
       * #getter
       */
      get filteredRows() {
        return filterRowsByFacets(self.rows, self.filters)
      },
      /**
       * #getter
       * whether the filter box or a facet filter narrows the list
       */
      get narrowed() {
        return (
          self.filters.size > 0 || searchMatcher(self.filterText) !== undefined
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the listed trackIds the filter box and the facet filters keep, which
       * the tree shows; undefined while neither is set
       */
      get keptIds() {
        return self.narrowed
          ? new Set(self.filteredRows.map(r => r.id))
          : undefined
      },
      /**
       * #getter
       * how many listed tracks the filter box and the facet filters keep, of
       * how many; undefined while neither is set
       */
      get matchCounts() {
        return self.narrowed
          ? { matched: self.filteredRows.length, total: self.allRows.length }
          : undefined
      },
    }))
    .views(self => ({
      /**
       * #getter
       * every column that can show at some width, name first
       */
      get candidateColumns() {
        const { shown, hidden } = self.chosenColumns
        return [
          ...new Set([
            'name',
            ...self.defaultColumns.filter(f => !hidden.has(f)),
            ...shown,
          ]),
        ]
      },
      /**
       * #getter
       * the field the rows are sorted by, while it can still show as a
       * column; empty keeps natural order
       */
      get activeSortField() {
        return this.candidateColumns.includes(self.sortField)
          ? self.sortField
          : ''
      },
      /**
       * #getter
       * The filter chips' facets, in an order that never changes as filters
       * are set: the default columns that group tracks, the other grouping
       * fields, then any field still filtering that no longer groups.
       */
      get filterFacets() {
        const grouping = new Set(self.groupingFields)
        return [
          ...new Set([
            ...self.defaultColumns.filter(f => grouping.has(f)),
            ...self.groupingFields,
            ...self.filters.keys(),
          ]),
        ]
      },
      /**
       * #getter
       * The facets offered first: the first three default columns that group
       * tracks and any grouping column the user showed, each with a chip of
       * its own. The rest wait behind "More filters", so a hub with many
       * metadata keys offers them all without a chip for each.
       */
      get leadingFacets() {
        const grouping = new Set(self.groupingFields)
        return new Set([
          ...self.defaultColumns
            .filter(f => grouping.has(f))
            .slice(0, LEADING_FACETS),
          ...self.chosenColumns.shown.filter(f => grouping.has(f)),
        ])
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the facets some listed track has a value for, or that are filtering,
       * whatever the filter box holds, so a chip never comes and goes while
       * typing
       */
      get presentFacets() {
        return new Set(
          self.filterFacets.filter(
            f =>
              self.filters.has(f) ||
              self.allRows.some(row => getRowStr(f, row) !== ''),
          ),
        )
      },
    }))
    .views(self => ({
      /**
       * #getter
       * the facets with a chip of their own: the leading ones and any still
       * filtering
       */
      get chipFacets() {
        return self.filterFacets.filter(
          f =>
            self.presentFacets.has(f) &&
            (self.leadingFacets.has(f) || self.filters.has(f)),
        )
      },
      /**
       * #getter
       * the facets "More filters" lists: every one that is not leading, so a
       * facet keeps its place there when it starts or stops filtering
       */
      get moreFacets() {
        return self.filterFacets.filter(
          f => self.presentFacets.has(f) && !self.leadingFacets.has(f),
        )
      },
    }))
    .views(self => ({
      /**
       * #method
       * one facet's value counts, read by its filter only while it lists its
       * values, so a collapsed facet costs nothing
       */
      facetCounts(field: string) {
        return countFacetValues(self.rows, field, self.filters)
      },
      /**
       * #getter
       * Measured pixel widths for every column that can show. Measured over
       * allRows so widths stay stable and don't recompute on every filterText
       * keystroke, each distinct value once.
       */
      get initialWidths(): Record<string, number> {
        return Object.fromEntries(
          self.candidateColumns.map(f => [
            f,
            f === 'name'
              ? measureNameColumnWidth(self.allRows)
              : Math.max(
                  measureGridWidth(
                    [...new Set(self.allRows.map(r => getRowStr(f, r)))],
                    { maxWidth: 400, stripHTML: true },
                  ),
                  measureGridWidth([facetLabel(f, self.nonMetadataFieldSet)], {
                    fontSize: 14,
                    padding: 46,
                    maxWidth: 400,
                  }),
                ),
          ]),
        )
      },
      /**
       * #getter
       * Table rows in display order: filteredRows sorted by the active sort
       * field. With no sort field, a search lists the tracks whose name holds
       * every word first, each group in natural order.
       */
      get sortedRows() {
        const { sortAscending, filteredRows, filterText } = self
        const sortField = self.activeSortField
        if (!sortField) {
          const nameMatches = searchMatcher(filterText)
          const named = nameMatches
            ? new Set(
                self.searchTexts.flatMap(({ row, name }) =>
                  nameMatches(name) ? [row] : [],
                ),
              )
            : undefined
          return named
            ? [
                ...filteredRows.filter(r => named.has(r)),
                ...filteredRows.filter(r => !named.has(r)),
              ]
            : filteredRows
        }
        const dir = sortAscending ? 1 : -1
        // sort on what the cell displays, not the raw slot: a value wrapped in
        // markup would otherwise sort under '<'. Keys are stripped once per row
        // rather than once per comparison.
        return filteredRows
          .map(row => ({
            row,
            key: coarseStripHTML(getRowStr(sortField, row)),
          }))
          .sort((a, b) => dir * trackNameCollator.compare(a.key, b.key))
          .map(({ row }) => row)
      },
      /**
       * #method
       * The columns to draw when `count` fit beside the name: the leading
       * default columns that fit, plus every column the user showed and the
       * sorted column, so narrowing the table never hides the order it shows.
       */
      shownColumns(count: number) {
        const { shown, hidden } = self.chosenColumns
        const pinned = new Set(
          [...shown, self.activeSortField].filter(f => f && f !== 'name'),
        )
        const auto = self.defaultColumns
          .filter(f => !hidden.has(f) && !pinned.has(f))
          .slice(0, Math.max(0, count - pinned.size))
        const keep = new Set([...auto, ...pinned])
        return [
          'name',
          ...self.candidateColumns.filter(f => f !== 'name' && keep.has(f)),
        ]
      },
    }))
}
export type TrackTableModel = Instance<
  ReturnType<typeof trackTableModelFactory>
>
export type TrackRow = TrackTableModel['filteredRows'][0]
