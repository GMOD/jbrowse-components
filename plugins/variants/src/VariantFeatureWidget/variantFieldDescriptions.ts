export const variantFieldDescriptions = {
  CHROM: 'chromosome: An identifier from the reference genome',
  POS: 'position: The reference position, with the 1st base having position 1',
  ID: 'identifier: Semi-colon separated list of unique identifiers where available',
  REF: 'reference base(s): Each base must be one of A,C,G,T,N (case insensitive).',
  ALT: 'alternate base(s): Comma-separated list of alternate non-reference alleles',
  QUAL: 'quality: Phred-scaled quality score for the assertion made in ALT',
  FILTER:
    'filter status: PASS if this position has passed all filters, otherwise a semicolon-separated list of codes for filters that fail',
}
