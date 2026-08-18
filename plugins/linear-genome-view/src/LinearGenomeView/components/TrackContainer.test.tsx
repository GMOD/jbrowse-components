import { createJBrowseTheme } from '@jbrowse/core/ui'
import { colord } from '@jbrowse/core/util/colord'
import { createTestSession } from '@jbrowse/web/testUtils'
import { ThemeProvider } from '@mui/material'
import { render, waitFor } from '@testing-library/react'

import LinearGenomeView from './LinearGenomeView.tsx'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

async function setup() {
  const session = createTestSession({
    sessionSnapshot: {
      views: [
        {
          type: 'LinearGenomeView',
          offsetPx: 0,
          bpPerPx: 1,
          displayedRegions: [
            { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 1000 },
          ],
          tracks: [],
          configuration: {},
        },
      ],
    },
  }) as any
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'ref0',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          {
            refName: 'ctgA',
            uniqueId: 'ctgA',
            start: 0,
            end: 1000,
            seq: 'A'.repeat(1000),
          },
        ],
      },
    },
  })
  session.addTrackConf({
    trackId: 'genes',
    name: 'Volvox genes',
    assemblyNames: ['volvox'],
    type: 'FeatureTrack',
    adapter: {
      type: 'FromConfigAdapter',
      features: [{ refName: 'ctgA', uniqueId: 'f1', start: 10, end: 100 }],
    },
  })
  const model = session.views[0]
  model.setWidth(800)
  await waitFor(() => {
    expect(model.initialized).toBe(true)
  })
  model.showTrack('genes')
  return model
}

/**
 * The divider at the bottom of a track is the only thing telling anyone the
 * height is draggable, and it is one `bar` word at one call site.
 *
 * It has been dropped once already — in a commit titled "Update snaps", which
 * is exactly the kind of diff nobody reads a `TrackContainer.tsx` hunk in — and
 * the whole test suite stayed green for two months, because every other thing
 * asserted about this handle is about the drag gesture, which works fine
 * whether or not you can see what to drag.
 */
test('a track draws a visible resize divider, not a transparent strip', async () => {
  const model = await setup()
  const { container } = render(
    <ThemeProvider theme={createJBrowseTheme()}>
      <LinearGenomeView model={model} />
    </ThemeProvider>,
  )

  const handles = await waitFor(() => {
    const found = [...container.querySelectorAll('div')].filter(
      el => getComputedStyle(el).cursor === 'row-resize',
    )
    expect(found.length).toBeGreaterThan(0)
    return found
  })

  for (const handle of handles) {
    const { backgroundColor } = getComputedStyle(handle)
    expect(colord(backgroundColor).alpha()).toBeGreaterThan(0)
  }
}, 20000)
