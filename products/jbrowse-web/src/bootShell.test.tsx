import { Component, useState } from 'react'

import { act, render } from '@testing-library/react'

import { useBootShell } from './bootShell.ts'

import type { ReactNode } from 'react'

function Hold() {
  return useBootShell() ? null : <span>spinner</span>
}

const flush = () => act(async () => {})
const shell = () => document.getElementById('boot-shell')

beforeEach(() => {
  document.documentElement.classList.remove('no-boot-shell')
  document.body.insertAdjacentHTML('afterbegin', '<div id="boot-shell"></div>')
})

afterEach(() => {
  shell()?.remove()
})

test('a loading state holds the shell instead of drawing a spinner', async () => {
  const { queryByText } = render(<Hold />)
  await flush()
  expect(shell()).not.toBeNull()
  expect(queryByText('spinner')).toBeNull()
})

test('one loading state handing over to another keeps the shell', async () => {
  let swap = () => {}
  function Swap() {
    const [second, setSecond] = useState(false)
    swap = () => {
      setSecond(true)
    }
    return second ? (
      <div>
        <Hold key="b" />
      </div>
    ) : (
      <Hold key="a" />
    )
  }
  render(<Swap />)
  act(() => {
    swap()
  })
  await flush()
  expect(shell()).not.toBeNull()
})

test('the app replacing the last loading state removes the shell', async () => {
  let done = () => {}
  function App() {
    const [ready, setReady] = useState(false)
    done = () => {
      setReady(true)
    }
    return ready ? <span>app</span> : <Hold />
  }
  render(<App />)
  act(() => {
    done()
  })
  await flush()
  expect(shell()).toBeNull()
})

test('a throw that tears the tree down removes the shell', async () => {
  class Boundary extends Component<{ children: ReactNode }> {
    state = { failed: false }
    static getDerivedStateFromError() {
      return { failed: true }
    }
    render() {
      return this.state.failed ? <span>error</span> : this.props.children
    }
  }
  let fail = () => {}
  function Thrower() {
    const [broken, setBroken] = useState(false)
    fail = () => {
      setBroken(true)
    }
    if (broken) {
      throw new Error('boom')
    }
    return <Hold />
  }
  jest.spyOn(console, 'error').mockImplementation(() => {})
  render(
    <Boundary>
      <Thrower />
    </Boundary>,
  )
  act(() => {
    fail()
  })
  await flush()
  expect(shell()).toBeNull()
})

test('a stored non-default theme leaves the spinner, since the shell is hidden', async () => {
  document.documentElement.classList.add('no-boot-shell')
  const { getByText } = render(<Hold />)
  await flush()
  expect(getByText('spinner')).toBeTruthy()
})
