import { getSnapshot, isStateTreeNode } from 'mobx-state-tree'

import { assembleLocStringFast } from '.'

import type { Region } from './types'
import type { Region as RegionModel } from './types/mst'
import type { Instance } from 'mobx-state-tree'

export function getParentRegion(
  region: Region | Instance<typeof RegionModel>,
) {
  return isStateTreeNode(region) ? getSnapshot(region) : region
}

export function calculateRegionWidthPx(
  regionStart: number,
  regionEnd: number,
  invBpPerPx: number,
) {
  return (regionEnd - regionStart) * invBpPerPx
}

export function shouldAddInterRegionPadding(
  regionWidthPx: number,
  minimumBlockWidth: number,
  regionNumber: number,
  totalRegions: number,
) {
  return (
    regionWidthPx >= minimumBlockWidth && regionNumber < totalRegions - 1
  )
}

export function generateBlockKey(
  assemblyName: string,
  refName: string,
  start: number,
  end: number,
  reversed: boolean | undefined,
  regionNumber: number,
) {
  return `${assembleLocStringFast({
    assemblyName,
    refName,
    start,
    end,
    reversed,
  })}-${regionNumber}${reversed ? '-reversed' : ''}`
}

export function shouldElideRegion(
  regionWidthPx: number,
  minimumBlockWidth: number,
) {
  return regionWidthPx < minimumBlockWidth
}

export function accumulateOffset(
  currentOffset: number,
  regionStart: number,
  regionEnd: number,
  invBpPerPx: number,
  shouldAddPadding: boolean,
  paddingWidth: number,
) {
  const regionOffset = (regionEnd - regionStart) * invBpPerPx
  const paddingOffset = shouldAddPadding ? paddingWidth : 0
  return currentOffset + regionOffset + paddingOffset
}

export function accumulateOffsetBp(
  currentOffsetBp: number,
  regionStart: number,
  regionEnd: number,
  shouldAddPadding: boolean,
  paddingWidth: number,
  bpPerPx: number,
) {
  const regionOffsetBp = regionEnd - regionStart
  const paddingOffsetBp = shouldAddPadding ? paddingWidth * bpPerPx : 0
  return currentOffsetBp + regionOffsetBp + paddingOffsetBp
}
