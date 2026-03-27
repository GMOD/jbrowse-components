// Polyfill setHTML so that SanitizedHTML renders content synchronously in
// tests instead of going through the lazy-loaded DOMPurify/Suspense path
// which produces empty snapshots
const dompurify = require('dompurify')

if (typeof Element !== 'undefined' && !Element.prototype.setHTML) {
  Element.prototype.setHTML = function (html) {
    this.innerHTML = dompurify.sanitize(html)
  }
}
