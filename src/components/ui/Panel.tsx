import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function Panel({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('panel', className)} {...props}>
      {children}
    </div>
  )
}

interface PanelHeaderProps {
  title: string
  eyebrow?: string
  action?: ReactNode
  icon?: ReactNode
  className?: string
  compact?: boolean
}

export function PanelHeader({ title, eyebrow, action, icon, className, compact }: PanelHeaderProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 border-b border-[var(--line)]',
        compact ? 'px-3 py-2' : 'px-4 py-3',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        {icon ? <span className="text-[var(--cyan)]">{icon}</span> : null}
        <div className="min-w-0">
          {eyebrow ? <div className="label-micro mb-1">{eyebrow}</div> : null}
          <h2 className="truncate font-display text-[13px] font-medium tracking-[-0.01em] text-[var(--text-bright)]">{title}</h2>
        </div>
      </div>
      {action ? <div className="flex flex-none items-center gap-1.5">{action}</div> : null}
    </div>
  )
}

export function PanelBody({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('p-4', className)} {...props}>
      {children}
    </div>
  )
}
