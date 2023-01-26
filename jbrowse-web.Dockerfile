# syntax=docker/dockerfile:1

# Multi-stage build dockerfile: https://docs.docker.com/build/building/multi-stage/

# Based on the layer caching example in the Docker docs:
# https://docs.docker.com/get-started/09_image_best/#layer-caching
# Basically, by running `yarn install` with just the package.json and
# yarn.lock files present, you can used cached layers to speed up builds that
# don't need to re-run `yarn install`. Because we have a monorepo and Docker's
# COPY doesn't handle complicated globs, though, we have to do two stages
# ("setup" and "build") to get the layer caching to work correctly.
FROM node:16 AS setup
WORKDIR /app
COPY ["package.json", "yarn.lock", "./"]
COPY packages packages
COPY products products
COPY plugins plugins
RUN find . -type f \! \( -name "package.json" -o -name "yarn.lock" \) -delete
RUN find . -type d -empty -delete

FROM node:16 AS build
WORKDIR /app
COPY --from=setup /app .
RUN yarn install --frozen-lockfile
COPY . .
WORKDIR /app/products/jbrowse-web
RUN yarn build

# Once we've built the app, we don't need the Node environment, just the built
# files and a static server. Based on the example in the Docker docs:
# https://docs.docker.com/get-started/09_image_best/#react-example
FROM httpd:alpine
COPY --from=build /app/products/jbrowse-web/build /usr/local/apache2/htdocs
