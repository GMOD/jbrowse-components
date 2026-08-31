import { cachedSetup } from '@jbrowse/core/data_adapters/BaseAdapter'
import {
  ObservableCreate,
  subscribeToObservable,
} from '@jbrowse/core/util/rxjs'

import MafFeature from '../MafFeature.ts'
import { MafAdapterBase } from '../util/MafAdapterBase.ts'
import { buildSampleFilter } from '../util/getSamples.ts'
import { loadSubAdapter } from '../util/loadSubAdapter.ts'
import {
  makeSourceResolver,
  scanMafTabixEntry,
  selectReferenceSequenceString,
} from '../util/parseAssemblyName.ts'

import type { AlignmentRecord, MafAdapterOptions } from '../types.ts'
import type { SubAdapterLoader } from '../util/loadSubAdapter.ts'
import type { MafTabixAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

/**
 * The packed per-species alignment column of a `maf2bed` / `maf_to_bed.py` BED:
 * the 6th, which `@gmod/bed` names `field5` on a **headerless** file.
 *
 * Guarded rather than cast because that name is not universal, and the way to
 * lose it is an easy mistake to make: `BedTabixAdapter` takes its column names
 * from a `#` header line when the file has one (or from an `autoSql` config),
 * and the summary BED this adapter's own `summaryAdapter` slot wants — the
 * sibling file `maf2bed --summary` writes in the same pass — has exactly such a
 * header. Swap the two paths and every feature reaches `.split` on `undefined`,
 * which surfaces as `Cannot read properties of undefined` with nothing in it
 * naming a MAF, a column, or a file.
 */
function alignmentColumn(feature: Feature) {
  const encoded = feature.get('field5')
  if (typeof encoded !== 'string') {
    throw new Error(
      `MafTabixAdapter: no alignment column at ${feature.get('refName')}:${feature.get('start')}. ` +
        'Expected column 6 of a headerless BED, holding every species as ' +
        '`sample.chr:start:size:strand:srcSize:seq` — check that bedGzLocation is ' +
        'the alignment BED and not the `--summary` one.',
    )
  }
  return encoded
}

export default class MafTabixAdapter extends MafAdapterBase<MafTabixAdapterConfig> {
  private configure: SubAdapterLoader = cachedSetup({
    label: 'Downloading index',
    setup: () => loadSubAdapter(this, 'BedTabixAdapter'),
  })

  async getRefNames(opts?: BaseOptions) {
    const { adapter } = await this.configure(opts)
    return adapter.getRefNames()
  }

  async getHeader(opts?: BaseOptions) {
    const { adapter } = await this.configure(opts)
    return adapter.getHeader()
  }

  getFeatures(query: Region, opts?: MafAdapterOptions) {
    return ObservableCreate<Feature>(async observer => {
      const { adapter } = await this.configure(opts)
      const refAssemblyName = this.getConf('refAssemblyName')
      const resolver = makeSourceResolver(buildSampleFilter(opts))

      await subscribeToObservable(adapter.getFeatures(query, opts), feature => {
        const encoded = alignmentColumn(feature)
        const alignments: Record<string, AlignmentRecord> = {}
        // Per feature, not per query: the last-resort reference is this
        // stanza's own first species. MAF puts the reference first in every
        // stanza, so this is the same answer on a well-formed file — but
        // carrying one stanza's choice across the rest meant a stanza that
        // happened to lack that species resolved to no reference sequence at
        // all, and a block with an empty reference has no genomic extent, so
        // it vanished from the rows and from coverage.
        let firstAssemblyNameFound: string | undefined

        // Walked with `indexOf` rather than `split(',')`. This column holds
        // every species' bases for the block, so it is nearly the whole line,
        // and splitting it built an array of one string per species on every
        // block — tens of thousands of throwaway strings per fetch, whose only
        // surviving content is the `seq` each one ends with. `scanMafTabixEntry`
        // slices out just that.
        for (let from = 0, l = encoded.length; from < l;) {
          let to = encoded.indexOf(',', from)
          if (to === -1) {
            to = l
          }
          const entry = scanMafTabixEntry(encoded, from, to, resolver.resolve)
          if (entry) {
            const { assemblyName, chr, start, strand, srcSize, seq } = entry
            if (!firstAssemblyNameFound) {
              firstAssemblyNameFound = assemblyName
            }
            alignments[assemblyName] = { chr, start, strand, srcSize, seq }
          }
          from = to + 1
        }

        observer.next(
          new MafFeature(
            feature.id(),
            feature.get('start'),
            feature.get('end'),
            feature.get('refName'),
            0, // strand determined per-alignment
            alignments,
            selectReferenceSequenceString(
              alignments,
              refAssemblyName,
              query.assemblyName,
              firstAssemblyNameFound,
            ) ?? '',
          ),
        )
      })

      resolver.reportUnmatched()
      observer.complete()
    }, opts?.stopToken)
  }

  // Byte budget for the fetch gate comes straight from the tabix index (the
  // .bed.gz already contains every species' sequence, so the compressed block
  // size is a faithful download estimate). No feature download.
  async getRegionByteSize(regions: Region[], opts?: BaseOptions) {
    const { adapter } = await this.configure(opts)
    return adapter.getRegionByteSize(regions, opts)
  }
}
