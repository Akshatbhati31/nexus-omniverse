import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

interface PageHeaderProps {
  kicker: string
  title: string
  subtitle?: string
  actions?: ReactNode
  meta?: ReactNode
  className?: string
}

export function PageHeader({ kicker, title, subtitle, actions, meta, className }: PageHeaderProps) {
  return (
    <header className={cn('mb-5 flex flex-col justify-between gap-4 lg:flex-row lg:items-end', className)}>
      <div className="min-w-0">
        <div className="mb-2 flex items-center gap-2">
          <span className="h-1.5 w-1.5 bg-[var(--cyan)] shadow-[0_0_10px_var(--cyan)]" />
          <div className="kicker">{kicker}</div>
        </div>
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle mt-2 max-w-2xl">{subtitle}</p> : null}
        {meta ? <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  )
}
