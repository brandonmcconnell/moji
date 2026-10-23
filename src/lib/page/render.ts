import { findCompletedShortcodes } from '../shortcode'
import type { ImageEmoji, ResolvedEmoji } from '../types'
import { PAGE_STYLE } from './style'

export const ATOM_CLASS = 'emoji-ext-atom'
const PLACEHOLDER =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'

const SKIP = [
  'script',
  'style',
  'textarea',
  'input',
  'select',
  'pre',
  'code',
  'noscript',
  'svg',
  `.${ATOM_CLASS}`,
  '.emoji-ext-mirror',
  '.emoji-ext-measurer',
  '.emoji-ext-keyboard-host',
  '.monaco-editor',
  '.cm-editor',
  '.CodeMirror',
  '[data-emoji-ext-skip]',
].join(', ')

export function ensurePageStyle(doc: Document): void {
  if (doc.getElementById('emoji-ext-style')) return
  const style = doc.createElement('style')
  style.id = 'emoji-ext-style'
  style.textContent = PAGE_STYLE
  doc.documentElement.append(style)
}

export function createAtom(emoji: ImageEmoji, src = PLACEHOLDER): HTMLSpanElement {
  const atom = document.createElement('span')
  atom.className = ATOM_CLASS
  atom.contentEditable = 'false'
  atom.dataset.emojiName = emoji.name
  atom.dataset.emojiCache = emoji.cacheKey
  atom.setAttribute('role', 'img')
  atom.setAttribute('aria-label', `:${emoji.name}:`)
  const code = document.createElement('span')
  code.className = 'emoji-ext-code'
  code.textContent = `:${emoji.name}:`
  const image = document.createElement('img')
  image.className = 'emoji-ext-img'
  image.alt = ''
  image.src = src || PLACEHOLDER
  atom.append(code, image)
  return atom
}

function skipText(node: Text): boolean {
  const parent = node.parentElement
  if (!parent) return true
  return parent.closest(SKIP) !== null
}

function placeCaretAfter(node: Node): void {
  const doc = node.ownerDocument
  if (!doc) return
  const range = doc.createRange()
  range.setStartAfter(node)
  range.collapse(true)
  const selection = doc.getSelection()
  selection?.removeAllRanges()
  selection?.addRange(range)
}

function replaceMatch(node: Text, start: number, end: number, emoji: ResolvedEmoji, onImage: (emoji: ImageEmoji, image: HTMLImageElement) => void): Node {
  node.splitText(end)
  const middle = node.splitText(start)
  if (emoji.kind === 'native') {
    middle.data = emoji.native
    return middle
  }
  const atom = createAtom(emoji)
  middle.replaceWith(atom)
  const image = atom.querySelector('img')
  if (image instanceof HTMLImageElement) onImage(emoji, image)
  return atom
}

export function renderTextNode(
  node: Text,
  resolve: (name: string) => ResolvedEmoji | null,
  onImage: (emoji: ImageEmoji, image: HTMLImageElement) => void,
  caretOffset: number | null,
): void {
  if (skipText(node)) return
  const matches = findCompletedShortcodes(node.data).filter((match) => {
    if (caretOffset === null) return true
    return !(caretOffset > match.start && caretOffset < match.end)
  })
  let current = node
  let caretAnchor: Node | null = null
  for (let index = matches.length - 1; index >= 0; index -= 1) {
    const match = matches[index]
    if (!match) continue
    const emoji = resolve(match.name)
    if (!emoji) continue
    const placed = replaceMatch(current, match.start, match.end, emoji, onImage)
    if (caretOffset !== null && match.end === caretOffset) caretAnchor = placed
  }
  if (caretAnchor) placeCaretAfter(caretAnchor)
}

export function renderWithin(
  root: Node,
  resolve: (name: string) => ResolvedEmoji | null,
  onImage: (emoji: ImageEmoji, image: HTMLImageElement) => void,
): void {
  const doc = root.ownerDocument
  if (!doc) return
  const caret = caretLocation(root)
  const nodes: Text[] = []
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let current = walker.nextNode()
  while (current) {
    if (current instanceof Text) nodes.push(current)
    current = walker.nextNode()
  }
  for (const node of nodes) {
    if (!node.isConnected) continue
    const localCaret = caret && caret.node === node ? caret.offset : null
    renderTextNode(node, resolve, onImage, localCaret)
  }
}

function caretLocation(root: Node): { node: Text; offset: number } | null {
  const doc = root.ownerDocument
  const selection = doc?.getSelection()
  if (!selection || !selection.isCollapsed || selection.rangeCount === 0) return null
  const node = selection.anchorNode
  if (!(node instanceof Text) || !root.contains(node)) return null
  return { node, offset: selection.anchorOffset }
}

export function atomBeforeCaret(): HTMLElement | null {
  const selection = document.getSelection()
  if (!selection || !selection.isCollapsed || selection.rangeCount === 0) return null
  const node = selection.anchorNode
  const offset = selection.anchorOffset
  if (node instanceof Text) {
    if (offset > 0) return null
    const previous = node.previousSibling
    return previous instanceof HTMLElement && previous.classList.contains(ATOM_CLASS) ? previous : null
  }
  if (node instanceof HTMLElement && offset > 0) {
    const previous = node.childNodes.item(offset - 1)
    return previous instanceof HTMLElement && previous.classList.contains(ATOM_CLASS) ? previous : null
  }
  return null
}

export function textBeforeCaret(root: HTMLElement): string | null {
  const doc = root.ownerDocument
  const selection = doc.getSelection()
  if (!selection || !selection.isCollapsed || selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.endContainer)) return null
  const before = range.cloneRange()
  before.selectNodeContents(root)
  before.setEnd(range.endContainer, range.endOffset)
  return before.toString()
}

export function richFragment(
  value: string,
  resolve: (name: string) => ResolvedEmoji | null,
  imageSrc: (emoji: ImageEmoji) => string,
): DocumentFragment {
  const fragment = document.createDocumentFragment()
  const matches = findCompletedShortcodes(value)
  let cursor = 0
  for (const match of matches) {
    if (match.start > cursor) fragment.append(value.slice(cursor, match.start))
    const emoji = resolve(match.name)
    if (!emoji) fragment.append(value.slice(match.start, match.end))
    else if (emoji.kind === 'native') fragment.append(emoji.native)
    else {
      const image = document.createElement('img')
      image.className = 'emoji-ext-img'
      image.alt = `:${emoji.name}:`
      image.src = imageSrc(emoji) || PLACEHOLDER
      fragment.append(image)
    }
    cursor = match.end
  }
  if (cursor < value.length) fragment.append(value.slice(cursor))
  return fragment
}
