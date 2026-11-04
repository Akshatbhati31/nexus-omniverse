import { useMemo, useState } from 'react'
import {
  Bell,
  Check,
  Database,
  Download,
  History,
  KeyRound,
  Lock,
  Minus,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  UserCog,
  Users,
  X,
} from 'lucide-react'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel, PanelHeader } from '../components/ui/Panel'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Tabs } from '../components/ui/Tabs'
import { PERMISSION_CATALOG } from '../data/roles'
import { formatDateTime, formatRelative } from '../lib/format'
import { cn, csvFromRows, downloadFile } from '../lib/utils'
import { usePlatformStore } from '../store/usePlatformStore'
import { useCurrentUser, usePermission, useSessionStore } from '../store/useSessionStore'
import { useUIStore } from '../store/useUIStore'
import type { NotificationPreferences, Permission, RoleId } from '../types'

type AdminTab = 'users' | 'roles' | 'audit' | 'settings'

const STATUS_CLASS: Record<string, string> = {
  active: 'badge-green',
  suspended: 'badge-red',
  invited: 'badge-amber',
}

const NOTIFICATION_TOGGLES: Array<{
  key: Exclude<keyof NotificationPreferences, 'digestFrequency'>
  label: string
  description: string
}> = [
  { key: 'incidentUpdates', label: 'Incident updates', description: 'Status changes, escalations and new incident records.' },
  { key: 'assignments', label: 'Assignments', description: 'Team deployments and command ownership changes.' },
  { key: 'simulations', label: 'Simulation runs', description: 'Saved scenarios and completed model runs.' },
  { key: 'workspaceActivity', label: 'Workspace activity', description: 'Dashboard, report and sharing activity.' },
  { key: 'systemAlerts', label: 'System alerts', description: 'Twin synchronization and platform health notices.' },
]

function Toggle({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean
  disabled?: boolean
  onChange: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={cn(
        'relative h-5 w-9 flex-none border transition-colors',
        checked ? 'border-[var(--cyan)]/50 bg-[var(--cyan-dim)]' : 'border-[var(--line-strong)] bg-white/[0.03]',
        disabled && 'cursor-not-allowed opacity-40',
      )}
      onClick={onChange}
    >
      <span
        className={cn(
          'absolute top-1/2 h-3 w-3 -translate-y-1/2 transition-all',
          checked ? 'left-[18px] bg-[var(--cyan)] shadow-[0_0_8px_var(--cyan)]' : 'left-[3px] bg-[var(--muted-2)]',
        )}
      />
    </button>
  )
}

