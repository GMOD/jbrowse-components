import type { ClusterMatrix, NumericRow } from './clusterMatrix.ts'

// A row name goes into the script as an R single-quoted literal, so `o'brien`
// must not close the string early. Backslash first, or escaping the quote would
// then escape its own escape.
function quoteRName(name: string) {
  return `'${name.replaceAll('\\', '\\\\').replaceAll("'", "\\'")}'`
}

// A no-call genotype or an uncovered score column is NaN, which neither R nor a
// TSV reader understands; `NA` is the value both do.
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
// dialogs, which build byte-identical scripts. The script fills each NA with
// its column's mean, 0 for a column with none, as `imputeMissingToSiteMean`
// does before the in-app run, so both cluster the same matrix and hclust never
// meets an NA distance.
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
siteMeans<-colMeans(inputMatrix,na.rm=TRUE)
siteMeans[is.nan(siteMeans)]<-0
missing<-which(is.na(inputMatrix),arr.ind=TRUE)
inputMatrix[missing]<-siteMeans[missing[,2]]
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
