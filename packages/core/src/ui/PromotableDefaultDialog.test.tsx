import { types } from '@jbrowse/mobx-state-tree'
import { ThemeProvider } from '@mui/material'
import { fireEvent, render } from '@testing-library/react'

import PromotableDefaultDialog from './PromotableDefaultDialog.tsx'
import { createJBrowseTheme } from './theme.ts'
import PluginManager from '../PluginManager.ts'
import { ConfigurationSchema } from '../configuration/configurationSchema.ts'
import {
  getConfResolved,
  isSlotPinned,
} from '../configuration/promotableDefaults.ts'

const pluginManager = new PluginManager([]).createPluggableElements()
pluginManager.configure()
const theme = createJBrowseTheme()

const configSchema = ConfigurationSchema('DialogTestDisplay', {
  customHeight: {
    type: 'maybeNumber',
    defaultValue: undefined,
    promotable: true,
  },
})

// Real MST session/view/track/display tree (isViewContainer + isSessionModel) so
// the mounted dialog exercises the actual applyPromotableDefault path against
// real config, not a mock.
function createSession(displayConfigsPerView: Record<string, unknown>[][]) {
  const Display = types.model('TestDisplay', {
    type: types.literal('TestDisplay'),
    configuration: configSchema,
  })
  const Track = types.model('TestTrack', { displays: types.array(Display) })
  const View = types.model('TestView', { tracks: types.array(Track) })
  const Session = types
    .model('TestSession', {
      rpcManager: types.frozen({}),
      configuration: types.frozen({}),
      displayTypeDefaults: types.frozen<
        Record<string, Record<string, unknown>>
      >({}),
      views: types.array(View),
    })
    .views(self => ({
      getDisplayTypeDefault(displayType: string, slot: string): unknown {
        return self.displayTypeDefaults[displayType]?.[slot]
      },
    }))
    .actions(self => ({
      setDisplayTypeDefault(displayType: string, slot: string, value: unknown) {
        const forType = { ...self.displayTypeDefaults[displayType] }
        if (value === undefined) {
          delete forType[slot]
        } else {
          forType[slot] = value
        }
        self.displayTypeDefaults = {
          ...self.displayTypeDefaults,
          [displayType]: forType,
        }
      },
      removeView() {},
      addView() {},
    }))
  return Session.create(
    {
      views: displayConfigsPerView.map(configs => ({
        tracks: configs.map(configuration => ({
          displays: [{ type: 'TestDisplay' as const, configuration }],
        })),
      })),
    },
    { pluginManager },
  )
}

function renderDialog(
  session: ReturnType<typeof createSession>,
  value: unknown,
) {
  const self = session.views[0]!.tracks[0]!.displays[0]!
  const handleClose = jest.fn()
  const utils = render(
    <ThemeProvider theme={theme}>
      <PromotableDefaultDialog
        self={self}
        entries={[{ slot: 'customHeight', value }]}
        valueLabel="Compact"
        handleClose={handleClose}
      />
    </ThemeProvider>,
  )
  return { ...utils, handleClose }
}

describe('PromotableDefaultDialog', () => {
  it('submitting "apply to future tracks" sets the session default', () => {
    const session = createSession([[{ customHeight: 10 }]])
    const { getByLabelText, getByText, handleClose } = renderDialog(session, 10)

    fireEvent.click(getByLabelText(/Apply to future tracks/))
    fireEvent.click(getByText('Submit'))

    expect(session.getDisplayTypeDefault('TestDisplay', 'customHeight')).toBe(
      10,
    )
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('names the differing open-track count and applies to them on submit', () => {
    // self is 10; a second open track pinned to 20 differs from the promoted 10
    const session = createSession([
      [{ customHeight: 10 }],
      [{ customHeight: 20 }],
    ])
    const other = session.views[1]!.tracks[0]!.displays[0]!
    const { getByLabelText, getByText } = renderDialog(session, 10)

    fireEvent.click(getByLabelText(/Apply to future tracks/))
    fireEvent.click(getByLabelText(/Apply to 1 currently open track/))
    fireEvent.click(getByText('Submit'))

    expect(isSlotPinned(other, 'customHeight')).toBe(false)
    expect(getConfResolved(other, 'customHeight')).toBe(10)
  })

  it('disables the open-tracks option when nothing differs', () => {
    const session = createSession([[{ customHeight: 10 }]])
    const { getByLabelText } = renderDialog(session, 10)
    expect((getByLabelText(/already match/) as HTMLInputElement).disabled).toBe(
      true,
    )
  })
})
