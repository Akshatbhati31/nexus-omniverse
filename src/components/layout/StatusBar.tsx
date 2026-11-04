import { Activity, Database, GitBranch, ShieldCheck } from 'lucide-react'
import { usePlatformStore } from '../../store/usePlatformStore'
import { useUIStore } from '../../store/useUIStore'

export function StatusBar() {
  const workspace = useUIStore((state) => state.activeWorkspace)
  const activeIncidentCount = usePlatformStore(
    (state) => state.incidents.filter((incident) => !['resolved', 'archived'].includes(incident.status)).length,
  )
  const entityCount = usePlatformStore((state) => state.entities.length)
  const notifications = usePlatformStore((state) => state.notifications.filter((notification) => !notification.read).length)

  return (
    <footer className="flex h-[25px] flex-none items-center justify-between gap-3 border-t border-[var(--line)] bg-[rgba(5,8,12,0.92)] px-3 font-mono text-[7.5px] uppercase tracking-[0.1em] text-[var(--muted-2)]">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex items-center gap-1.5 text-[var(--amber)]">
          <span className="status-dot status-dot-pulse" />
          Simulated environment
        </span>
        <span className="hidden h-3 w-px bg-[var(--line)] sm:block" />
        <span className="hidden truncate text-[var(--muted)] sm:block">{workspace}</span>
        <span className="hidden items-center gap-1 text-[var(--muted)] md:flex">
          <GitBranch size={9} />
          {activeIncidentCount} active events
        </span>
        <span className="hidden items-center gap-1 text-[var(--muted)] md:flex">
          <Database size={9} />
          Local persistence
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden items-center gap-1 text-[var(--green)] sm:flex">
          <Activity size={9} />
          streams {entityCount}/{entityCount}
        </span>
        <span className="hidden items-center gap-1 text-[var(--muted)] md:flex">
          <ShieldCheck size={9} />
          RBAC enforced
        </span>
        <span className="hidden text-[var(--muted)] lg:inline">{notifications} unread</span>
        <span className="hidden text-[var(--muted)] lg:inline">latency 18ms</span>
        <span className="text-[var(--muted)]">NEXUS 1.0.4</span>
      </div>
    </footer>
  )
}
