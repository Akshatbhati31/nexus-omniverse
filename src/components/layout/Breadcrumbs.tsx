import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

export interface Crumb {
  label: string
  to?: string
}

export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('mb-3 flex items-center gap-1 overflow-x-auto', className)}>
      <ol className="flex min-w-0 items-center gap-1">
        {items.map((item, index) => {
          const current = index === items.length - 1
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1">
              {index > 0 ? <ChevronRight size={10} className="flex-none text-[var(--muted-2)]" aria-hidden="true" /> : null}
              {current || !item.to ? (
                <span
                  aria-current={current ? 'page' : undefined}
                  className={cn(
                    'truncate font-mono text-[8px] uppercase tracking-[0.1em]',
                    current ? 'text-[var(--text)]' : 'text-[var(--muted-2)]',
                  )}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.to}
                  className="truncate font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)] transition-colors hover:text-[var(--cyan)]"
                >
                  {item.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
