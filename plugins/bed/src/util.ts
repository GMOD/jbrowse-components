import { parseLineByLine } from '@jbrowse/core/util/parseLineByLine'

import {
  generateBedMethylFeature,
  isBedMethylFeature,
} from './generateBedMethylFeature.ts'
import { parseRepeatMaskerDescription } from './generateRepeatMaskerFeature.ts'
import {
  generateUcscTranscript,
  isUcscTranscript,
} from './generateUcscTranscript.ts'

import type { MinimalFeature } from './types.ts'
import type BED from '@gmod/bed'
import type { StatusCallback } from '@jbrowse/core/util'

interface BedData {
  strand?: string | number
  score?: string | number
  chrom?: string
  chromStart?: number | string
  chromEnd?: number | string
  description?: string
  blockCount?: number
  chromStarts?: number[]
  blockSizes?: number[]
  blockStarts?: number[]
  thickStart?: number
  thickEnd?: number
  [key: string]: unknown
}

export interface FeatureData {
  uniqueId: string
  refName: string
  start: number
  end: number
  strand?: number
  score?: number
  type?: string
  subfeatures?: MinimalFeature[]
  [key: string]: unknown
}

// Heuristically split features and header from a buffered BED file, bucketing
// data lines by the first tab-separated column (refName).
export function bucketBedLines(
  buffer: Uint8Array,
  statusCallback?: StatusCallback,
) {
  const features: Record<string, string[]> = {}
  const headerLines: string[] = []
  parseLineByLine(
    buffer,
    line => {
      if (line.startsWith('#')) {
        headerLines.push(line)
      } else {
        const tab = line.indexOf('\t')
        const refName = line.slice(0, tab)
        features[refName] ??= []
        features[refName].push(line)
      }
      return true
    },
    statusCallback,
  )
  return { header: headerLines.join('\n'), features }
}

function defaultParser(fields: string[], splitLine: string[]): BedData {
  const obj: Record<string, string> = {}
  for (const [i, element] of splitLine.entries()) {
    const field = fields[i]
    // '.' is BED's "missing" marker; skip it so this path matches @gmod/bed's
    // parseLine (which leaves such columns unset) instead of storing a literal
    // '.' that later coerces to NaN
    if (field && element !== '.') {
      obj[field] = element
    }
  }

  // heuristically take the 'slow path' only when block fields are present, as
  // GWAS-type BED data can be very large and we avoid the extra work for it
  if ('blockCount' in obj) {
    const {
      blockStarts,
      blockCount,
      chromStarts,
      thickEnd,
      thickStart,
      blockSizes,
      exonFrames,
      _exonFrames,
      ...rest
    } = obj
    return {
      ...rest,
      blockStarts: arrayify(blockStarts),
      chromStarts: arrayify(chromStarts),
      blockSizes: arrayify(blockSizes),
      // exonFrames is int[blockCount] like the block lists; generateUcscTranscript
      // reads it (or its _exonFrames alias) as number[] to derive CDS phases
      exonFrames: arrayify(exonFrames),
      _exonFrames: arrayify(_exonFrames),
      thickStart: thickStart ? +thickStart : undefined,
      thickEnd: thickEnd ? +thickEnd : undefined,
      blockCount: blockCount ? +blockCount : undefined,
    }
  }
  return obj
}

export function makeBlocks({
  start,
  uniqueId,
  refName,
  chromStarts,
  blockCount,
  blockSizes,
  blockStarts,
}: {
  blockCount: number
  start: number
  uniqueId: string
  refName: string
  chromStarts?: number[]
  blockSizes?: number[]
  blockStarts?: number[]
}) {
  const subfeatures: MinimalFeature[] = []
  const starts = chromStarts ?? blockStarts ?? []
  for (let b = 0; b < blockCount; b++) {
    const bmin = (starts[b] ?? 0) + start
    const bsize = blockSizes?.[b]
    if (bsize && bsize > 0) {
      subfeatures.push({
        uniqueId: `${uniqueId}-${b}`,
        start: bmin,
        end: bmin + bsize,
        refName,
        type: 'block',
      })
    }
  }
  return subfeatures
}

export function parseNamesFromHeader(header: string) {
  const defs = header.split(/\n|\r\n|\r/).filter(Boolean)
  const defline = defs.at(-1)
  return defline?.includes('\t')
    ? defline
        .slice(1)
        .split('\t')
        .map(f => f.trim())
    : undefined
}

export function parseStrand(strand: string | number | undefined): number {
  if (strand === '-' || strand === -1) {
    return -1
  }
  if (strand === '+' || strand === 1) {
    return 1
  }
  return 0
}

export function arrayify(f: string | undefined): number[] | undefined {
  // BED block columns are conventionally comma-terminated ("200,300,200,");
  // drop the trailing empty so we don't emit a trailing NaN
  return f === undefined
    ? undefined
    : f.replace(/,$/, '').split(',').map(Number)
}

export function featureData({
  splitLine,
  refName,
  start,
  end,
  parser,
  uniqueId,
  scoreColumn,
  names,
  disableGeneHeuristic,
}: {
  splitLine: string[]
  refName: string
  start: number
  end: number
  parser: BED
  uniqueId: string
  scoreColumn: string
  names?: string[]
  disableGeneHeuristic?: boolean
}): FeatureData {
  // bedMethyl detection runs on raw splitLine before parsing
  if (isBedMethylFeature({ splitLine, start, end })) {
    return generateBedMethylFeature({
      splitLine,
      uniqueId,
      refName,
      start,
      end,
    })
  }

  const data: BedData = names
    ? defaultParser(names, splitLine)
    : parser.parseLine(splitLine, { uniqueId })
  const {
    strand: strandRaw,
    score: scoreRaw,
    chrom,
    chromStart,
    chromEnd,
    ...rest
  } = data
  const strand = parseStrand(strandRaw)
  const rawScore = scoreColumn ? data[scoreColumn] : scoreRaw
  const score = rawScore === undefined ? undefined : Number(rawScore)

  const repeat = parseRepeatMaskerDescription(rest.description)
  if (repeat) {
    const {
      description,
      chromStarts,
      blockSizes,
      blockStarts,
      blockCount,
      thickStart,
      thickEnd,
      ...rest2
    } = rest
    return {
      ...rest2,
      ...repeat,
      uniqueId,
      score,
      start,
      end,
      strand,
      refName,
    }
  }

  const subfeatures = rest.blockCount
    ? makeBlocks({
        start,
        uniqueId,
        refName,
        chromStarts: rest.chromStarts,
        blockCount: rest.blockCount,
        blockSizes: rest.blockSizes,
        blockStarts: rest.blockStarts,
      })
    : undefined

  const transcriptCheck = {
    strand,
    blockCount: rest.blockCount,
    thickStart: rest.thickStart,
    thickEnd: rest.thickEnd,
  }
  if (
    !disableGeneHeuristic &&
    subfeatures &&
    isUcscTranscript(transcriptCheck)
  ) {
    return generateUcscTranscript({
      ...rest,
      score,
      start,
      end,
      strand: transcriptCheck.strand,
      refName,
      uniqueId,
      subfeatures,
      thickStart: transcriptCheck.thickStart,
      thickEnd: transcriptCheck.thickEnd,
    })
  }
  return {
    ...rest,
    uniqueId,
    score,
    start,
    end,
    strand,
    refName,
    subfeatures,
  }
}
