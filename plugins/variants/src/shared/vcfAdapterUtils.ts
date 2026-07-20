import { downloadStatus, fetchAndMaybeUnzipText } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'

import VcfFeature from '../VcfFeature/index.ts'
import { parseSamplesTsv } from './parseSamplesTsv.ts'

import type { TabixIndexedFile } from '@gmod/tabix'
import type VcfParser from '@gmod/vcf'
import type PluginManager from '@jbrowse/core/PluginManager'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature } from '@jbrowse/core/util'
import type { FileLocation } from '@jbrowse/core/util/types'
import type { Observer } from 'rxjs'

// The samplesTsvLocation schema default; an unset slot still carries it. Only
// the empty and default uri mean "no metadata file"; a localPath/blob location
// has no uri and is treated as configured (matches openLocation).
const SAMPLES_TSV_DEFAULT_URI = '/path/to/samples.tsv'

// Sample list for a VCF: the metadata TSV when one is configured, otherwise the
// bare sample names from the VCF header. Shared by all three VCF adapters so the
// unset-slot detection can't drift between them.
export async function getVcfSources(
  samplesTsvLocation: FileLocation,
  parser: VcfParser,
  pluginManager: PluginManager | undefined,
) {
  const uri = 'uri' in samplesTsvLocation ? samplesTsvLocation.uri : undefined
  if (uri === '' || uri === SAMPLES_TSV_DEFAULT_URI) {
    return parser.samples.map(name => ({ name }))
  }
  const txt = await fetchAndMaybeUnzipText(
    openLocation(samplesTsvLocation, pluginManager),
  )
  return parseSamplesTsv(txt, parser.samples)
}

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
      }),
  )
  observer.complete()
}
