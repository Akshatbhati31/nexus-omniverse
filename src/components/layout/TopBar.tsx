import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  Check,
  ChevronDown,
  Menu,
  PanelRight,
  Search,
  ShieldCheck,
  UserRound,
  Wifi,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { findGroupForPath, findNavItem } from '../../data/navigation'
import { can, getRole } from '../../data/roles'
import { useSimulatedClock } from '../../hooks/useClock'
import { cn } from '../../lib/utils'
import { usePlatformStore } from '../../store/usePlatformStore'
import { useCurrentUser, useSessionStore } from '../../store/useSessionStore'
import { useUIStore } from '../../store/useUIStore'
import { Kbd } from '../ui/Kbd'

const WORKSPACES = [
  { id: 'aurelia', name: 'Aurelia Metropolitan Theater', code: 'AUR-01', description: 'Unified city operating picture' },
  { id: 'eastern-grid', name: 'Eastern Grid Command', code: 'NRG-E', description: 'Lumen / Solace / Helix energy corridor' },
  { id: 'tidal', name: 'Tidal Corridor', code: 'MOB-S', description: 'Bridge, port and freight operations' },
  { id: 'foundry', name: 'Foundry Environmental', code: 'ENV-F', description: 'Air, thermal and industrial telemetry' },
  { id: 'archive', name: 'Historical Intelligence', code: 'ARC-H', description: 'Temporal analysis workspace' },
]

