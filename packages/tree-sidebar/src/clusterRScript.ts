import type { ClusterMatrix, NumericRow } from './clusterMatrix.ts'

// A row name is an arbitrary string from somebody's data file, and it goes into
// the script as an R single-quoted literal — so `o'brien` (a name the newick
// half already quotes, see `newick.ts`) closed the string early and the whole
// `rownames(...)` line became an R syntax error. The user only finds that out in
// R, several steps from the dialog that wrote it. Backslash first, or escaping
// the quote would then escape its own escape.
function quoteRName(name: string) {
  return `'${name.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
}

// A genotype matrix marks a no-call with NaN, which neither R nor a TSV reader
// understands. `NA` is the value both do: R's `dist()` drops that column from
// the pair's sum and scales the result up over the columns it could use, which
// is what a missing genotype should do to a distance.
function formatRow(row: NumericRow, separator: string) {
  const out: string[] = []
  for (const value of row) {
    out.push(Number.isNaN(value) ? 'NA' : `${value}`)
  }
  return out.join(separator)
}

// Emit an R script that reconstructs the score/genotype matrix and runs
// hclust, printing the resulting leaf order (one 1-based index per line) for the
// user to paste back. Shared by the wiggle and variant "manual clustering"
// dialogs, which build byte-identical scripts.
export function generateClusterRScript(matrix: ClusterMatrix, method: string) {
  const values: string[] = []
  const names: string[] = []
  for (const [name, row] of matrix) {
    values.push(formatRow(row, ','))
    names.push(quoteRName(name))
  }
  return String.raw`inputMatrix<-matrix(c(${values.join(',\n')}
),nrow=${matrix.size},byrow=TRUE)
rownames(inputMatrix)<-c(${names.join(',')})
resultClusters<-hclust(dist(inputMatrix), method='${method}')
cat(resultClusters$order,sep='\n')`
}

// Serialize the matrix to a name-prefixed TSV (one row per source).
export function matrixToTsv(matrix: ClusterMatrix) {
  const lines: string[] = []
  for (const [name, row] of matrix) {
    lines.push(`${name}\t${formatRow(row, '\t')}`)
  }
  return lines.join('\n')
}
