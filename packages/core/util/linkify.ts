// based on autolink-js, license MIT
// https://github.com/bryanwoods/autolink-js/blob/1418049970152c56ced73d43dcc62d80b320fb71/autolink.js#L9

const URL_PATTERN =
  /(^|[\s\n]|<[A-Za-z]*\/?>)((?:https?|ftp):\/\/[-A-Z0-9+\u0026\u2019@#/%?=()~_|!:,.;]*[-A-Z0-9+\u0026@#/%=~()_|])/gi

export function linkify(s: string) {
  URL_PATTERN.lastIndex = 0
  return s.replace(URL_PATTERN, '$1<a href=\'$2\' target="_blank">$2</a>')
}
