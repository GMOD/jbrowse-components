export interface SeqChunk {
  header: string
  seq: string
}
/**
 * Returns sequence with new line every 80 characters
 * ref https://stackoverflow.com/a/51506718/2129219
 *
 * @param seqString -  string
 * @returns formatted sequence string
 */
export function formatFastaLines(seqString: string) {
  return seqString.replaceAll(/(.{1,80})/g, '$1\n').trimEnd()
}
/**
 * Formats the sequences chunks into Fasta format
 *
 * @param chunks - array of seq chunks of the form `{ header: string, seq: string }`
 * @returns formatted sequence in fasta format
 */
export function formatSeqFasta(chunks: SeqChunk[]) {
  return chunks
    .map(chunk => `>${chunk.header}\n${formatFastaLines(chunk.seq)}`)
    .join('\n')
}
