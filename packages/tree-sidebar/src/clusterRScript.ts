type NumericRow = Iterable<number>

// A Map, not a Record, because the row order IS the contract: `order` comes back
// as indices into it and every caller maps those straight into its own source
// list. A plain object cannot carry that — it hoists integer-like keys ahead of
// the rest, so rows named "1", "2", "10" (numbered bigWigs, numeric VCF sample
// IDs, a numeric partition field) arrived at the clusterer in numeric order and
// the indices it returned pointed at the wrong sources. What made that expensive
// to notice is that it fails twice over: the rows reorder to the wrong
// identities, and the tree's leaf names then disagree with them, so
// `treeDescribesRows` refuses to draw the dendrogram that would have shown it.
export type ClusterMatrix = Map<string, NumericRow>

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
    names.push(`'${name}'`)
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
