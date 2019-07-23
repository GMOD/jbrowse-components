import { getSnapshot } from 'mobx-state-tree'
import jbrowseModel from './jbrowseModel'

describe('JBrowse MST model', () => {
  it('creates with defaults', () => {
    const jbrowse = jbrowseModel.create()
    expect(jbrowse.session).toBeUndefined()
    jbrowse.setDefaultSession()
    expect(jbrowse.session).toBeTruthy()
    expect(jbrowse.savedSessions.length).toBe(0)
    expect(jbrowse.datasets.length).toBe(0)
    expect(getSnapshot(jbrowse.configuration)).toMatchSnapshot({
      configId: expect.any(String),
      rpc: { configId: expect.any(String) },
    })
  })

  it('creates with a minimal session', () => {
    const jbrowse = jbrowseModel.create({ session: { name: 'testSession' } })
    expect(jbrowse.session).toBeTruthy()
  })

  it('activates a session snapshot', () => {
    const jbrowse = jbrowseModel.create({
      savedSessions: [{ name: 'testSession' }],
    })
    expect(jbrowse.session).toBeUndefined()
    jbrowse.setSession(jbrowse.savedSessions[0])
    expect(jbrowse.session).toBeTruthy()
  })

  it('adds track and connection configs to a dataset', () => {
    const jbrowse = jbrowseModel.create({
      datasets: [
        {
          name: 'dataset1',
          assembly: { name: 'assembly1', aliases: ['assemblyA'] },
        },
      ],
    })
    expect(jbrowse.datasets.length).toBe(1)
    expect(getSnapshot(jbrowse.datasets[0])).toMatchSnapshot({
      configId: expect.any(String),
      assembly: {
        configId: expect.any(String),
      },
    })
    const newTrackConf = jbrowse.datasets[0].addTrackConf({
      type: 'BasicTrack',
    })
    expect(getSnapshot(newTrackConf)).toMatchSnapshot({
      configId: expect.any(String),
      adapter: {
        configId: expect.any(String),
        index: { configId: expect.any(String) },
      },
      renderer: { configId: expect.any(String) },
    })
    expect(jbrowse.datasets[0].tracks.length).toBe(1)
    const newConnectionConf = jbrowse.datasets[0].addConnectionConf({
      type: 'JBrowse1Connection',
    })
    expect(getSnapshot(newConnectionConf)).toMatchSnapshot({
      configId: expect.any(String),
    })
    expect(jbrowse.datasets[0].connections.length).toBe(1)
  })

  it('adds a session snapshot', () => {
    const jbrowse = jbrowseModel.create()
    jbrowse.addSessionSnapshot({ name: 'testSession' })
    expect(jbrowse.savedSessions.length).toBe(1)
  })

  it('throws if session is invalid', () => {
    expect(() => jbrowseModel.create({ session: {} })).toThrow()
  })

  it('throws if session snapshot is invalid', () => {
    expect(() => jbrowseModel.create({ savedSessions: [{}] })).toThrow()
  })
})
