import {
  canonicalSpelling,
  getConfigurationSchemaMetadata,
  isKeyedWrites,
  keyedBase,
  readConfObject,
} from '@jbrowse/core/configuration'
import { baseDisplayConfig } from '@jbrowse/core/util/baseDisplayConfig'
import { getSnapshot } from '@jbrowse/mobx-state-tree'

import type { TreeSidebarConfigModel } from './treeSidebarRowViews.ts'
import type {
  AnyConfigurationModel,
  KeyedWrites,
} from '@jbrowse/core/configuration'
import type { ROW_ARRANGEMENT_MEMBERS } from '@jbrowse/display-kit/rowArrangementConfigSchema'

export type ArrangementMember = (typeof ROW_ARRANGEMENT_MEMBERS)[number]

export type RowsMembers = Partial<
  Record<ArrangementMember | 'filter' | 'color', unknown>
>

/** What reading a display's `rows` against its base reads: the display. */
export interface BaseRowsHost {
  configuration: TreeSidebarConfigModel & { displayId: string }
}

/**
 * An empty list or map is the member's default, which a stripped snapshot
 * leaves out, so the two spellings compare as one.
 */
export function present(value: unknown) {
  if (Array.isArray(value)) {
    return value.length ? value : undefined
  }
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value).length ? value : undefined
  }
  return value
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * The one read of the base's `rows`: in the spelling the live one is stored
 * in, so a `rows.tree` written as its newick compares equal to the object it
 * lifts to, less what names the base field's rows once the live rows are on
 * another field (the keyed rule, ADR-257), so a reset returns no arrangement
 * of the old rows to the new ones. A base stating no field names no field, so
 * its arrangement returns on any, as a write from an empty field keeps one.
 * It does not name the field a mark display's default plot picks: re-derived
 * from the latest scan that is wrong after a reload or a rescan, and a
 * recorded pick is display state a re-shown track loses.
 */
export function baseRows(self: BaseRowsHost): RowsMembers {
  const { rows } = baseDisplayConfig(self)
  const live: AnyConfigurationModel = self.configuration.rows
  const meta = getConfigurationSchemaMetadata(live)!
  const { writes } = meta.options
  const base = isRecord(rows) ? canonicalSpelling(meta, rows) : {}
  return isKeyedWrites(writes)
    ? keyedBase(writes, base, keyedFieldOf(live, writes))
    : base
}

function keyedFieldOf(live: AnyConfigurationModel, writes: KeyedWrites) {
  const value: unknown = readConfObject(live, writes.keyedBy)
  return { [writes.keyedBy]: value }
}

/** The live `rows`, as a snapshot to compare against `baseRows`. */
export function liveRows(self: BaseRowsHost): RowsMembers {
  return getSnapshot(self.configuration.rows)
}
