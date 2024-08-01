import {
  Feature,
  assembleLocString,
  getEnv,
  getSession,
} from '@jbrowse/core/util'
import { getParent } from 'mobx-state-tree'
import { VcfFeature } from '@jbrowse/plugin-variants'
import VCF, { parseBreakend } from '@gmod/vcf'

// locals
import { locationLinkClick } from '../components/util'
import { SpreadsheetModel } from '../models/Spreadsheet'

export function parseStrand(strand: string) {
  if (strand === '+') {
    return 1
  } else if (strand === '-') {
    return -1
  } else if (strand === '.') {
    return 0
  } else {
    return undefined
  }
}

export async function launchLinearGenomeView({
  model,
  value,
}: {
  model: SpreadsheetModel
  value: string
}) {
  try {
    await locationLinkClick(model, value)
  } catch (e) {
    console.error(e)
    getSession(model).notify(`${e}`, 'error')
  }
}

export async function launchBreakpointSplitView({
  model,
  row,
  vcfParser,
}: {
  model: SpreadsheetModel
  row: Record<string, unknown>
  vcfParser: VCF
}) {
  try {
    const session = getSession(model)
    const { pluginManager } = getEnv(model)
    const { assemblyName } = model
    if (!assemblyName) {
      throw new Error('assemblyName not set')
    }
    const viewType = pluginManager.getViewType('BreakpointSplitView')
    const feat = new VcfFeature({
      id: row.id as string,
      // eslint-disable-next-line no-underscore-dangle
      variant: vcfParser.parseLine(row.___lineData as string),
      parser: vcfParser,
    })
    // @ts-expect-error
    const snap = await viewType.snapshotFromBreakendFeature(
      feat,
      assemblyName,
      session,
    )
    const v = getParent<{ width: number }>(model)
    snap.views[0].offsetPx -= v.width / 2 + 100
    snap.views[1].offsetPx -= v.width / 2 + 100

    session.addView('BreakpointSplitView', snap)
  } catch (e) {
    console.error(e)
    getSession(model).notify(`${e}`, 'error')
  }
}

function getBreakpoints(feature: Feature) {
  const alt = feature.get('ALT')?.[0]

  const bnd = alt ? parseBreakend(alt) : undefined
  let endPos
  let mateRefName: string | undefined

  // a VCF breakend feature
  if (alt === '<TRA>') {
    const INFO = feature.get('INFO')
    endPos = INFO.END[0] - 1
    mateRefName = INFO.CHR2[0]
  } else if (bnd?.MatePosition) {
    const matePosition = bnd.MatePosition.split(':')
    endPos = +matePosition[1] - 1
    mateRefName = matePosition[0]
  } else if (feature.get('mate')) {
    const mate = feature.get('mate')
    mateRefName = mate.refName
    endPos = mate.start
  }

  return [
    {
      refName: feature.get('refName'),
      start: feature.get('start') - 1000,
      end: feature.get('end') + 1000,
    },
    {
      refName: mateRefName!,
      start: endPos - 1000,
      end: endPos + 1000,
    },
  ] as const
}
export async function launchLinearGenomeViewWithEndFocus({
  model,
  row,
}: {
  model: SpreadsheetModel
  row: Record<string, unknown>
}) {
  try {
    const { feature } = row
    const [s1, s2] = getBreakpoints(feature as Feature)
    await locationLinkClick(
      model,
      `${assembleLocString(s1)} ${assembleLocString(s2)}`,
    )
  } catch (e) {
    console.error(e)
    getSession(model).notify(`${e}`, 'error')
  }
}
