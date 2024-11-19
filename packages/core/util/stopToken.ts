/**
 * source https://github.com/panstromek/zebra-rs/blob/82d616225930b3ad423a2c6d883c79b94ee08ba6/webzebra/src/stopToken.ts#L34C1-L57C16
 *
 * blogpost https://yoyo-code.com/how-to-stop-synchronous-web-worker/
 *
 * license "I explicitly added MIT license to the stopToken file to make it more
 * permissive"
 *
 * Copyright (c) 2022 Matyáš Racek
 *
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

export function createStopToken() {
  // URL not available in jest and can't properly mock it
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return URL.createObjectURL?.(new Blob()) || `${Math.random()}`
}

export function stopStopToken(stopToken: string) {
  // URL not available in jest and can't properly mock it
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  URL.revokeObjectURL?.(stopToken)
}

export function checkStopToken(stopToken?: string) {
  if (typeof jest === 'undefined' && stopToken !== undefined) {
    const xhr = new XMLHttpRequest()

    // synchronous XHR usage to check the token
    xhr.open('GET', stopToken, false)
    try {
      xhr.send(null)
    } catch (e) {
      throw new Error('aborted')
    }
  }
}
