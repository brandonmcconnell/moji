import type { BackspaceBehavior } from './types'

export type ShortcodeMatch = {
  name: string
  start: number
  end: number
}

const COMPLETE = /:([a-z0-9_+-]{1,100}):/gi
const OPEN_QUERY = /:([a-z0-9_+-]{0,100})$/i

export function findCompletedShortcodes(text: string): ShortcodeMatch[] {
  const matches: ShortcodeMatch[] = []
  for (const match of text.matchAll(COMPLETE)) {
    const name = match[1]
    if (!name || match.index === undefined) continue
    matches.push({
      name: name.toLowerCase(),
      start: match.index,
      end: match.index + match[0].length,
    })
  }
  return matches
}

/**
 * The unfinished `:query` at the end of the text before the caret.
 * A colon that closes `:name:` is not a new query.
 */
export function findOpenQuery(beforeCaret: string): { start: number; query: string } | null {
  const match = OPEN_QUERY.exec(beforeCaret)
  if (!match || match.index === undefined) return null
  const query = match[1] ?? ''
  if (query.length === 0 && match.index > 0) {
    const completed = findCompletedShortcodes(beforeCaret)
    const last = completed[completed.length - 1]
    if (last && last.end === beforeCaret.length) return null
  }
  return { start: match.index, query: query.toLowerCase() }
}

export type BackspaceEdit = {
  start: number
  end: number
  insert: string
}

/**
 * Edit to apply when Backspace is pressed and the caret sits just after a
 * completed shortcode. Unwrap is the browser's normal single-character delete,
 * so it returns null.
 */
export function backspaceEdit(
  value: string,
  caret: number,
  behavior: BackspaceBehavior,
): BackspaceEdit | null {
  if (behavior !== 'delete') return null
  if (caret < 0 || caret > value.length) return null
  const matches = findCompletedShortcodes(value.slice(0, caret))
  const last = matches[matches.length - 1]
  if (!last || last.end !== caret) return null
  return { start: last.start, end: last.end, insert: '' }
}

export function unwrappedShortcode(name: string): string {
  return `:${name}`
}
