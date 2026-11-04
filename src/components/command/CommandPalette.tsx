import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  Bell,
  Bot,
  Command,
  CornerDownLeft,
  FileText,
  Layers3,
  PanelRight,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { ALL_NAV_ITEMS } from '../../data/navigation'
import { can } from '../../data/roles'
import { usePlatformStore } from '../../store/usePlatformStore'
import { useCurrentUser, useSessionStore } from '../../store/useSessionStore'
import { useUIStore } from '../../store/useUIStore'
import { cn } from '../../lib/utils'
import { Kbd } from '../ui/Kbd'

interface CommandResult {
  id: string
  label: string
  description: string
  group: string
  icon: LucideIcon
  meta?: string
  run: () => void
}

export function CommandPalette() {
  const navigate = useNavigate()
  const open = useUIStore((state) => state.commandOpen)
  const close = useUIStore((state) => state.closeCommand)
  const openNotifications = useUIStore((state) => state.openNotifications)
  const toggleInspector = useUIStore((state) => state.toggleInspector)
  const pushToast = useUIStore((state) => state.pushToast)
  const setCompactDensity = useUIStore((state) => state.setCompactDensity)
  const compactDensity = useUIStore((state) => state.compactDensity)
  const entities = usePlatformStore((state) => state.entities)
  const incidents = usePlatformStore((state) => state.incidents)
  const reports = usePlatformStore((state) => state.reports)
  const simulations = usePlatformStore((state) => state.simulations)
  const resetPlatform = usePlatformStore((state) => state.resetPlatform)
  const markAllRead = usePlatformStore((state) => state.markAllNotificationsRead)
  const user = useCurrentUser()
  const roles = useSessionStore((state) => state.roles)
  const logout = useSessionStore((state) => state.logout)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      window.setTimeout(() => inputRef.current?.focus(), 40)
    }
  }, [open])

  const results = useMemo<CommandResult[]>(() => {
    const navigation: CommandResult[] = ALL_NAV_ITEMS.filter((item) => can(user?.roleId, item.permission, roles)).map((item) => ({
      id: `nav-${item.path}`,
      label: item.label,
      description: item.description,
      group: item.groupLabel,
      icon: item.icon,
      meta: item.groupLabel.toUpperCase(),
      run: () => navigate(item.path),
    }))

    const actions: CommandResult[] = [
      {
        id: 'action-notifications',
        label: 'Open signal center',
        description: 'Review incident, assignment and system notifications',
        group: 'Actions',
        icon: Bell,
        run: openNotifications,
      },
      {
        id: 'action-inspector',
        label: 'Toggle context inspector',
        description: 'Show or hide the contextual dossier sidebar',
        group: 'Actions',
        icon: PanelRight,
        run: toggleInspector,
      },
      {
        id: 'action-ai',
        label: 'Ask NEXUS Intelligence',
        description: 'Open the deterministic intelligence workstation',
        group: 'Actions',
        icon: Bot,
        run: () => navigate('/ai'),
      },
      {
        id: 'action-3d',
        label: 'Open the Aurelia digital twin',
        description: 'Enter the 3D geographic intelligence workspace',
        group: 'Actions',
        icon: Layers3,
        run: () => navigate('/geoint'),
      },
      {
        id: 'action-mark-read',
        label: 'Mark all signals read',
        description: 'Clear the unread notification state',
        group: 'Actions',
        icon: Sparkles,
        run: () => {
          markAllRead()
          pushToast({ title: 'Signal center cleared', message: 'All notifications marked read.', tone: 'success' })
        },
      },
      {
        id: 'action-density',
        label: compactDensity ? 'Use standard density' : 'Use compact density',
        description: 'Adjust analytical information density',
        group: 'Actions',
        icon: Command,
        run: () => setCompactDensity(!compactDensity),
      },
      {
        id: 'action-admin',
        label: 'Administration console',
        description: 'Identity, roles, audit and platform configuration',
        group: 'Actions',
        icon: ShieldCheck,
        run: () => navigate('/admin'),
      },
      {
        id: 'action-reset',
        label: 'Reset deterministic demo data',
        description: 'Restore incidents, reports, simulations and notifications',
        group: 'Actions',
        icon: RotateCcw,
        run: () => {
          if (window.confirm('Reset all locally persisted demo records to their seed state?')) {
            resetPlatform()
            pushToast({ title: 'Demo data restored', message: 'Local records returned to the deterministic seed.', tone: 'warning' })
          }
        },
      },
      {
        id: 'action-signout',
        label: 'End demo session',
        description: 'Return to the identity access portal',
        group: 'Actions',
        icon: X,
        run: () => {
          logout()
          navigate('/login')
        },
      },
    ]

    const entityResults: CommandResult[] = entities.slice(0, 80).map((entity) => ({
      id: `entity-${entity.id}`,
      label: entity.name,
      description: `${entity.code} · ${entity.kind} · ${entity.status}`,
      group: 'Entities',
      icon: FileText,
      meta: entity.code,
      run: () => navigate(`/entity/${entity.id}`),
    }))

    const incidentResults: CommandResult[] = incidents.map((incident) => ({
      id: `incident-${incident.id}`,
      label: `${incident.reference} · ${incident.title}`,
      description: `${incident.severity} · ${incident.status} · ${incident.teams.join(', ') || 'unassigned'}`,
      group: 'Incidents',
      icon: Bell,
      meta: incident.status.toUpperCase(),
      run: () => navigate(`/incidents/${incident.id}`),
    }))

    const reportResults: CommandResult[] = reports.map((report) => ({
      id: `report-${report.id}`,
      label: report.title,
      description: `${report.status} · ${report.author}`,
      group: 'Reports',
      icon: FileText,
      meta: report.classification.toUpperCase(),
      run: () => navigate(`/reports/${report.id}`),
    }))

    const simulationResults: CommandResult[] = simulations.map((simulation) => ({
      id: `simulation-${simulation.id}`,
      label: simulation.name,
      description: `${simulation.result.confidence}% confidence · ${simulation.owner}`,
      group: 'Simulations',
      icon: Sparkles,
      meta: simulation.kind.toUpperCase(),
      run: () => navigate('/simulation'),
    }))

    const all = [...actions, ...navigation, ...entityResults, ...incidentResults, ...reportResults, ...simulationResults]
    const normalized = query.trim().toLowerCase()
    if (!normalized) {
      return [
        ...navigation.slice(0, 6),
        ...actions.slice(0, 6),
        ...incidentResults.slice(0, 3),
      ]
    }
    return all
      .filter((result) => `${result.label} ${result.description} ${result.meta ?? ''}`.toLowerCase().includes(normalized))
      .slice(0, 34)
  }, [
    compactDensity,
    entities,
    incidents,
    navigate,
    openNotifications,
    pushToast,
    query,
    reports,
    resetPlatform,
    roles,
    setCompactDensity,
    simulations,
    toggleInspector,
    user?.roleId,
    markAllRead,
    logout,
  ])

  useEffect(() => {
    setActive((current) => Math.min(current, Math.max(0, results.length - 1)))
  }, [results.length])

  if (!open) return null

  const execute = (result: CommandResult) => {
    close()
    result.run()
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((current) => (current + 1) % Math.max(1, results.length))
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((current) => (current - 1 + results.length) % Math.max(1, results.length))
    }
    if (event.key === 'Enter' && results[active]) {
      event.preventDefault()
      execute(results[active])
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[10vh]"
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <button type="button" className="overlay-backdrop absolute inset-0" onClick={close} aria-label="Close command palette" />
        <motion.div
          initial={{ opacity: 0, y: -14, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.985 }}
          transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          className="command-dialog relative w-full max-w-[660px]"
        >
          <div className="flex items-center gap-3 border-b border-[var(--line-strong)] px-4 py-3.5">
            <Search size={17} className="text-[var(--cyan)]" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActive(0)
              }}
              placeholder="Search entities, incidents, subsystems, actions…"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[var(--text-bright)] outline-none placeholder:text-[var(--muted-2)]"
              aria-label="Search command palette"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className="icon-btn h-6 w-6" onClick={close} aria-label="Close command palette">
              <X size={14} />
            </button>
          </div>

          <div className="max-h-[54vh] overflow-y-auto p-2">
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search size={20} className="text-[var(--muted-2)]" />
                <div className="mt-3 font-display text-sm text-[var(--text)]">No matching records</div>
                <div className="mt-1 text-[10px] text-[var(--muted-2)]">Try an entity code, incident reference or subsystem name.</div>
              </div>
            ) : (
              results.map((result, index) => {
                const Icon = result.icon
                const showHeader = index === 0 || results[index - 1].group !== result.group
                return (
                  <div key={result.id}>
                    {showHeader ? (
                      <div className="px-2.5 pb-1 pt-3">
                        <span className="label-micro">{result.group}</span>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-3 px-2.5 py-2.5 text-left transition-colors',
                        active === index ? 'bg-[rgba(86,225,255,0.075)]' : 'hover:bg-white/[0.03]',
                      )}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => execute(result)}
                    >
                      <span className={cn('flex h-7 w-7 flex-none items-center justify-center border border-[var(--line)]', active === index ? 'text-[var(--cyan)]' : 'text-[var(--muted)]')}>
                        <Icon size={14} strokeWidth={1.5} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-[11.5px] text-[var(--text-bright)]">{result.label}</span>
                          {result.meta ? <span className="hidden flex-none font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)] sm:inline">{result.meta}</span> : null}
                        </span>
                        <span className="mt-0.5 block truncate text-[9.5px] text-[var(--muted)]">{result.description}</span>
                      </span>
                      <ArrowRight size={12} className={cn('flex-none transition-opacity', active === index ? 'text-[var(--cyan)] opacity-100' : 'opacity-0')} />
                    </button>
                  </div>
                )
              })
            )}
          </div>

          <div className="flex items-center justify-between border-t border-[var(--line)] px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd><span className="font-mono text-[8px] text-[var(--muted-2)]">navigate</span></span>
              <span className="flex items-center gap-1"><Kbd>↵</Kbd><span className="font-mono text-[8px] text-[var(--muted-2)]">open</span></span>
              <span className="hidden items-center gap-1 sm:flex"><CornerDownLeft size={10} className="text-[var(--muted-2)]" /><span className="font-mono text-[8px] text-[var(--muted-2)]">execute</span></span>
            </div>
            <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">{results.length} records</span>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
