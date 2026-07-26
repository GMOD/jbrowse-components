import { cachedSetup } from '@jbrowse/core/data_adapters/BaseAdapter'
import { fetchAndMaybeUnzip } from '@jbrowse/core/util'
import { openLocation } from '@jbrowse/core/util/io'
import {
  makeFeatureIntervalTreeMap,
  parseLineByLine,
} from '@jbrowse/core/util/parseLineByLine'
import { ObservableCreate } from '@jbrowse/core/util/rxjs'
import { checkStopToken } from '@jbrowse/core/util/stopToken'

import { BaseAlignmentsAdapter } from '../shared/BaseAlignmentsAdapter.ts'
import { seqFetchSpan } from '../shared/seqFetchSpan.ts'
import {
  filterReadFlag,
  filterTagValue,
  parseSamHeader,
} from '../shared/util.ts'
import SamRecordFeature from './SamRecordFeature.ts'
import { parseSamHeaderLine, parseSamLine } from './parseSam.ts'

import type { FilterBy } from '../shared/types.ts'
import type { SamAdapterConfig } from './configSchema.ts'
import type { BaseOptions } from '@jbrowse/core/data_adapters/BaseAdapter'
import type { Feature, Region } from '@jbrowse/core/util'

// RNAME, the column SAM records are grouped by (QNAME, FLAG, RNAME, ...)
const RNAME_COLUMN = 2

function refNameOf(line: string) {
  let from = 0
  for (let col = 0; col < RNAME_COLUMN; col++) {
    from = line.indexOf('\t', from) + 1
  }
  const to = line.indexOf('\t', from)
  return line.slice(from, to)
}

/**
 * Plain-text SAM. The file is resident after one load, like the text GFF3/GTF
 * adapters, so there is no index and no per-region fetch: records are grouped by
 * RNAME up front and each ref's lines are parsed into an interval tree on first
 * access.
 *
 * The alignment content lives in either `samLocation` or an inline `samText`
 * string. The inline form is what makes an alignment computed at runtime —
 * a BLAT hit converted from PSL, say — into a track that survives a session
 * save without a file or a server round-trip.
 */
export default class SamAdapter extends BaseAlignmentsAdapter<SamAdapterConfig> {
  // the whole file is resident after one load, so the fetch/parse status comes
  // from inside the load itself rather than a label wrapped around it
  private loadData = cachedSetup({
    setup: async (opts?: BaseOptions) => {
      const samText = this.getConf('samText')
      const buffer = samText
        ? new TextEncoder().encode(samText)
        : await fetchAndMaybeUnzip(
            openLocation(this.getConf('samLocation'), this.pluginManager),
            opts,
          )

      const headerLines: string[] = []
      const linesByRef: Record<string, string[]> = {}
      parseLineByLine(
        buffer,
        line => {
          if (line.startsWith('@')) {
            headerLines.push(line)
          } else {
            const refName = refNameOf(line)
            // an unmapped record (RNAME '*') has no placement to draw
            if (refName !== '*') {
              ;(linesByRef[refName] ??= []).push(line)
            }
          }
          return true
        },
        opts?.statusCallback,
        { label: 'Parsing SAM', stopToken: opts?.stopToken },
      )

      // @SQ lines resolve through the same parser a BAM/CRAM binary header does
      const { idToName } = parseSamHeader(headerLines.map(parseSamHeaderLine))
      return {
        header: headerLines.join('\n'),
        intervalTreeMap: makeFeatureIntervalTreeMap(
          linesByRef,
          (lines, refName) =>
            lines.map(
              (line, i) =>
                new SamRecordFeature(
                  parseSamLine(line),
                  `${this.id}-${refName}-${i}`,
                ),
            ),
          'Parsing SAM',
        ),
        // @SQ lines are the authority when present, since they carry the
        // reference order; a headerless SAM falls back to what the records name
        refNames: idToName.length ? idToName : Object.keys(linesByRef),
      }
    },
  })

  async getRefNames(opts?: BaseOptions) {
    const { refNames } = await this.loadData(opts)
    return refNames
  }

  async getHeader(opts?: BaseOptions) {
    const { header } = await this.loadData(opts)
    return header
  }

  getFeatures(
    region: Region & { originalRefName?: string },
    opts?: BaseOptions & { filterBy?: FilterBy },
  ) {
    const { refName, start, end, originalRefName } = region
    const { stopToken, filterBy, statusCallback } = opts ?? {}
    return ObservableCreate<Feature>(async observer => {
      const { intervalTreeMap } = await this.loadData(opts)
      checkStopToken(stopToken)
      const tree = intervalTreeMap[refName]
      const records = tree
        ? tree(statusCallback)
            .search([start, end])
            .filter(record => !this.shouldFilterRecord(record, filterBy))
        : []

      // only records lacking an MD tag need the reference, so defer loading the
      // sequence adapter (and the fetch) until we know at least one does.
      //
      // One base of slack on the right: a soft/hard clip sits at its read's end
      // position and consumes no reference, but the mismatch walk's right bound
      // is exclusive and comes from what the reference string covers — so
      // without the slack the rightmost read's trailing clip is dropped, which
      // for a converted PSL hit is the unaligned end of the query.
      const recordSpan = seqFetchSpan(records, start, end)
      const span = recordSpan
        ? { start: recordSpan.start, end: Math.min(recordSpan.end + 1, end) }
        : null
      const sequenceAdapter = span ? await this.getSequenceAdapter() : undefined
      const regionSeq =
        sequenceAdapter && span
          ? await sequenceAdapter.getSequence({
              refName: originalRefName ?? refName,
              start: span.start,
              end: span.end,
            })
          : undefined
      checkStopToken(stopToken)

      for (const record of records) {
        // a record carrying MD needs no reference and walks in full, so leave
        // its span unbounded (see BamSlightlyLazyFeature.forEachMismatch)
        if (!record.NUMERIC_MD && regionSeq !== undefined && span) {
          // share the one region string; refOffset locates this read in it
          record.ref = regionSeq
          record.refOffset = record.start - span.start
        }
        observer.next(record)
      }
      observer.complete()
    }, stopToken)
  }

  // Mirrors BamAdapter/CramAdapter: flags, read name and AND-ed tag filters are
  // applied in the adapter so every alignments source honors the same filterBy.
  private shouldFilterRecord(
    record: SamRecordFeature,
    filterBy: FilterBy | undefined,
  ) {
    const {
      flagInclude = 0,
      flagExclude = 0,
      tagFilters,
      readName,
    } = filterBy ?? {}
    return (
      filterReadFlag(record.flags, flagInclude, flagExclude) ||
      (readName !== undefined && record.name !== readName) ||
      !!tagFilters?.some(tf => filterTagValue(record.tags[tf.tag], tf.value))
    )
  }
}
