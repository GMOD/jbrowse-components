import { vcfRecordSpan } from '@jbrowse/add-track-core'
import { downloadStatus, updateStatus } from '@jbrowse/core/util'
import { getSamplesTsvSources } from '@jbrowse/core/util/samplesTsv'

import VcfFeature from '../VcfFeature/index.ts'
import { HAPLOTYPE_ROW_FIELDS } from './constants.ts'

import type { TabixIndexedFile } from '@gmod/tabix'
import type VcfParser from '@gmod/vcf'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { FileLocation } from '@jbrowse/core/util/types'
import type { Observer } from 'rxjs'

// The index answers by the extent @gmod/tabix reads off a line, which is not
// always the span the feature draws (a breakend's END names its mate), and a
// record ending exactly at the region's start touches it without overlapping.
export function overlapsRegion(
  span: { start: number; end: number },
  region: { start: number; end: number },
) {
  return span.end > region.start && span.start < region.end
}

// Stream tabix VCF lines for a region as VcfFeatures onto an observer, wrapping
// the download in a determinate progress bar. Shared by VcfTabixAdapter and
// SplitVcfTabixAdapter, whose getFeatures bodies were otherwise identical.
// The parser may still be waiting on the header: the download starts anyway,
// and lines that arrive first wait for it.
export async function streamVcfFeatures(
  {
    vcf,
    parser,
    idPrefix,
  }: {
    vcf: TabixIndexedFile
    parser: VcfParser | Promise<VcfParser>
    idPrefix: string
  },
  query: { refName: string; start: number; end: number },
  opts: BaseOptions,
  observer: Observer<Feature>,
) {
  const { refName, start, end } = query
  let ready: VcfParser | undefined
  const early: { line: string; fileOffset: number }[] = []
  const emit = (
    p: VcfParser,
    { line, fileOffset }: { line: string; fileOffset: number },
  ) => {
    const feature = new VcfFeature({
      variant: p.parseLine(line),
      parser: p,
      id: `${idPrefix}-${fileOffset}`,
    })
    if (
      overlapsRegion(
        { start: feature.get('start'), end: feature.get('end') },
        query,
      )
    ) {
      observer.next(feature)
    }
  }
  const parsed = Promise.resolve(parser).then(resolved => {
    ready = resolved
    for (const line of early.splice(0)) {
      emit(resolved, line)
    }
  })
  // downloadStatus shows the label and clears when done; the onProgress it hands
  // back upgrades the in-between status to a determinate bar as blocks download
  await Promise.all([
    parsed,
    downloadStatus('Downloading variants', opts.statusCallback, onProgress =>
      vcf.getLines(refName, start, end, {
        lineCallback: (line, fileOffset) => {
          if (ready) {
            emit(ready, { line, fileOffset })
          } else {
            early.push({ line, fileOffset })
          }
        },
        onProgress,
        signal: opts.signal,
      }),
    ),
  ])
  observer.complete()
}

/**
 * Append the lines whose span overlaps each region, a line spanning two of
 * them once.
 */
export async function appendVcfLines(
  lines: string[],
  vcf: TabixIndexedFile,
  parser: VcfParser,
  regions: { refName: string; start: number; end: number }[],
  opts?: BaseOptions,
) {
  const seen = new Set<number>()
  for (const { refName, start, end } of regions) {
    await updateStatus('Exporting variants', opts?.statusCallback, () =>
      vcf.getLines(refName, start, end, {
        lineCallback: (line, fileOffset) => {
          if (!seen.has(fileOffset)) {
            const span = vcfRecordSpan(parser.parseLine(line))
            if (overlapsRegion(span, { start, end })) {
              seen.add(fileOffset)
              lines.push(line)
            }
          }
        },
        ...opts,
      }),
    )
  }
}

/**
 * The sources of one VCF, or of several whose headers list different samples
 * (a chrY file holds only the males): the first header's samples in its order,
 * then each name a later header adds, merged with the samples table when the
 * adapter has one, less any column naming a field the display writes on its
 * haplotype rows. `getSources` is the base-class contract and drops the
 * warnings, `MultiSampleVariantGetSources` takes this one so the display can
 * report them.
 */
export async function vcfSourcesAndWarnings({
  parsers,
  samplesTsvLocation,
  pluginManager,
  opts,
}: {
  parsers: readonly VcfParser[]
  samplesTsvLocation: FileLocation | undefined
  pluginManager: PluginManager | undefined
  opts?: BaseOptions
}) {
  const { sources, warnings } = await getSamplesTsvSources({
    location: samplesTsvLocation,
    names: [...new Set(parsers.flatMap(parser => parser.samples))],
    namesLabel: 'the VCF',
    pluginManager,
    opts,
  })
  const reserved: string[] = HAPLOTYPE_ROW_FIELDS.filter(field =>
    sources.some(source => Object.hasOwn(source, field)),
  )
  return reserved.length
    ? {
        sources: sources.map(source => ({
          ...Object.fromEntries(
            Object.entries(source).filter(([key]) => !reserved.includes(key)),
          ),
          name: source.name,
        })),
        warnings: [
          ...warnings,
          `The samples metadata file's ${reserved.map(f => `"${f}"`).join(', ')} ${reserved.length > 1 ? 'columns are' : 'column is'} ignored, since the variant display names its own rows' fields so: rename it, or put a display name in a "label" column`,
        ],
      }
    : { sources, warnings }
}

/**
 * The contigs a VCF holds records on, which its index or its records name,
 * each with the length its `##contig` line states.
 */
export function vcfContigs(refNames: string[], metadata: unknown) {
  const declared = (
    metadata as { contig?: Record<string, { length?: unknown }> }
  ).contig
  return refNames.map(refName => {
    const length = Number(declared?.[refName]?.length)
    return {
      refName,
      length: Number.isFinite(length) ? length : undefined,
      hasData: true,
    }
  })
}
