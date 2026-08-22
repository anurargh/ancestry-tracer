import { db } from './index.ts';
import { tree, treeMember, person, users } from './schema.ts';
import { eq, and, or, desc, inArray, isNull, sql } from 'drizzle-orm';
import { getUserByUid } from './users.ts';

export type TreeRole = 'owner' | 'editor' | 'viewer';

export interface TreeRecord {
  treeId: string;
  name: string;
  description: string | null;
  ownerUid: string;
  isDiscoverable: boolean | null;
  createdAt: string | null;
  userRole?: TreeRole;
  memberCount?: number;
  personCount?: number;
}

export interface TreeMemberDetail {
  treeId: string;
  userUid: string;
  userEmail: string | null;
  role: TreeRole;
  displayName?: string | null;
  photoURL?: string | null;
  createdAt: string | null;
}

/**
 * Ensure user has a default tree and assign any unassigned person records created by this user
 */
export async function ensureUserHasDefaultTree(userUid: string, userEmail?: string): Promise<TreeRecord> {
  // Check if user already owns or is a member of any tree
  const userMemberships = await db
    .select({
      treeId: treeMember.treeId,
      role: treeMember.role,
      tree: tree,
    })
    .from(treeMember)
    .innerJoin(tree, eq(treeMember.treeId, tree.treeId))
    .where(eq(treeMember.userUid, userUid))
    .limit(1);

  if (userMemberships.length > 0) {
    const existing = userMemberships[0];
    return {
      treeId: existing.tree.treeId,
      name: existing.tree.name,
      description: existing.tree.description,
      ownerUid: existing.tree.ownerUid,
      isDiscoverable: existing.tree.isDiscoverable,
      createdAt: existing.tree.createdAt ? existing.tree.createdAt.toISOString() : null,
      userRole: existing.role as TreeRole,
    };
  }

  // Create default tree for the user
  const emailPrefix = userEmail ? userEmail.split('@')[0] : 'Family';
  const capitalizedPrefix = emailPrefix.charAt(0).toUpperCase() + emailPrefix.slice(1);
  const defaultTreeName = `${capitalizedPrefix}'s Family Tree`;

  const [newTree] = await db
    .insert(tree)
    .values({
      name: defaultTreeName,
      description: 'Primary genealogical tree with family records and research lines.',
      ownerUid: userUid,
      isDiscoverable: false,
    })
    .returning();

  // Add owner to tree_member table
  await db.insert(treeMember).values({
    treeId: newTree.treeId,
    userUid: userUid,
    userEmail: userEmail || null,
    role: 'owner',
  });

  // Assign any existing person records created by this user that don't have a tree_id
  await db
    .update(person)
    .set({ treeId: newTree.treeId })
    .where(and(eq(person.createdBy, userUid), isNull(person.treeId)));

  return {
    treeId: newTree.treeId,
    name: newTree.name,
    description: newTree.description,
    ownerUid: newTree.ownerUid,
    isDiscoverable: newTree.isDiscoverable,
    createdAt: newTree.createdAt ? newTree.createdAt.toISOString() : null,
    userRole: 'owner',
  };
}

/**
 * Get all trees accessible to the user with their role and statistics
 */
export async function getTreesForUser(userUid: string, userEmail?: string): Promise<TreeRecord[]> {
  await ensureUserHasDefaultTree(userUid, userEmail);

  const memberships = await db
    .select({
      treeId: tree.treeId,
      name: tree.name,
      description: tree.description,
      ownerUid: tree.ownerUid,
      isDiscoverable: tree.isDiscoverable,
      createdAt: tree.createdAt,
      role: treeMember.role,
    })
    .from(treeMember)
    .innerJoin(tree, eq(treeMember.treeId, tree.treeId))
    .where(eq(treeMember.userUid, userUid))
    .orderBy(desc(tree.createdAt));

  const memberTreeIds = new Set(memberships.map((m) => m.treeId));

  // Also query discoverable / public archival trees
  const discoverableTrees = await db
    .select({
      treeId: tree.treeId,
      name: tree.name,
      description: tree.description,
      ownerUid: tree.ownerUid,
      isDiscoverable: tree.isDiscoverable,
      createdAt: tree.createdAt,
    })
    .from(tree)
    .where(eq(tree.isDiscoverable, true))
    .orderBy(desc(tree.createdAt));

  const combinedTrees: Array<{
    treeId: string;
    name: string;
    description: string | null;
    ownerUid: string;
    isDiscoverable: boolean | null;
    createdAt: Date | string | null;
    role?: TreeRole;
    userRole?: TreeRole;
  }> = memberships.map((m) => ({
    ...m,
    role: m.role as TreeRole,
    userRole: m.role as TreeRole,
  }));

  for (const dt of discoverableTrees) {
    if (!memberTreeIds.has(dt.treeId)) {
      combinedTrees.push({
        treeId: dt.treeId,
        name: dt.name,
        description: dt.description,
        ownerUid: dt.ownerUid,
        isDiscoverable: dt.isDiscoverable,
        createdAt: dt.createdAt,
        userRole: 'viewer' as TreeRole,
      });
    }
  }

  // Count persons per tree
  const treeIds = combinedTrees.map((t) => t.treeId);
  const personCounts = new Map<string, number>();

  if (treeIds.length > 0) {
    const pRows = await db
      .select({
        treeId: person.treeId,
        count: sql<number>`count(*)`,
      })
      .from(person)
      .where(and(inArray(person.treeId, treeIds), isNull(person.mergedInto)))
      .groupBy(person.treeId);

    pRows.forEach((r) => {
      if (r.treeId) personCounts.set(r.treeId, Number(r.count));
    });
  }

  return combinedTrees.map((m) => ({
    treeId: m.treeId,
    name: m.name,
    description: m.description,
    ownerUid: m.ownerUid,
    isDiscoverable: m.isDiscoverable,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : (typeof m.createdAt === 'string' ? m.createdAt : null),
    userRole: ((m.userRole || m.role || 'viewer') as TreeRole),
    personCount: personCounts.get(m.treeId) || 0,
  }));
}

