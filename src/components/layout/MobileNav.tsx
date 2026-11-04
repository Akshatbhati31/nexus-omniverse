import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, Command, LogOut, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { NAV_GROUPS } from '../../data/navigation'
import { can, getRole } from '../../data/roles'
import { useCurrentUser, useSessionStore } from '../../store/useSessionStore'
import { useUIStore } from '../../store/useUIStore'

export function MobileNav() {
  const navigate = useNavigate()
  const open = useUIStore((state) => state.mobileNavOpen)
  const setOpen = useUIStore((state) => state.setMobileNav)
  const openCommand = useUIStore((state) => state.openCommand)
  const user = useCurrentUser()
  const roles = useSessionStore((state) => state.roles)
  const logout = useSessionStore((state) => state.logout)

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => can(user?.roleId, item.permission, roles)),
  })).filter((group) => group.items.length > 0)

  const role = user ? getRole(user.roleId, roles) : undefined

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] lg:hidden"
        >
          <button type="button" className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close menu" />
          <motion.aside
            initial={{ x: -320 }}
            animate={{ x: 0 }}
            exit={{ x: -320 }}
            transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
            className="drawer absolute left-0 top-0 flex h-full w-[min(88vw,340px)] flex-col border-r border-[var(--line-strong)]"
          >
            <div className="flex h-[60px] items-center justify-between border-b border-[var(--line)] px-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center border border-[var(--cyan)]/30 font-mono text-[10px] text-[var(--cyan)]">N</span>
                <div>
                  <div className="font-display text-sm font-medium tracking-[0.04em] text-[var(--text-bright)]">NEXUS</div>
                  <div className="label-micro">Omniverse shell</div>
                </div>
              </div>
              <button type="button" className="icon-btn" onClick={() => setOpen(false)} aria-label="Close navigation">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-4">
              <button
                type="button"
                className="mb-4 flex w-full items-center gap-2 border border-[var(--line)] bg-white/[0.02] px-3 py-2.5 text-left text-[var(--muted)]"
                onClick={() => {
                  setOpen(false)
                  openCommand()
                }}
              >
                <Command size={14} />
                <span className="flex-1 text-[11px]">Search or run a command</span>
                <span className="font-mono text-[8px]">⌘K</span>
              </button>
              {groups.map((group) => (
                <div key={group.id} className="mb-5">
                  <div className="mb-2 flex items-center justify-between px-1">
                    <span className="label-micro">{group.label}</span>
                    <span className="font-mono text-[8px] text-[var(--muted-2)]">{group.code}</span>
                  </div>
                  <div className="space-y-0.5">
                    {group.items.map((item) => {
                      const Icon = item.icon
                      return (
                        <button
                          key={item.path}
                          type="button"
                          className="flex w-full items-center gap-3 border border-transparent px-2 py-2.5 text-left hover:border-[var(--line)] hover:bg-white/[0.025]"
                          onClick={() => {
                            navigate(item.path)
                            setOpen(false)
                          }}
                        >
                          <Icon size={15} className="text-[var(--muted)]" />
                          <span className="flex-1 text-[12px] text-[var(--text)]">{item.label}</span>
                          <ChevronRight size={12} className="text-[var(--muted-2)]" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-[var(--line)] p-3">
              <div className="flex items-center gap-3 border border-[var(--line)] bg-white/[0.02] p-3">
                <div className="flex h-8 w-8 items-center justify-center border font-mono text-[10px]" style={{ borderColor: `${user?.color}44`, color: user?.color }}>
                  {user?.initials ?? '--'}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-[12px] text-[var(--text-bright)]">{user?.name ?? 'Unauthenticated'}</div>
                  <div className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">{role?.shortName ?? 'OFFLINE'}</div>
                </div>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => {
                    logout()
                    setOpen(false)
                    navigate('/login')
                  }}
                  aria-label="Sign out"
                >
                  <LogOut size={14} />
                </button>
              </div>
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
