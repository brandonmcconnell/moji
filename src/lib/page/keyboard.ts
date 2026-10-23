import { customEmojiForPage, keyboardItems, pageAllowsStandard, pageHasCustomSource, type StandardLookup } from '../catalog'
import type { ExtensionState, KeyboardItem } from '../types'
import { KEYBOARD_STYLE } from './style'

export type KeyboardController = {
  host: HTMLElement
  update: (state: {
    snapshot: ExtensionState
    url: string
    query: string
    rect: DOMRect
    imageSrc: (cacheKey: string) => string
    onSelect: (item: KeyboardItem) => void
  }) => void
  close: () => void
  isOpen: () => boolean
  activeItem: () => KeyboardItem | null
  move: (delta: number) => void
}

function element(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

export function mountKeyboard(doc: Document, standard: StandardLookup): KeyboardController {
  const host = doc.createElement('div')
  host.className = 'emoji-ext-keyboard-host'
  host.hidden = true
  const shadow = host.attachShadow({ mode: 'open' })
  const style = doc.createElement('style')
  style.textContent = KEYBOARD_STYLE
  const panel = element('div', 'panel')
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', 'Emoji')
  shadow.append(style, panel)
  doc.body.append(host)

  let items: KeyboardItem[] = []
  let active = 0
  let onSelect: (item: KeyboardItem) => void = () => undefined
  let mode: 'browse' | 'filter' = 'browse'
  let categoryId = standard.categories()[0]?.id ?? ''

  panel.addEventListener('mousedown', (event) => {
    event.preventDefault()
  })

  function choose(index: number): void {
    const item = items[index]
    if (!item) return
    onSelect(item)
  }

  function paintFilter(query: string, imageSrc: (cacheKey: string) => string): void {
    panel.replaceChildren()
    panel.append(element('div', 'query', query ? `:${query}` : 'Emoji'))
    const rows = element('div', 'rows')
    if (items.length === 0) {
      rows.append(element('div', 'empty', 'No emoji match that.'))
    }
    items.forEach((item, index) => {
      const button = doc.createElement('button')
      button.type = 'button'
      button.dataset.active = index === active ? 'true' : 'false'
      if (item.kind === 'standard') {
        button.append(element('span', 'glyph', item.native), element('span', 'name', item.name), element('span', 'meta', item.label))
      } else {
        const image = doc.createElement('img')
        image.alt = ''
        image.src = imageSrc(item.image.cacheKey)
        button.append(image, element('span', 'name', item.name), element('span', 'meta', item.label))
      }
      button.addEventListener('click', () => choose(index))
      rows.append(button)
    })
    panel.append(rows)
    rows.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }

  function paintBrowse(
    snapshot: ExtensionState,
    url: string,
    imageSrc: (cacheKey: string) => string,
  ): void {
    panel.replaceChildren()
    const custom = customEmojiForPage(snapshot, url)
    const categories = pageAllowsStandard(snapshot, url) ? standard.categories() : []
    const tabs = element('div', 'tabs')
    tabs.setAttribute('role', 'tablist')
    if (custom.length > 0) {
      const button = doc.createElement('button')
      button.type = 'button'
      button.textContent = 'Custom'
      button.setAttribute('aria-selected', categoryId === 'custom' ? 'true' : 'false')
      button.addEventListener('click', () => {
        categoryId = 'custom'
        active = 0
        paintBrowse(snapshot, url, imageSrc)
      })
      tabs.append(button)
    }
    for (const category of categories) {
      const button = doc.createElement('button')
      button.type = 'button'
      button.textContent = category.emoji[0]?.native ?? '•'
      button.title = category.label
      button.setAttribute('aria-label', category.label)
      button.setAttribute('aria-selected', category.id === categoryId ? 'true' : 'false')
      button.addEventListener('click', () => {
        categoryId = category.id
        active = 0
        paintBrowse(snapshot, url, imageSrc)
      })
      tabs.append(button)
    }
    const grid = element('div', 'grid')
    items = []
    if (categoryId === 'custom') {
      items = custom.slice(0, 160).map((emoji) => ({
        kind: 'custom',
        name: emoji.name,
        label: emoji.sourceLabel,
        image: emoji,
      }))
    } else {
      const category = categories.find((item) => item.id === categoryId) ?? categories[0]
      items = (category?.emoji ?? []).slice(0, 240).map((emoji) => ({
        kind: 'standard',
        name: emoji.name,
        label: emoji.label,
        native: emoji.native,
      }))
    }
    if (active >= items.length) active = 0
    items.forEach((item, index) => {
      const button = doc.createElement('button')
      button.type = 'button'
      button.dataset.active = index === active ? 'true' : 'false'
      button.title = `:${item.name}:`
      if (item.kind === 'standard') button.textContent = item.native
      else {
        const image = doc.createElement('img')
        image.alt = item.name
        image.src = imageSrc(item.image.cacheKey)
        button.append(image)
      }
      button.addEventListener('click', () => choose(index))
      grid.append(button)
    })
    if (items.length === 0) grid.append(element('div', 'empty', 'No custom emoji for this site yet.'))
    panel.append(tabs, grid)
  }

  return {
    host,
    isOpen: () => !host.hidden,
    activeItem: () => items[active] ?? null,
    move(delta: number) {
      if (items.length === 0) return
      active = (active + delta + items.length) % items.length
      const buttons = panel.querySelectorAll('button[data-active]')
      buttons.forEach((button, index) => {
        if (button instanceof HTMLElement) button.dataset.active = index === active ? 'true' : 'false'
      })
      panel.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
    },
    close() {
      host.hidden = true
      items = []
      active = 0
    },
    update(next) {
      const allowed = pageAllowsStandard(next.snapshot, next.url) || pageHasCustomSource(next.snapshot, next.url)
      if (!allowed) {
        this.close()
        return
      }
      onSelect = next.onSelect
      host.hidden = false
      const rect = next.rect
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - 360))
      const top = rect.bottom + 6
      const panelTop = top + 340 > window.innerHeight ? Math.max(8, rect.top - 346) : top
      panel.style.left = `${left}px`
      panel.style.top = `${panelTop}px`
      if (next.query.length > 0) {
        if (mode !== 'filter') active = 0
        mode = 'filter'
        items = keyboardItems(next.snapshot, next.url, next.query, standard)
        if (active >= items.length) active = 0
        paintFilter(next.query, next.imageSrc)
      } else {
        if (mode !== 'browse') active = 0
        mode = 'browse'
        if (categoryId !== 'custom' && !standard.categories().some((category) => category.id === categoryId)) {
          categoryId = pageHasCustomSource(next.snapshot, next.url) ? 'custom' : (standard.categories()[0]?.id ?? '')
        }
        if (categoryId === '' && pageHasCustomSource(next.snapshot, next.url)) categoryId = 'custom'
        paintBrowse(next.snapshot, next.url, next.imageSrc)
      }
    },
  }
}
