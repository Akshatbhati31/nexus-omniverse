import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center px-6 py-10 text-center">
      <div className="mb-4 flex h-11 w-11 items-center justify-center border border-[var(--line)] bg-white/[0.02] text-[var(--muted)]">
        <Icon size={19} strokeWidth={1.4} />
      </div>
      <h3 className="font-display text-sm font-medium text-[var(--text-bright)]">{title}</h3>
      <p className="mt-2 max-w-sm text-[11px] leading-relaxed text-[var(--muted)]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
