import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

export interface TabItem<T extends string = string> {
  id: T
  label: string
  icon?: LucideIcon
  count?: number
}

interface TabsProps<T extends string> {
  items: TabItem<T>[]
  active: T
  onChange: (id: T) => void
  className?: string
  ariaLabel?: string
}

export function Tabs<T extends string>({ items, active, onChange, className, ariaLabel }: TabsProps<T>) {
  return (
    <div className={cn('flex overflow-x-auto border-b border-[var(--line)]', className)} role="tablist" aria-label={ariaLabel}>
      {items.map((item) => {
        const Icon = item.icon
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active === item.id}
            className="tab"
            data-active={active === item.id}
            onClick={() => onChange(item.id)}
          >
            {Icon ? <Icon size={12} strokeWidth={1.5} /> : null}
            {item.label}
            {typeof item.count === 'number' ? (
              <span className="font-mono text-[9px] text-[var(--muted-2)]">{String(item.count).padStart(2, '0')}</span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
