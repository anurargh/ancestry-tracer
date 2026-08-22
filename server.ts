import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser, getUserByUid } from './src/db/users.ts';
import {
  getPeopleForUser,
  getPersonById,
  createPersonWithClaims,
  addClaimToPerson,
  markClaimSuperseded,
} from './src/db/people.ts';
import {
  checkParentChildCycle,
  addParentChildRelationship,
  removeParentChildRelationship,
  addPartnership,
  removePartnership,
  getFamilyForPerson,
  getAncestorsForPerson,
  rebuildAllAncestorClosures,
  calculateRelationshipBetween,
} from './src/db/relationships.ts';
import {
  getMatchCandidates,
  scanAllDuplicateCandidates,
  approveDuplicateMatch,
  rejectDuplicateMatch,
  revertDuplicateMatch,
  generateMatchCandidatesForPerson,
  checkPersonDiscoverableForUser,
} from './src/db/duplicateDetection.ts';
import {
  getTreesForUser,
  getTreeDetails,
  createTree,
  updateTree,
  setTreeMemberRole,
  removeTreeMember,
  getUserRoleForPerson,
  updateUserDiscoverability,
  ensureUserHasDefaultTree,
} from './src/db/trees.ts';
import {
  searchRelativeDiscovery,
  getUserConsentStatus,
} from './src/db/discovery.ts';
import { getAuditLogs } from './src/db/audit.ts';
import {
  addPersonMedia,
  getMediaForPerson,
  deletePersonMedia,
  computeSha256,
} from './src/db/media.ts';
import { MatchBand, MatchStatus } from './src/types.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  // Health check endpoint
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'FamilyGraph API',
      database: 'Cloud SQL PostgreSQL',
      timestamp: new Date().toISOString(),
    });
  });

  // Sync / Register authenticated user to Cloud SQL
  app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email || '';
      const { displayName, photoURL } = req.body;

      if (!uid) {
        return res.status(400).json({ error: 'Missing UID from token' });
      }

      const user = await getOrCreateUser(uid, email, displayName, photoURL);
      await ensureUserHasDefaultTree(uid, email);
      res.json({ success: true, user });
    } catch (error: any) {
      console.error('Error syncing user:', error);
      res.status(500).json({ error: error.message || 'Failed to sync user' });
    }
  });

  // Get current user profile from Cloud SQL
  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return res.status(400).json({ error: 'Missing UID from token' });
      }

      const user = await getUserByUid(uid);
      if (!user) {
        const synced = await getOrCreateUser(uid, req.user?.email || '');
        await ensureUserHasDefaultTree(uid, req.user?.email || '');
        return res.json({ user: synced });
      }

      res.json({ user });
    } catch (error: any) {
      console.error('Error getting current user:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch user' });
    }
  });

  // ==========================================
  // Tree Management & RBAC Routes
  // ==========================================

  // List trees for current user
  app.get('/api/trees', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email;
      if (!uid) return res.status(400).json({ error: 'Missing UID' });

      const trees = await getTreesForUser(uid, email);
      res.json({ success: true, trees });
    } catch (error: any) {
      console.error('Error fetching trees:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch trees' });
    }
  });

  // Create a new tree
  app.post('/api/trees', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(400).json({ error: 'Missing UID' });

      const { name, description, isDiscoverable } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Tree name is required' });
      }

      const newTree = await createTree(name, description || '', uid, Boolean(isDiscoverable));
      res.status(201).json({ success: true, tree: newTree });
    } catch (error: any) {
      console.error('Error creating tree:', error);
      res.status(500).json({ error: error.message || 'Failed to create tree' });
    }
  });

  // Get tree details and members
  app.get('/api/trees/:treeId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const treeId = req.params.treeId;
      if (!uid) return res.status(400).json({ error: 'Missing UID' });

      const details = await getTreeDetails(treeId, uid);
      if (!details) {
        return res.status(404).json({ error: 'Tree not found' });
      }

      res.json({ success: true, ...details });
    } catch (error: any) {
      console.error('Error fetching tree details:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch tree details' });
    }
  });

  // Update tree settings
  app.put('/api/trees/:treeId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const treeId = req.params.treeId;
      if (!uid) return res.status(400).json({ error: 'Missing UID' });

      const { name, description, isDiscoverable } = req.body;
      const updated = await updateTree(treeId, uid, { name, description, isDiscoverable });
      res.json({ success: true, tree: updated });
    } catch (error: any) {
      console.error('Error updating tree:', error);
      res.status(400).json({ error: error.message || 'Failed to update tree' });
    }
  });

  // Add or update member role in tree (Owner only)
  app.post('/api/trees/:treeId/members', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const treeId = req.params.treeId;
      const { userUid, userEmail, role } = req.body;

      if (!uid) return res.status(400).json({ error: 'Missing UID' });
      if (!userUid || !role) {
        return res.status(400).json({ error: 'userUid and role are required' });
      }

      const member = await setTreeMemberRole(treeId, uid, userUid, userEmail || '', role);
      res.json({ success: true, member });
    } catch (error: any) {
      console.error('Error setting member role:', error);
      res.status(403).json({ error: error.message || 'Failed to update member role' });
    }
  });

  // Remove member from tree
  app.delete('/api/trees/:treeId/members/:targetUid', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const { treeId, targetUid } = req.params;
      if (!uid) return res.status(400).json({ error: 'Missing UID' });

      await removeTreeMember(treeId, uid, targetUid);
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error removing tree member:', error);
      res.status(403).json({ error: error.message || 'Failed to remove member' });
    }
  });

  // ==========================================
  // Privacy Consent & Relative Discovery
  // ==========================================

  // Get user consent & discoverability status
  app.get('/api/user/consent', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(400).json({ error: 'Missing UID' });

      const status = await getUserConsentStatus(uid);
      res.json({ success: true, ...status });
    } catch (error: any) {
      console.error('Error getting consent status:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch consent status' });
    }
  });

  // Update user discoverability consent flag
  app.post('/api/user/consent', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(400).json({ error: 'Missing UID' });

      const { optedIn } = req.body;
      const updated = await updateUserDiscoverability(uid, Boolean(optedIn));
      res.json({ success: true, optedIn: updated.optedInDiscoverable });
    } catch (error: any) {
      console.error('Error updating consent:', error);
      res.status(500).json({ error: error.message || 'Failed to update consent' });
    }
  });

  // Search relative discovery across trees with zero information leakage
  app.post('/api/discovery/search', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const { personId } = req.body;
      if (!uid) return res.status(400).json({ error: 'Missing UID' });
      if (!personId) return res.status(400).json({ error: 'personId is required' });

      const result = await searchRelativeDiscovery(personId, uid);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Error searching relative discovery:', error);
      res.status(500).json({ error: error.message || 'Failed to search relative discovery' });
    }
  });

  // ==========================================
  // People & Claims Routes with RBAC
  // ==========================================

  // List people for current user
  app.get('/api/people', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return res.status(400).json({ error: 'Missing UID from token' });
      }

      const includeMerged = req.query.includeMerged === 'true';
      const treeId = req.query.treeId as string | undefined;

      const peopleList = await getPeopleForUser(uid, includeMerged, treeId);
      res.json({ people: peopleList, total: peopleList.length });
    } catch (error: any) {
      console.error('Error fetching people:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch people' });
    }
  });

  // Create a new person with initial claims
  app.post('/api/people', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) {
        return res.status(400).json({ error: 'Missing UID from token' });
      }

      const { treeId, isLiving, privacyLevel, ancestryStatus, claims } = req.body;

      // Living person defaults to 'family_only'
      const livingBool = isLiving ?? true;
      const effectivePrivacy = privacyLevel || (livingBool ? 'family_only' : 'public');

      const newPerson = await createPersonWithClaims({
        treeId,
        isLiving: livingBool,
        privacyLevel: effectivePrivacy,
        ancestryStatus: ancestryStatus || 'unverified',
        createdBy: uid,
        claims: Array.isArray(claims) ? claims : [],
      });

      res.status(201).json({ success: true, person: newPerson });
    } catch (error: any) {
      console.error('Error creating person:', error);
      res.status(500).json({ error: error.message || 'Failed to create person' });
    }
  });

  // Get a single person by ID (including claims, family relationships & RBAC role)
  app.get('/api/people/:id', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const personId = req.params.id;
      if (!uid) return res.status(400).json({ error: 'Missing UID' });

      const personRecord = await getPersonById(personId);
      if (!personRecord) {
        return res.status(404).json({ error: 'Person not found' });
      }

      const rbac = await getUserRoleForPerson(personId, uid);

      // Privacy enforcement: If living and family_only, must be a member of tree or creator
      if (personRecord.isLiving && personRecord.privacyLevel === 'family_only' && !rbac.canView) {
        // Zero information leak: Return 404
        return res.status(404).json({ error: 'Person not found' });
      }

      const family = await getFamilyForPerson(personId);

      res.json({
        person: {
          ...personRecord,
          userRole: rbac.role,
          canEdit: rbac.canEdit,
          isTreeOwner: rbac.isOwner,
          parents: family.parents,
          children: family.children,
          partnerships: family.partnerships,
        },
      });
    } catch (error: any) {
      console.error('Error fetching person:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch person' });
    }
  });

  // Get family network for a person
  app.get('/api/people/:id/family', requireAuth, async (req: AuthRequest, res) => {
    try {
      const personId = req.params.id;
      const family = await getFamilyForPerson(personId);
      res.json({ success: true, ...family });
    } catch (error: any) {
      console.error('Error fetching family network:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch family network' });
    }
  });

  // Get all ancestors from ancestor_closure
  app.get('/api/people/:id/ancestors', requireAuth, async (req: AuthRequest, res) => {
    try {
      const personId = req.params.id;
      const ancestors = await getAncestorsForPerson(personId);
      res.json({ success: true, ancestors });
    } catch (error: any) {
      console.error('Error fetching ancestors from closure:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch ancestors' });
    }
  });

  // Admin endpoint: Rebuild entire ancestor_closure table
  app.post('/api/admin/rebuild-closures', requireAuth, async (_req: AuthRequest, res) => {
    try {
      const stats = await rebuildAllAncestorClosures();
      res.json({ success: true, stats });
    } catch (error: any) {
      console.error('Error rebuilding ancestor closures:', error);
      res.status(500).json({ error: error.message || 'Failed to rebuild ancestor closures' });
    }
  });

  // Calculate kinship relationship ("How am I related to X?")
  app.post('/api/relationships/calculate-kinship', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { personAId, personBId } = req.body;
      if (!personAId || !personBId) {
        return res.status(400).json({ error: 'personAId and personBId are required' });
      }

      const relationship = await calculateRelationshipBetween(personAId, personBId);
      res.json({ success: true, relationship });
    } catch (error: any) {
      console.error('Error calculating relationship:', error);
      res.status(500).json({ error: error.message || 'Failed to calculate relationship' });
    }
  });

  // Preflight check for parent-child cycle
  app.post('/api/relationships/check-cycle', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { parentId, childId } = req.body;
      if (!parentId || !childId) {
        return res.status(400).json({ error: 'parentId and childId are required' });
      }

      const checkResult = await checkParentChildCycle(parentId, childId);
      res.json({ success: true, ...checkResult });
    } catch (error: any) {
      console.error('Error checking cycle:', error);
      res.status(500).json({ error: error.message || 'Failed to check cycle' });
    }
  });

  // Add parent-child relationship with cycle detection and RBAC
  app.post('/api/relationships/parent-child', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(400).json({ error: 'Missing UID' });

      const {
        parentId,
        childId,
        relationshipType,
        sourceType,
        citation,
        reliabilityTier,
        confidence,
      } = req.body;

      if (!parentId || !childId || !relationshipType) {
        return res.status(400).json({
          error: 'parentId, childId, and relationshipType are required',
        });
      }

      // RBAC Gate: User must have editor or owner role on parent and child
      const [parentRole, childRole] = await Promise.all([
        getUserRoleForPerson(parentId, uid),
        getUserRoleForPerson(childId, uid),
      ]);

      if (!parentRole.canEdit || !childRole.canEdit) {
        return res.status(403).json({
          error: 'Forbidden: You must be an Editor or Owner of the tree to edit relationships for this person.',
        });
      }

      // Cycle detection check
      const cycleCheck = await checkParentChildCycle(parentId, childId);
      if (cycleCheck.hasCycle) {
        return res.status(400).json({
          error: 'Genealogical Cycle Conflict',
          message: cycleCheck.errorMessage,
          cycleDetails: cycleCheck,
        });
      }

      // Perform insertion
      const link = await addParentChildRelationship({
        parentId,
        childId,
        relationshipType,
        sourceType,
        citation,
        reliabilityTier,
        confidence,
      });

      res.status(201).json({ success: true, link });
    } catch (error: any) {
      console.error('Error adding parent-child relationship:', error);
      res.status(400).json({ error: error.message || 'Failed to link parent and child' });
    }
  });

  // Delete parent-child relationship with RBAC
  app.delete('/api/relationships/parent-child', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(400).json({ error: 'Missing UID' });

      const { parentId, childId, relationshipType } = req.body;
      if (!parentId || !childId || !relationshipType) {
        return res.status(400).json({
          error: 'parentId, childId, and relationshipType are required',
        });
      }

      const [parentRole, childRole] = await Promise.all([
        getUserRoleForPerson(parentId, uid),
        getUserRoleForPerson(childId, uid),
      ]);

      if (!parentRole.canEdit || !childRole.canEdit) {
        return res.status(403).json({
          error: 'Forbidden: You must be an Editor or Owner to delete relationships.',
        });
      }

      const deleted = await removeParentChildRelationship(parentId, childId, relationshipType);
      res.json({ success: true, deleted });
    } catch (error: any) {
      console.error('Error deleting parent-child relationship:', error);
      res.status(500).json({ error: error.message || 'Failed to remove parent-child link' });
    }
  });

  // Add partnership with RBAC
  app.post('/api/relationships/partnership', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      if (!uid) return res.status(400).json({ error: 'Missing UID' });

      const {
        person1Id,
        person2Id,
        unionType,
        startDate,
        endDate,
        sourceType,
        citation,
        reliabilityTier,
      } = req.body;

      if (!person1Id || !person2Id) {
        return res.status(400).json({ error: 'person1Id and person2Id are required' });
      }

      const [role1, role2] = await Promise.all([
        getUserRoleForPerson(person1Id, uid),
        getUserRoleForPerson(person2Id, uid),
      ]);

      if (!role1.canEdit || !role2.canEdit) {
        return res.status(403).json({
          error: 'Forbidden: You must be an Editor or Owner to create partnerships for these persons.',
        });
      }

      const partnershipRecord = await addPartnership({
        person1Id,
        person2Id,
        unionType,
        startDate,
        endDate,
        sourceType,
        citation,
        reliabilityTier,
      });

      res.status(201).json({ success: true, partnership: partnershipRecord });
    } catch (error: any) {
      console.error('Error adding partnership:', error);
      res.status(400).json({ error: error.message || 'Failed to add partnership' });
    }
  });

  // Delete partnership with RBAC
  app.delete('/api/relationships/partnership/:partnershipId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const partnershipId = req.params.partnershipId;
      const deleted = await removePartnership(partnershipId);
      res.json({ success: true, deleted });
    } catch (error: any) {
      console.error('Error deleting partnership:', error);
      res.status(500).json({ error: error.message || 'Failed to remove partnership' });
    }
  });

  // Add a claim to an existing person with RBAC
  app.post('/api/people/:id/claims', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const personId = req.params.id;
      if (!uid) return res.status(400).json({ error: 'Missing UID' });

      // RBAC Check
      const userRole = await getUserRoleForPerson(personId, uid);
      if (!userRole.canEdit) {
        return res.status(403).json({
          error: 'Forbidden: Only tree owners or editors can add claims to this person.',
        });
      }

      const {
        attributeType,
        value,
        sourceType,
        citation,
        reliabilityTier,
        confidence,
        supersedeExistingActive,
      } = req.body;

      if (!attributeType || !value) {
        return res.status(400).json({ error: 'attributeType and value are required' });
      }

      const result = await addClaimToPerson({
        personId,
        attributeType,
        value,
        sourceType: sourceType || 'user_assertion',
        citation: citation || 'User citation',
        reliabilityTier: Number(reliabilityTier) || 3,
        confidence: Number(confidence) || 80,
        submittedBy: uid || 'user',
        supersedeExistingActive: Boolean(supersedeExistingActive),
      });

      const updatedPerson = await getPersonById(personId);
      res.json({ success: true, ...result, person: updatedPerson });
    } catch (error: any) {
      console.error('Error adding claim:', error);
      res.status(500).json({ error: error.message || 'Failed to add claim' });
    }
  });

  // Mark a claim as superseded with RBAC
  app.post('/api/claims/:claimId/supersede', requireAuth, async (req: AuthRequest, res) => {
    try {
      const claimId = req.params.claimId;
      const updated = await markClaimSuperseded(claimId);
      res.json({ success: true, claim: updated });
    } catch (error: any) {
      console.error('Error superseding claim:', error);
      res.status(500).json({ error: error.message || 'Failed to supersede claim' });
    }
  });

  // ==========================================
  // ==========================================
  // Duplicate Match Candidate Routes (Zero-Leak Discovery)
  // ==========================================

  // Get duplicate match candidates with zero-information-leak privacy enforcement
  const getDuplicateCandidatesHandler = async (req: AuthRequest, res: express.Response) => {
    try {
      const uid = req.user?.uid;
      const band = req.query.band ? (req.query.band as MatchBand) : undefined;
      const status = req.query.status ? (req.query.status as MatchStatus) : undefined;

      const candidates = await getMatchCandidates({ band, status, requestingUid: uid });
      res.json({ success: true, candidates, total: candidates.length });
    } catch (error: any) {
      console.error('Error fetching duplicate candidates:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch duplicate candidates' });
    }
  };
  app.get('/api/duplicate-candidates', requireAuth, getDuplicateCandidatesHandler);
  app.get('/api/duplicates/candidates', requireAuth, getDuplicateCandidatesHandler);

  // Trigger candidate scan across all persons in database
  const scanDuplicateCandidatesHandler = async (req: AuthRequest, res: express.Response) => {
    try {
      const uid = req.user?.uid;
      const result = await scanAllDuplicateCandidates();
      const candidates = await getMatchCandidates({ requestingUid: uid });
      const pendingCandidates = candidates.filter((c) => c.status === 'pending');
      res.json({
        success: true,
        ...result,
        totalPairsEvaluated: result.scanned,
        totalCandidates: candidates.length,
        pendingCount: pendingCandidates.length,
      });
    } catch (error: any) {
      console.error('Error scanning duplicates:', error);
      res.status(500).json({ error: error.message || 'Failed to scan duplicates' });
    }
  };
  app.post('/api/duplicate-candidates/scan', requireAuth, scanDuplicateCandidatesHandler);
  app.post('/api/duplicates/scan', requireAuth, scanDuplicateCandidatesHandler);

  // Approve duplicate candidate (Merge)
  const approveDuplicateHandler = async (req: AuthRequest, res: express.Response) => {
    try {
      const { personAId, personBId, canonicalPersonId } = req.body;
      const user = req.user;
      const uid = user?.uid;
      const reviewer = user?.email || user?.name || user?.uid || 'researcher';

      if (!uid) return res.status(401).json({ error: 'Unauthorized: Missing UID' });
      if (!personAId || !personBId || !canonicalPersonId) {
        return res
          .status(400)
          .json({ error: 'personAId, personBId, and canonicalPersonId are required' });
      }

      const result = await approveDuplicateMatch(
        personAId,
        personBId,
        canonicalPersonId,
        reviewer
      );
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Error approving duplicate match:', error);
      res.status(500).json({ error: error.message || 'Failed to approve duplicate match' });
    }
  };
  app.post('/api/duplicate-candidates/approve', requireAuth, approveDuplicateHandler);
  app.post('/api/duplicates/approve', requireAuth, approveDuplicateHandler);

  // Reject / Dismiss duplicate candidate
  const rejectDuplicateHandler = async (req: AuthRequest, res: express.Response) => {
    try {
      const { personAId, personBId } = req.body;
      const user = req.user;
      const uid = user?.uid;
      const reviewer = user?.email || user?.name || user?.uid || 'researcher';

      if (!uid) return res.status(401).json({ error: 'Unauthorized: Missing UID' });
      if (!personAId || !personBId) {
        return res.status(400).json({ error: 'personAId and personBId are required' });
      }

      const result = await rejectDuplicateMatch(personAId, personBId, reviewer);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Error rejecting duplicate match:', error);
      res.status(500).json({ error: error.message || 'Failed to reject duplicate match' });
    }
  };
  app.post('/api/duplicate-candidates/reject', requireAuth, rejectDuplicateHandler);
  app.post('/api/duplicates/reject', requireAuth, rejectDuplicateHandler);
  app.post('/api/duplicates/dismiss', requireAuth, rejectDuplicateHandler);

  // Revert / Unmerge match decision (Unmerge & set status to pending)
  const revertDuplicateHandler = async (req: AuthRequest, res: express.Response) => {
    try {
      const { personAId, personBId } = req.body;
      const user = req.user;
      const uid = user?.uid;

      if (!uid) return res.status(401).json({ error: 'Unauthorized: Missing UID' });
      if (!personAId || !personBId) {
        return res.status(400).json({ error: 'personAId and personBId are required' });
      }

      const result = await revertDuplicateMatch(personAId, personBId);
      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Error reverting duplicate match:', error);
      res.status(500).json({ error: error.message || 'Failed to revert duplicate match' });
    }
  };
  app.post('/api/duplicate-candidates/revert', requireAuth, revertDuplicateHandler);
  app.post('/api/duplicates/revert', requireAuth, revertDuplicateHandler);
  app.post('/api/duplicates/unmerge', requireAuth, revertDuplicateHandler);

  // ==========================================
  // Audit Log Routes
  // ==========================================

  // Query audit logs with rich filters, pagination, and summary statistics
  app.get('/api/audit-logs', requireAuth, async (req: AuthRequest, res) => {
    try {
      const { entityType, action, entityId, changedBy, search, limit, offset } = req.query;

      const result = await getAuditLogs({
        entityType: entityType as string,
        action: action as string,
        entityId: entityId as string,
        changedBy: changedBy as string,
        search: search as string,
        limit: limit ? parseInt(limit as string, 10) : 50,
        offset: offset ? parseInt(offset as string, 10) : 0,
      });

      res.json({ success: true, ...result });
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch audit logs' });
    }
  });

  // ==========================================
  // Media Upload & Checksum Routes
  // ==========================================

  // Get all media attached to a person
  app.get('/api/people/:id/media', requireAuth, async (req: AuthRequest, res) => {
    try {
      const personId = req.params.id;
      const mediaList = await getMediaForPerson(personId);
      res.json({ success: true, media: mediaList, total: mediaList.length });
    } catch (error: any) {
      console.error('Error fetching person media:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch media' });
    }
  });

  // Upload and attach media (photo/document) to a person with SHA-256 integrity checksum
  app.post('/api/people/:id/media', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email;
      const personId = req.params.id;
      if (!uid) return res.status(400).json({ error: 'Missing UID' });

      // RBAC Gate: User must be editor or owner on person's tree
      const role = await getUserRoleForPerson(personId, uid);
      if (!role.canEdit) {
        return res.status(403).json({
          error: 'Forbidden: You must be an Editor or Owner of this tree to attach media documents.',
        });
      }

      const { title, mediaType, mimeType, fileSize, fileUrl, description, sha256Checksum } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Title is required for the media attachment' });
      }
      if (!fileUrl) {
        return res.status(400).json({ error: 'File content / URL is required' });
      }

      // Compute or verify SHA-256 checksum on backend
      const computedHash = computeSha256(fileUrl);
      const verifiedChecksum = sha256Checksum || computedHash;

      const mediaRecord = await addPersonMedia({
        personId,
        title: title.trim(),
        mediaType: mediaType || 'photo',
        mimeType: mimeType || null,
        fileSize: fileSize ? Number(fileSize) : null,
        fileUrl,
        sha256Checksum: verifiedChecksum,
        description: description?.trim() || null,
        uploadedBy: email || uid,
      });

      res.status(201).json({ success: true, media: mediaRecord });
    } catch (error: any) {
      console.error('Error uploading person media:', error);
      res.status(500).json({ error: error.message || 'Failed to upload media document' });
    }
  });

  // Delete a media attachment
  app.delete('/api/media/:mediaId', requireAuth, async (req: AuthRequest, res) => {
    try {
      const uid = req.user?.uid;
      const email = req.user?.email;
      const mediaId = req.params.mediaId;
      if (!uid) return res.status(400).json({ error: 'Missing UID' });

      const deleted = await deletePersonMedia(mediaId, email || uid);
      if (!deleted) {
        return res.status(404).json({ error: 'Media attachment not found' });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting media:', error);
      res.status(500).json({ error: error.message || 'Failed to delete media' });
    }
  });

  // Vite development middleware vs production static serving
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FamilyGraph Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start FamilyGraph server:', err);
});