export function TopBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { time, date } = useSimulatedClock()
  const user = useCurrentUser()
  const roles = useSessionStore((state) => state.roles)
  const users = useSessionStore((state) => state.users)
  const loginAs = useSessionStore((state) => state.loginAs)
  const logout = useSessionStore((state) => state.logout)
  const unread = usePlatformStore((state) => state.notifications.filter((notification) => !notification.read).length)
  const activeWorkspace = useUIStore((state) => state.activeWorkspace)
  const setActiveWorkspace = useUIStore((state) => state.setActiveWorkspace)
  const openCommand = useUIStore((state) => state.openCommand)
  const openNotifications = useUIStore((state) => state.openNotifications)
  const toggleInspector = useUIStore((state) => state.toggleInspector)
  const inspectorOpen = useUIStore((state) => state.inspectorOpen)
  const setMobileNav = useUIStore((state) => state.setMobileNav)
  const pushToast = useUIStore((state) => state.pushToast)

  const [workspaceOpen, setWorkspaceOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)

  const role = user ? getRole(user.roleId, roles) : undefined
  const activeGroup = findGroupForPath(location.pathname)
  const activeItem = findNavItem(location.pathname)
  const isIncidentDetail = /^\/incidents\/[^/]+/.test(location.pathname)
  const isEntityDetail = /^\/entity\/[^/]+/.test(location.pathname)
  const isReportDetail = /^\/reports\/[^/]+/.test(location.pathname)
  const currentLabel = isIncidentDetail
    ? 'Incident Dossier'
    : isEntityDetail
      ? 'Entity Dossier'
      : isReportDetail
        ? 'Report Workspace'
        : (activeItem?.label ?? 'Operating Environment')
  const workspace = WORKSPACES.find((item) => item.name === activeWorkspace) ?? WORKSPACES[0]

  useEffect(() => {
    setWorkspaceOpen(false)
    setProfileOpen(false)
  }, [location.pathname])

  const closeMenus = () => {
    setWorkspaceOpen(false)
    setProfileOpen(false)
  }

  return (
    <header className="relative z-40 flex h-[58px] flex-none items-center justify-between gap-3 border-b border-[var(--line)] bg-[rgba(6,10,15,0.82)] px-3 backdrop-blur-xl lg:px-4">
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" className="icon-btn lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation">
          <Menu size={18} />
        </button>
        <div className="hidden items-center gap-2 sm:flex">
          <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[var(--muted-2)]">NEXUS</span>
          <span className="text-[var(--muted-2)]">/</span>
          <span className="font-mono text-[8px] uppercase tracking-[0.14em] text-[var(--cyan)]/70">{activeGroup?.code ?? 'SYS'}</span>
          <span className="text-[var(--muted-2)]">/</span>
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate font-display text-[12px] font-medium tracking-[0.01em] text-[var(--text-bright)]">{currentLabel}</h1>
          <span className="hidden items-center gap-1.5 border border-[var(--amber)]/20 bg-[var(--amber-dim)] px-1.5 py-0.5 font-mono text-[7px] uppercase tracking-[0.12em] text-[var(--amber)] sm:flex">
            <span className="h-1 w-1 bg-[var(--amber)]" />
            Simulation
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <div className="relative hidden xl:block">
          <button
            type="button"
            className="flex h-8 min-w-[220px] items-center gap-2 border border-[var(--line)] bg-white/[0.015] px-2.5 text-left transition-colors hover:border-[var(--line-strong)]"
            onClick={() => {
              setWorkspaceOpen((open) => !open)
              setProfileOpen(false)
            }}
            aria-expanded={workspaceOpen}
          >
            <span className="h-1.5 w-1.5 bg-[var(--green)] shadow-[0_0_6px_var(--green)]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[10px] text-[var(--text)]">{workspace.name}</span>
            </span>
            <span className="font-mono text-[7px] text-[var(--muted-2)]">{workspace.code}</span>
            <ChevronDown size={11} className="text-[var(--muted-2)]" />
          </button>
        </div>

        <button
          type="button"
          className="group flex h-8 items-center gap-2 border border-[var(--line)] bg-white/[0.015] px-2.5 text-[var(--muted)] transition-colors hover:border-[var(--line-strong)] hover:text-[var(--text)] sm:min-w-[190px]"
          onClick={openCommand}
          aria-label="Search environment"
        >
          <Search size={13} />
          <span className="hidden flex-1 text-left text-[10px] sm:block">Search environment</span>
          <span className="hidden items-center gap-0.5 sm:flex" aria-hidden="true">
            <Kbd>⌘</Kbd>
            <Kbd>K</Kbd>
          </span>
        </button>

        <div className="mx-1 hidden h-6 w-px bg-[var(--line)] md:block" />

        <div className="hidden flex-col items-end md:flex">
          <span className="font-mono text-[10px] tracking-[0.03em] text-[var(--text-bright)]">{time} UTC</span>
          <span className="font-mono text-[7px] uppercase tracking-[0.13em] text-[var(--muted-2)]">{date} · SIM</span>
        </div>

        <div className="mx-1 hidden h-6 w-px bg-[var(--line)] md:block" />

        <div className="hidden items-center gap-1.5 px-1 lg:flex" title="All telemetry streams nominal">
          <Wifi size={12} className="text-[var(--green)]" />
          <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-[var(--muted)]">Nominal</span>
        </div>

        <button type="button" className="icon-btn relative" onClick={openNotifications} aria-label={`Open notifications, ${unread} unread`}>
          <Bell size={16} strokeWidth={1.5} />
          {unread > 0 ? (
            <span className="absolute right-1 top-1 flex h-3 min-w-3 items-center justify-center bg-[var(--red)] px-0.5 font-mono text-[7px] font-bold text-[#1b0307]">
              {unread}
            </span>
          ) : null}
        </button>

        <button
          type="button"
          className={cn('icon-btn hidden md:flex', inspectorOpen && 'border-[var(--cyan)]/20 bg-[var(--cyan-dim)] text-[var(--cyan)]')}
          onClick={toggleInspector}
          aria-label="Toggle context inspector"
          title="Toggle context inspector"
        >
          <PanelRight size={16} strokeWidth={1.5} />
        </button>

        <div className="relative">
          <button
            type="button"
            className="flex h-8 items-center gap-2 border border-[var(--line)] bg-white/[0.015] px-1.5 transition-colors hover:border-[var(--line-strong)]"
            onClick={() => {
              setProfileOpen((open) => !open)
              setWorkspaceOpen(false)
            }}
            aria-expanded={profileOpen}
            aria-label={`${user?.initials ?? 'Account'} ${user?.name ?? 'sign in'} ${role?.shortName ?? ''} — open profile and identity menu`}
          >
            <span
              className="flex h-5 w-5 items-center justify-center border font-mono text-[8px]"
              style={{ borderColor: `${user?.color ?? '#56e1ff'}44`, background: `${user?.color ?? '#56e1ff'}0e`, color: user?.color }}
            >
              {user?.initials ?? '--'}
            </span>
            <span className="hidden pr-1 text-left xl:block">
              <span className="block text-[9px] leading-tight text-[var(--text)]">{user?.name ?? 'Sign in'}</span>
              <span className="block font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{role?.shortName}</span>
            </span>
            <ChevronDown size={10} className="hidden text-[var(--muted-2)] xl:block" />
          </button>
        </div>
      </div>

      {(workspaceOpen || profileOpen) && <button type="button" className="fixed inset-0 z-40 cursor-default bg-transparent" onClick={closeMenus} aria-label="Close menu" tabIndex={-1} />}

      <AnimatePresence>
        {workspaceOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.16 }}
            className="absolute right-[360px] top-[50px] z-50 hidden w-[300px] border border-[var(--line-strong)] bg-[rgba(8,13,19,0.98)] shadow-[0_30px_80px_rgba(0,0,0,0.7)] backdrop-blur-xl xl:block"
          >
            <div className="border-b border-[var(--line)] px-4 py-3">
              <div className="label-micro">Workspace selector</div>
              <div className="mt-1 font-display text-sm text-[var(--text-bright)]">Active operating context</div>
            </div>
            <div className="p-1.5">
              {WORKSPACES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={cn(
                    'flex w-full items-start gap-2.5 px-2.5 py-2.5 text-left transition-colors',
                    activeWorkspace === item.name ? 'bg-[rgba(86,225,255,0.06)]' : 'hover:bg-white/[0.03]',
                  )}
                  onClick={() => {
                    setActiveWorkspace(item.name)
                    setWorkspaceOpen(false)
                    pushToast({ title: 'Workspace context switched', message: item.name, tone: 'info' })
                  }}
                >
                  <span className="mt-0.5 flex h-4 w-4 items-center justify-center border border-[var(--line)]">
                    {activeWorkspace === item.name ? <Check size={10} className="text-[var(--cyan)]" /> : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[11px] text-[var(--text)]">{item.name}</span>
                      <span className="font-mono text-[7px] text-[var(--muted-2)]">{item.code}</span>
                    </span>
                    <span className="mt-0.5 block text-[9px] text-[var(--muted)]">{item.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        ) : null}

        {profileOpen ? (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.16 }}
            className="absolute right-3 top-[50px] z-50 w-[300px] border border-[var(--line-strong)] bg-[rgba(8,13,19,0.98)] shadow-[0_30px_80px_rgba(0,0,0,0.7)] backdrop-blur-xl"
          >
            <div className="border-b border-[var(--line)] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center border font-mono text-[11px]" style={{ borderColor: `${user?.color}44`, color: user?.color, background: `${user?.color}0d` }}>
                  {user?.initials ?? '--'}
                </div>
                <div className="min-w-0">
                  <div className="truncate font-display text-sm text-[var(--text-bright)]">{user?.name ?? 'Unauthenticated'}</div>
                  <div className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">{role?.name}</div>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="border border-[var(--line)] bg-black/20 px-2 py-1.5">
                  <div className="label-micro">Clearance</div>
                  <div className="mt-0.5 font-mono text-[9px] text-[var(--text)]">{user?.clearance}</div>
                </div>
                <div className="border border-[var(--line)] bg-black/20 px-2 py-1.5">
                  <div className="label-micro">Status</div>
                  <div className="mt-0.5 flex items-center gap-1.5 font-mono text-[9px] text-[var(--green)]">
                    <span className="h-1 w-1 bg-[var(--green)]" />
                    ACTIVE
                  </div>
                </div>
              </div>
            </div>

            <div className="p-1.5">
              <div className="label-micro px-2.5 py-2">Demo identity switch</div>
              <div className="max-h-[190px] overflow-y-auto">
                {users.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-white/[0.035]"
                    onClick={() => {
                      loginAs(candidate.id)
                      setProfileOpen(false)
                      pushToast({ title: 'Demo identity switched', message: `${candidate.name} · ${getRole(candidate.roleId, roles).name}`, tone: 'info' })
                    }}
                  >
                    <span className="flex h-5 w-5 items-center justify-center border font-mono text-[7px]" style={{ borderColor: `${candidate.color}33`, color: candidate.color }}>
                      {candidate.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10px] text-[var(--text)]">{candidate.name}</span>
                      <span className="block font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{getRole(candidate.roleId, roles).shortName}</span>
                    </span>
                    {candidate.id === user?.id ? <Check size={11} className="text-[var(--cyan)]" /> : null}
                  </button>
                ))}
              </div>
              <div className="my-1 border-t border-[var(--line)]" />
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-[10px] text-[var(--muted)] hover:bg-white/[0.03] hover:text-[var(--text)]"
                onClick={() => {
                  setProfileOpen(false)
                  navigate('/admin')
                }}
              >
                <UserRound size={13} />
                Profile & access
              </button>
              {can(user?.roleId, 'view:admin', roles) ? (
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-[10px] text-[var(--muted)] hover:bg-white/[0.03] hover:text-[var(--text)]"
                  onClick={() => {
                    setProfileOpen(false)
                    navigate('/admin')
                  }}
                >
                  <ShieldCheck size={13} />
                  Administration
                </button>
              ) : null}
              <button
                type="button"
                className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left text-[10px] text-[var(--red)]/80 hover:bg-[var(--red-dim)] hover:text-[var(--red)]"
                onClick={() => {
                  logout()
                  setProfileOpen(false)
                  navigate('/login')
                }}
              >
                <X size={13} />
                End session
              </button>
            </div>
            <div className="border-t border-[var(--line)] px-4 py-2">
              <span className="font-mono text-[7px] uppercase tracking-[0.12em] text-[var(--amber)]/70">Demo mode · not a security boundary</span>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  )
}
