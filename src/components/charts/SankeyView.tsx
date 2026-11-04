import { useMemo, useState } from 'react'
import { cn } from '../../lib/utils'

interface SankeyLink {
  source: string
  target: string
  value: number
}

interface SankeyViewProps {
  links: SankeyLink[]
  height?: number
  accent?: string
  className?: string
}

interface PositionedNode {
  name: string
  level: number
  x: number
  y: number
  height: number
  value: number
  color: string
}

const WIDTH = 840
const PADDING = 24

export function SankeyView({ links, height = 320, accent = '#56e1ff', className }: SankeyViewProps) {
  const [active, setActive] = useState<string | null>(null)

  const { nodes, renderedLinks } = useMemo(() => {
    const nodeNames = Array.from(new Set(links.flatMap((link) => [link.source, link.target])))
    const levels = new Map<string, number>()
    nodeNames.forEach((name) => levels.set(name, 0))
    for (let pass = 0; pass < nodeNames.length; pass += 1) {
      links.forEach((link) => {
        const sourceLevel = levels.get(link.source) ?? 0
        const targetLevel = levels.get(link.target) ?? 0
        if (targetLevel <= sourceLevel) levels.set(link.target, sourceLevel + 1)
      })
    }
    const grouped = new Map<number, string[]>()
    nodeNames.forEach((name) => {
      const level = levels.get(name) ?? 0
      grouped.set(level, [...(grouped.get(level) ?? []), name])
    })
    const maxLevel = Math.max(...Array.from(levels.values()), 0)
    const columnWidth = (WIDTH - PADDING * 2) / (maxLevel + 1)
    const nodeMap = new Map<string, PositionedNode>()
    const colors = ['#56e1ff', '#8f7cff', '#f3b85a', '#5ce1a4', '#5b8def']

    grouped.forEach((names, level) => {
      const total = names.reduce(
        (sum, name) =>
          sum +
          Math.max(
            links.filter((link) => link.source === name).reduce((value, link) => value + link.value, 0),
            links.filter((link) => link.target === name).reduce((value, link) => value + link.value, 0),
          ),
        0,
      )
      const available = height - PADDING * 2
      const gap = 10
      const heightUnit = (available - gap * (names.length - 1)) / Math.max(1, total)
      let cursor = PADDING
      names.forEach((name, index) => {
        const value = Math.max(
          links.filter((link) => link.source === name).reduce((sum, link) => sum + link.value, 0),
          links.filter((link) => link.target === name).reduce((sum, link) => sum + link.value, 0),
        )
        const nodeHeight = Math.max(16, value * heightUnit)
        const node: PositionedNode = {
          name,
          level,
          x: PADDING + level * columnWidth,
          y: cursor,
          height: nodeHeight,
          value,
          color: colors[index % colors.length],
        }
        nodeMap.set(name, node)
        cursor += nodeHeight + gap
      })
    })

    const rendered = links.map((link) => {
      const source = nodeMap.get(link.source)!
      const target = nodeMap.get(link.target)!
      const sourceOffset = links
        .filter((candidate) => candidate.source === link.source && candidate.target < link.target)
        .reduce((sum, candidate) => sum + candidate.value, 0)
      const targetOffset = links
        .filter((candidate) => candidate.target === link.target && candidate.source < link.source)
        .reduce((sum, candidate) => sum + candidate.value, 0)
      const sourceHeight = (source.height * link.value) / Math.max(1, source.value)
      const targetHeight = (target.height * link.value) / Math.max(1, target.value)
      const sy = source.y + (sourceOffset / Math.max(1, source.value)) * source.height + sourceHeight / 2
      const ty = target.y + (targetOffset / Math.max(1, target.value)) * target.height + targetHeight / 2
      const sx = source.x + 86
      const tx = target.x
      const mid = (sx + tx) / 2
      return {
        ...link,
        path: `M ${sx} ${sy} C ${mid} ${sy}, ${mid} ${ty}, ${tx} ${ty}`,
        width: Math.max(1, (source.height * link.value) / Math.max(1, source.value)),
        sourceColor: source.color,
      }
    })

    return { nodes: Array.from(nodeMap.values()), renderedLinks: rendered }
  }, [links, height])

  const isActive = (link: SankeyLink) => active === null || active === link.source || active === link.target

  return (
    <div className={cn('w-full overflow-hidden', className)}>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="h-auto w-full" role="img" aria-label="Supply chain flow diagram">
        <defs>
          <linearGradient id="sankey-flow" x1="0" x2="1">
            <stop offset="0%" stopColor={accent} stopOpacity="0.12" />
            <stop offset="100%" stopColor="#8f7cff" stopOpacity="0.22" />
          </linearGradient>
        </defs>
        {renderedLinks.map((link) => (
          <path
            key={`${link.source}-${link.target}`}
            d={link.path}
            fill="none"
            stroke={isActive(link) ? link.sourceColor : 'rgba(120,145,170,0.12)'}
            strokeOpacity={active && isActive(link) ? 0.65 : 0.24}
            strokeWidth={link.width}
            onMouseEnter={() => setActive(link.source)}
            onMouseLeave={() => setActive(null)}
            className="cursor-crosshair transition-[stroke-opacity] duration-200"
          />
        ))}
        {nodes.map((node) => (
          <g
            key={node.name}
            onMouseEnter={() => setActive(node.name)}
            onMouseLeave={() => setActive(null)}
            className="cursor-crosshair"
          >
            <rect x={node.x} y={node.y} width={86} height={node.height} fill={node.color} opacity={active && !isActive({ source: node.name, target: node.name, value: 0 }) ? 0.25 : 0.7} />
            <text
              x={node.x + 4}
              y={node.y + node.height / 2 + 3}
              fontSize="8"
              fontFamily="JetBrains Mono Variable, monospace"
              fill={node.height > 24 ? '#051016' : node.color}
              className="pointer-events-none"
            >
              {node.name.length > 18 ? `${node.name.slice(0, 17)}…` : node.name}
            </text>
            <text
              x={node.x + 4}
              y={node.y - 4}
              fontSize="7"
              fontFamily="JetBrains Mono Variable, monospace"
              fill="#7e91a8"
              className="pointer-events-none"
            >
              {node.value}
            </text>
          </g>
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-between px-1">
        <span className="label-micro">Flow volume · simulated logistics graph</span>
        <span className="font-mono text-[8px] text-[var(--muted-2)]">Hover a node to trace dependencies</span>
      </div>
    </div>
  )
}
