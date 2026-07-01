type NumericRow = Iterable<number> & { join(separator?: string): string }
type ClusterMatrix = Record<string, NumericRow>

// Emit an R script that reconstructs the score/genotype matrix and runs
// hclust, printing the resulting leaf order (one 1-based index per line) for the
// user to paste back. Shared by the wiggle and variant "manual clustering"
// dialogs, which build byte-identical scripts.
export function generateClusterRScript(matrix: ClusterMatrix, method: string) {
  const rows = Object.values(matrix)
  return String.raw`inputMatrix<-matrix(c(${rows
    .map(val => val.join(','))
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
    .map(([key, val]) => [key, ...val].join('\t'))
    .join('\n')
}
