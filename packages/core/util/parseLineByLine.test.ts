import { parseLineByLine } from './parseLineByLine'

describe('parseLineByLine', () => {
  it('should call callback for each line', () => {
    const content = `line1
line2
line3`
    const buffer = new TextEncoder().encode(content)
    const lines: string[] = []
    
    parseLineByLine(buffer, (line) => {
      lines.push(line)
    })
    
    expect(lines).toEqual(['line1', 'line2', 'line3'])
  })

  it('should stop parsing when callback returns false', () => {
    const content = `line1
line2
line3
line4`
    const buffer = new TextEncoder().encode(content)
    const lines: string[] = []
    
    parseLineByLine(buffer, (line) => {
      lines.push(line)
      if (line === 'line2') {
        return false
      }
      return true
    })
    
    expect(lines).toEqual(['line1', 'line2'])
  })

  it('should handle empty lines', () => {
    const content = `line1

line3`
    const buffer = new TextEncoder().encode(content)
    const lines: string[] = []
    
    parseLineByLine(buffer, (line) => {
      lines.push(line)
    })
    
    expect(lines).toEqual(['line1', 'line3'])
  })

  it('should handle file without trailing newline', () => {
    const content = `line1
line2`
    const buffer = new TextEncoder().encode(content)
    const lines: string[] = []
    
    parseLineByLine(buffer, (line) => {
      lines.push(line)
    })
    
    expect(lines).toEqual(['line1', 'line2'])
  })

  it('should call status callback during parsing', () => {
    const content = `line1
line2`
    const buffer = new TextEncoder().encode(content)
    const mockStatusCallback = jest.fn()
    
    parseLineByLine(buffer, () => {}, mockStatusCallback)
    
    expect(mockStatusCallback).toHaveBeenCalledWith(expect.stringContaining('Loading'))
  })

  it('should provide line index to callback', () => {
    const content = `line1
line2
line3`
    const buffer = new TextEncoder().encode(content)
    const lineIndices: number[] = []
    
    parseLineByLine(buffer, (line, index) => {
      lineIndices.push(index)
    })
    
    expect(lineIndices).toEqual([0, 1, 2])
  })

  it('should handle empty buffer', () => {
    const buffer = new TextEncoder().encode('')
    const lines: string[] = []
    
    parseLineByLine(buffer, (line) => {
      lines.push(line)
    })
    
    expect(lines).toEqual([])
  })

  it('should handle buffer with only whitespace', () => {
    const content = `   
    
	`
    const buffer = new TextEncoder().encode(content)
    const lines: string[] = []
    
    parseLineByLine(buffer, (line) => {
      lines.push(line)
    })
    
    expect(lines).toEqual([])
  })

  it('should handle single line without newline', () => {
    const content = `single line`
    const buffer = new TextEncoder().encode(content)
    const lines: string[] = []
    
    parseLineByLine(buffer, (line) => {
      lines.push(line)
    })
    
    expect(lines).toEqual(['single line'])
  })
})