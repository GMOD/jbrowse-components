import { Component, useState } from 'react'

import fs from 'node:fs'
import path from 'node:path'

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

describe("index.html's theme check", () => {
  const html = fs.readFileSync(
    path.join(__dirname, '../public/index.html'),
    'utf8',
  )
  const script = /<script id="boot-shell-theme">([\s\S]*?)<\/script>/.exec(
    html,
  )![1]!
  const hidden = () =>
    document.documentElement.classList.contains('no-boot-shell')

  beforeEach(() => {
    window.name = ''
  })

  afterEach(() => {
    localStorage.clear()
  })

  // global scope, as the browser runs a classic script: a top-level `var name`
  // there is `window.name`, which reads back the string "null"
  const run = () => {
    // eslint-disable-next-line no-eval
    ;(0, eval)(script)
  }

  test('a fresh visitor gets the shell', () => {
    run()
    expect(hidden()).toBe(false)
  })

  // Chrome's window.name setter turns a stored null into "null", which hid the
  // shell for everyone; jsdom's does not, so the check is on the globals
  test('it leaves the page globals alone', () => {
    const before = { keys: Object.keys(window), name: window.name }
    run()
    expect({ keys: Object.keys(window), name: window.name }).toEqual(before)
  })

  test.each([
    ['themeName', 'lightStock'],
    ['themeMode', 'dark'],
    ['themeMode', 'system'],
    ['themeModeOverride', 'dark'],
  ])('%s=%s hides it', (key, value) => {
    localStorage.setItem(key, value)
    run()
    expect(hidden()).toBe(true)
  })

  test('the stored default theme in light mode keeps it', () => {
    localStorage.setItem('themeName', 'default')
    localStorage.setItem('themeMode', 'light')
    run()
    expect(hidden()).toBe(false)
  })
})

test('a stored non-default theme leaves the spinner, since the shell is hidden', async () => {
  document.documentElement.classList.add('no-boot-shell')
  const { getByText } = render(<Hold />)
  await flush()
  expect(getByText('spinner')).toBeTruthy()
})
