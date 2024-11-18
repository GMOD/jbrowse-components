/**
 * Copyright (c) 2022 Matyáš Racek
 *
 *
 * Permission is hereby granted, free of charge, to any person
 * obtaining a copy of this software and associated documentation
 * files (the "Software"), to deal in the Software without
 * restriction, including without limitation the rights to use,
 * copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following
 * conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
 * OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
 * HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
 * OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * source https://github.com/panstromek/zebra-rs/blob/82d616225930b3ad423a2c6d883c79b94ee08ba6/webzebra/src/stopToken.ts#L34C1-L57C16
 * https://yoyo-code.com/how-to-stop-synchronous-web-worker/
 * "I explicitly added MIT license to the stopToken file to make it more
 * permissive"
 *
 *
 * This is a simple hacky utility that allows you to stop synchronous code in a
 * worker from another thread without Atomics and other unstable APIs. The code
 * in the worker just has to repeatedly call a check function until it returns
 * true. No async `onmessage` handler needed.
 *
 * Usage:
 *  - use createStopToken to create stop token
 *
 *  - give the stop token to the worker that you want to stop at some point
 *
 *  - repeatedly call checkStopToken in the worker thread until it returns true
 *
 *  - When you want to stop the worker, call stop function with the same token
 *  This destroys the token and cause the checkStopToken function in the worker
 *  to return true
 */

export function createStopToken() {
  return URL.createObjectURL(new Blob())
}

export function stopStopToken(stopToken: string) {
  URL.revokeObjectURL(stopToken)
}

export function checkStopToken(stopToken?: string): boolean {
  if (stopToken !== undefined) {
    const xhr = new XMLHttpRequest()
    xhr.open('GET', stopToken, false)
    try {
      xhr.send(null)
    } catch (e) {
      return true
    }
    return false
  }
  return false
}
