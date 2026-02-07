type MenuItem = {
  name: string
  vintage?: string
  region?: string
  grapes?: string
  note?: string
  bin?: string | number
  price?: string | number
  staffPick?: boolean
}

type MenuCategory = {
  id: string
  label: string
}

type MenuTab = {
  id: string
  label: string
  categories: MenuCategory[]
}

export type MenuData = {
  tabs: MenuTab[]
  wines: MenuItem[]
}

const LANG_KEY = 'wine_lang'

const FR_MAP: Record<string, string> = {
  'Wine List': 'Carte des vins',
  'Red': 'Rouge',
  'White': 'Blanc',
  'Sparkling': 'Mousseux',
  'Staff Picks': 'Coups de cœur',
  'Bin': 'Casier',
  'Name': 'Nom',
  'Vintage': 'Millésime',
  'Price': 'Prix',
  'Bottle': 'Bouteille',
  'Glass': 'Verre',
  'Market Price': 'Prix du marché',
  'Red Blends': 'Assemblages rouges',
  'Other Reds': 'Autres rouges',
  'White Blends': 'Assemblages blancs',
  'Other Whites': 'Autres blancs'
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}

export function resolveLanguage(): 'en' | 'fr' {
  const url = new URL(window.location.href)
  const q = (url.searchParams.get('lang') || '').toLowerCase()
  if (q === 'fr') return 'fr'
  const stored = (localStorage.getItem(LANG_KEY) || '').toLowerCase()
  return stored === 'fr' ? 'fr' : 'en'
}

export function setLanguage(lang: 'en' | 'fr') {
  const url = new URL(window.location.href)

  if (lang === 'fr') {
    localStorage.setItem(LANG_KEY, 'fr')
    url.searchParams.set('lang', 'fr')
  } else {
    localStorage.removeItem(LANG_KEY)
    url.searchParams.delete('lang')
  }

  history.replaceState({}, '', url.toString())
  window.location.reload()
}

export function ensureFrenchUrlIfStored() {
  const stored = (localStorage.getItem(LANG_KEY) || '').toLowerCase()
  if (stored !== 'fr') return

  const url = new URL(window.location.href)
  if (url.searchParams.get('lang') === 'fr') return

  url.searchParams.set('lang', 'fr')
  history.replaceState({}, '', url.toString())
}

export function attachSevenClickUnlock(selector = '.title') {
  const el = document.querySelector(selector)
  if (!el) return

  let count = 0
  let timer: number | null = null

  ;(el as HTMLElement).style.userSelect = 'none'
  ;(el as HTMLElement).style.cursor = 'pointer'

  el.addEventListener('click', () => {
    count++

    if (timer) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      count = 0
    }, 5000)

    if (count >= 7) {
      count = 0
      const next = resolveLanguage() === 'fr' ? 'en' : 'fr'
      setLanguage(next)
    }
  })
}

function t(label: string, lang: 'en' | 'fr') {
  if (lang !== 'fr') return label
  return FR_MAP[label] || label
}

export function applyLocalePolicy(data: MenuData, lang: 'en' | 'fr'): MenuData {
  if (lang !== 'fr') return data

  const copy = deepClone(data)

  copy.tabs = copy.tabs.map(tab => ({
    ...tab,
    label: t(tab.label, lang),
    categories: tab.categories.map(cat => ({
      ...cat,
      label: t(cat.label, lang)
    }))
  }))

  return copy
}

export function localizeString(str: string, lang: 'en' | 'fr') {
  return t(str, lang)
}
