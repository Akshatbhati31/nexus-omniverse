import {
  BrainCircuit,
  ChartNoAxesCombined,
  FileText,
  FlaskConical,
  Globe2,
  History,
  LayoutDashboard,
  LayoutGrid,
  Leaf,
  Network,
  Route,
  ShieldCheck,
  Siren,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { Permission } from '../types'

export interface NavItem {
  label: string
  shortLabel: string
  path: string
  description: string
  permission: Permission
  icon: LucideIcon
}

export interface NavGroup {
  id: string
  label: string
  code: string
  icon: LucideIcon
  items: NavItem[]
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'command',
    label: 'Command',
    code: 'CMD',
    icon: LayoutDashboard,
    items: [
      {
        label: 'Global Overview',
        shortLabel: 'Overview',
        path: '/overview',
        description: 'Synthesis of the operating environment',
        permission: 'view:overview',
        icon: LayoutDashboard,
      },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence Network',
    code: 'INT',
    icon: Globe2,
    items: [
      {
        label: 'Geographic Intelligence',
        shortLabel: 'GeoInt',
        path: '/geoint',
        description: 'Aurelia digital twin and geographic layers',
        permission: 'view:geoint',
        icon: Globe2,
      },
      {
        label: 'Infrastructure',
        shortLabel: 'Infra',
        path: '/infrastructure',
        description: 'Network health and dependency analysis',
        permission: 'view:infrastructure',
        icon: Network,
      },
      {
        label: 'Environmental',
        shortLabel: 'Environ',
        path: '/environment',
        description: 'Climate, air, water and hazard telemetry',
        permission: 'view:environment',
        icon: Leaf,
      },
      {
        label: 'Economic',
        shortLabel: 'Economy',
        path: '/economy',
        description: 'Markets, trade and supply chain intelligence',
        permission: 'view:economy',
        icon: ChartNoAxesCombined,
      },
      {
        label: 'Mobility',
        shortLabel: 'Mobility',
        path: '/mobility',
        description: 'Transit flows, corridors and travel time',
        permission: 'view:mobility',
        icon: Route,
      },
      {
        label: 'Energy Systems',
        shortLabel: 'Energy',
        path: '/energy',
        description: 'Generation, demand and grid resilience',
        permission: 'view:energy',
        icon: Zap,
      },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    code: 'OPS',
    icon: Siren,
    items: [
      {
        label: 'Incident Command',
        shortLabel: 'Incidents',
        path: '/incidents',
        description: 'Detection through resolution',
        permission: 'view:incidents',
        icon: Siren,
      },
      {
        label: 'Simulation Laboratory',
        shortLabel: 'Simulation',
        path: '/simulation',
        description: 'Hypothetical system stress testing',
        permission: 'view:simulation',
        icon: FlaskConical,
      },
      {
        label: 'Relationship Network',
        shortLabel: 'Network',
        path: '/network',
        description: 'Cross-domain entity graph',
        permission: 'view:network',
        icon: Network,
      },
    ],
  },
  {
    id: 'analysis',
    label: 'Analysis & Knowledge',
    code: 'ANL',
    icon: ChartNoAxesCombined,
    items: [
      {
        label: 'Analytics Studio',
        shortLabel: 'Analytics',
        path: '/analytics',
        description: 'Composable dashboards and saved layouts',
        permission: 'view:analytics',
        icon: LayoutGrid,
      },
      {
        label: 'AI Intelligence',
        shortLabel: 'Nexus AI',
        path: '/ai',
        description: 'Contextual investigation assistant',
        permission: 'view:ai',
        icon: BrainCircuit,
      },
      {
        label: 'Temporal Archive',
        shortLabel: 'Archive',
        path: '/archive',
        description: 'Historical snapshots and comparisons',
        permission: 'view:archive',
        icon: History,
      },
      {
        label: 'Reports',
        shortLabel: 'Reports',
        path: '/reports',
        description: 'Intelligence products and briefings',
        permission: 'view:reports',
        icon: FileText,
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    code: 'SYS',
    icon: ShieldCheck,
    items: [
      {
        label: 'Administration',
        shortLabel: 'Admin',
        path: '/admin',
        description: 'Identity, roles, audit and configuration',
        permission: 'view:admin',
        icon: ShieldCheck,
      },
    ],
  },
]

export const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, groupId: group.id, groupLabel: group.label })),
)

export function findGroupForPath(pathname: string) {
  return NAV_GROUPS.find((group) => group.items.some((item) => pathname.startsWith(item.path)))
}

export function findNavItem(pathname: string) {
  return ALL_NAV_ITEMS.find((item) => pathname.startsWith(item.path))
}
