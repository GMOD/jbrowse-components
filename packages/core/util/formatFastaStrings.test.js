import { formatFastaLines, formatSeqFasta } from './formatFastaStrings'

describe('formatting seqChunks and strings into Fasta format', () => {
  const small = 'cattgttgcg'
  const medium =
    'cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagcct'
  const large =
    'cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagcctt'
  it('sequence length is less than 80 characters', () => {
    const formattedSmallFasta = formatFastaLines(small)
    expect(formattedSmallFasta.length).toEqual(10)
  })
  it('sequence length is 80 characters', () => {
    const formattedMediumFasta = formatFastaLines(medium)
    expect(formattedMediumFasta.length).toEqual(80)
  })
  it('sequence length is more than 80 characters', () => {
    const formattedLargeFasta = formatFastaLines(large)
    expect(
      formattedLargeFasta.substring(0, formattedLargeFasta.indexOf('\n'))
        .length,
    ).toEqual(80)
    expect(
      formattedLargeFasta.substring(formattedLargeFasta.indexOf('\n') - 1, 80)
        .length,
    ).toEqual(1)
  })
  it('formats headers and sequence', () => {
    const chunks = [
      { header: 'ctgA:1-10', seq: small },
      { header: 'ctgB:1-81', seq: large },
    ]
    const formattedFastaFile = formatSeqFasta(chunks)
    /* 
    >ctgA:1-10
    cattgttgcg
    >ctgB:1-81
    cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagcct
    t
    */
    const lines = formattedFastaFile.split('\n')
    expect(lines.length).toEqual(5)
    expect(formattedFastaFile).toEqual(
      `>ctgA:1-10\n${small}\n>ctgB:1-81\n${medium}\nt`,
    )
  })
})
