import { generateClusterRScript, matrixToTsv } from './clusterRScript.ts'
import { parseClusterOrder } from './clusterUtils.ts'

test('generateClusterRScript builds an hclust script', () => {
  const script = generateClusterRScript(
    new Map([
      ['a', [1, 2]],
      ['b', [3, 4]],
    ]),
    'complete',
  )
  expect(script).toContain('inputMatrix<-matrix(c(1,2,\n3,4')
  expect(script).toContain('nrow=2,byrow=TRUE')
  expect(script).toContain("rownames(inputMatrix)<-c('a','b')")
  expect(script).toContain("method='complete'")
})

test('generateClusterRScript accepts Float32Array rows', () => {
  const script = generateClusterRScript(
    new Map([['a', new Float32Array([1, 2])]]),
    'single',
  )
  expect(script).toContain('c(1,2')
})

test('matrixToTsv prefixes each row with its name', () => {
  expect(
    matrixToTsv(
      new Map([
        ['a', [1, 2]],
        ['b', [3, 4]],
      ]),
    ),
  ).toBe('a\t1\t2\nb\t3\t4')
})

// The R script's rownames and its row order have to be the caller's order, since
// the user pastes `resultClusters$order` back as indices into the source list.
// A plain object could not carry that for names like these.
test('generateClusterRScript keeps numeric-looking row names in caller order', () => {
  const script = generateClusterRScript(
    new Map([
      ['10', [1]],
      ['2', [2]],
      ['1', [3]],
    ]),
    'average',
  )
  expect(script).toContain("rownames(inputMatrix)<-c('10','2','1')")
  expect(script).toContain('inputMatrix<-matrix(c(1,\n2,\n3')
})

test('parseClusterOrder ignores blank and whitespace lines', () => {
  expect(parseClusterOrder('3\n  \n1 \n\n2')).toEqual([3, 1, 2])
})
