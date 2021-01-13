export interface SeqChunk {
  header: string
  seq: string
}
/**
 * Returns sequence with new line every 80 characters
 *
 * @param seqString -  string
 * @returns formated sequence string
 */
export function formatFastaLines(seqString: string) {
  let formatted = ''
  while (seqString.length > 0) {
    if (seqString.substring(0, 80).length < 80) {
      formatted += seqString.substring(0, 80)
    } else {
      formatted += `${seqString.substring(0, 80)}\n`
    }
    seqString = seqString.substring(80)
  }
  return formatted
}
/**
 * Formats the sequences chunks into Fasta format
 *
 * @param chunks - array of seq chunks of the form `{ header: string, seq: string }`
 * @returns formatted sequence in fasta format
 */
export function formatSeqFasta(chunks: SeqChunk[]) {
  let result = ''
  chunks.forEach((chunk, idx) => {
    if (idx === 0) {
      result += `>${chunk.header}\n${formatFastaLines(chunk.seq)}`
    } else if (idx === chunks.length - 1) {
      result += `\n>${chunk.header}\n${formatFastaLines(chunk.seq)}`
    } else {
      result += `\n>${chunk.header}\n${formatFastaLines(chunk.seq)}`
    }
  })
  return result
}
