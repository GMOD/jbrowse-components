import { downloadStatus } from '@jbrowse/core/util'

import VcfFeature from '../VcfFeature/index.ts'

import type { TabixIndexedFile } from '@gmod/tabix'
import type VcfParser from '@gmod/vcf'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { Observer } from 'rxjs'

// Stream tabix VCF lines for a region as VcfFeatures onto an observer, wrapping
// the download in a determinate progress bar. Shared by VcfTabixAdapter and
// SplitVcfTabixAdapter, whose getFeatures bodies were otherwise identical.
export async function streamVcfFeatures(
  {
    vcf,
    parser,
    idPrefix,
  }: { vcf: TabixIndexedFile; parser: VcfParser; idPrefix: string },
  query: { refName: string; start: number; end: number },
  opts: BaseOptions,
  observer: Observer<Feature>,
) {
  const { refName, start, end } = query
  // downloadStatus shows the label and clears when done; the onProgress it hands
  // back upgrades the in-between status to a determinate bar as blocks download
  await downloadStatus(
    'Downloading variants',
    opts.statusCallback,
    onProgress =>
      vcf.getLines(refName, start, end, {
        lineCallback: (line, fileOffset) => {
          observer.next(
            new VcfFeature({
              variant: parser.parseLine(line),
              parser,
              id: `${idPrefix}-vcf-${fileOffset}`,
            }),
          )
        },
        onProgress,
        signal: opts.signal,
      }),
  )
  observer.complete()
}
