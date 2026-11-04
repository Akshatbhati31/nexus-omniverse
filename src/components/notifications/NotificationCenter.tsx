import { AnimatePresence, motion } from 'framer-motion'
import { Bell, CheckCheck, Filter, Settings2, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { NotificationCategory } from '../../types'
import { formatRelative, titleCase } from '../../lib/format'
import { cn } from '../../lib/utils'
import { usePlatformStore } from '../../store/usePlatformStore'
import { useUIStore } from '../../store/useUIStore'
import { Tabs } from '../ui/Tabs'

type DrawerTab = 'all' | 'unread' | 'preferences'

const priorityColor = {
  critical: 'bg-[var(--red)]',
  high: 'bg-[var(--amber)]',
  normal: 'bg-[var(--cyan)]',
  low: 'bg-[var(--muted)]',
}

const categories: Array<{ id: NotificationCategory | 'all'; label: string }> = [
  { id: 'all', label: 'All categories' },
  { id: 'incident', label: 'Incident updates' },
  { id: 'assignment', label: 'Assignments' },
  { id: 'system', label: 'System alerts' },
  { id: 'simulation', label: 'Simulations' },
  { id: 'workspace', label: 'Workspace' },
  { id: 'administration', label: 'Administration' },
]

export function NotificationCenter() {
  const navigate = useNavigate()
  const open = useUIStore((state) => state.notificationsOpen)
  const close = useUIStore((state) => state.closeNotifications)
  const notifications = usePlatformStore((state) => state.notifications)
  const markRead = usePlatformStore((state) => state.markNotificationRead)
  const markAllRead = usePlatformStore((state) => state.markAllNotificationsRead)
  const preferences = usePlatformStore((state) => state.notificationPreferences)
  const updatePreferences = usePlatformStore((state) => state.updateNotificationPreferences)
  const [tab, setTab] = useState<DrawerTab>('all')
  const [category, setCategory] = useState<NotificationCategory | 'all'>('all')

  const filtered = useMemo(() => {
    return notifications.filter((notification) => {
      if (tab === 'unread' && notification.read) return false
      if (category !== 'all' && notification.category !== category) return false
      return true
    })
  }, [notifications, tab, category])

  const unread = notifications.filter((notification) => !notification.read).length

  const handleNotification = (id: string, href?: string) => {
    markRead(id)
    close()
    if (href) navigate(href)
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[75]">
          <button type="button" className="overlay-backdrop absolute inset-0" onClick={close} aria-label="Close notifications" />
          <motion.aside
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            className="drawer absolute right-0 top-0 flex h-full w-[min(94vw,400px)] flex-col"
          >
            <div className="flex h-[58px] flex-none items-center justify-between border-b border-[var(--line)] px-4">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-[var(--cyan)]" />
                <div>
                  <div className="font-display text-[13px] font-medium text-[var(--text-bright)]">Signal center</div>
                  <div className="label-micro mt-0.5">{unread} unread · {notifications.length} total</div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" className="icon-btn" onClick={markAllRead} title="Mark all read" aria-label="Mark all notifications read">
                  <CheckCheck size={15} />
                </button>
                <button type="button" className="icon-btn" onClick={close} aria-label="Close notification center">
                  <X size={16} />
                </button>
              </div>
            </div>

            <Tabs
              items={[
                { id: 'all', label: 'All', count: notifications.length },
                { id: 'unread', label: 'Unread', count: unread },
                { id: 'preferences', label: 'Preferences', icon: Settings2 },
              ]}
              active={tab}
              onChange={setTab}
              className="flex-none px-2"
              ariaLabel="Notification views"
            />

            {tab !== 'preferences' ? (
              <>
                <div className="flex flex-none items-center gap-2 border-b border-[var(--line)] px-4 py-2">
                  <Filter size={11} className="text-[var(--muted-2)]" />
                  <select
                    className="field h-7 min-h-0 flex-1 py-0 text-[10px]"
                    value={category}
                    onChange={(event) => setCategory(event.target.value as NotificationCategory | 'all')}
                    aria-label="Filter notifications by category"
                  >
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {filtered.map((notification, index) => (
                    <motion.button
                      key={notification.id}
                      type="button"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.025, 0.18) }}
                      className={cn(
                        'group relative flex w-full gap-3 border-b border-[var(--line)] px-4 py-3.5 text-left transition-colors hover:bg-white/[0.025]',
                        !notification.read && 'bg-[rgba(86,225,255,0.018)]',
                      )}
                      onClick={() => handleNotification(notification.id, notification.href)}
                    >
                      <span className={cn('mt-1.5 h-1.5 w-1.5 flex-none', priorityColor[notification.priority])} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start justify-between gap-3">
                          <span className={cn('text-[11px] leading-snug', notification.read ? 'text-[var(--muted)]' : 'text-[var(--text-bright)]')}>
                            {notification.title}
                          </span>
                          <span className="flex-none font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">
                            {formatRelative(notification.createdAt)}
                          </span>
                        </span>
                        <span className="mt-1.5 block text-[10px] leading-relaxed text-[var(--muted)]">{notification.body}</span>
                        <span className="mt-2 flex items-center gap-2">
                          <span className="font-mono text-[7px] uppercase tracking-[0.1em] text-[var(--muted-2)]">{titleCase(notification.category)}</span>
                          {!notification.read ? <span className="h-1 w-1 bg-[var(--cyan)]" /> : null}
                        </span>
                      </span>
                    </motion.button>
                  ))}
                  {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <CheckCheck size={22} className="text-[var(--green)]" />
                      <div className="mt-3 font-display text-sm text-[var(--text)]">No signals in this view</div>
                      <div className="mt-1 text-[10px] text-[var(--muted-2)]">All caught up.</div>
                    </div>
                  ) : null}
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="label-micro mb-3">Notification preferences</div>
                <div className="space-y-1">
                  {[
                    { key: 'incidentUpdates' as const, label: 'Incident updates', detail: 'Detection, state transitions and command notices.' },
                    { key: 'assignments' as const, label: 'Assignment updates', detail: 'Response team ownership and reassignment.' },
                    { key: 'simulations' as const, label: 'Simulation completion', detail: 'Saved scenario and model completion events.' },
                    { key: 'workspaceActivity' as const, label: 'Workspace activity', detail: 'Shared dashboards and published reports.' },
                    { key: 'systemAlerts' as const, label: 'System alerts', detail: 'Twin synchronization and platform health.' },
                  ].map((item) => (
                    <label key={item.key} className="flex cursor-pointer items-start justify-between gap-4 border-b border-[var(--line)] py-3">
                      <span>
                        <span className="block text-[11px] text-[var(--text)]">{item.label}</span>
                        <span className="mt-0.5 block text-[9px] leading-relaxed text-[var(--muted)]">{item.detail}</span>
                      </span>
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={preferences[item.key]}
                        onChange={(event) => updatePreferences({ [item.key]: event.target.checked })}
                      />
                      <span className="relative mt-1 h-4 w-7 flex-none border border-[var(--line-strong)] bg-black/30 transition-colors peer-checked:border-[var(--cyan)]/40 peer-checked:bg-[var(--cyan-dim)]">
                        <span className={cn('absolute top-[2px] h-2.5 w-2.5 bg-[var(--muted)] transition-all', preferences[item.key] ? 'left-[13px] bg-[var(--cyan)]' : 'left-[2px]')} />
                      </span>
                    </label>
                  ))}
                </div>
                <div className="mt-4">
                  <label className="label-micro" htmlFor="digest-frequency">Digest frequency</label>
                  <select
                    id="digest-frequency"
                    className="field mt-2"
                    value={preferences.digestFrequency}
                    onChange={(event) => updatePreferences({ digestFrequency: event.target.value as typeof preferences.digestFrequency })}
                  >
                    <option value="realtime">Real time</option>
                    <option value="hourly">Hourly digest</option>
                    <option value="daily">Daily digest</option>
                  </select>
                </div>
                <div className="mt-5 border border-[var(--line)] bg-white/[0.018] p-3">
                  <div className="label-micro">Demo notice</div>
                  <p className="mt-1.5 text-[9.5px] leading-relaxed text-[var(--muted)]">
                    Preferences persist locally. Production notifications should be delivered by a server-side event pipeline with user-scoped
                    policies.
                  </p>
                </div>
              </div>
            )}
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
