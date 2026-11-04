import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { getDomain, getWorkspacesForDomain, type DomainId } from '../../data/workspaces'

export function WorkspaceNav({ domain: domainId, className }: { domain: DomainId; className?: string }) {
  const domain = getDomain(domainId)
  const workspaces = getWorkspacesForDomain(domainId)
  if (!domain) return null

  return (
    <nav aria-label={`${domain.label} workspaces`} className={cn('mb-4 border-b border-[var(--line)]', className)}>
      <div className="flex items-center justify-between gap-3 overflow-x-auto">
        <div className="flex min-w-max items-center">
          <NavLink
            to={domain.path}
            end
            className={({ isActive }) => cn('tab', isActive && 'border-[var(--cyan)] text-[var(--cyan)]')}
          >
            Module overview
          </NavLink>
          {workspaces.map((workspace) => (
            <NavLink
              key={workspace.id}
              to={`${domain.path}/workspace/${workspace.id}`}
              className={({ isActive }) => cn('tab', isActive && 'border-[var(--cyan)] text-[var(--cyan)]')}
            >
              {workspace.label}
            </NavLink>
          ))}
        </div>
        <span className="hidden flex-none font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)] sm:block">
          Level 2 · {workspaces.length} workspaces
        </span>
      </div>
    </nav>
  )
}
