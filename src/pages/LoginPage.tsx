import { motion } from 'framer-motion'
import { ArrowRight, Fingerprint, LockKeyhole, ShieldCheck, Sparkles, Wifi } from 'lucide-react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { DEMO_USERS, DISTRICTS, RIVER_PATH } from '../data/constants'
import { getRole } from '../data/roles'
import { useSessionStore } from '../store/useSessionStore'
import { cn } from '../lib/utils'

function AccessCity() {
  return (
    <svg viewBox="0 0 1000 600" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="access-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#56e1ff" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#56e1ff" stopOpacity="0.12" />
        </linearGradient>
        <pattern id="login-grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(126,160,190,0.09)" strokeWidth="0.5" />
        </pattern>
        <filter id="city-glow">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width="1000" height="600" fill="url(#login-grid)" />
      <path d={RIVER_PATH} fill="none" stroke="rgba(86,225,255,0.22)" strokeWidth="18" />
      <path d={RIVER_PATH} fill="none" stroke="rgba(86,225,255,0.45)" strokeWidth="0.7" strokeDasharray="4 8" />
      {DISTRICTS.map((district, index) => (
        <g key={district.id}>
          <motion.path
            d={district.path}
            fill="url(#access-sky)"
            stroke={district.color}
            strokeOpacity="0.22"
            strokeWidth="0.8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 + index * 0.08, duration: 0.8 }}
          />
          <text x={district.center.x} y={district.center.y} fill={district.color} fillOpacity="0.42" fontSize="7" fontFamily="JetBrains Mono Variable" letterSpacing="2" textAnchor="middle">
            {district.code}
          </text>
          {Array.from({ length: 5 }, (_, buildingIndex) => {
            const x = district.center.x - 34 + buildingIndex * 17 + (index % 3) * 3
            const height = 9 + ((index * 17 + buildingIndex * 13) % 28)
            return <rect key={buildingIndex} x={x} y={district.center.y + 18 - height} width="7" height={height} fill={district.color} opacity={0.1 + buildingIndex * 0.02} />
          })}
        </g>
      ))}
      <g filter="url(#city-glow)">
        <circle cx="500" cy="300" r="5" fill="#56e1ff" />
        <circle cx="500" cy="300" r="20" fill="none" stroke="#56e1ff" strokeOpacity="0.4" strokeWidth="0.6" className="glow-ring" />
        <circle cx="786" cy="168" r="3" fill="#f3b85a" />
        <circle cx="748" cy="464" r="3" fill="#ff5d73" />
        <circle cx="505" cy="498" r="3" fill="#8f7cff" />
      </g>
      {[
        [120, 90, 'MERIDIAN CORE', '41.2 N / 08.4 W'],
        [720, 70, 'EASTERN GRID', 'RESERVE 11.4%'],
        [120, 520, 'TIDAL CORRIDOR', 'MONITORING'],
        [700, 520, 'FOUNDRY BELT', 'AQI 168'],
      ].map(([x, y, label, value], index) => (
        <motion.g
          key={label}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 + index * 0.15 }}
        >
          <line x1={Number(x)} y1={Number(y) + 4} x2={Number(x) + 64} y2={Number(y) + 4} stroke="rgba(126,160,190,0.25)" strokeWidth="0.5" />
          <text x={Number(x)} y={Number(y)} fill="#d8e4f0" fillOpacity="0.5" fontSize="7" fontFamily="JetBrains Mono Variable" letterSpacing="1.5">
            {label}
          </text>
          <text x={Number(x)} y={Number(y) + 15} fill="#7e91a8" fontSize="6" fontFamily="JetBrains Mono Variable" letterSpacing="1">
            {value}
          </text>
        </motion.g>
      ))}
      <g opacity="0.5">
        <line x1="500" y1="0" x2="500" y2="600" stroke="#56e1ff" strokeOpacity="0.07" strokeWidth="0.5" />
        <line x1="0" y1="300" x2="1000" y2="300" stroke="#56e1ff" strokeOpacity="0.07" strokeWidth="0.5" />
      </g>
    </svg>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useSessionStore((state) => state.login)
  const loginAs = useSessionStore((state) => state.loginAs)
  const currentUserId = useSessionStore((state) => state.currentUserId)
  const roles = useSessionStore((state) => state.roles)
  const [email, setEmail] = useState('elena.voss@nexus.local')
  const [password, setPassword] = useState('nexus')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const from = (location.state as { from?: string } | null)?.from ?? '/overview'
  const currentUser = DEMO_USERS.find((user) => user.id === currentUserId)

  const enter = (target = from) => {
    navigate(target, { replace: true })
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    window.setTimeout(() => {
      const result = login(email, password)
      setLoading(false)
      if (!result.ok) {
        setError(result.message ?? 'Authentication failed.')
        return
      }
      enter()
    }, 480)
  }

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-[var(--bg-0)]">
      <div className="app-background" />
      <header className="relative z-10 flex h-[62px] flex-none items-center justify-between border-b border-[var(--line)] px-5 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center border border-[var(--cyan)]/30 bg-[var(--cyan-dim)]">
            <svg width="17" height="17" viewBox="0 0 32 32" aria-hidden="true" className="text-[var(--cyan)]">
              <path d="M4 27V5h4.4L23.5 21V5H28v22h-4.4L8.5 11v16z" fill="currentColor" />
            </svg>
          </span>
          <div>
            <div className="font-display text-[13px] font-medium tracking-[0.08em] text-[var(--text-bright)]">NEXUS // OMNIVERSE</div>
            <div className="font-mono text-[7px] uppercase tracking-[0.16em] text-[var(--muted-2)]">Civilization intelligence operating environment</div>
          </div>
        </div>
        <div className="hidden items-center gap-5 font-mono text-[8px] uppercase tracking-[0.12em] text-[var(--muted)] sm:flex">
          <span className="flex items-center gap-1.5 text-[var(--green)]"><Wifi size={10} /> Network nominal</span>
          <span>Aurelia theater</span>
          <span className="badge badge-amber">Demo mode</span>
        </div>
      </header>

      <div className="relative z-10 grid min-h-0 flex-1 lg:grid-cols-[1.35fr_0.8fr]">
        <section className="relative hidden min-h-[520px] flex-col justify-between overflow-hidden border-r border-[var(--line)] p-8 lg:flex xl:p-12">
          <div className="absolute inset-0 opacity-80">
            <AccessCity />
          </div>
          <div className="relative z-10 max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="kicker flex items-center gap-2">
              <span className="h-1 w-1 bg-[var(--cyan)] shadow-[0_0_8px_var(--cyan)]" />
              Operating environment · 2040 specification
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.7 }}
              className="mt-5 font-display text-[clamp(46px,6vw,92px)] font-medium leading-[0.86] tracking-[-0.065em] text-[var(--text-bright)]"
            >
              A LIVING
              <br />
              <span className="text-[var(--cyan)] text-glow-cyan">MODEL</span> OF
              <br />
              A CITY.
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.7 }}
              className="mt-6 max-w-md text-[12px] leading-relaxed text-[var(--muted)]"
            >
              One operating environment for geography, infrastructure, economy, environment, response and simulation. Every signal connected.
              Every decision traceable.
            </motion.p>
          </div>
          <div className="relative z-10 grid max-w-xl grid-cols-3 gap-px bg-[var(--line)]">
            {[
              ['5.95M', 'MODELED RESIDENTS'],
              ['8', 'LIVE DISTRICTS'],
              ['42/42', 'TELEMETRY STREAMS'],
            ].map(([value, label]) => (
              <div key={label} className="bg-[rgba(5,8,12,0.78)] px-4 py-3 backdrop-blur-sm">
                <div className="data-value text-[20px]">{value}</div>
                <div className="label-micro mt-1">{label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center px-4 py-8 sm:px-8">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18, duration: 0.5 }}
            className="w-full max-w-[420px]"
          >
            <div className="mb-6 flex items-center justify-between">
              <div>
                <div className="kicker">Identity access portal</div>
                <h2 className="mt-2 font-display text-3xl tracking-[-0.04em] text-[var(--text-bright)]">Authenticate</h2>
              </div>
              <div className="flex h-10 w-10 items-center justify-center border border-[var(--line-strong)] text-[var(--cyan)]">
                <Fingerprint size={20} strokeWidth={1.2} />
              </div>
            </div>

            {currentUser ? (
              <div className="mb-4 flex items-center justify-between gap-3 border border-[var(--green)]/20 bg-[var(--green-dim)] px-3 py-2.5">
                <div>
                  <div className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--green)]">Active demo session</div>
                  <div className="mt-0.5 text-[10px] text-[var(--text)]">{currentUser.name} · {getRole(currentUser.roleId, roles).name}</div>
                </div>
                <button type="button" className="btn btn-sm" onClick={() => enter()}>
                  Resume <ArrowRight size={10} />
                </button>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="panel p-5">
              <label className="label-micro mb-1.5 block" htmlFor="login-email">Identity email</label>
              <input
                id="login-email"
                type="email"
                className="field"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="username"
                placeholder="analyst@nexus.local"
              />
              <label className="label-micro mb-1.5 mt-4 block" htmlFor="login-password">Access key</label>
              <div className="relative">
                <input
                  id="login-password"
                  type="password"
                  className="field pr-9"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••"
                />
                <LockKeyhole size={13} className="absolute right-3 top-2.5 text-[var(--muted-2)]" />
              </div>
              {error ? <div className="mt-3 border border-[var(--red)]/20 bg-[var(--red-dim)] px-2.5 py-2 text-[10px] text-[var(--red)]">{error}</div> : null}
              <button type="submit" className="btn btn-primary mt-4 w-full" disabled={loading}>
                {loading ? 'Establishing session…' : 'Enter operating environment'}
                {!loading ? <ArrowRight size={12} /> : null}
              </button>
              <div className="mt-3 flex items-center justify-between">
                <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted-2)]">Demo credentials prefilled</span>
                <span className="font-mono text-[8px] text-[var(--muted-2)]">nexus / nexus</span>
              </div>
            </form>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <span className="label-micro">Or enter as a demo identity</span>
                <span className="font-mono text-[8px] text-[var(--amber)]/70">LOCAL FIXTURES</span>
              </div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {DEMO_USERS.map((identity) => (
                  <button
                    key={identity.id}
                    type="button"
                    className={cn(
                      'group flex items-center gap-2.5 border border-[var(--line)] bg-white/[0.015] px-2.5 py-2 text-left transition-colors hover:border-[var(--cyan)]/30 hover:bg-[var(--cyan-dim)]',
                      identity.id === currentUserId && 'border-[var(--cyan)]/30 bg-[var(--cyan-dim)]',
                    )}
                    onClick={() => {
                      loginAs(identity.id)
                      enter()
                    }}
                  >
                    <span className="flex h-6 w-6 flex-none items-center justify-center border font-mono text-[8px]" style={{ borderColor: `${identity.color}44`, color: identity.color }}>
                      {identity.initials}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[10px] text-[var(--text)]">{identity.name}</span>
                      <span className="block font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{getRole(identity.roleId, roles).shortName}</span>
                    </span>
                    <ArrowRight size={10} className="text-[var(--muted-2)] opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex items-start gap-2 border border-[var(--line)] bg-white/[0.015] p-3">
              <ShieldCheck size={13} className="mt-0.5 flex-none text-[var(--amber)]" />
              <p className="text-[9px] leading-relaxed text-[var(--muted)]">
                This is a local demonstration environment. Authentication fixtures and permissions are not a production security boundary. The
                included Supabase migration enforces equivalent authorization server-side for configured deployments.
              </p>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3 font-mono text-[7.5px] uppercase tracking-[0.12em] text-[var(--muted-2)]">
              <span className="flex items-center gap-1"><Sparkles size={9} /> deterministic data</span>
              <span className="h-2 w-px bg-[var(--line)]" />
              <span>no external services required</span>
            </div>
          </motion.div>
        </section>
      </div>
    </div>
  )
}
