/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

module.exports = function getPublicUrlOrPath(isEnvDevelopment, homepage, envPublicUrl) {
  const stubDomain = 'https://create-react-app.dev'

  if (envPublicUrl) {
    const publicUrl = envPublicUrl.endsWith('/') ? envPublicUrl : envPublicUrl + '/'
    const validPublicUrl = new URL(publicUrl, stubDomain)
    return isEnvDevelopment
      ? publicUrl.startsWith('.')
        ? '/'
        : validPublicUrl.pathname
      : publicUrl
  }

  if (homepage) {
    const hp = homepage.endsWith('/') ? homepage : homepage + '/'
    const validHomepagePathname = new URL(hp, stubDomain).pathname
    return isEnvDevelopment
      ? hp.startsWith('.')
        ? '/'
        : validHomepagePathname
      : hp.startsWith('.')
        ? hp
        : validHomepagePathname
  }

  return '/'
}
