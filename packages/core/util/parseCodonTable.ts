export function parseCodonTable(str: string) {
  const lines = str
    .split('\n')
    .filter(f => !!f)
    .map(line => line.split('=')[1].trim())

  const codons = {} as Record<string, string>
  const starts = {} as Record<string, boolean>
  const stops = {} as Record<string, boolean>
  for (let i = 0; i < lines[0].length; i++) {
    const codon = lines[2][i] + lines[3][i] + lines[4][i]
    const amino = lines[0][i]
    codons[codon] = amino
  }

  for (let i = 0; i < lines[0].length; i++) {
    const codon = lines[2][i] + lines[3][i] + lines[4][i]
    if (lines[1][i] === 'M') {
      starts[codon] = true
    } else if (lines[1][i] === '*') {
      stops[codon] = true
    }
  }

  return { codons, starts, stops }
}
