import { useEffect, useState } from 'react'

import { fireEvent, render } from '@testing-library/react'
import { observer } from 'mobx-react'

import PluginManager from '../PluginManager.ts'
import PluggableComponent from './PluggableComponent.tsx'
import { addReplaceWidget, addWidgetWrapper } from './addReplaceWidget.tsx'

import type { ReplaceWidgetProps } from '../PluginManager.ts'

// the default widget keeps state, so a remount shows up as the state resetting
// and not only as a mount count
let mounts = 0
function DefaultWidget() {
  const [n, setN] = useState(0)
  useEffect(() => {
    mounts++
  }, [])
  return (
    <button
      type="button"
      onClick={() => {
        setN(n + 1)
      }}
    >
      count {n}
    </button>
  )
}

function widgetProps(model: Partial<ReplaceWidgetProps['model']>) {
  return {
    model: { type: 'W', ...model } as ReplaceWidgetProps['model'],
    session: {} as ReplaceWidgetProps['session'],
  }
}

// inline observer, matching the real fire sites (DrawerWidget/ModalWidget): per
// CLAUDE.md the react compiler leaves those alone, so the `props` object really
// is a fresh identity every render, as it is in the app. A compiled harness
// memoizes it, PluggableComponent's own memo then skips the re-render, and the
// remount below stops reproducing.
const Harness = observer(function Harness({
  pluginManager,
  model = {},
}: {
  pluginManager: PluginManager
  model?: Partial<ReplaceWidgetProps['model']>
}) {
  const [, forceRender] = useState(0)
  return (
    <>
      <button
        type="button"
        onClick={() => {
          forceRender(x => x + 1)
        }}
      >
        rerender
      </button>
      <PluggableComponent
        pluginManager={pluginManager}
        name="Core-replaceWidget"
        component={DefaultWidget}
        props={widgetProps(model)}
      />
    </>
  )
})

beforeEach(() => {
  mounts = 0
})

test('a stable replacement component survives a parent rerender', () => {
  const pm = new PluginManager([])
  addReplaceWidget(pm, { component: DefaultWidget })
  const { getByText } = render(<Harness pluginManager={pm} />)
  fireEvent.click(getByText('count 0'))
  fireEvent.click(getByText('rerender'))
  expect(mounts).toBe(1)
  expect(getByText('count 1')).toBeTruthy()
})

// the reason addWidgetWrapper exists. The point is re-evaluated in
// PluggableComponent's render body, so a callback that declares its component
// inline gives React a new element type every render and the default widget's
// whole subtree is thrown away along with its state
test('a callback that declares its component inline remounts every render', () => {
  const pm = new PluginManager([])
  let evaluations = 0
  pm.addToExtensionPoint('Core-replaceWidget', Default => {
    evaluations++
    return function NewWidget(props: ReplaceWidgetProps) {
      return (
        <div>
          <div>custom</div>
          <Default {...props} />
        </div>
      )
    }
  })
  const { getByText } = render(<Harness pluginManager={pm} />)
  fireEvent.click(getByText('count 0'))
  fireEvent.click(getByText('rerender'))
  expect(evaluations).toBeGreaterThan(1)
  expect(mounts).toBe(2)
  expect(getByText('count 0')).toBeTruthy()
})

test('addWidgetWrapper keeps the wrapped widget mounted across renders', () => {
  const pm = new PluginManager([])
  addWidgetWrapper(pm, {
    wrapper: ({ DefaultWidget: Widget, ...rest }) => (
      <div>
        <div>custom</div>
        <Widget {...rest} />
      </div>
    ),
  })
  const { getByText } = render(<Harness pluginManager={pm} />)
  fireEvent.click(getByText('count 0'))
  fireEvent.click(getByText('rerender'))
  expect(mounts).toBe(1)
  expect(getByText('count 1')).toBeTruthy()
  expect(getByText('custom')).toBeTruthy()
})

test('wrappers from two plugins nest instead of clobbering', () => {
  const pm = new PluginManager([])
  addWidgetWrapper(pm, {
    wrapper: ({ DefaultWidget: Widget, ...rest }) => (
      <div>
        <div>first</div>
        <Widget {...rest} />
      </div>
    ),
  })
  addWidgetWrapper(pm, {
    wrapper: ({ DefaultWidget: Widget, ...rest }) => (
      <div>
        <div>second</div>
        <Widget {...rest} />
      </div>
    ),
  })
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const { getByText } = render(<Harness pluginManager={pm} />)
  expect(getByText('first')).toBeTruthy()
  expect(getByText('second')).toBeTruthy()
  expect(getByText('count 0')).toBeTruthy()
  expect(warn).not.toHaveBeenCalled()
  warn.mockRestore()
})

test('a selector scopes a replacement to one track and leaves others alone', () => {
  const pm = new PluginManager([])
  addReplaceWidget(pm, {
    select: { trackId: 'volvox.inv.vcf' },
    component: () => <div>mine</div>,
  })
  const a = render(
    <Harness pluginManager={pm} model={{ trackId: 'volvox.inv.vcf' }} />,
  )
  expect(a.getByText('mine')).toBeTruthy()
  const b = render(
    <Harness pluginManager={pm} model={{ trackId: 'other.vcf' }} />,
  )
  expect(b.getByText('count 0')).toBeTruthy()
})

// copyTrackSnapshot appends `-${Date.now()}`, so a bare trackId that stopped
// applying to the user's copy is the footgun the framework matcher removes
test('a bare trackId selector still matches a copy of that track', () => {
  const pm = new PluginManager([])
  addReplaceWidget(pm, {
    select: { trackId: 'volvox.inv.vcf' },
    component: () => <div>mine</div>,
  })
  const { getByText } = render(
    <Harness
      pluginManager={pm}
      model={{ trackId: 'volvox.inv.vcf-1712000000000' }}
    />,
  )
  expect(getByText('mine')).toBeTruthy()
})

test('a bare trackId selector does not match an unrelated longer id', () => {
  const pm = new PluginManager([])
  addReplaceWidget(pm, {
    select: { trackId: 'volvox.inv.vcf' },
    component: () => <div>mine</div>,
  })
  const { getByText } = render(
    <Harness pluginManager={pm} model={{ trackId: 'volvox.inv.vcf-extra' }} />,
  )
  expect(getByText('count 0')).toBeTruthy()
})

test('two plugins replacing the same slot warns once', () => {
  const pm = new PluginManager([])
  addReplaceWidget(pm, { component: () => <div>first</div> })
  addReplaceWidget(pm, { component: () => <div>second</div> })
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  const { getByText } = render(<Harness pluginManager={pm} />)
  fireEvent.click(getByText('rerender'))
  expect(getByText('second')).toBeTruthy()
  expect(warn).toHaveBeenCalledTimes(1)
  warn.mockRestore()
})
