import { downloadStatus, updateStatus } from '@jbrowse/core/util'

import VcfFeature from '../VcfFeature/index.ts'

import type { TabixIndexedFile } from '@gmod/tabix'
import type VcfParser from '@gmod/vcf'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Observer } from 'rxjs'

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
    observer.next(
      new VcfFeature({
        variant: p.parseLine(line),
        parser: p,
        id: `${idPrefix}-vcf-${fileOffset}`,
      }),
    )
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
 * Append the lines overlapping each region, a line spanning two of them once.
 */
export async function appendVcfLines(
  lines: string[],
  vcf: TabixIndexedFile,
  regions: { refName: string; start: number; end: number }[],
  opts?: BaseOptions,
) {
  const seen = new Set<number>()
  for (const { refName, start, end } of regions) {
    await updateStatus('Exporting variants', opts?.statusCallback, () =>
      vcf.getLines(refName, start, end, {
        lineCallback: (line, fileOffset) => {
          if (!seen.has(fileOffset)) {
            seen.add(fileOffset)
            lines.push(line)
          }
        },
        ...opts,
      }),
    )
  }
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
