import { useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import {
  ArrowUpRight,
  Bot,
  BrainCircuit,
  ChevronRight,
  CircleAlert,
  Database,
  FileText,
  MessageSquare,
  Plus,
  Search,
  Send,
  ShieldCheck,
  Siren,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '../components/ui/PageHeader'
import { Panel, PanelHeader } from '../components/ui/Panel'
import { EmptyState } from '../components/ui/EmptyState'
import { SeverityBadge } from '../components/ui/StatusBadge'
import { AI_ENGINE_DESCRIPTION, AI_ENGINE_LABEL, AI_ENDPOINT, requestIntelligence } from '../lib/ai'
import { formatRelative } from '../lib/format'
import { uid } from '../lib/utils'
import { usePlatformStore } from '../store/usePlatformStore'
import { usePermission } from '../store/useSessionStore'
import { useUIStore } from '../store/useUIStore'
import type { ChatMessage, MessageSource } from '../types'

const SUGGESTED_PROMPTS = [
  'Summarize the current eastern grid situation and identify the highest-risk dependencies.',
  'What is the operational status of the Tidal Bridge and Cross-City Line?',
  'Give me a cross-domain risk brief for the next 12 hours.',
  'Compare the latest saved simulation against the grid reserve posture.',
  'Which entities are connected to INC-2841?',
]

export default function AIPage() {
  const navigate = useNavigate()
  const reduceMotion = useReducedMotion()
  const conversations = usePlatformStore((state) => state.conversations)
  const entities = usePlatformStore((state) => state.entities)
  const incidents = usePlatformStore((state) => state.incidents)
  const simulations = usePlatformStore((state) => state.simulations)
  const reports = usePlatformStore((state) => state.reports)
  const createConversation = usePlatformStore((state) => state.createConversation)
  const appendMessage = usePlatformStore((state) => state.appendMessage)
  const deleteConversation = usePlatformStore((state) => state.deleteConversation)
  const pushToast = useUIStore((state) => state.pushToast)
  const canUse = usePermission('ai:use')

  const [activeId, setActiveId] = useState<string | null>(conversations[0]?.id ?? null)
  const [query, setQuery] = useState('')
  const [threadQuery, setThreadQuery] = useState('')
  const [thinking, setThinking] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const activeConversation = conversations.find((conversation) => conversation.id === activeId)
  const filteredConversations = useMemo(() => {
    const normalized = threadQuery.trim().toLowerCase()
    if (!normalized) return conversations
    return conversations.filter((conversation) => `${conversation.title} ${conversation.messages.map((message) => message.content).join(' ')}`.toLowerCase().includes(normalized))
  }, [conversations, threadQuery])
  const activeIncidents = incidents.filter((incident) => !['resolved', 'archived'].includes(incident.status))
  const critical = activeIncidents.filter((incident) => incident.severity === 'critical')

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    element.scrollTo({ top: element.scrollHeight, behavior: reduceMotion ? 'auto' : 'smooth' })
  }, [activeConversation?.messages.length, reduceMotion, thinking])

  const startThread = () => {
    if (!canUse) {
      pushToast({ title: 'Insufficient permission', message: 'Your role cannot create intelligence threads.', tone: 'danger' })
      return
    }
    const result = createConversation()
    if (!result.ok || !result.id) {
      pushToast({ title: 'Thread not created', message: result.message, tone: 'danger' })
      return
    }
    setActiveId(result.id)
    setQuery('')
  }

  const removeThread = (id: string) => {
    const result = deleteConversation(id)
    if (!result.ok) {
      pushToast({ title: 'Thread not removed', message: result.message, tone: 'danger' })
      return
    }
    if (activeId === id) {
      const remaining = conversations.filter((conversation) => conversation.id !== id)
      setActiveId(remaining[0]?.id ?? null)
    }
    pushToast({ title: 'Thread removed', message: result.message, tone: 'success' })
  }

  const send = async (preset?: string) => {
    const content = (preset ?? query).trim()
    if (!content || thinking) return
    if (!canUse) {
      pushToast({ title: 'Insufficient permission', message: 'Your role cannot query the intelligence assistant.', tone: 'danger' })
      return
    }

    let conversationId = activeId
    if (!conversationId) {
      const created = createConversation()
      if (!created.ok || !created.id) {
        pushToast({ title: 'Thread not created', message: created.message, tone: 'danger' })
        return
      }
      conversationId = created.id
      setActiveId(created.id)
    }

    const userMessage: ChatMessage = {
      id: uid('msg'),
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
    appendMessage(conversationId, userMessage)
    setQuery('')
    setThinking(true)

    const history = [...(conversations.find((conversation) => conversation.id === conversationId)?.messages ?? []), userMessage]
    try {
      const response = await requestIntelligence(content, { entities, incidents, simulations, reports }, history)
      appendMessage(conversationId, {
        id: uid('msg'),
        role: 'assistant',
        content: response.content,
        createdAt: new Date().toISOString(),
        sources: response.sources,
        engine: response.engine,
      })
    } catch {
      appendMessage(conversationId, {
        id: uid('msg'),
        role: 'assistant',
        content: 'The intelligence request could not be completed. No record was lost; retry the question or inspect the cited platform records directly.',
        createdAt: new Date().toISOString(),
        engine: 'deterministic',
      })
      pushToast({ title: 'Assistant error', message: 'The local engine could not complete this request.', tone: 'danger' })
    } finally {
      setThinking(false)
    }
  }

  const openSource = (source: MessageSource) => {
    if (source.href) navigate(source.href)
    else if (source.entityId) navigate(`/entity/${source.entityId}`)
  }

  return (
    <div className="p-4 lg:p-6">
      <PageHeader
        kicker="Analysis & knowledge // AI intelligence"
        title="Ask the operating model."
        subtitle="A grounded investigation assistant over platform entities, incidents, simulations and reports. The local engine is deterministic and cites the records it uses."
        meta={
          <>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <BrainCircuit size={10} className="text-[var(--violet)]" /> {AI_ENGINE_LABEL}
            </span>
            <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--muted)]">
              <Database size={10} className="text-[var(--cyan)]" /> {entities.length + incidents.length + reports.length + simulations.length} grounded records
            </span>
            <span className={AI_ENDPOINT ? 'badge badge-cyan' : 'badge badge-amber'}>{AI_ENDPOINT ? 'External endpoint configured' : 'No model endpoint'}</span>
          </>
        }
        actions={
          <button type="button" className="btn btn-primary" onClick={startThread} disabled={!canUse}>
            <Plus size={12} /> New thread
          </button>
        }
      />

      <div className="mb-3 flex flex-wrap items-start gap-2 border border-[var(--line)] bg-white/[0.015] px-3 py-2.5">
        <ShieldCheck size={13} className="mt-0.5 flex-none text-[var(--cyan)]" />
        <p className="text-[9.5px] leading-relaxed text-[var(--muted)]">
          <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-[var(--cyan)]">Grounding boundary · </span>
          {AI_ENGINE_DESCRIPTION} Responses are analytical assistance only and may be incomplete. No conversation content leaves the browser unless an external endpoint is configured.
        </p>
      </div>

      <div className="grid gap-3 xl:grid-cols-[255px_minmax(0,1fr)_280px]">
        <Panel className="order-2 xl:order-1">
          <PanelHeader title="Threads" eyebrow="Investigation history" icon={<MessageSquare size={13} />} action={<span className="font-mono text-[8px] text-[var(--muted-2)]">{conversations.length}</span>} />
          <div className="border-b border-[var(--line)] p-2.5">
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-2.5 text-[var(--muted-2)]" />
              <input className="field h-8 min-h-0 pl-8 text-[10px]" placeholder="Search threads…" value={threadQuery} onChange={(event) => setThreadQuery(event.target.value)} />
            </div>
          </div>
          <div className="max-h-[460px] overflow-y-auto">
            {filteredConversations.map((conversation) => (
              <div key={conversation.id} className={`group flex items-start gap-2 border-b border-[var(--line)] px-3 py-3 transition-colors ${activeId === conversation.id ? 'bg-white/[0.035]' : 'hover:bg-white/[0.02]'}`}>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setActiveId(conversation.id)}>
                  <span className="block truncate text-[10px] text-[var(--text)]">{conversation.title}</span>
                  <span className="mt-1 flex items-center gap-1.5 font-mono text-[7px] uppercase tracking-[0.06em] text-[var(--muted-2)]">
                    {conversation.messages.length} messages · {formatRelative(conversation.updatedAt)}
                  </span>
                </button>
                <button type="button" className="icon-btn h-6 w-6 flex-none opacity-0 group-hover:opacity-100" onClick={() => removeThread(conversation.id)} disabled={!canUse} aria-label={`Delete ${conversation.title}`}>
                  <Trash2 size={10} />
                </button>
              </div>
            ))}
            {filteredConversations.length === 0 ? <div className="px-4 py-8 text-center text-[9.5px] text-[var(--muted-2)]">No threads match the search.</div> : null}
          </div>
          <div className="border-t border-[var(--line)] p-3">
            <button type="button" className="btn w-full" onClick={startThread} disabled={!canUse}>
              <Plus size={11} /> Start new thread
            </button>
          </div>
        </Panel>

        <Panel className="order-1 flex min-h-[620px] flex-col overflow-hidden xl:order-2">
          <PanelHeader
            title={activeConversation?.title ?? 'New intelligence thread'}
            eyebrow={activeConversation ? `${activeConversation.messages.length} messages · local grounding` : 'No active thread'}
            icon={<Bot size={13} />}
            action={<span className="badge badge-violet">{AI_ENGINE_LABEL.toLowerCase()}</span>}
          />

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
            {!activeConversation || activeConversation.messages.length === 0 ? (
              <div className="flex min-h-[380px] flex-col items-center justify-center text-center">
                <div className="flex h-12 w-12 items-center justify-center border border-[var(--line)] bg-[var(--violet-dim)] text-[var(--violet)]">
                  <BrainCircuit size={22} />
                </div>
                <h2 className="mt-4 font-display text-xl tracking-[-0.03em] text-[var(--text-bright)]">Interrogate the operating picture.</h2>
                <p className="mt-2 max-w-md text-[10.5px] leading-relaxed text-[var(--muted)]">
                  Ask about an entity, incident reference, grid posture, corridor constraint, environmental advisory or saved scenario. The assistant cites the records it used.
                </p>
                <div className="mt-5 grid w-full max-w-xl gap-2 text-left">
                  {SUGGESTED_PROMPTS.slice(0, 3).map((prompt) => (
                    <button key={prompt} type="button" className="flex items-start gap-2 border border-[var(--line)] px-3 py-2.5 text-left text-[9.5px] leading-relaxed text-[var(--muted)] transition-colors hover:border-[var(--line-strong)] hover:bg-white/[0.025] hover:text-[var(--text)]" onClick={() => setQuery(prompt)} disabled={!canUse}>
                      <Sparkles size={11} className="mt-0.5 flex-none text-[var(--violet)]" />
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {activeConversation.messages.map((message) => (
                  <div key={message.id} className={`flex gap-2.5 ${message.role === 'user' ? 'justify-end' : ''}`}>
                    {message.role === 'assistant' ? (
                      <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center border border-[var(--violet)]/30 bg-[var(--violet-dim)] text-[var(--violet)]"><Bot size={13} /></span>
                    ) : null}
                    <div className={`max-w-[86%] ${message.role === 'user' ? 'border border-[var(--cyan)]/25 bg-[var(--cyan-dim)]' : 'border border-[var(--line)] bg-white/[0.02]'} px-3 py-2.5`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-[7.5px] uppercase tracking-[0.1em] text-[var(--muted-2)]">{message.role === 'user' ? 'Analyst' : 'Nexus assistant'}</span>
                        <span className="font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{formatRelative(message.createdAt)}</span>
                      </div>
                      <p className="mt-1.5 whitespace-pre-line text-[10.5px] leading-[1.7] text-[var(--text)]">{message.content}</p>
                      {message.role === 'assistant' && message.sources?.length ? (
                        <div className="mt-2.5 border-t border-[var(--line)] pt-2">
                          <div className="label-micro">Cited records</div>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {message.sources.map((source) => (
                              <button key={`${message.id}-${source.label}`} type="button" className="badge badge-cyan hover:border-[var(--cyan)]" onClick={() => openSource(source)}>
                                {source.label}
                                <ArrowUpRight size={8} />
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {message.engine ? <div className="mt-2 font-mono text-[7px] uppercase tracking-[0.08em] text-[var(--muted-2)]">engine · {message.engine}</div> : null}
                    </div>
                    {message.role === 'user' ? (
                      <span className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center border border-[var(--cyan)]/30 bg-[var(--cyan-dim)] text-[var(--cyan)]"><UserRound size={13} /></span>
                    ) : null}
                  </div>
                ))}
                {thinking ? (
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 flex-none items-center justify-center border border-[var(--violet)]/30 bg-[var(--violet-dim)] text-[var(--violet)]"><Bot size={13} /></span>
                    <div className="border border-[var(--line)] bg-white/[0.02] px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="h-1 w-1 animate-pulse bg-[var(--violet)]" />
                        <span className="h-1 w-1 animate-pulse bg-[var(--violet)] [animation-delay:120ms]" />
                        <span className="h-1 w-1 animate-pulse bg-[var(--violet)] [animation-delay:240ms]" />
                        <span className="ml-1 font-mono text-[8px] uppercase tracking-[0.08em] text-[var(--muted-2)]">Grounding response</span>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="border-t border-[var(--line)] p-3">
            {!canUse ? (
              <div className="mb-2 flex items-center gap-2 border border-[var(--amber)]/20 bg-[var(--amber-dim)] px-2.5 py-2 text-[8.5px] text-[var(--muted)]">
                <CircleAlert size={11} className="flex-none text-[var(--amber)]" /> Your role can read threads but cannot query the assistant.
              </div>
            ) : null}
            <div className="flex items-end gap-2">
              <textarea
                className="field min-h-[58px] flex-1 resize-none text-[11px]"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void send()
                  }
                }}
                placeholder="Ask about an entity, incident, corridor or scenario… (Enter to send)"
                disabled={!canUse || thinking}
              />
              <button type="button" className="btn btn-primary h-[58px] w-[58px] px-0" onClick={() => void send()} disabled={!canUse || thinking || !query.trim()} aria-label="Send query">
                <Send size={15} />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">Shift + Enter for a new line · local deterministic fallback</span>
              <span className="font-mono text-[7.5px] uppercase tracking-[0.08em] text-[var(--muted-2)]">{activeConversation ? `${activeConversation.messages.length} messages` : 'no active thread'}</span>
            </div>
          </div>
        </Panel>

        <div className="order-3 space-y-3">
          <Panel>
            <PanelHeader title="Grounding context" eyebrow="Records available to the engine" icon={<Database size={13} />} />
            <div className="grid grid-cols-2 gap-px bg-[var(--line)]">
              {[
                { label: 'Entities', value: entities.length, href: '/network' },
                { label: 'Incidents', value: incidents.length, href: '/incidents' },
                { label: 'Scenarios', value: simulations.length, href: '/simulation' },
                { label: 'Reports', value: reports.length, href: '/reports' },
              ].map((item) => (
                <button key={item.label} type="button" className="bg-[rgba(8,13,19,0.9)] px-3 py-3 text-left transition-colors hover:bg-white/[0.025]" onClick={() => navigate(item.href)}>
                  <div className="label-micro">{item.label}</div>
                  <div className="data-value mt-1 text-[19px]">{item.value}</div>
                </button>
              ))}
            </div>
            <div className="border-t border-[var(--line)] p-4">
              <div className="label-micro">Active critical signals</div>
              <div className="mt-2 space-y-2">
                {critical.slice(0, 3).map((incident) => (
                  <button key={incident.id} type="button" className="flex w-full items-start gap-2 text-left" onClick={() => navigate(`/incidents/${incident.id}`)}>
                    <SeverityBadge severity={incident.severity} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[9px] text-[var(--text)]">{incident.title}</span>
                      <span className="mt-0.5 block font-mono text-[7px] uppercase tracking-[0.06em] text-[var(--muted-2)]">{incident.reference}</span>
                    </span>
                  </button>
                ))}
                {critical.length === 0 ? <div className="text-[9px] text-[var(--muted-2)]">No critical signals active.</div> : null}
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Suggested questions" eyebrow="Prompt library" icon={<Sparkles size={13} />} />
            <div className="p-2">
              {SUGGESTED_PROMPTS.map((prompt) => (
                <button key={prompt} type="button" className="flex w-full items-start gap-2 border-b border-[var(--line)] px-2 py-2.5 text-left text-[9px] leading-relaxed text-[var(--muted)] transition-colors last:border-0 hover:bg-white/[0.02] hover:text-[var(--text)]" onClick={() => setQuery(prompt)} disabled={!canUse}>
                  <ChevronRight size={10} className="mt-0.5 flex-none text-[var(--violet)]" />
                  {prompt}
                </button>
              ))}
            </div>
          </Panel>

          <Panel className="relative overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(143,124,255,0.12),transparent_65%)]" />
            <div className="relative p-4">
              <div className="flex items-center gap-2">
                <Siren size={12} className="text-[var(--violet)]" />
                <span className="label-micro">Engine boundary</span>
              </div>
              <p className="mt-2 text-[9px] leading-relaxed text-[var(--muted)]">
                {AI_ENDPOINT
                  ? 'The external endpoint is configured. If it is unavailable, the deterministic fallback engages and labels the response accordingly.'
                  : 'No external AI integration is configured. The assistant retrieves and summarizes deterministic records from the local demo store only.'}
              </p>
              <button type="button" className="btn mt-3 w-full" onClick={() => navigate('/reports')}>
                <FileText size={11} /> Open source reports
              </button>
            </div>
          </Panel>
        </div>
      </div>

      {!activeConversation && conversations.length > 0 ? (
        <Panel className="mt-3">
          <EmptyState icon={MessageSquare} title="Select a thread" description="Choose an investigation thread from the list, or start a new one." action={<button type="button" className="btn btn-primary" onClick={startThread} disabled={!canUse}><Plus size={11} /> New thread</button>} />
        </Panel>
      ) : null}
    </div>
  )
}
