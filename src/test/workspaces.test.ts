import { describe, expect, it } from 'vitest'
import { ENTITIES } from '../data/entities'
import {
  DOMAINS,
  WORKSPACES,
  getDomain,
  getWorkspaceById,
  getWorkspaceEntities,
  getWorkspaceHref,
  getWorkspacesForDomain,
} from '../data/workspaces'

describe('three-level workspace model', () => {
  it('registers every domain with at least two specialized workspaces', () => {
    for (const domain of DOMAINS) {
      expect(getWorkspacesForDomain(domain.id).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('uses unique workspace identifiers and valid domain references', () => {
    const ids = new Set(WORKSPACES.map((workspace) => workspace.id))
    expect(ids.size).toBe(WORKSPACES.length)
    for (const workspace of WORKSPACES) {
      expect(getDomain(workspace.domain)).toBeDefined()
    }
  })

  it('resolves a non-empty entity scope for every workspace', () => {
    for (const workspace of WORKSPACES) {
      expect(getWorkspaceEntities(workspace, ENTITIES).length, workspace.id).toBeGreaterThan(0)
    }
  })

  it('keeps explicit entity inclusions inside the resolved scope', () => {
    for (const workspace of WORKSPACES) {
      const scopedIds = new Set(getWorkspaceEntities(workspace, ENTITIES).map((entity) => entity.id))
      for (const entityId of workspace.entityIds ?? []) {
        expect(scopedIds.has(entityId), `${workspace.id} should include ${entityId}`).toBe(true)
      }
    }
  })

  it('resolves related workspaces and preserves domain route prefixes', () => {
    for (const workspace of WORKSPACES) {
      for (const relatedId of workspace.relatedWorkspaceIds) {
        expect(getWorkspaceById(relatedId), `${workspace.id} → ${relatedId}`).toBeDefined()
      }
      const domain = getDomain(workspace.domain)
      expect(getWorkspaceHref(workspace).startsWith(`${domain?.path}/workspace/`)).toBe(true)
    }
  })
})
