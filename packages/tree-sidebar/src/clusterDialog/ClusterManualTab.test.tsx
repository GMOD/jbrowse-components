import { checkStopToken } from '@jbrowse/core/util/stopToken'
import { types } from '@jbrowse/mobx-state-tree'
import { render, screen, waitFor } from '@testing-library/react'

import ClusterManualTab from './ClusterManualTab.tsx'

import type { ClusterMatrix } from '../clusterMatrix.ts'
import type { ClusterDialogProps } from './types.ts'
import type { StopToken } from '@jbrowse/core/util/stopToken'

// `isViewModel` duck-types on `width` + `setWidth`, so a containing view this
// small is enough for `getContainingView` — the tab reads only the region key
// off it.
const View = types
  .model('MockView', { id: types.optional(types.identifier, 'view1') })
  .volatile(() => ({ width: 800, bpPerPx: 1, initialized: true }))
  .views(() => ({
    get dynamicBlocks() {
      return { contentBlocks: [{ refName: 'ctgA', start: 0, end: 100 }] }
    },
  }))
  .actions(self => ({
    setWidth(n: number) {
      self.width = n
    },
  }))

// The root stands in for the session: `resolveClusterRunArgs` reaches the RPC
// host through `isSessionServices`, which duck-types on `rpcManager` and
// `configuration`, and the session id through the `rpcSessionId` walk.
const Root = types
  .model('Root', {
    view: types.optional(
      types.compose(
        'ViewWithDisplay',
        View,
        types.model({
          display: types.optional(types.model('Display', {}), {}),
        }),
      ),
      {},
    ),
  })
  .volatile(() => ({
    rpcManager: {},
    configuration: {},
    rpcSessionId: 'session',
  }))

function setup(fetchMatrix: ClusterDialogProps['fetchMatrix']) {
  const root = Root.create({})
  return render(
    <ClusterManualTab
      model={root.view.display}
      handleClose={() => {}}
      title="Cluster"
      canRun
      run={async () => {}}
      matrixLabel="genotype matrix"
      tsvFilename="genotypes.tsv"
      matrixKey={['genotypeMatrix']}
      fetchMatrix={fetchMatrix}
      applyOrder={() => {}}
    >
      {null}
    </ClusterManualTab>,
  )
}

// The manual tab does the SAME work as the auto tab — fetch the region, build
// the matrix — and only the clustering step differs. `fetchMatrix` used to be
// declared `() => Promise<ClusterMatrix>`, which `useFetch` accepts (its
// trailing `stopToken`/`statusCallback` are positional, so a zero-parameter
// fetcher is assignable and never sees them). Both plugins complied and both
// lost cancel and progress on this tab alone.
describe('ClusterManualTab forwards the fetch handles it is given', () => {
  // Closing the dialog is the cancel — `useFetch` stops the token it created on
  // unmount, so the assertion is on the token going stopped rather than merely
  // being handed over. A placeholder token forwarded from the tab (or none at
  // all) leaves the worker building a matrix nobody is waiting for, which is the
  // state this shipped in.
  it('gives the fetch a token the dialog closing actually stops', async () => {
    let seen: StopToken | undefined
    const { unmount } = setup(({ stopToken }) => {
      seen = stopToken
      // never settles, so the token is still live at unmount
      return new Promise<ClusterMatrix>(() => {})
    })

    await waitFor(() => {
      expect(seen).toBeDefined()
    })
    expect(() => {
      checkStopToken(seen)
    }).not.toThrow()

    unmount()
    expect(() => {
      checkStopToken(seen)
    }).toThrow()
  })

  it('renders the reported phase and percentage rather than a bare spinner', async () => {
    setup(({ statusCallback }) => {
      statusCallback({
        message: 'Downloading variants',
        current: 42,
        total: 100,
      })
      // never settles, so the loading branch is what is on screen
      return new Promise<ClusterMatrix>(() => {})
    })

    await waitFor(() => {
      expect(screen.getByText('Downloading variants 42%')).toBeTruthy()
    })
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe(
      '42',
    )
  })

  it('falls back to the matrix label until a phase is reported', async () => {
    setup(() => new Promise<ClusterMatrix>(() => {}))

    await waitFor(() => {
      expect(screen.getByText('Generating genotype matrix')).toBeTruthy()
    })
  })
})
