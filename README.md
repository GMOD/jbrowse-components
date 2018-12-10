[![Build Status](https://travis-ci.com/GMOD/jbrowse-components.svg?branch=master)](https://travis-ci.com/GMOD/jbrowse-components)

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

Following the
[Lerna philosophy](https://github.com/lerna/lerna#common-devdependencies), most
`devDependencies` should be in the root `package.json` and not in the individual
packages. This way they can be shared and updated more easily. The only
exception should be if a package has a `devDependencies` that conflicts with one
already in the root.

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
