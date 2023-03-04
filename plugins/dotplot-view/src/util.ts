import { Feature } from '@jbrowse/core/util'

export interface ReducedFeature {
  refName: string
  start: number
  clipPos: number
  end: number
  seqLength: number
}

export interface Interval {
  start: number
  end: number
}

export interface BasicFeature {
  end: number
  start: number
  refName: string
}

export function getTag(f: Feature, tag: string) {
  const tags = f.get('tags')
  return tags ? tags[tag] : f.get(tag)
}

// source https://gist.github.com/vrachieru/5649bce26004d8a4682b
export function mergeIntervals<T extends Interval>(intervals: T[], w = 5000) {
  // test if there are at least 2 intervals
  if (intervals.length <= 1) {
    return intervals
  }

  const stack = []
  let top = null

  // sort the intervals based on their start values
  intervals = intervals.sort((a, b) => a.start - b.start)

  // push the 1st interval into the stack
  stack.push(intervals[0])

  // start from the next interval and merge if needed
  for (let i = 1; i < intervals.length; i++) {
    // get the top element
    top = stack[stack.length - 1]

    // if the current interval doesn't overlap with the
    // stack top element, push it to the stack
    if (top.end + w < intervals[i].start - w) {
      stack.push(intervals[i])
    }
    // otherwise update the end value of the top element
    // if end of current interval is higher
    else if (top.end < intervals[i].end) {
      top.end = Math.max(top.end, intervals[i].end)
      stack.pop()
      stack.push(top)
    }
  }

  return stack
}

export function gatherOverlaps(regions: BasicFeature[]) {
  const memo = {} as { [key: string]: BasicFeature[] }
  for (const x of regions) {
    if (!memo[x.refName]) {
      memo[x.refName] = []
    }
    memo[x.refName].push(x)
  }

  return Object.values(memo).flatMap(group =>
    mergeIntervals(group.sort((a, b) => a.start - b.start)),
  )
}
