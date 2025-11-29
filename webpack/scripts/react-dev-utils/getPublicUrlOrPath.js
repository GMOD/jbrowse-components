/**
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict'

const { URL } = require('url')

module.exports = function getPublicUrlOrPath(
  isEnvDevelopment,
  homepage,
  envPublicUrl,
) {
  const stubDomain = 'https://create-react-app.dev'

  if (envPublicUrl) {
    envPublicUrl = envPublicUrl.endsWith('/')
      ? envPublicUrl
      : envPublicUrl + '/'

    const validPublicUrl = new URL(envPublicUrl, stubDomain)

    return isEnvDevelopment
      ? envPublicUrl.startsWith('.')
        ? '/'
        : validPublicUrl.pathname
      : envPublicUrl
  }

  if (homepage) {
    homepage = homepage.endsWith('/') ? homepage : homepage + '/'

    const validHomepagePathname = new URL(homepage, stubDomain).pathname
    return isEnvDevelopment
      ? homepage.startsWith('.')
        ? '/'
        : validHomepagePathname
      : homepage.startsWith('.')
        ? homepage
        : validHomepagePathname
  }

  return '/'
}
