import { describe, expect, it } from 'vitest'
import { inline, parseMarkdown } from '../../src/renderer/ui/markdown'

describe('markdown', () => {
  it('parses bold and inline code, leaving everything else as text', () => {
    expect(inline('use **npm** and `npm test` <b>x</b>')).toEqual([
      { kind: 'text', text: 'use ' },
      { kind: 'bold', text: 'npm' },
      { kind: 'text', text: ' and ' },
      { kind: 'code', text: 'npm test' },
      { kind: 'text', text: ' <b>x</b>' }
    ])
    expect(inline('2 * 3 ** 4')).toEqual([{ kind: 'text', text: '2 * 3 ** 4' }])
  })

  it('groups paragraphs, lists, headings and code fences', () => {
    const blocks = parseMarkdown('## Steps\nDo this:\n\n- one\n- **two**\n1. a\n2) b\n```js\nlet x = 1\n```\nafter')
    expect(blocks).toEqual([
      { kind: 'p', lines: [[{ kind: 'bold', text: 'Steps' }], [{ kind: 'text', text: 'Do this:' }]] },
      { kind: 'ul', items: [[{ kind: 'text', text: 'one' }], [{ kind: 'bold', text: 'two' }]] },
      { kind: 'ol', items: [[{ kind: 'text', text: 'a' }], [{ kind: 'text', text: 'b' }]] },
      { kind: 'code', text: 'let x = 1' },
      { kind: 'p', lines: [[{ kind: 'text', text: 'after' }]] }
    ])
  })

  it('handles fences indented under a list item', () => {
    expect(parseMarkdown('- **Types**\n  ```ts\n  let a: string\n    nested\n  ```\n- next')).toEqual([
      { kind: 'ul', items: [[{ kind: 'bold', text: 'Types' }]] },
      { kind: 'code', text: 'let a: string\n  nested' },
      { kind: 'ul', items: [[{ kind: 'text', text: 'next' }]] }
    ])
  })

  it('keeps an unclosed fence as code while it streams', () => {
    expect(parseMarkdown('Here:\n```\nconst a')).toEqual([
      { kind: 'p', lines: [[{ kind: 'text', text: 'Here:' }]] },
      { kind: 'code', text: 'const a' }
    ])
  })
})
