import { createTestSession } from '@jbrowse/web/testUtils'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createPortal } from 'react-dom'

import { fileDropHandlers, routeDroppedFiles } from './fileDrop.ts'

jest.mock('@jbrowse/web/makeWorkerInstance', () => () => {})

const desktopExtensions = ['.jbrowse', '.json']

test.each([
  [['volvox.jbrowse'], desktopExtensions, false, 'session'],
  [['Session.JSON'], desktopExtensions, false, 'session'],
  [['session.json'], ['.json'], false, 'session'],
  [['volvox.jbrowse'], ['.json'], false, 'tracks'],
  [['hg19.fa', 'hg19.fa.fai'], desktopExtensions, true, 'genome'],
  [['hg19.2bit', 'reads.bam'], desktopExtensions, true, 'genome'],
  [['sakai.gbk'], desktopExtensions, false, 'genome'],
  [['sakai.gbk'], desktopExtensions, true, 'tracks'],
  [['sakai.gbk', 'sakai.fa'], desktopExtensions, true, 'genome'],
  [['x.bed.gz', 'x.bed.gz.tbi'], desktopExtensions, true, 'tracks'],
  [['a.json', 'b.json'], desktopExtensions, false, 'tracks'],
  [['reads.bam', 'reads.bam.bai'], desktopExtensions, true, 'tracks'],
])(
  '%j with session extensions %j and a view open %j routes to %s',
  (names, extensions, hasView, kind) => {
    expect(
      routeDroppedFiles(
        names.map(name => ({ name })),
        extensions,
        hasView,
      ).kind,
    ).toBe(kind)
  },
)

function renderDropTarget() {
  const session = createTestSession()
  session.addAssemblyConf({
    name: 'volvox',
    sequence: {
      trackId: 'ref',
      type: 'ReferenceSequenceTrack',
      adapter: {
        type: 'FromConfigSequenceAdapter',
        features: [
          { refName: 'ctgA', uniqueId: 'a', start: 0, end: 10, seq: 'a' },
        ],
      },
    },
  })
  const region = { assemblyName: 'volvox', refName: 'ctgA', start: 0, end: 10 }
  const first = session.addView('LinearGenomeView', {
    displayedRegions: [region],
  })
  const second = session.addView('LinearGenomeView', {
    displayedRegions: [region],
  })
  const routes = {
    sessionFileExtensions: desktopExtensions,
    openSessionFile: jest.fn(async () => {}),
    openGenomeFiles: jest.fn(),
  }
  render(
    <div {...fileDropHandlers(session, routes)}>
      <span>beside the views</span>
      <div data-view-id={second.id}>
        <span>inside a view</span>
        <div
          onDrop={event => {
            event.preventDefault()
          }}
        >
          inner drop zone
        </div>
      </div>
      {createPortal(<span>in a dialog</span>, document.body)}
    </div>,
  )
  return { session, routes, first, second }
}

function dropFiles(target: HTMLElement, names: string[], types = ['Files']) {
  fireEvent.drop(target, {
    dataTransfer: { types, files: names.map(name => new File([''], name)) },
  })
}

test('dropped track files stage in the Add track widget for the view under the drop', async () => {
  const { session, second } = renderDropTarget()
  dropFiles(screen.getByText('inside a view'), ['x.bed.gz', 'x.bed.gz.tbi'])
  await waitFor(() => {
    expect(session.visibleWidget).toMatchObject({
      type: 'AddTrackWidget',
      view: { id: second.id },
      workflowName: 'Add multiple tracks',
      workflowForms: {
        'Add multiple tracks': {
          mode: 'local',
          localLocations: [{ name: 'x.bed.gz' }, { name: 'x.bed.gz.tbi' }],
        },
      },
    })
  })
})

test('a drop off the views stages into the open Add track form, keeping its view', async () => {
  const { session, second } = renderDropTarget()
  session.openWidget('AddTrackWidget', 'addTrackWidget', { view: second.id })
  dropFiles(screen.getByText('beside the views'), ['reads.bam'])
  await waitFor(() => {
    expect(session.visibleWidget).toMatchObject({
      view: { id: second.id },
      workflowForms: {
        'Add multiple tracks': { localLocations: [{ name: 'reads.bam' }] },
      },
    })
  })
})

test('a closed Add track form is not reused by a drop off the views', async () => {
  const { session, first, second } = renderDropTarget()
  dropFiles(screen.getByText('inside a view'), ['reads.bam'])
  await waitFor(() => {
    expect(session.visibleWidget).toMatchObject({ view: { id: second.id } })
  })
  const form = session.widgets.get('addTrackWidget')
  if (form) {
    session.hideWidget(form)
  }
  dropFiles(screen.getByText('beside the views'), ['x.bed'])
  await waitFor(() => {
    expect(session.visibleWidget).toMatchObject({
      view: { id: first.id },
      workflowForms: {
        'Add multiple tracks': { localLocations: [{ name: 'x.bed' }] },
      },
    })
  })
})

test('a second drop adds to the files staged by the first', async () => {
  const { session } = renderDropTarget()
  dropFiles(screen.getByText('inside a view'), ['reads.bam'])
  dropFiles(screen.getByText('inside a view'), ['reads.bam.bai'])
  await waitFor(() => {
    expect(session.visibleWidget).toMatchObject({
      workflowForms: {
        'Add multiple tracks': {
          localLocations: [{ name: 'reads.bam' }, { name: 'reads.bam.bai' }],
        },
      },
    })
  })
})

test('a drop outside every view targets the first view', async () => {
  const { session, first } = renderDropTarget()
  dropFiles(screen.getByText('beside the views'), ['reads.bam'])
  await waitFor(() => {
    expect(session.visibleWidget).toMatchObject({ view: { id: first.id } })
  })
})

test('a genome set goes to the genome route, a lone session file to the session route', async () => {
  const { session, routes } = renderDropTarget()
  dropFiles(screen.getByText('inside a view'), ['hg19.fa', 'reads.bam'])
  dropFiles(screen.getByText('inside a view'), ['saved.jbrowse'])
  await waitFor(() => {
    expect(routes.openSessionFile).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'saved.jbrowse' }),
    )
  })
  expect(routes.openGenomeFiles).toHaveBeenCalledWith([
    expect.objectContaining({ name: 'hg19.fa' }),
    expect.objectContaining({ name: 'reads.bam' }),
  ])
  expect(session.visibleWidget).toBeUndefined()
})

test('a drop the wrapper does not own is left alone', async () => {
  const { session, routes } = renderDropTarget()
  dropFiles(screen.getByText('in a dialog'), ['a.jbrowse'])
  dropFiles(screen.getByText('inner drop zone'), ['b.jbrowse'])
  dropFiles(screen.getByText('inside a view'), ['c.jbrowse'], ['text/plain'])
  dropFiles(screen.getByText('inside a view'), ['d.jbrowse'])
  await waitFor(() => {
    expect(routes.openSessionFile).toHaveBeenCalledTimes(1)
  })
  expect(routes.openSessionFile).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'd.jbrowse' }),
  )
  expect(session.visibleWidget).toBeUndefined()
})