/**
 * Get tree details with members
 */
export async function getTreeDetails(treeId: string, userUid: string) {
  const treeRows = await db.select().from(tree).where(eq(tree.treeId, treeId)).limit(1);
  if (!treeRows[0]) return null;

  const currentTree = treeRows[0];

  // Fetch members
  const memberRows = await db
    .select({
      treeId: treeMember.treeId,
      userUid: treeMember.userUid,
      userEmail: treeMember.userEmail,
      role: treeMember.role,
      createdAt: treeMember.createdAt,
      displayName: users.displayName,
      photoURL: users.photoURL,
    })
    .from(treeMember)
    .leftJoin(users, eq(treeMember.userUid, users.uid))
    .where(eq(treeMember.treeId, treeId));

  const userMembership = memberRows.find((m) => m.userUid === userUid);
  const userRole = (userMembership?.role as TreeRole) || (currentTree.ownerUid === userUid ? 'owner' : (currentTree.isDiscoverable ? 'viewer' : null));

  return {
    tree: {
      treeId: currentTree.treeId,
      name: currentTree.name,
      description: currentTree.description,
      ownerUid: currentTree.ownerUid,
      isDiscoverable: currentTree.isDiscoverable,
      createdAt: currentTree.createdAt ? currentTree.createdAt.toISOString() : null,
      userRole,
    },
    members: memberRows.map((m) => ({
      treeId: m.treeId,
      userUid: m.userUid,
      userEmail: m.userEmail,
      role: m.role as TreeRole,
      displayName: m.displayName || null,
      photoURL: m.photoURL || null,
      createdAt: m.createdAt ? m.createdAt.toISOString() : null,
    })),
  };
}

/**
 * Create a new tree
 */
export async function createTree(name: string, description: string, ownerUid: string, isDiscoverable = false) {
  const [newTree] = await db
    .insert(tree)
    .values({
      name: name.trim(),
      description: description ? description.trim() : null,
      ownerUid,
      isDiscoverable,
    })
    .returning();

  // Add owner to tree_member
  await db.insert(treeMember).values({
    treeId: newTree.treeId,
    userUid: ownerUid,
    role: 'owner',
  });

  return newTree;
}

/**
 * Update tree metadata and discoverability
 */
export async function updateTree(
  treeId: string,
  userUid: string,
  data: { name?: string; description?: string; isDiscoverable?: boolean }
) {
  const role = await getUserRoleInTree(treeId, userUid);
  if (role !== 'owner' && role !== 'editor') {
    throw new Error('Unauthorized: Only tree owners or editors can update tree settings');
  }

  // Only owners can change discoverability flag
  const updatePayload: any = {};
  if (data.name !== undefined) updatePayload.name = data.name.trim();
  if (data.description !== undefined) updatePayload.description = data.description?.trim() || null;
  if (data.isDiscoverable !== undefined) {
    if (role !== 'owner') {
      throw new Error('Unauthorized: Only tree owner can change tree discoverability');
    }
    updatePayload.isDiscoverable = data.isDiscoverable;
  }

  const [updated] = await db.update(tree).set(updatePayload).where(eq(tree.treeId, treeId)).returning();
  return updated;
}

/**
 * Add or update member role in tree
 */
