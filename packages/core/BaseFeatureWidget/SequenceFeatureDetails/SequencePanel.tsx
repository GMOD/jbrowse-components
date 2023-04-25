import React from 'react'

import { defaultCodonTable, generateCodonTable, revcom } from '../../util'
import {
  ParentFeat,
  SeqState,
  calculateUTRs,
  calculateUTRs2,
  dedupe,
  revlist,
} from '../util'
import CDNASequence from './CDNASequence'
import ProteinSequence from './ProteinSequence'
import GenomicSequence from './GenomicSequence'
import CDSSequence from './CDSSequence'

interface SeqPanelProps {
  sequence: SeqState
  feature: ParentFeat
  mode: string
  intronBp?: number
}
const SeqPanel = React.forwardRef<HTMLDivElement, SeqPanelProps>(function (
  props,
  ref,
) {
  const { feature, mode, intronBp = 10 } = props
  let {
    sequence: { seq, upstream = '', downstream = '' },
  } = props
  const { subfeatures = [] } = feature

  const children = subfeatures
    .sort((a, b) => a.start - b.start)
    .map(sub => ({
      ...sub,
      start: sub.start - feature.start,
      end: sub.end - feature.start,
    }))

  // we filter duplicate entries in cds and exon lists duplicate entries may be
  // rare but was seen in Gencode v36 track NCList, likely a bug on GFF3 or
  // probably worth ignoring here (produces broken protein translations if
  // included)
  //
  // position 1:224,800,006..225,203,064 gene ENSG00000185842.15 first
  // transcript ENST00000445597.6
  //
  // http://localhost:3000/?config=test_data%2Fconfig.json&session=share-FUl7G1isvF&password=HXh5Y

  let cds = dedupe(children.filter(sub => sub.type === 'CDS'))
  let utr = dedupe(children.filter(sub => sub.type.match(/utr/i)))
  let exons = dedupe(children.filter(sub => sub.type === 'exon'))

  if (!utr.length && cds.length && exons.length) {
    utr = calculateUTRs(cds, exons)
  }
  if (!utr.length && cds.length && !exons.length) {
    utr = calculateUTRs2(cds, {
      start: 0,
      end: feature.end - feature.start,
      type: 'gene',
    })
  }

  if (feature.strand === -1) {
    // doing this in a single assignment is needed because downstream and
    // upstream are swapped so this avoids a temp variable
    ;[seq, upstream, downstream] = [
      revcom(seq),
      revcom(downstream),
      revcom(upstream),
    ]
    cds = revlist(cds, seq.length)
    exons = revlist(exons, seq.length)
    utr = revlist(utr, seq.length)
  }
  const codonTable = generateCodonTable(defaultCodonTable)

  return (
    <div ref={ref} data-testid="sequence_panel">
      <div
        style={{
          /* raw styles instead of className so that html copy works */
          fontFamily: 'monospace',
          wordWrap: 'break-word',
          overflow: 'auto',
          color: 'black',
          fontSize: 12,
          maxWidth: 600,
          maxHeight: 300,
        }}
      >
        <span style={{ background: 'white' }}>
          {`>${
            feature.name ||
            feature.id ||
            `${feature.refName}:${feature.start + 1}-${feature.end}`
          }-${mode}\n`}
        </span>
        <br />
        {mode === 'genomic' ? (
          <GenomicSequence sequence={seq} />
        ) : mode === 'genomic_sequence_updownstream' ? (
          <GenomicSequence
            sequence={seq}
            upstream={upstream}
            downstream={downstream}
          />
        ) : mode === 'cds' ? (
          <CDSSequence cds={cds} sequence={seq} />
        ) : mode === 'cdna' ? (
          <CDNASequence
            exons={exons}
            cds={cds}
            utr={utr}
            sequence={seq}
            intronBp={intronBp}
          />
        ) : mode === 'protein' ? (
          <ProteinSequence cds={cds} codonTable={codonTable} sequence={seq} />
        ) : mode === 'gene' ? (
          <CDNASequence
            exons={exons}
            cds={cds}
            utr={utr}
            sequence={seq}
            includeIntrons
            intronBp={intronBp}
          />
        ) : mode === 'gene_collapsed_intron' ? (
          <CDNASequence
            exons={exons}
            cds={cds}
            sequence={seq}
            utr={utr}
            includeIntrons
            collapseIntron
            intronBp={intronBp}
          />
        ) : mode === 'gene_updownstream' ? (
          <CDNASequence
            exons={exons}
            cds={cds}
            sequence={seq}
            utr={utr}
            upstream={upstream}
            downstream={downstream}
            includeIntrons
            intronBp={intronBp}
          />
        ) : mode === 'gene_updownstream_collapsed_intron' ? (
          <CDNASequence
            exons={exons}
            cds={cds}
            sequence={seq}
            utr={utr}
            upstream={upstream}
            downstream={downstream}
            includeIntrons
            collapseIntron
            intronBp={intronBp}
          />
        ) : (
          <div>Unknown type</div>
        )}
      </div>
    </div>
  )
})

export default SeqPanel
