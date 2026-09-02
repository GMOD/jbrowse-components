export {
  CIGAR_D,
  CIGAR_EQ,
  CIGAR_H,
  CIGAR_I,
  CIGAR_INDEL_MASK,
  CIGAR_M,
  CIGAR_M_EQ_MASK,
  CIGAR_N,
  CIGAR_P,
  CIGAR_RUN,
  CIGAR_S,
  CIGAR_X,
} from './cigarConstants.ts'
export {
  coarseCigarOwnAxis,
  coarsenCigar,
  flipCoarseCigar,
  parseCoarseCigar,
  swapCoarseCigar,
} from './coarseCigar.ts'
export type { CoarsenedCigar } from './coarseCigar.ts'
export {
  CHAR_FROM_CODE,
  SEQRET,
  SEQRET_NUMERIC_DECODER,
} from './bamSeqDecoder.ts'
export { encodeSeqNumeric } from './bamSeqEncoder.ts'
// The BAM mismatch walk and its packed reference come from `@gmod/bam`:
// `forEachMismatchNumeric`, `packReference`, `PackedReference`. One
// implementation of the format's trickiest walk, in the library that owns the
// format.
export { flipCigar, swapIndelCigar } from './cigarReorient.ts'
export { csToCigar } from './csToCigar.ts'
export { flipCs, forEachCsMismatch, forEachCsOp } from './csOps.ts'
export type { CsOp } from './csOps.ts'
export { orientAlignment } from './orientAlignment.ts'
export { pafIdentity } from './pafIdentity.ts'
export {
  DELETION_TYPE,
  HARDCLIP_TYPE,
  INSERTION_TYPE,
  MISMATCH_TYPE,
  SKIP_TYPE,
  SOFTCLIP_TYPE,
} from './mismatchCallback.ts'
export type { MismatchCallback, MismatchWindow } from './mismatchCallback.ts'
export { visitCigarRenderedSegments } from './cigarRenderedSegments.ts'
export {
  cigarWalkBp1,
  cigarWalkBp2,
  cigarWalkRev1,
  cigarWalkRev2,
} from './cigarWalkStart.ts'
export { cigarToMismatches2 } from './cigarToMismatches2.ts'
export { mdToMismatches2 } from './mdToMismatches2.ts'
export { getNextRefPos } from './getNextRefPos.ts'
export { numericCigarHasSkip } from './numericCigarHasSkip.ts'
export { numericCigarToString } from './numericCigarToString.ts'
export {
  connectionEndpointBps,
  readLeadingBodyDir,
  readLeadingBp,
  readTrailingBodyDir,
  readTrailingBp,
} from './readEndpoints.ts'
export {
  clipLengthAtStartOfReadNumeric,
  featurizeSA,
  featurizeSAEntries,
  getClip,
  getLength,
  getLengthOnRef,
  getLengthSansClipping,
  getMismatches,
  parseCigar2,
  parseCigar2Typed,
  parseCigar,
  splitSA,
} from './mismatchParser.ts'
export type {
  ClipMismatch,
  DeletionMismatch,
  InsertionMismatch,
  Mismatch,
  SNPMismatch,
  SkipMismatch,
} from './mismatchTypes.ts'
export { buildReadVsRefFeatures } from './buildReadVsRefFeatures.ts'
export type {
  ReadVsRefFeature,
  ReadVsRefFeatures,
  ReadVsRefInput,
  ReadVsRefMate,
} from './buildReadVsRefFeatures.ts'
export {
  SAM_FLAG_DUPLICATE,
  SAM_FLAG_FAILS_QC,
  SAM_FLAG_FIRST_IN_PAIR,
  SAM_FLAG_MATE_REVERSE,
  SAM_FLAG_MATE_UNMAPPED,
  SAM_FLAG_PAIRED,
  SAM_FLAG_PROPER_PAIR,
  SAM_FLAG_REVERSE,
  SAM_FLAG_SECONDARY,
  SAM_FLAG_SECOND_IN_PAIR,
  SAM_FLAG_SUPPLEMENTARY,
  SAM_FLAG_UNMAPPED,
  samFlagDescriptions,
  samFlagLabels,
  samFlagNames,
} from './samFlags.ts'
