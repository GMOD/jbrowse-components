import { observer } from 'mobx-react'

import { defaultCodonTable, generateCodonTable, revcom } from '../../util'
import { calculateUTRs2, calculateUTRs, dedupe, revlist } from '../util'
import CDNASequence from './seqtypes/CDNASequence'
import CDSSequence from './seqtypes/CDSSequence'
import GenomicSequence from './seqtypes/GenomicSequence'
import ProteinSequence from './seqtypes/ProteinSequence'

import type { SequenceFeatureDetailsModel } from './model'
import type { SimpleFeatureSerialized } from '../../util'
import type { SeqState } from '../util'

const SequenceContents = observer(function ({
  mode,
  feature,
  sequence,
  model,
}: {
  mode: string
  feature: SimpleFeatureSerialized
  sequence: SeqState
  model: SequenceFeatureDetailsModel
}) {
  let { seq, upstream = '', downstream = '' } = sequence
  const children =
    feature.subfeatures
      ?.sort((a, b) => a.start - b.start)
      .map(sub => ({
        ...sub,
        start: sub.start - feature.start,
        end: sub.end - feature.start,
      })) || []

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
  let utr = dedupe(children.filter(sub => sub.type?.match(/utr/i)))
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
  return (
    <>
      {mode === 'genomic' ? (
        <GenomicSequence feature={feature} model={model} sequence={seq} />
      ) : mode === 'genomic_sequence_updownstream' ? (
        <GenomicSequence
          model={model}
          feature={feature}
          sequence={seq}
          upstream={upstream}
          downstream={downstream}
        />
      ) : mode === 'cds' ? (
        <CDSSequence model={model} cds={cds} sequence={seq} />
      ) : mode === 'cdna' ? (
        <CDNASequence
          model={model}
          exons={exons}
          feature={feature}
          cds={cds}
          utr={utr}
          sequence={seq}
        />
      ) : mode === 'protein' ? (
        <ProteinSequence
          model={model}
          cds={cds}
          codonTable={generateCodonTable(defaultCodonTable)}
          sequence={seq}
        />
      ) : mode === 'gene' ? (
        <CDNASequence
          model={model}
          exons={exons}
          feature={feature}
          cds={cds}
          utr={utr}
          sequence={seq}
          includeIntrons
        />
      ) : mode === 'gene_collapsed_intron' ? (
        <CDNASequence
          model={model}
          exons={exons}
          feature={feature}
          cds={cds}
          sequence={seq}
          utr={utr}
          includeIntrons
          collapseIntron
        />
      ) : mode === 'gene_updownstream' ? (
        <CDNASequence
          model={model}
          exons={exons}
          feature={feature}
          cds={cds}
          sequence={seq}
          utr={utr}
          upstream={upstream}
          downstream={downstream}
          includeIntrons
        />
      ) : mode === 'gene_updownstream_collapsed_intron' ? (
        <CDNASequence
          model={model}
          exons={exons}
          feature={feature}
          cds={cds}
          sequence={seq}
          utr={utr}
          upstream={upstream}
          downstream={downstream}
          includeIntrons
          collapseIntron
        />
      ) : (
        <div>Unknown type</div>
      )}
    </>
  )
})

export default SequenceContents
