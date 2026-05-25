// Polyfill setHTML so that SanitizedHTML renders content synchronously in
// tests instead of going through the lazy-loaded DOMPurify/Suspense path
// which produces empty snapshots.
// This file is only loaded in Jest test environments via jest.config.js.
const dompurify = require('dompurify')

if (typeof Element !== 'undefined' && !Element.prototype.setHTML) {
  Object.defineProperty(Element.prototype, 'setHTML', {
    value: function (html) {
      const sanitized = dompurify.sanitize(html)
      if (typeof sanitized !== 'string') {
        throw new Error('setHTML polyfill: DOMPurify.sanitize did not return a string')
      }
      this.innerHTML = sanitized
    },
    writable: true,
    configurable: true,
  })
}
