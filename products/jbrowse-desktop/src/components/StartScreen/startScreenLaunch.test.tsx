import { renderHook } from '@testing-library/react'

import { NotifyContext } from '../NotifyContext.ts'
import { MAX_GENOMES_PER_LAUNCH, TOO_MANY_GENOMES } from './launchLimit.ts'
import {
  StartScreenLaunchContext,
  useLaunchConfigs,
} from './startScreenLaunch.ts'

jest.mock('./util.tsx', () => ({
  launchSnapshot: jest.fn(),
  fetchConfig: jest.fn(),
}))

function setup() {
  const launch = jest.fn()
  const notifyError = jest.fn()
  const { result } = renderHook(() => useLaunchConfigs(), {
    wrapper: ({ children }) => (
      <NotifyContext value={notifyError}>
        <StartScreenLaunchContext value={{ launch, openDialog: jest.fn() }}>
          {children}
        </StartScreenLaunchContext>
      </NotifyContext>
    ),
  })
  return {
    launchConfigUrls: result.current.launchConfigUrls,
    launch,
    notifyError,
  }
}

const urls = (count: number) =>
  Array.from({ length: count }, (_, i) => `https://example.com/${i}.json`)

test('launches up to the limit', async () => {
  const { launchConfigUrls, launch, notifyError } = setup()
  await launchConfigUrls(urls(MAX_GENOMES_PER_LAUNCH))
  expect(launch).toHaveBeenCalledTimes(1)
  expect(notifyError).not.toHaveBeenCalled()
})

test('refuses more than the limit without fetching any', async () => {
  const { launchConfigUrls, launch, notifyError } = setup()
  await launchConfigUrls(urls(MAX_GENOMES_PER_LAUNCH + 1))
  expect(launch).not.toHaveBeenCalled()
  expect(notifyError).toHaveBeenCalledWith(new Error(TOO_MANY_GENOMES))
})
