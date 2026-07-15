import { generateClusterRScript, matrixToTsv } from './clusterRScript.ts'
import { parseClusterOrder } from './clusterUtils.ts'

test('generateClusterRScript builds an hclust script', () => {
  const script = generateClusterRScript({ a: [1, 2], b: [3, 4] }, 'complete')
  expect(script).toContain('inputMatrix<-matrix(c(1,2,\n3,4')
  expect(script).toContain('nrow=2,byrow=TRUE')
  expect(script).toContain("rownames(inputMatrix)<-c('a','b')")
  expect(script).toContain("method='complete'")
})

test('generateClusterRScript accepts Float32Array rows', () => {
  const script = generateClusterRScript(
    { a: new Float32Array([1, 2]) },
    'single',
  )
  expect(script).toContain('c(1,2')
})

test('matrixToTsv prefixes each row with its name', () => {
  expect(matrixToTsv({ a: [1, 2], b: [3, 4] })).toBe('a\t1\t2\nb\t3\t4')
})

test('parseClusterOrder ignores blank and whitespace lines', () => {
  expect(parseClusterOrder('3\n  \n1 \n\n2')).toEqual([3, 1, 2])
})
