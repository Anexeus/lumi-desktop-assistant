// The small slice of Markdown local models actually write. Parsed to data and rendered as React text nodes, never as HTML.

export type Inline = { kind: 'text' | 'code' | 'bold'; text: string }
export type Block = { kind: 'p'; lines: Inline[][] } | { kind: 'code'; text: string } | { kind: 'ul' | 'ol'; items: Inline[][] }

export function inline(text: string): Inline[] {
  return text
    .split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('`') && part.endsWith('`') && part.length > 1
        ? { kind: 'code', text: part.slice(1, -1) }
        : part.startsWith('**') && part.endsWith('**') && part.length > 4
          ? { kind: 'bold', text: part.slice(2, -2) }
          : { kind: 'text', text: part }
    )
}

const BULLET = /^\s*[-*•]\s+/
const NUMBER = /^\s*\d+[.)]\s+/
const HEADING = /^#{1,6}\s+/

/** Models often indent fences inside list items; drop the shared indent so the code lines up. */
function dedent(code: string): string {
  const lines = code.replace(/\n\s*$/, '').split('\n')
  const indent = Math.min(...lines.filter((l) => l.trim()).map((l) => /^[ \t]*/.exec(l)![0].length))
  return lines.map((l) => l.slice(indent)).join('\n')
}

export function parseMarkdown(text: string): Block[] {
  const blocks: Block[] = []
  // Odd parts are inside ``` fences; an unclosed fence (still streaming) runs to the end.
  text.split(/^[ \t]*```[^\n]*\n?/m).forEach((part, i) => {
    if (i % 2) return part.trim() && blocks.push({ kind: 'code', text: dedent(part) })
    for (const line of part.split('\n')) {
      const last = blocks.at(-1)
      const list = BULLET.test(line) ? 'ul' : NUMBER.test(line) ? 'ol' : null
      if (list) {
        const item = inline(line.replace(list === 'ul' ? BULLET : NUMBER, ''))
        if (last?.kind === list) last.items.push(item)
        else blocks.push({ kind: list, items: [item] })
      } else if (!line.trim()) {
        if (last && last.kind !== 'code') blocks.push({ kind: 'p', lines: [] }) // paragraph break
      } else {
        const content = HEADING.test(line) ? [{ kind: 'bold' as const, text: line.replace(HEADING, '') }] : inline(line)
        if (last?.kind === 'p') last.lines.push(content)
        else blocks.push({ kind: 'p', lines: [content] })
      }
    }
  })
  return blocks.filter((b) => b.kind !== 'p' || b.lines.length)
}
