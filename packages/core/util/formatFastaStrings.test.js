import { formatSeqFasta, formatFastaLines } from './formatFastaStrings'

describe('formatting seqChunks and strings into Fasta format', () => {
  const small = 'cattgttgcg'
  const medium =
    'cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagcct'
  const large =
    'cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagcctt'
  it('sequence length is less than 80 characters', () => {
    const formattedSmallFasta = formatFastaLines(small)
    expect(formattedSmallFasta).toMatchSnapshot()
  })
  it('sequence length is 80 characters', () => {
    const formattedMediumFasta = formatFastaLines(medium)
    expect(formattedMediumFasta).toMatchSnapshot()
  })
  it('sequence length is more than 80 characters', () => {
    const formattedLargeFasta = formatFastaLines(large)
    expect(formattedLargeFasta).toMatchSnapshot()
  })
  it('formats headers and sequence', () => {
    const chunks = [
      { header: 'ctgA:1-10', seq: small },
      { header: 'ctgB:1-81', seq: large },
    ]
    const formattedFastaFile = formatSeqFasta(chunks)
    /**
    >ctgA:1-10
    cattgttgcg
    >ctgB:1-81
    cattgttgcggagttgaacaACGGCATTAGGAACACTTCCGTCTCtcacttttatacgattatgattggttctttagcct
    t
    */
    expect(formattedFastaFile).toMatchSnapshot()
  })
})
