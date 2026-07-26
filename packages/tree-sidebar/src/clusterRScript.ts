type NumericRow = Iterable<number>
export type ClusterMatrix = Record<string, NumericRow>

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
  const rows = Object.values(matrix)
  return String.raw`inputMatrix<-matrix(c(${rows
    .map(val => formatRow(val, ','))
    .join(',\n')}
),nrow=${rows.length},byrow=TRUE)
rownames(inputMatrix)<-c(${Object.keys(matrix)
    .map(key => `'${key}'`)
    .join(',')})
resultClusters<-hclust(dist(inputMatrix), method='${method}')
cat(resultClusters$order,sep='\n')`
}

// Serialize the matrix to a name-prefixed TSV (one row per source).
export function matrixToTsv(matrix: ClusterMatrix) {
  return Object.entries(matrix)
    .map(([key, val]) => `${key}\t${formatRow(val, '\t')}`)
    .join('\n')
}
