import util from 'util'
if (!global.TextEncoder) {
  global.TextEncoder = util.TextEncoder
}
if (!global.TextDecoder) {
  global.TextDecoder = util.TextDecoder
}
