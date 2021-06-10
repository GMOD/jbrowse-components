# JBrowse + Trix Documentation

## How `ixIxx` works:

`ixIxx` is a program that creates Trix indicies. The program takes one file as input and outputs two index files. The input file is formatted as:

```
value1 searchTerm1 searchTerm2 searchTerm3
value2 searchTerm1 searchTerm4
value3 searchTerm2 searchTerm5 searchTerm1
```

^ Notice that the order of the search terms does not matter. They are space separated and can be any number of terms.

After running `ixIxx input.txt out.ix out.ixx`:

The output of the `.ix` file is as follows:

```
searchTerm1 value1,1 value2,1 value3,3
searchTerm2 value1,2 value3,1
searchTerm3 value1,3
searchTerm4 value2,2
searchTerm5 value3,2
```

The `.ix`  plaintext file is sorted in alphanumeric order, where each line is a search term, followed by values. Each value has a comma followed by a *line-level-location* which represents where the search term exists in the line of the input file. For example, `searchTerm5 value3,2` means that `searchTerm5` is the second word on the line for `value3` in the input file. Also notice how much repetition there is with the data in the `.ix` file.

The output of the `.ixx` file is as follows:

```
searc0000000000
```

The `.ixx` file is also sorted in alphanumeric order, but this example is so small that there is only one line. The `.ixx` file is used to locate a chunk of the `.ix` file. The first five characters are the prefix for the searchTerm, and the following 10 characters are a representation in hexadecimal byte offset of where the chunk is located in the `.ix` file. (0 means the start of the file)

## How `trixSearch` works:

Given a searchWord, `trixSearch` first reads line by line of the `.ixx` file until it reaches a prefix that is alphabetically greater than the searchWord (or hits the end of the file). Then it takes the previous line and grabs the hexadecimal byte offset to use as the `seekPosStart`, and the current line's hex byte offset as the `seekPosEnd`. It then grabs a chunk of data from `.ix` within the range `[seekPosStart, seekPosEnd]`.

`trixSearch` now just needs to read from that chunk of data line by line until it gets a "hit", i.e. when the searchWord matches the first word in the line. It does this until the searchWord is alphabetically less than the first word in the line. If it reaches the end of the chunk and there is a possibility for more matches, it grabs the next consecutive chunk from the `.ix` file. Each "hit" is stored in an array. Once the number of hits ≥ `maxResults` (default 20), or searchTerm is alphabetically less than the first word on the line, it returns the results array.

## How `text-index` command works:

Essentially there are 4 steps in the code:

1. Get the gff file.
2. Unzip the gff file if needed.
3. Parse the gff file into a stream.
4. Create a child process with `stdin` set to the gff stream.

In more detail:

```
// Diagram of function call flow:

                                      ------> handleGff3UrlWithGz()---\
                                    /             OR                   parseGff3Stream()
                                  / --------> handleGff3UrlNoGz()-----/                 \
                                /                                                        \
               -----> handleURL()                                                         \
              /                                                                            \
 indexDriver()         OR                                                                  returns ----> indexDriver() -------> runIxIxx() --------> output .ix and .ixx files
              \                                                                            /                ⇆
               -----> handleLocalGff3()                                                   /           recurseFeatures()
                                      \                                                  /
                                       \ -----> parseLocalGZip() ---\                   /
                                        \            OR              parseGff3Stream()
                                         ---------------------------/
```

1. If the file is a url, we call `handleGffUrl()`, otherwise we call `handleLocalGff3()`.
2. If the file is gzipped, then unzip it. Then hand off the code to `parseGff3Stream()`.
3. Return back to `indexDriver()`
4. `indexDriver()` calls `recurseFeatures()` to get all the feature records from the gff file. We convert the json record to base64 so that there are no spaces or commas that would mess up the Trix search.
5. `runIxIxx()` creates a child process with `stdin` set to the gff stream.

## Known Problems and How to Fix Them:

→ ix searches really fast (5 ms for a GB test). But the downside is that it is pretty space inefficient with the `.ix` file (1-5x larger than the file to index). This isn't the end of the world, because the .ix files can be hosted remotely, and then the client only has to have the .`ixx` file to do the search and make a request for the specific chunk needed from the remote `.ix` file. From what I've seen this is about 5000 lines or 300 KB of data on average. 

- One way to reduce space is to store line items as arrays instead of a json string. This would save 20-30% space since the identifiers are not included in the string (which is worth doing)
- Ideally the data needs to be compressed instead of just converting it to base 64, but this can cause problems because Trix treats commas and spaces as separator keys. Consider converting commas and spaces to other non-used characters such as semi-colons and backticks? Then use [https://www.npmjs.com/package/shorter](https://www.npmjs.com/package/shorter) to compress data. Re-writing `ixIxx` and altering `trixSearch` could also fix this.

→ It only works with gff files at the moment. We use the `@gmod/gff` npm package and would likely use similar packages for other times of files. However, Colin mentioned just parsing line by line might be an option.

→ `ixIxx` is difficult to have as a dependency. Because it is run in the shell of the user, they need to have `ixIxx`. One solution is to write it in Node just like `trixSearch`. Here is the source code: [https://github.com/ucscGenomeBrowser/kent/blob/master/src/index/ixIxx/ixIxx.c](https://github.com/ucscGenomeBrowser/kent/blob/master/src/index/ixIxx/ixIxx.c)

## Useful links:

Github Issue: [https://github.com/GMOD/jbrowse-components/issues/1827](https://github.com/GMOD/jbrowse-components/issues/1827)

Info on UCSC Trix: [https://genome.ucsc.edu/goldenPath/help/trix.html](https://genome.ucsc.edu/goldenPath/help/trix.html)

Kent repo with ixIxx and Trix: [https://github.com/ucscGenomeBrowser/kent](https://github.com/ucscGenomeBrowser/kent)