export async function setTreeMemberRole(
  treeId: string,
  requestingUid: string,
  targetUserUid: string,
  targetEmail: string,
  role: TreeRole
) {
  const requestingRole = await getUserRoleInTree(treeId, requestingUid);
  if (requestingRole !== 'owner') {
    throw new Error('Unauthorized: Only tree owner can manage member roles');
  }

  const existing = await db
    .select()
    .from(treeMember)
    .where(and(eq(treeMember.treeId, treeId), eq(treeMember.userUid, targetUserUid)))
    .limit(1);

  if (existing[0]) {
    const [updated] = await db
      .update(treeMember)
      .set({ role, userEmail: targetEmail || existing[0].userEmail })
      .where(and(eq(treeMember.treeId, treeId), eq(treeMember.userUid, targetUserUid)))
      .returning();
    return updated;
  } else {
    const [inserted] = await db
      .insert(treeMember)
      .values({
        treeId,
        userUid: targetUserUid,
        userEmail: targetEmail || null,
        role,
      })
      .returning();
    return inserted;
  }
}

/**
 * Remove a member from tree
 */
export async function removeTreeMember(treeId: string, requestingUid: string, targetUserUid: string) {
  const requestingRole = await getUserRoleInTree(treeId, requestingUid);
  if (requestingRole !== 'owner' && requestingUid !== targetUserUid) {
    throw new Error('Unauthorized: Only tree owner can remove members');
  }

  const treeRows = await db.select().from(tree).where(eq(tree.treeId, treeId)).limit(1);
  if (treeRows[0] && treeRows[0].ownerUid === targetUserUid) {
    throw new Error('Cannot remove the primary tree owner');
  }

  await db
    .delete(treeMember)
    .where(and(eq(treeMember.treeId, treeId), eq(treeMember.userUid, targetUserUid)));

  return { success: true };
}

/**
 * Check user role in a tree
 */
export async function getUserRoleInTree(treeId: string, userUid: string): Promise<TreeRole | null> {
  const members = await db
    .select({ role: treeMember.role })
    .from(treeMember)
    .where(and(eq(treeMember.treeId, treeId), eq(treeMember.userUid, userUid)))
    .limit(1);

  if (members[0]) {
    return members[0].role as TreeRole;
  }

  const treeRows = await db.select({ ownerUid: tree.ownerUid }).from(tree).where(eq(tree.treeId, treeId)).limit(1);
  if (treeRows[0] && treeRows[0].ownerUid === userUid) {
    return 'owner';
  }

  return null;
}

/**
 * Determine effective role of a user for a specific person record
 */
export async function getUserRoleForPerson(
  personId: string,
  userUid: string
): Promise<{
  role: TreeRole | null;
  treeId: string | null;
  isOwner: boolean;
  canEdit: boolean;
  canView: boolean;
}> {
  const pRows = await db
    .select({
      personId: person.personId,
      treeId: person.treeId,
      createdBy: person.createdBy,
      isLiving: person.isLiving,
      privacyLevel: person.privacyLevel,
    })
    .from(person)
    .where(eq(person.personId, personId))
    .limit(1);

  if (!pRows[0]) {
    return { role: null, treeId: null, isOwner: false, canEdit: false, canView: false };
  }

  const p = pRows[0];

  // If person belongs to a tree, check tree role
  if (p.treeId) {
    const treeRole = await getUserRoleInTree(p.treeId, userUid);
    if (treeRole) {
      return {
        role: treeRole,
        treeId: p.treeId,
        isOwner: treeRole === 'owner',
        canEdit: treeRole === 'owner' || treeRole === 'editor',
        canView: true,
      };
    }

    // Check if tree is discoverable
    const treeRows = await db
      .select({ isDiscoverable: tree.isDiscoverable })
      .from(tree)
      .where(eq(tree.treeId, p.treeId))
      .limit(1);

    if (treeRows[0]?.isDiscoverable) {
      const canViewRecord = !p.isLiving || p.privacyLevel === 'public';
      return {
        role: 'viewer',
        treeId: p.treeId,
        isOwner: false,
        canEdit: false,
        canView: canViewRecord,
      };
    }
  }

  // Fallback: If person was created by this user
  if (p.createdBy === userUid) {
    return {
      role: 'owner',
      treeId: p.treeId,
      isOwner: true,
      canEdit: true,
      canView: true,
    };
  }

  // Check viewing permissions for public / deceased vs living family_only
  const isDeceasedPublic = !p.isLiving && p.privacyLevel === 'public';
  return {
    role: null,
    treeId: p.treeId,
    isOwner: false,
    canEdit: false,
    canView: isDeceasedPublic,
  };
}

/**
 * Update user global discoverability consent
 */
export async function updateUserDiscoverability(userUid: string, optedIn: boolean) {
  const [updated] = await db
    .update(users)
    .set({ optedInDiscoverable: optedIn })
    .where(eq(users.uid, userUid))
    .returning();
  return updated;
}
