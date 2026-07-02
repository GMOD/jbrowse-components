import PluginManager from '@jbrowse/core/PluginManager'
import { getSnapshot, types } from '@jbrowse/mobx-state-tree'

import sessionModelFactory from './index.ts'
import { createTestSession } from '../rootModel/index.ts'
jest.mock('../makeWorkerInstance', () => () => {})

describe('JBrowseWebSessionModel', () => {
  it('creates with no parent and just a name', () => {
    const pluginManager = new PluginManager()
    pluginManager.configure()
    const sessionModel = sessionModelFactory({
      pluginManager,
      // @ts-expect-error
      assemblyConfigSchema: types.frozen(),
    })
    const session = sessionModel.create(
      { name: 'testSession' },
      { pluginManager },
    )

    const { id, ...rest } = getSnapshot(session)
    expect(rest).toMatchSnapshot()
  })

  it('accepts a custom drawer width', () => {
    const session = createTestSession({ sessionSnapshot: { drawerWidth: 256 } })
    expect(session.drawerWidth).toBe(256)
  })

  describe('displayTypeDefaults store', () => {
    it('round-trips a promoted per-display-type slot default', () => {
      const session = createTestSession()
      expect(
        session.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
      ).toBeUndefined()

      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        'compact',
      )
      expect(
        session.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
      ).toBe('compact')
    })

    it('keeps defaults for different display types independent', () => {
      const session = createTestSession()
      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        'compact',
      )
      session.setDisplayTypeDefault('LinearArcDisplay', 'displayMode', 'arcs')
      expect(
        session.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
      ).toBe('compact')
      expect(
        session.getDisplayTypeDefault('LinearArcDisplay', 'displayMode'),
      ).toBe('arcs')
    })

    it('clears a default when set to undefined without disturbing siblings', () => {
      const session = createTestSession()
      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        'compact',
      )
      session.setDisplayTypeDefault('LinearBasicDisplay', 'height', 20)

      session.setDisplayTypeDefault(
        'LinearBasicDisplay',
        'displayMode',
        undefined,
      )
      expect(
        session.getDisplayTypeDefault('LinearBasicDisplay', 'displayMode'),
      ).toBeUndefined()
      expect(
        session.getDisplayTypeDefault('LinearBasicDisplay', 'height'),
      ).toBe(20)
    })
  })
})
