/**
 * @jest-environment node
 */

import { test } from './testUtil'

describe('testUtil', () => {
  test
    .mockConsoleLog()
    .do(() => {
      // eslint-disable-next-line no-console
      console.log('this is console log', 'also console log')
    })
    .it('mocks console log', ctx => {
      expect(ctx.consoleLog).toHaveBeenCalledWith(
        'this is console log',
        'also console log',
      )
    })

  test
    .mockConsoleWarn()
    .do(() => {
      console.warn('this is console warn', 'also console warn')
    })
    .it('mocks console warn', ctx => {
      expect(ctx.consoleWarn).toHaveBeenCalledWith(
        'this is console warn',
        'also console warn',
      )
    })

  test
    .mockConsoleError()
    .do(() => {
      console.error('this is console error', 'also console error')
    })
    .it('mocks console error', ctx => {
      expect(ctx.consoleError).toHaveBeenCalledWith(
        'this is console error',
        'also console error',
      )
    })
})
