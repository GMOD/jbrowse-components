[![Build Status](https://img.shields.io/travis/com/GMOD/jbrowse-components/master.svg?logo=travis&style=for-the-badge)](https://travis-ci.com/GMOD/jbrowse-components)
[![Coverage Status](https://img.shields.io/codecov/c/github/GMOD/jbrowse-components/master.svg?logo=codecov&style=for-the-badge)](https://codecov.io/gh/GMOD/jbrowse-components/branch/master)
[![Contributor Covenant](https://img.shields.io/badge/Contributor%20Covenant-v1.4%20adopted-ff69b4.svg?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTQiIGhlaWdodD0iMTQiIHZpZXdCb3g9IjAgMCAyNTYgMjU2IiB2ZXJzaW9uPSIxLjEiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgeG1sbnM6eGxpbms9Imh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmsiPjx0aXRsZT5Db250cmlidXRvciBDb3ZlbmFudCBMb2dvPC90aXRsZT48ZyBpZD0iQ2FudmFzIj48ZyBpZD0iR3JvdXAiPjxnIGlkPSJTdWJ0cmFjdCI+PHVzZSB4bGluazpocmVmPSIjcGF0aDBfZmlsbCIgZmlsbD0iIzVFMEQ3MyIvPjwvZz48ZyBpZD0iU3VidHJhY3QiPjx1c2UgeGxpbms6aHJlZj0iI3BhdGgxX2ZpbGwiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDU4IDI0KSIgZmlsbD0iIzVFMEQ3MyIvPjwvZz48L2c+PC9nPjxkZWZzPjxwYXRoIGlkPSJwYXRoMF9maWxsIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0gMTgyLjc4NyAxMi4yODQ2QyAxNzMuMDA1IDkuNDk0MDggMTYyLjY3NyA4IDE1MiA4QyA5MC4xNDQxIDggNDAgNTguMTQ0MSA0MCAxMjBDIDQwIDE4MS44NTYgOTAuMTQ0MSAyMzIgMTUyIDIzMkMgMTg4LjQ2NCAyMzIgMjIwLjg1NyAyMTQuNTc1IDI0MS4zMDggMTg3LjU5OEMgMjE5Ljg3IDIyOC4yNzIgMTc3LjE3MyAyNTYgMTI4IDI1NkMgNTcuMzA3NSAyNTYgMCAxOTguNjkyIDAgMTI4QyAwIDU3LjMwNzUgNTcuMzA3NSAwIDEyOCAwQyAxNDcuNjA0IDAgMTY2LjE3OSA0LjQwNzA5IDE4Mi43ODcgMTIuMjg0NloiLz48cGF0aCBpZD0icGF0aDFfZmlsbCIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNIDEzNy4wOSA5LjIxMzQyQyAxMjkuNzU0IDcuMTIwNTYgMTIyLjAwOCA2IDExNCA2QyA2Ny42MDgxIDYgMzAgNDMuNjA4MSAzMCA5MEMgMzAgMTM2LjM5MiA2Ny42MDgxIDE3NCAxMTQgMTc0QyAxNDEuMzQ4IDE3NCAxNjUuNjQzIDE2MC45MzEgMTgwLjk4MSAxNDAuNjk4QyAxNjQuOTAzIDE3MS4yMDQgMTMyLjg4IDE5MiA5NiAxOTJDIDQyLjk4MDcgMTkyIDAgMTQ5LjAxOSAwIDk2QyAwIDQyLjk4MDcgNDIuOTgwNyAwIDk2IDBDIDExMC43MDMgMCAxMjQuNjM0IDMuMzA1MzEgMTM3LjA5IDkuMjEzNDJaIi8+PC9kZWZzPjwvc3ZnPg==)](CODE_OF_CONDUCT.md)

<!-- [![Greenkeeper badge](https://badges.greenkeeper.io/GMOD/jbrowse-components.svg)](https://greenkeeper.io/) -->

# jbrowse-components

Monorepo using Lerna and Yarn workspaces containing many related packages for
next-generation JBrowse development.

## Development environment setup

You should already have [git](https://git-scm.com/downloads),
[npm](https://nodejs.org/en/download/), and
[yarn](https://yarnpkg.com/en/docs/install) installed

```sh
git clone https://github.com/GMOD/jbrowse-components.git
cd jbrowse-components
yarn
```

This creates a central `node_modules` directory and `yarn.lock` file in the root
directory that are shared by all packages.

## To add a package

Simply create a package in the `packages` directory and make sure it has a
`package.json` You can easily create a shell of a package by running
`./node_modules/.bin/lerna create <package_name>` from the root directory, or
you can use a Yeoman generator or a number of other methods. You may need to
move dev dependencies from the new package to the root, though (see next section
[Dependency management](#dependency-management))

The following are all configured in the root and will be immediately ready to
use in the new package:

- **Jest:** All files in a `tests/` or `__tests__` directory or that have the
  suffixes `.test.js` or `.spec.js` will automatically be run in the test suite.
  You can add a `jest.config.js` file to the new package to build on or override
  settings from the config in the root.
- **ESLint** All JavaScript files will be linted unless listed in
  `.eslintignore`. You can add a `.eslintrc.json` file to the new package to
  build on or override settings from the config in the root, but be aware that
  any files to be ignored will have to be added to the root level
  `.eslintignore` as ESLint does not support multiple ignore files.
- **Babel** By default Babel is set up but does not specify any transformations.
  Set up any that are needed in a `.babelrc` file in the new package.
- **Browserslist** TODO: Find out if a package can modify the root config.
- **EditorConfig** TODO: Find out if a package entry will modify or overwrite
  the root config.

Since these are all installed at the root level, the binary files will not be in
a `node_modules/.bin` directory, however you can still use them in scripts. For
example, you can have an entry like this in your `package.json`:

```json
{
  "scripts": {
    "lint": "eslint src"
  }
}
```

If you then run `yarn lint` within your package it will run eslint on the `src/`
directory of your package. That way you can avoid having to run ESLint on the
whole monorepo.

## Dependency management

### TL;DR

- All `dependencies` go in `<root>/packages/<package>/package.json`
- All `devDependencies` go in `<root>/package.json`

Or saying it a different way:
- `<root>/package.json` should only list devDependencies and no dependencies
- `<root>/packages/<package>/package.json` should only list dependencies and no devDependencies

### Additional information

Following the
[Lerna philosophy](https://github.com/lerna/lerna#common-devdependencies), most
`devDependencies` should be in the root `package.json` and not in the individual
packages. This way they can be shared and updated more easily. The only
exception should be if a package has a `devDependencies` that conflicts with one
already in the root.

- `dependencies` are any NPM package `import`ed or `require`d in a package's `src/` directory _except for any `*test.js` files, which follow the next rule_
- `devDependencies` are any NPM package `import`ed or `require`d in any other files and not already in `dependencies`

To add NPM packages:
- `dependencies`: from root directory run `cd packages/<package> && yarn add <npm_package_name>`
- `devDependencies`: from root directory run `yarn add --dev -W <npm_package_name>`

Currently ESLint seems to have trouble when `dependencies` and `devDependencies`
are in different `package.json` files (even though it should work), so you might
need an ESLint rule like this for now in your package to appease the linter:

```json
{
  "overrides": [
    {
      "files": [
        "generators/**/*.test.js"
      ],
      "rules": {
        "import/no-extraneous-dependencies": "off"
      }
    }
  ]
}
```

## To release

Will be done with Lerna, specifics TBD.
