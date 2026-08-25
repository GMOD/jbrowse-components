import { setupRowSortAutorun } from './rowSortAutorun.ts'
import { setupRunClusteringAutorun } from './runClusteringAutorun.ts'
import { setupTreeDrawingAutorun } from './treeDrawingAutorun.ts'

/**
 * The three autoruns every display with a dendrogram sidebar installs from its
 * `afterAttach`, in one call: the tree drawing, the declarative `sortRowsBy`
 * sort, and the declarative `runClustering` run. Each display used to spell the
 * three calls out under the same two paragraphs — that they install
 * synchronously because the heavy half is code-split inside the callbacks, and
 * that this barrel must not be `import()`ed (packages/tree-sidebar/CLAUDE.md).
 *
 * What stays per display is exactly what the two callbacks say: which value a
 * row carries at a column (`sortRows`), and what a clustering run *is*
 * (`clustering.run`, gated by `clustering.ready`). `name` prefixes the
 * autoruns so a reaction census can still tell the displays apart.
 */
export function setupTreeSidebarAutoruns(
  self: Parameters<typeof setupTreeDrawingAutorun>[0] &
    Parameters<typeof setupRowSortAutorun>[0] &
    Parameters<typeof setupRunClusteringAutorun>[0],
  {
    name,
    sortRows,
    clustering,
  }: {
    name: string
    sortRows: Parameters<typeof setupRowSortAutorun>[1]['sortRows']
    clustering: Omit<Parameters<typeof setupRunClusteringAutorun>[1], 'name'>
  },
) {
  setupTreeDrawingAutorun(self)
  setupRowSortAutorun(self, { name: `${name}SortRows`, sortRows })
  setupRunClusteringAutorun(self, {
    name: `AutoRun${name}Clustering`,
    ...clustering,
  })
}
