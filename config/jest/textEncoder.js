import { TextEncoder, TextDecoder } from 'web-encoding'
if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder
}
if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder
}
