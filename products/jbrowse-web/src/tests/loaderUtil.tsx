// we use mainthread rpc so we mock the makeWorkerInstance to an empty file
import React from 'react'
import { QueryParamProvider } from 'use-query-params'
import { WindowHistoryAdapter } from 'use-query-params/adapters/window'

// eslint-disable-next-line import/no-extraneous-dependencies
import { LocalFile } from 'generic-filehandle'
import { Loader } from '../Loader'
import { fetchFile } from './util'

jest.mock('../makeWorkerInstance', () => () => {})

const getFile = (url: string) =>
  new LocalFile(
    require.resolve(`../../${url.replace(/http:\/\/localhost\//, '')}`),
  )

export const readBuffer = async (url: string, args: RequestInit) => {
  if (url.match('plugin-store')) {
    return {
      ok: true,
      async json() {
        return {
          plugins: [
            {
              url: 'https://unpkg.com/jbrowse-plugin-msaview/dist/jbrowse-plugin-msaview.umd.production.min.js',
            },
          ],
        }
      },
    }
  }
  if (url.match(/testid/)) {
    return {
      ok: true,
      async text() {
        return `{"session":"U2FsdGVkX1+9+Hsy+o75Cdyb1jGYB/N1/h6Jr5ARZRF02uH2AN70Uc/yTXAEo4PQMVypDZMLqO+LJcnF6k2FKfRo9w3oeL+EbWZsXgsTrP5IrE+xYN1wfdTKoIohbQMI+zcIZGLVNf7UqNZjwzsIracm5DkgZh9EWo4MAkBP10ZZEWSdV7gmg95a5ofta2bOMpL4T5yOdukBa+6Uvv9qYXt2KdZPR4PoVLQUTE67zIdc0A9n9BuXiTOFUmczfJVvkoQSOGaXGgSUVoK31Ei12lk67a55YtbG3ClENIMcSK/YbMH7w9HtqImzPY0jaQZSZ6ikKW8fXIbXmqX0oadOKS70RNVcF5JcDMYKx6zPxAf7WjpuFh+cNNr7j6bizRoTbuZi+xNsPpnA2QmbtOXCQzbOao1Oj3HzriBAIGC56bSxx0YfJ0en751LV6yrLPsnMmmmowTIjkbH5c+QRJId9sdYQb9Ytqr2dWBKixHSGhLBfdNr0yt3t5GQRu11Rlq6OekrA9KcmHv9QU3AhDtj9TYjG5vqveYCDfS7uSc3TJLEczwF8p02wjuGapYV5QpX+Lm9ADO8X+qW+bFZj3EGKoQBTUSfV1fd3t5oH3KWWuWYpMuRLbSYgcjKC29DOUJA43k+Ufmio+wO7CufcgGkIWlpejojX8f28UsPXaONmd3t8H4bmzXkB631E1EVS4y+RZGxc2uSVedS446qq/9tV9XJW9tkwNINwbpMHAG0OZk="}`
      },
    }
  }
  if (url.match(/testcustomcallback/)) {
    return {
      ok: true,
      async text() {
        return `{"session":"eJzVVm1v2zYQ_isCvzQB7NiK4zTQt9TNVm9p59puUmANAlo6SdwoSiPptwb-7zuSsiw7dhpk2YB9MGAe7-W5e053fCAsIgHRX5fwOfslnJAGETQDFPWFhkRSzXLhaVDagwXNCg6e37ponbZP_YbXDfyLoPvWG3xEs4zKhAkStBskknQO8pZFOiVB5-KsQWYM5ooEvz-4cGzj-974RnO9LEzUayaAyp9B5BncoBHe5HGsQA8WJDhtt9H7pBiANMf2SbuLwZgqOF1CNIQE_bkoEuJPLo1QJ5foRGkqtQUHAhF00ZPfQLUZSAUoiClX0CBUKcgmfFkaz3I-yxdkdYf4JA3_rKUwHOpr-XF0c7PBfslZIjIQWo2NMl6EuYhZMnWZVv6aPBdJUwKNVFPNmhOaNf1zv312cX7WOe-87TQVKIUGay9lhrXgf_XTL1dt6Y-Gu5XbYHjvrFBhwDhMi_U5KH2o3kD9OhmLSO362NZvkBRYkmLxfFP9nZQenjYtofejp5I_gHy7KPeFdX2_WH43zZZPFeRIHvqNpyI0YI5ioHoq4dh7-CY8TwIehFcKTxLQR28UsiiiN8ffxIoY9kUEEhvApOGQD0tRLbGdi1WDjGbJT87rHvU9l6sVGqk0n4_yWPc4KwomkqrlYsY1yHeWmJjTpC9CPo3A9qo5Xy3Ks9_tnBtPo0-DnkmdJrDLaZq__0qv2Kw72eV0j9GG2LMf8rrX_BXJVaIIS___GsO1HPbxtufWEQccQm3Gi5Fa5oh1rXI-dcXybflMaBxsJtbqBbQ-e1Y8q6I1dk-7bdd-6_xIoOUUnMx1t5Os7sygS1kEHzCeqU7ZohvRb-jBzPLqyo7FkS1RLseulCnDMDJMWUg5KVWu6QQ4loYYDJy6T6CEhUmANFmVXg2KOYuQT8tb3d24Hm7T9gc1qq_gwyGVWxvIzmqOuOwy2PA3hoV2fLusH2-uirmriNUxbQkrGL06ye6yAoAbyvx52ZZAGCwrcqlHTlp6XaPZd1eB6u-5NB1J8aObwW3FhEtVgP0W-9jvVIRQXtTBuEV1cCnafnh6aDy5DkV9N1tjzxp7c6ZTb3TjHYV5sTwm29vcgFrvc-wvGtFCbw2AdzS7LIX4xqDZdR5Ws3Aq2QG4J6hp9RV8sUqp1kXQanG05mmudNDBp0bLtMp9RDVtOSct1x4nfygMYLjD2bIwkfizo-KP_ePIhuat58UPHxOvN_T_d2u88cIV8npvpC3TR9X8L98zr_w-eGz_dHYvIsKut3KY9KpBZvr-bvU3l2iNHA"}`
      },
    }
  }
  if (url.match(/nonexist/)) {
    return {
      ok: false,
      statusText: 'failed to find session',
    }
  }
  // this is the analytics
  if (url.match(/jb2=true/)) {
    return {
      ok: true,
      async json() {
        return {}
      },
    }
  }
  return fetchFile(getFile(url), args)
}

export function App({ search }: { search: string }) {
  const location = {
    ...window.location,
    search,
  }
  Object.defineProperty(window, 'location', {
    writable: true,
    value: location,
  })
  return (
    <QueryParamProvider adapter={WindowHistoryAdapter}>
      <Loader />
    </QueryParamProvider>
  )
}