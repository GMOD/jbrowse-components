import { compareGroupKeys } from '@jbrowse/core/util/groupKeys'
import { isAlive } from '@jbrowse/mobx-state-tree'
import { orderRowsByValueAt } from '@jbrowse/tree-sidebar'

import { featureSpanRegion } from '../shared/fetchCanvasFeatureDetails.ts'

import type RpcManager from '@jbrowse/core/rpc/RpcManager'
import type { Region } from '@jbrowse/core/util'
import type { IStateTreeNode } from '@jbrowse/mobx-state-tree'
import type { RowSource } from '@jbrowse/tree-sidebar'

/**
 * What "Sort rows by ... here" names: the attribute clustering compares rows
 * on, since a sort and a tree over the same rows should answer the same
 * question.
 */
export function columnSortLabel(clusterField: string) {
  const field =
    clusterField === ''
      ? 'presence'
      : clusterField.startsWith('jexl:')
        ? 'expression'
        : clusterField
  return `Sort rows by ${field} here`
}

const isNumber = (value: string) => value !== '' && Number.isFinite(+value)

/**
 * Order rows by each one's value at the column: numbers highest first, as the
 * score and mark displays sort, and text in blocks of equal value, the
 * largest block on screen first so the split reads at a glance. A row whose
 * feature carries no value sorts below every value, and a row with no feature
 * below that.
 */
export function rowOrderByValues<T extends { name: string }>(
  sources: T[],
  valueByName: ReadonlyMap<string, string>,
  shown: ReadonlySet<string>,
): T[] {
  const values = [...valueByName.values()].filter(v => v !== '')
  const numeric = values.length > 0 && values.every(isNumber)
  const blockSize = new Map<string, number>()
  for (const [name, value] of valueByName) {
    if (shown.has(name)) {
      blockSize.set(value, (blockSize.get(value) ?? 0) + 1)
    }
  }
  return orderRowsByValueAt(sources, valueByName, (a, b) =>
    a === '' || b === ''
      ? Number(a === '') - Number(b === '')
      : numeric
        ? +b - +a
        : (blockSize.get(b) ?? 0) - (blockSize.get(a) ?? 0) ||
          compareGroupKeys(a, b),
  )
}

export interface ColumnSortModel extends IStateTreeNode {
  adapterConfig: Record<string, unknown>
  effectiveRowsField: string
  effectiveClusterField: string
  sources: RowSource[]
  editableSources: RowSource[]
  setRowOrder: (rows: RowSource[]) => void
}

/**
 * Read each row's `effectiveClusterField` value at one base in the worker,
 * through the resolver clustering reads, and write the order it gives.
 * Resolves whether it wrote one; an aborted sort writes nothing.
 */
export async function applyColumnSort(
  model: ColumnSortModel,
  rpc: { rpcManager: RpcManager; sessionId: string; signal: AbortSignal },
  region: Region,
  pos: number,
) {
  const valueByName = await rpc.rpcManager.call(
    rpc.sessionId,
    'MultiRowValuesAt',
    {
      adapterConfig: model.adapterConfig,
      regions: [featureSpanRegion(region, pos, pos + 1)],
      pos,
      rowsField: model.effectiveRowsField,
      clusterField: model.effectiveClusterField,
      signal: rpc.signal,
      // one base's features: nothing a bar could show
      statusCallback: undefined,
    },
  )
  if (!isAlive(model) || rpc.signal.aborted) {
    return false
  }
  model.setRowOrder(
    rowOrderByValues(
      model.editableSources,
      valueByName,
      new Set(model.sources.map(s => s.name)),
    ),
  )
  return true
}
