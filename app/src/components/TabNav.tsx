import type { TabKey } from '../types/run'
import { TABS } from '../types/run'

interface TabNavProps {
  currentTab: TabKey
  onTabChange: (tab: TabKey) => void
}

export function TabNav({ currentTab, onTabChange }: TabNavProps) {
  return (
    <nav>
      {TABS.map((t) => (
        <a
          key={t}
          href={`#tab=${t}`}
          className={t === currentTab ? 'on' : ''}
          onClick={(e) => {
            e.preventDefault()
            onTabChange(t)
          }}
        >
          {t.toUpperCase()}
        </a>
      ))}
    </nav>
  )
}
