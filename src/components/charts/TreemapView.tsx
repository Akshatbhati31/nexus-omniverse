import { useMemo, useState } from 'react'
import { cn } from '../../lib/utils'

interface TreemapItem {
  name: string
  value: number
  change?: number
  color: string
}

interface Rect extends TreemapItem {
  x: number
  y: number
  w: number
  h: number
}

const WIDTH = 800
const HEIGHT = 340

function layout(items: TreemapItem[], x: number, y: number, w: number, h: number, vertical: boolean): Rect[] {
  if (items.length === 1) return [{ ...items[0], x, y, w, h }]
  const total = items.reduce((sum, item) => sum + item.value, 0)
  let running = 0
  let split = 1
  for (let index = 0; index < items.length - 1; index += 1) {
    running += items[index].value
    split = index + 1
    if (running >= total / 2) break
  }
  const first = items.slice(0, split)
  const second = items.slice(split)
  const firstTotal = first.reduce((sum, item) => sum + item.value, 0)
  const ratio = firstTotal / Math.max(1, total)
  if (!second.length) return layout(first, x, y, w, h, vertical)
  if (vertical) {
    return [
      ...layout(first, x, y, w * ratio, h, !vertical),
      ...layout(second, x + w * ratio, y, w * (1 - ratio), h, !vertical),
    ]
  }
  return [
    ...layout(first, x, y, w, h * ratio, !vertical),
    ...layout(second, x, y + h * ratio, w, h * (1 - ratio), !vertical),
  ]
}

export function TreemapView({ items, className }: { items: TreemapItem[]; className?: string }) {
  const [active, setActive] = useState<string | null>(null)
  const rects = useMemo(() => layout([...items].sort((a, b) => b.value - a.value), 0, 0, WIDTH, HEIGHT, true), [items])

  return (
    <div className={cn('w-full', className)}>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full" role="img" aria-label="Market sector treemap">
        {rects.map((rect) => (
          <g
            key={rect.name}
            onMouseEnter={() => setActive(rect.name)}
            onMouseLeave={() => setActive(null)}
            className="cursor-crosshair"
          >
            <rect
              x={rect.x + 1.5}
              y={rect.y + 1.5}
              width={Math.max(0, rect.w - 3)}
              height={Math.max(0, rect.h - 3)}
              fill={rect.color}
              opacity={active === null ? 0.14 : active === rect.name ? 0.28 : 0.055}
              stroke={rect.color}
              strokeOpacity={active === rect.name ? 0.85 : 0.25}
              className="transition-all duration-200"
            />
            {rect.w > 80 && rect.h > 40 ? (
              <>
                <text x={rect.x + 10} y={rect.y + 20} fill={rect.color} fontSize="10" fontFamily="Space Grotesk Variable, sans-serif">
                  {rect.name}
                </text>
                <text x={rect.x + 10} y={rect.y + 36} fill="#d8e4f0" fontSize="16" fontFamily="JetBrains Mono Variable, monospace">
                  {rect.value}
                </text>
                {typeof rect.change === 'number' ? (
                  <text x={rect.x + 10} y={rect.y + 51} fill={rect.change >= 0 ? '#5ce1a4' : '#ff5d73'} fontSize="8" fontFamily="JetBrains Mono Variable, monospace">
                    {rect.change >= 0 ? '+' : ''}
                    {rect.change}%
                  </text>
                ) : null}
              </>
            ) : null}
          </g>
        ))}
      </svg>
      <div className="mt-2 flex items-center justify-between px-1">
        <span className="label-micro">Sector weight · simulated exchange</span>
        <span className="font-mono text-[8px] text-[var(--muted-2)]">Values indexed</span>
      </div>
    </div>
  )
}