export default function AdminPage() {
  const users = useSessionStore((state) => state.users)
  const roles = useSessionStore((state) => state.roles)
  const sessionStartedAt = useSessionStore((state) => state.sessionStartedAt)
  const updateUserRole = useSessionStore((state) => state.updateUserRole)
  const toggleRolePermission = useSessionStore((state) => state.toggleRolePermission)
  const resetRolePermissions = useSessionStore((state) => state.resetRolePermissions)
  const currentUser = useCurrentUser()
  const auditLogs = usePlatformStore((state) => state.auditLogs)
  const notificationPreferences = usePlatformStore((state) => state.notificationPreferences)
  const updateNotificationPreferences = usePlatformStore((state) => state.updateNotificationPreferences)
  const resetPlatform = usePlatformStore((state) => state.resetPlatform)
  const compactDensity = useUIStore((state) => state.compactDensity)
  const setCompactDensity = useUIStore((state) => state.setCompactDensity)
  const pushToast = useUIStore((state) => state.pushToast)

  const canUsers = usePermission('admin:users')
  const canRoles = usePermission('admin:roles')
  const canAudit = usePermission('admin:audit')
  const canSettings = usePermission('admin:settings')
  const canPrefs = usePermission('notification:prefs')

  const [tab, setTab] = useState<AdminTab>('users')
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<RoleId | 'all'>('all')
  const [auditQuery, setAuditQuery] = useState('')
  const [auditAction, setAuditAction] = useState('all')
  const [resetArmed, setResetArmed] = useState(false)

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return users.filter((user) => {
      if (roleFilter !== 'all' && user.roleId !== roleFilter) return false
      if (!normalized) return true
      return `${user.name} ${user.email} ${user.title} ${user.clearance}`.toLowerCase().includes(normalized)
    })
  }, [query, roleFilter, users])

  const auditActions = useMemo(() => Array.from(new Set(auditLogs.map((entry) => entry.action))).sort(), [auditLogs])
  const filteredAudit = useMemo(() => {
    const normalized = auditQuery.trim().toLowerCase()
    return auditLogs.filter((entry) => {
      if (auditAction !== 'all' && entry.action !== auditAction) return false
      if (!normalized) return true
      return `${entry.actor} ${entry.action} ${entry.targetType} ${entry.targetId}`.toLowerCase().includes(normalized)
    })
  }, [auditAction, auditLogs, auditQuery])

  const roleName = (roleId: RoleId) => roles.find((role) => role.id === roleId)?.name ?? roleId
  const activeUsers = users.filter((user) => user.status === 'active').length
  const aiEndpoint = import.meta.env.VITE_NEXUS_AI_ENDPOINT
  const permissionGroups = useMemo(() => {
    const categories = Array.from(new Set(PERMISSION_CATALOG.map((permission) => permission.category)))
    return categories.map((category) => ({
      category,
      permissions: PERMISSION_CATALOG.filter((permission) => permission.category === category),
    }))
  }, [])

  const changeRole = (userId: string, roleId: RoleId) => {
    if (!canUsers) {
      pushToast({ title: 'Insufficient permission', message: 'Your role cannot reassign identities.', tone: 'danger' })
      return
    }
    const result = updateUserRole(userId, roleId)
    if (!result.ok) {
      pushToast({ title: 'Role change rejected', message: result.message, tone: 'danger' })
      return
    }
    pushToast({ title: 'Identity updated', message: `${users.find((user) => user.id === userId)?.name ?? 'User'} is now ${roleName(roleId)}.`, tone: 'success' })
  }

  const togglePermission = (roleId: RoleId, permission: Permission) => {
    if (!canRoles) {
      pushToast({ title: 'Insufficient permission', message: 'Only a super administrator can alter the permission matrix.', tone: 'danger' })
      return
    }
    const result = toggleRolePermission(roleId, permission)
    if (!result.ok) {
      pushToast({ title: 'Permission change rejected', message: result.message, tone: 'danger' })
      return
    }
    pushToast({ title: 'Permission matrix updated', message: `${roleName(roleId)} · ${permission}`, tone: 'info' })
  }

  const resetPermissions = () => {
    if (!canRoles) {
      pushToast({ title: 'Insufficient permission', message: 'Only a super administrator can reset the matrix.', tone: 'danger' })
      return
    }
    const result = resetRolePermissions()
    if (!result.ok) {
      pushToast({ title: 'Reset rejected', message: result.message, tone: 'danger' })
      return
    }
    pushToast({ title: 'Permissions restored', message: 'All roles have been restored to the baseline matrix.', tone: 'success' })
  }

  const exportAudit = () => {
    downloadFile(
      'nexus-audit-log.csv',
      csvFromRows(
        filteredAudit.map((entry) => ({
          at: entry.at,
          actor: entry.actor,
          action: entry.action,
          target_type: entry.targetType,
          target_id: entry.targetId,
          metadata: JSON.stringify(entry.metadata ?? {}),
        })),
      ),
    )
  }

  const confirmReset = () => {
    if (!canSettings) {
      pushToast({ title: 'Insufficient permission', message: 'Your role cannot reset platform data.', tone: 'danger' })
      return
    }
    if (!resetArmed) {
      setResetArmed(true)
      return
    }
    resetPlatform()
    setResetArmed(false)
    pushToast({ title: 'Demo data reset', message: 'Platform records were restored to the seeded baseline.', tone: 'success' })
  }

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        kicker="System // Administration"
        title="Authority has a paper trail."
        subtitle="Identity management, role permissions, audit inspection and environment settings for the NEXUS operating environment. Every privileged mutation is recorded."
        meta={
          <>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <Users size={10} className="text-[var(--cyan)]" /> {users.length} identities
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <ShieldCheck size={10} className="text-[var(--violet)]" /> {roles.length} roles · {PERMISSION_CATALOG.length} permissions
            </span>
            <span className="badge badge-amber">Demo authority boundary</span>
          </>
        }
        actions={
          canAudit ? (
            <button type="button" className="btn" onClick={exportAudit}><Download size={12} /> Export audit log</button>
          ) : (
            <span className="badge badge-muted"><Lock size={9} /> Audit export restricted</span>
          )
        }
      />

      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Active identities', value: `${activeUsers}/${users.length}`, detail: 'accounts cleared for operation', color: 'var(--cyan)' },
          { label: 'Role definitions', value: String(roles.length), detail: 'ranked authority profiles', color: 'var(--violet)' },
          { label: 'Permission grants', value: String(roles.reduce((sum, role) => sum + role.permissions.length, 0)), detail: 'role-to-permission edges', color: 'var(--green)' },
          { label: 'Audit records', value: String(auditLogs.length), detail: 'retained privileged events', color: 'var(--amber)' },
        ].map((metric) => (
          <Panel key={metric.label} className="p-4">
            <div className="label-micro">{metric.label}</div>
            <div className="data-value mt-2 text-[26px]" style={{ color: metric.color }}>{metric.value}</div>
            <div className="mt-1 text-[9px] text-[var(--muted-2)]">{metric.detail}</div>
          </Panel>
        ))}
      </div>

      <Tabs<AdminTab>
        items={[
          { id: 'users', label: 'Identities', icon: Users, count: users.length },
          { id: 'roles', label: 'Roles & permissions', icon: ShieldCheck, count: roles.length },
          { id: 'audit', label: 'Audit trail', icon: History, count: auditLogs.length },
          { id: 'settings', label: 'Environment', icon: Settings2 },
        ]}
        active={tab}
        onChange={setTab}
        className="mb-3"
        ariaLabel="Administration sections"
      />

      {tab === 'users' ? (
        <Panel>
          <PanelHeader title="Identity directory" eyebrow="Accounts, roles and clearance" icon={<UserCog size={13} />} action={<span className="font-mono text-[8px] text-[var(--muted-2)]">{filteredUsers.length} shown</span>} />
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2.5">
            <div className="relative min-w-[180px] flex-1">
              <Search size={11} className="absolute left-2.5 top-2.5 text-[var(--muted-2)]" />
              <input className="field h-8 min-h-0 pl-8 text-[10px]" placeholder="Search identity, email or clearance…" value={query} onChange={(event) => setQuery(event.target.value)} />
            </div>
            <select className="field h-8 min-h-0 w-auto text-[10px]" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleId | 'all')} aria-label="Filter identity role">
              <option value="all">All roles</option>
              {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
            </select>
            {!canUsers ? <span className="badge badge-amber"><Lock size={9} /> Read-only</span> : null}
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Identity</th>
                  <th>Role</th>
                  <th>Clearance</th>
                  <th>Status</th>
                  <th>Last active</th>
                  <th>Session</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 flex-none items-center justify-center border border-[var(--line)] font-mono text-[8px]" style={{ color: user.color, background: `${user.color}11` }}>{user.initials}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[10.5px] text-[var(--text-bright)]">{user.name}</span>
                            {currentUser?.id === user.id ? <span className="badge badge-cyan">you</span> : null}
                          </div>
                          <div className="mt-0.5 font-mono text-[7.5px] text-[var(--muted-2)]">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <select
                        className="field h-7 min-h-0 w-auto min-w-[150px] py-0 text-[9px]"
                        value={user.roleId}
                        onChange={(event) => changeRole(user.id, event.target.value as RoleId)}
                        disabled={!canUsers}
                        aria-label={`Role for ${user.name}`}
                      >
                        {roles.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}
                      </select>
                    </td>
                    <td className="font-mono text-[8px] uppercase tracking-[0.06em] text-[var(--muted)]">{user.clearance}</td>
                    <td><span className={cn('badge', STATUS_CLASS[user.status] ?? 'badge-muted')}>{user.status}</span></td>
                    <td className="font-mono text-[8px] text-[var(--muted-2)]">{formatRelative(user.lastActive)}</td>
                    <td>
                      {currentUser?.id === user.id ? (
                        <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--green)]">active</span>
                      ) : (
                        <span className="font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted-2)]">offline</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {filteredUsers.length === 0 ? <div className="p-8 text-center text-[10px] text-[var(--muted-2)]">No identities match the filter.</div> : null}
          <div className="border-t border-[var(--line)] px-4 py-2.5 text-[8.5px] leading-relaxed text-[var(--muted-2)]">
            Client-side role assignment is a demonstration control. Production role changes must pass through a server-side RPC guarded by <span className="font-mono text-[var(--muted)]">admin:users</span> and be written to an append-only audit table.
          </div>
        </Panel>
      ) : null}

      {tab === 'roles' ? (
        <div className="space-y-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {roles.map((role) => (
              <Panel key={role.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">{role.shortName} · rank {role.rank}</div>
                    <h3 className="mt-1 font-display text-[15px] tracking-[-0.02em] text-[var(--text-bright)]">{role.name}</h3>
                  </div>
                  {role.id === 'super_admin' ? <span className="badge badge-violet"><Lock size={9} /> root</span> : null}
                </div>
                <p className="mt-2 text-[9.5px] leading-relaxed text-[var(--muted)]">{role.description}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="label-micro">Permission grants</span>
                  <span className="font-mono text-[9px] text-[var(--text)]">{role.permissions.length}/{PERMISSION_CATALOG.length}</span>
                </div>
                <ProgressBar value={(role.permissions.length / PERMISSION_CATALOG.length) * 100} color={role.id === 'super_admin' ? 'var(--violet)' : 'var(--cyan)'} className="mt-1.5" />
              </Panel>
            ))}
          </div>

          <Panel>
            <PanelHeader
              title="Permission matrix"
              eyebrow={canRoles ? 'Click a grant to toggle it' : 'Read-only · admin:roles required'}
              icon={<KeyRound size={13} />}
              action={
                <button type="button" className="btn btn-sm h-7" onClick={resetPermissions} disabled={!canRoles}>
                  <RotateCcw size={10} /> Reset matrix
                </button>
              }
            />
            {!canRoles ? (
              <div className="flex items-start gap-2 border-b border-[var(--amber)]/20 bg-[var(--amber-dim)] px-4 py-2.5">
                <Lock size={11} className="mt-0.5 flex-none text-[var(--amber)]" />
                <p className="text-[9px] leading-relaxed text-[var(--muted)]">Your role can inspect the permission matrix but cannot modify role grants. Only a Super Administrator carries <span className="font-mono">admin:roles</span>.</p>
              </div>
            ) : null}
            <div className="max-h-[620px] overflow-auto">
              <table className="data-table min-w-[900px]">
                <thead className="sticky top-0 z-10 bg-[#0b1119]">
                  <tr>
                    <th className="w-[260px]">Permission</th>
                    {roles.map((role) => <th key={role.id} className="text-center">{role.shortName}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {permissionGroups.map((group) => (
                    <>
                      <tr key={group.category}>
                        <td colSpan={roles.length + 1} className="bg-white/[0.02]">
                          <span className="label-micro">{group.category}</span>
                        </td>
                      </tr>
                      {group.permissions.map((permission) => (
                        <tr key={permission.id}>
                          <td>
                            <div className="text-[10px] text-[var(--text)]">{permission.label}</div>
                            <div className="mt-0.5 font-mono text-[7.5px] text-[var(--muted-2)]">{permission.id}</div>
                          </td>
                          {roles.map((role) => {
                            const granted = role.permissions.includes(permission.id)
                            const immutable = role.id === 'super_admin' || !canRoles
                            return (
                              <td key={role.id} className="text-center">
                                <button
                                  type="button"
                                  className={cn(
                                    'mx-auto flex h-6 w-6 items-center justify-center border transition-colors',
                                    granted ? 'border-[var(--green)]/30 bg-[var(--green-dim)] text-[var(--green)]' : 'border-[var(--line)] bg-white/[0.015] text-[var(--muted-2)]',
                                    immutable ? 'cursor-not-allowed opacity-70' : 'hover:border-[var(--cyan)]/40',
                                  )}
                                  onClick={() => togglePermission(role.id, permission.id)}
                                  disabled={immutable}
                                  aria-label={`${granted ? 'Revoke' : 'Grant'} ${permission.id} for ${role.name}`}
                                  aria-pressed={granted}
                                  title={immutable ? (role.id === 'super_admin' ? 'Super Administrator permissions are immutable.' : 'admin:roles required.') : `${granted ? 'Revoke' : 'Grant'} ${permission.id}`}
                                >
                                  {granted ? <Check size={11} /> : <Minus size={11} />}
                                </button>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[var(--line)] px-4 py-2.5 text-[8.5px] leading-relaxed text-[var(--muted-2)]">
              Demo permission edits persist in localStorage. Production authorization is enforced by PostgreSQL RLS and server-side RPCs; client toggles never become the security boundary.
            </div>
          </Panel>
        </div>
      ) : null}

      {tab === 'audit' ? (
        canAudit ? (
          <Panel>
            <PanelHeader title="Privileged action ledger" eyebrow="Append-only demonstration audit trail" icon={<History size={13} />} action={<span className="font-mono text-[8px] text-[var(--muted-2)]">{filteredAudit.length} events</span>} />
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--line)] px-3 py-2.5">
              <div className="relative min-w-[180px] flex-1">
                <Search size={11} className="absolute left-2.5 top-2.5 text-[var(--muted-2)]" />
                <input className="field h-8 min-h-0 pl-8 text-[10px]" placeholder="Search actor, action or target…" value={auditQuery} onChange={(event) => setAuditQuery(event.target.value)} />
              </div>
              <select className="field h-8 min-h-0 w-auto text-[10px]" value={auditAction} onChange={(event) => setAuditAction(event.target.value)} aria-label="Filter audit action">
                <option value="all">All actions</option>
                {auditActions.map((action) => <option key={action} value={action}>{action}</option>)}
              </select>
              <button type="button" className="btn h-8" onClick={exportAudit}><Download size={10} /> Export filtered</button>
            </div>
            <div className="max-h-[620px] overflow-auto">
              <table className="data-table">
                <thead className="sticky top-0 z-10 bg-[#0b1119]">
                  <tr>
                    <th>Timestamp</th>
                    <th>Actor</th>
                    <th>Action</th>
                    <th>Target</th>
                    <th>Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAudit.map((entry) => (
                    <tr key={entry.id}>
                      <td className="whitespace-nowrap font-mono text-[8px] text-[var(--muted-2)]">{formatDateTime(entry.at)}</td>
                      <td className="text-[10px] text-[var(--text)]">{entry.actor}</td>
                      <td className="font-mono text-[8.5px] text-[var(--cyan)]">{entry.action}</td>
                      <td>
                        <div className="font-mono text-[8px] uppercase tracking-[0.06em] text-[var(--muted-2)]">{entry.targetType}</div>
                        <div className="mt-0.5 text-[9.5px] text-[var(--text)]">{entry.targetId}</div>
                      </td>
                      <td className="font-mono text-[8px] text-[var(--muted-2)]">
                        {entry.metadata && Object.keys(entry.metadata).length
                          ? Object.entries(entry.metadata).map(([key, value]) => `${key}=${value}`).join(' · ')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredAudit.length === 0 ? <div className="p-8 text-center text-[10px] text-[var(--muted-2)]">No audit events match the filter.</div> : null}
            <div className="border-t border-[var(--line)] px-4 py-2.5 text-[8.5px] leading-relaxed text-[var(--muted-2)]">
              Audit records are created by privileged store actions. Production should store them in an append-only table with immutable triggers and restricted read access.
            </div>
          </Panel>
        ) : (
          <Panel>
            <div className="flex min-h-[260px] flex-col items-center justify-center px-6 py-10 text-center">
              <Lock size={22} className="text-[var(--amber)]" />
              <h2 className="mt-3 font-display text-[16px] text-[var(--text-bright)]">Audit access restricted</h2>
              <p className="mt-2 max-w-md text-[10px] leading-relaxed text-[var(--muted)]">The current role does not carry <span className="font-mono">admin:audit</span>. The audit ledger is intentionally hidden rather than partially rendered.</p>
            </div>
          </Panel>
        )
      ) : null}

      {tab === 'settings' ? (
        <div className="grid gap-3 xl:grid-cols-12">
          <div className="space-y-3 xl:col-span-7">
            <Panel>
              <PanelHeader title="Notification preferences" eyebrow="Category-level delivery controls" icon={<Bell size={13} />} action={!canPrefs ? <span className="badge badge-amber"><Lock size={9} /> Read-only</span> : null} />
              <div className="divide-y divide-[var(--line)]">
                {NOTIFICATION_TOGGLES.map((preference) => (
                  <div key={preference.key} className="flex items-center justify-between gap-4 px-4 py-3">
                    <div className="min-w-0">
                      <div className="text-[10.5px] text-[var(--text)]">{preference.label}</div>
                      <div className="mt-0.5 text-[9px] leading-relaxed text-[var(--muted-2)]">{preference.description}</div>
                    </div>
                    <Toggle
                      checked={notificationPreferences[preference.key]}
                      disabled={!canPrefs}
                      label={preference.label}
                      onChange={() => updateNotificationPreferences({ [preference.key]: !notificationPreferences[preference.key] } as Partial<NotificationPreferences>)}
                    />
                  </div>
                ))}
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="text-[10.5px] text-[var(--text)]">Digest frequency</div>
                    <div className="mt-0.5 text-[9px] text-[var(--muted-2)]">Controls notification batching in production delivery.</div>
                  </div>
                  <select
                    className="field h-8 min-h-0 w-auto text-[10px]"
                    value={notificationPreferences.digestFrequency}
                    onChange={(event) => updateNotificationPreferences({ digestFrequency: event.target.value as NotificationPreferences['digestFrequency'] })}
                    disabled={!canPrefs}
                    aria-label="Digest frequency"
                  >
                    <option value="realtime">Realtime</option>
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                  </select>
                </div>
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Workspace display" eyebrow="Local interface preferences" icon={<SlidersHorizontal size={13} />} />
              <div className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <div className="text-[10.5px] text-[var(--text)]">Compact density</div>
                  <div className="mt-0.5 text-[9px] leading-relaxed text-[var(--muted-2)]">Reduce panel spacing for high-density command displays. Persists to local UI state.</div>
                </div>
                <Toggle checked={compactDensity} label="Compact density" onChange={() => setCompactDensity(!compactDensity)} />
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Danger zone" eyebrow="Destructive demo action" icon={<Trash2 size={13} />} />
              <div className="p-4">
                <p className="text-[10px] leading-relaxed text-[var(--muted)]">
                  Reset all platform records to the seeded demonstration baseline. Incidents, reports, simulations, dashboards, conversations, notifications and audit logs created in this browser will be replaced.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button type="button" className={cn('btn', resetArmed ? 'btn-danger' : '')} onClick={confirmReset} disabled={!canSettings}>
                    <RotateCcw size={11} /> {resetArmed ? 'Confirm full reset' : 'Reset demo data'}
                  </button>
                  {resetArmed ? <button type="button" className="btn" onClick={() => setResetArmed(false)}><X size={11} /> Cancel</button> : null}
                </div>
                {!canSettings ? <p className="mt-2 text-[8.5px] text-[var(--amber)]">Your role cannot perform destructive platform actions.</p> : null}
              </div>
            </Panel>
          </div>

          <div className="space-y-3 xl:col-span-5">
            <Panel>
              <PanelHeader title="Environment posture" eyebrow="Runtime configuration" icon={<Database size={13} />} />
              <div className="divide-y divide-[var(--line)]">
                {[
                  ['Data plane', 'Local demo persistence'],
                  ['Persistence key', 'nexus-platform-v1'],
                  ['AI engine', aiEndpoint ? 'External endpoint configured' : 'Deterministic local fallback'],
                  ['Authorization', 'Client RBAC + documented RLS'],
                  ['Session start', sessionStartedAt ? formatDateTime(sessionStartedAt) : 'No active session'],
                  ['Current identity', currentUser?.name ?? 'Unauthenticated'],
                  ['Current role', currentUser ? roleName(currentUser.roleId) : '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-3 px-4 py-2.5">
                    <span className="label-micro">{label}</span>
                    <span className="text-right text-[9.5px] text-[var(--text)]">{value}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <PanelHeader title="Access posture" eyebrow="Current identity grants" icon={<ShieldCheck size={13} />} />
              <div className="p-4">
                {currentUser ? (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center border border-[var(--line)] font-mono text-[10px]" style={{ color: currentUser.color, background: `${currentUser.color}11` }}>{currentUser.initials}</span>
                      <div>
                        <div className="text-[11px] text-[var(--text-bright)]">{currentUser.name}</div>
                        <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{currentUser.title} · {currentUser.clearance}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {roles.find((role) => role.id === currentUser.roleId)?.permissions.slice(0, 10).map((permission) => (
                        <span key={permission} className="badge badge-muted">{permission}</span>
                      ))}
                      {(roles.find((role) => role.id === currentUser.roleId)?.permissions.length ?? 0) > 10 ? (
                        <span className="badge badge-cyan">+{(roles.find((role) => role.id === currentUser.roleId)?.permissions.length ?? 0) - 10} more</span>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <p className="text-[10px] text-[var(--muted-2)]">No active identity.</p>
                )}
              </div>
            </Panel>

            <div className="flex items-start gap-2 border border-[var(--line)] bg-white/[0.015] p-3">
              <Lock size={11} className="mt-0.5 flex-none text-[var(--violet)]" />
              <p className="text-[9px] leading-relaxed text-[var(--muted-2)]">
                Demo mode is not a security boundary. The production migration in <span className="font-mono text-[var(--muted)]">supabase/migrations</span> defines RLS policies and server-side RPCs for every privileged workflow represented here.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
