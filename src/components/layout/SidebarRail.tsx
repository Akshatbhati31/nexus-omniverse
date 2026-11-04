import { AnimatePresence, motion } from 'framer-motion'
import { Command, ChevronRight, PanelLeftClose, RadioTower, Settings2 } from 'lucide-react'
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { NAV_GROUPS, findGroupForPath } from '../../data/navigation'
import { can } from '../../data/roles'
import { cn } from '../../lib/utils'
import { useCurrentUser, useSessionStore } from '../../store/useSessionStore'
import { usePlatformStore } from '../../store/usePlatformStore'
import { useUIStore } from '../../store/useUIStore'

function NexusMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M4 27V5h4.4L23.5 21V5H28v22h-4.4L8.5 11v16z" fill="currentColor" />
      <rect x="24" y="2" width="5" height="5" fill="var(--violet)" />
      <rect x="2" y="25" width="5" height="5" fill="var(--violet)" />
    </svg>
  )
}

export function SidebarRail() {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const roles = useSessionStore((state) => state.roles)
  const activeIncidentCount = usePlatformStore(
    (state) => state.incidents.filter((incident) => !['resolved', 'archived'].includes(incident.status)).length,
  )
  const navGroupOpen = useUIStore((state) => state.navGroupOpen)
  const setNavGroup = useUIStore((state) => state.setNavGroup)
  const openCommand = useUIStore((state) => state.openCommand)

  const activeGroup = findGroupForPath(location.pathname)
  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(user?.roleId, item.permission, roles)),
  })).filter((group) => group.items.length > 0)
  const openGroup = groups.find((group) => group.id === navGroupOpen)

  useEffect(() => {
    setNavGroup(null)
    // Navigation closes any expanded subsystem panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  return (
    <>
      <aside className="nav-rail relative z-50 hidden w-[64px] flex-none flex-col items-center lg:flex">
        <button
          type="button"
          className="group relative flex h-[60px] w-full items-center justify-center border-b border-[var(--line)] text-[var(--cyan)]"
          onClick={() => navigate('/overview')}
          title="NEXUS // OMNIVERSE"
          aria-label="Open global overview"
        >
          <span className="transition-transform duration-300 group-hover:scale-110">
            <NexusMark />
          </span>
          <span className="absolute bottom-2 h-[1px] w-5 bg-gradient-to-r from-transparent via-[var(--cyan)]/40 to-transparent" />
        </button>

        <nav className="mt-4 flex flex-1 flex-col items-center gap-1" aria-label="Primary navigation">
          {groups.map((group) => {
            const Icon = group.icon
            const isActive = activeGroup?.id === group.id
            return (
              <button
                key={group.id}
                type="button"
                className="rail-button group"
                data-active={isActive}
                onClick={() => setNavGroup(navGroupOpen === group.id ? null : group.id)}
                title={`${group.label} (${group.code})`}
                aria-expanded={navGroupOpen === group.id}
              >
                <Icon size={18} strokeWidth={1.5} />
                <span className="pointer-events-none absolute left-[54px] z-50 whitespace-nowrap border border-[var(--line)] bg-[rgba(7,12,18,0.97)] px-2 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--text)] opacity-0 transition-opacity group-hover:opacity-100">
                  {group.label}
                </span>
                {group.id === 'operations' && activeIncidentCount > 0 ? (
                  <span className="absolute right-2 top-2 flex h-3 min-w-3 items-center justify-center bg-[var(--red)] px-1 font-mono text-[7px] font-bold text-[#1b0307]">
                    {activeIncidentCount}
                  </span>
                ) : null}
              </button>
            )
          })}
        </nav>

        <div className="flex w-full flex-col items-center gap-1 border-t border-[var(--line)] py-3">
          <button type="button" className="rail-button" onClick={openCommand} title="Command palette (Ctrl K)" aria-label="Open command palette">
            <Command size={17} strokeWidth={1.5} />
          </button>
          <button
            type="button"
            className="rail-button"
            onClick={() => navigate('/admin')}
            title="System configuration"
            aria-label="Open system administration"
          >
            <Settings2 size={17} strokeWidth={1.5} />
          </button>
          <div className="mt-2 flex flex-col items-center gap-1.5" title="All telemetry streams nominal">
            <span className="status-dot status-dot-pulse text-[var(--green)]" />
            <span className="font-mono text-[7px] tracking-[0.16em] text-[var(--muted-2)]">SYS</span>
          </div>
        </div>
      </aside>

      <AnimatePresence>
        {openGroup ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-40 hidden cursor-default bg-transparent lg:block"
              onClick={() => setNavGroup(null)}
              aria-label="Close navigation panel"
              tabIndex={-1}
            />
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.18, ease: [0.2, 0.8, 0.2, 1] }}
              className="flyout-panel fixed left-[64px] top-[60px] z-50 hidden w-[308px] lg:block"
            >
              <div className="flex items-start justify-between border-b border-[var(--line)] p-4">
                <div>
                  <div className="kicker mb-2">
                    {openGroup.code} // SUBSYSTEM GROUP
                  </div>
                  <h2 className="font-display text-xl tracking-[-0.03em] text-[var(--text-bright)]">{openGroup.label}</h2>
                </div>
                <button type="button" className="icon-btn" onClick={() => setNavGroup(null)} aria-label="Collapse navigation panel">
                  <PanelLeftClose size={14} />
                </button>
              </div>
              <div className="p-2">
                {openGroup.items.map((item, index) => {
                  const Icon = item.icon
                  const active = location.pathname.startsWith(item.path)
                  return (
                    <motion.button
                      key={item.path}
                      type="button"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.03 * index, duration: 0.18 }}
                      onClick={() => {
                        navigate(item.path)
                        setNavGroup(null)
                      }}
                      className={cn(
                        'group flex w-full items-start gap-3 border border-transparent px-3 py-3 text-left transition-colors',
                        active ? 'border-[rgba(86,225,255,0.14)] bg-[rgba(86,225,255,0.055)]' : 'hover:bg-white/[0.025]',
                      )}
                    >
                      <span className={cn('mt-0.5 flex h-7 w-7 flex-none items-center justify-center border border-[var(--line)]', active ? 'text-[var(--cyan)]' : 'text-[var(--muted)]')}>
                        <Icon size={14} strokeWidth={1.5} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className={cn('font-display text-[12px] font-medium', active ? 'text-[var(--text-bright)]' : 'text-[var(--text)]')}>{item.label}</span>
                          {active ? <span className="h-1 w-1 bg-[var(--cyan)]" /> : null}
                        </span>
                        <span className="mt-1 block text-[10px] leading-relaxed text-[var(--muted)]">{item.description}</span>
                      </span>
                      <ChevronRight size={13} className="mt-1 text-[var(--muted-2)] transition-transform group-hover:translate-x-0.5" />
                    </motion.button>
                  )
                })}
              </div>
              <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-3">
                <div className="flex items-center gap-2">
                  <RadioTower size={11} className="text-[var(--green)]" />
                  <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--muted)]">All streams nominal</span>
                </div>
                <span className="font-mono text-[8px] text-[var(--muted-2)]">{activeIncidentCount} ACTIVE</span>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>
    </>
  )
}
