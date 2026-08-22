import React from 'react';
import { MRCAConnection, PathPersonNode, PersonRecord } from '../types.ts';
import { formatOrdinal } from '../utils/formatting.ts';

interface RelationshipPathTreeProps {
  connection: MRCAConnection;
  personA: (PersonRecord & { displayName?: string; name?: string }) | PathPersonNode | { personId: string; displayName?: string; name?: string };
  personB: (PersonRecord & { displayName?: string; name?: string }) | PathPersonNode | { personId: string; displayName?: string; name?: string };
  onSelectPerson?: (personId: string) => void;
}

export const RelationshipPathTree: React.FC<RelationshipPathTreeProps> = ({
  connection,
  personA,
  personB,
  onSelectPerson,
}) => {
  const ancestor1 = connection.ancestor1;
  const ancestor2 = connection.ancestor2;
  const isCouple = Boolean(connection.isCouple && ancestor2);

  // Normalize paths from ancestor1 (or fallback)
  const rawPathA: PathPersonNode[] =
    ancestor1.pathA && ancestor1.pathA.length > 0
      ? ancestor1.pathA
      : [
          {
            personId: personA.personId,
            name: ('displayName' in personA ? personA.displayName : (personA as any).name) || 'Person A',
            generationDistance: 0,
          },
          {
            personId: ancestor1.personId,
            name: ancestor1.name || 'Shared Ancestor',
            generationDistance: connection.genDistanceA,
          },
        ];

  const rawPathB: PathPersonNode[] =
    ancestor1.pathB && ancestor1.pathB.length > 0
      ? ancestor1.pathB
      : [
          {
            personId: personB.personId,
            name: ('displayName' in personB ? personB.displayName : (personB as any).name) || 'Person B',
            generationDistance: 0,
          },
          {
            personId: ancestor1.personId,
            name: ancestor1.name || 'Shared Ancestor',
            generationDistance: connection.genDistanceB,
          },
        ];

  const genA = connection.genDistanceA ?? (rawPathA.length > 0 ? rawPathA.length - 1 : 0);
  const genB = connection.genDistanceB ?? (rawPathB.length > 0 ? rawPathB.length - 1 : 0);
  const maxGen = Math.max(genA, genB, 1);

  // Separate Branch A and Branch B intermediate nodes (excluding apex if already in path)
  const branchANodes =
    genA === 0
      ? []
      : rawPathA.slice(0, rawPathA.length - 1);

  const branchBNodes =
    genB === 0
      ? []
      : rawPathB.slice(0, rawPathB.length - 1);

  // Geometry configuration
  const nodeW = 196;
  const nodeH = 62;

  // Adapt vertical spacing based on max generation depth to keep it compact
  const levelSpacing = maxGen <= 2 ? 104 : maxGen <= 4 ? 92 : maxGen <= 6 ? 80 : 72;

  // Responsive SVG canvas width and height
  const svgWidth = isCouple ? 760 : 680;
  const apexY = 56;
  const svgHeight = apexY + maxGen * levelSpacing + nodeH / 2 + 42;

  const colAX = 140;
  const colBX = svgWidth - 140;
  const centerX = svgWidth / 2;

  const anc1X = isCouple ? centerX - (nodeW / 2 + 18) : centerX;
  const anc2X = isCouple ? centerX + (nodeW / 2 + 18) : centerX;
  const ancY = apexY;

  // Calculate coordinates for Branch A nodes
  const getBranchACoords = (idx: number) => {
    const y = apexY + (maxGen - idx) * levelSpacing;
    return { x: colAX, y };
  };

  // Calculate coordinates for Branch B nodes
  const getBranchBCoords = (idx: number) => {
    const y = apexY + (maxGen - idx) * levelSpacing;
    return { x: colBX, y };
  };

  // Label formatting
  const getGenerationLabel = (idx: number, side: 'A' | 'B') => {
    if (idx === 0) {
      return side === 'A' ? 'G0 • PERSON A (ORIGIN)' : 'G0 • PERSON B (TARGET)';
    }
    if (idx === 1) return 'G1 • PARENT';
    if (idx === 2) return 'G2 • GRANDPARENT';
    if (idx === 3) return 'G3 • G-GRANDPARENT';
    const greatCount = idx - 2;
    return `G${idx} • ${formatOrdinal(greatCount)} G-GRANDPARENT`;
  };

  const truncateName = (str: string, maxLen = 21) => {
    if (!str) return 'Unknown Record';
    return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
  };

  return (
    <div className="w-full bg-[#101317] border border-[#D4AF37]/25 rounded-sm p-3 sm:p-4 my-3 font-sans shadow-inner">
      {/* Visual Canvas Subheader */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-2 border-b border-[#D4AF37]/20 text-[10px] font-mono uppercase tracking-wider">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-[#FBBF24]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#D97706] border border-[#FDE68A]/60 shadow-[0_0_6px_rgba(217,119,6,0.8)]" />
            Person A Branch ({genA} gen)
          </span>
          <span className="flex items-center gap-1.5 text-[#34D399]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#059669] border border-[#A7F3D0]/60 shadow-[0_0_6px_rgba(5,150,105,0.8)]" />
            Person B Branch ({genB} gen)
          </span>
        </div>
        <span className="flex items-center gap-1.5 text-[#C4B5FD]">
          <span className="w-2.5 h-2.5 rounded-full bg-[#8B5CF6] border border-[#DDD6FE]/60 shadow-[0_0_6px_rgba(139,92,246,0.8)]" />
          {isCouple ? 'Shared MRCA Couple Apex' : 'Shared MRCA Common Ancestor'}
        </span>
      </div>

      {/* Scrollable Diagram Canvas */}
      <div className="w-full overflow-x-auto overflow-y-auto max-h-[520px] custom-scrollbar focus:outline-none focus:ring-1 focus:ring-[#D4AF37]/40 rounded-sm">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full min-w-[620px] sm:min-w-[660px] select-none block"
          style={{ height: 'auto', maxHeight: '500px' }}
        >
          <defs>
            {/* Gradients */}
            <linearGradient id="treeGradAmber" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#251A0D" />
              <stop offset="100%" stopColor="#140F08" />
            </linearGradient>
            <linearGradient id="treeGradEmerald" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0E2319" />
              <stop offset="100%" stopColor="#081610" />
            </linearGradient>
            <linearGradient id="treeGradPurple" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#24153B" />
              <stop offset="100%" stopColor="#130B21" />
            </linearGradient>
            <linearGradient id="marriageGold" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#B88728" />
              <stop offset="50%" stopColor="#F3E5AB" />
              <stop offset="100%" stopColor="#B88728" />
            </linearGradient>

            {/* Filter Shadows */}
            <filter id="nodeGlowAmber" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#D97706" floodOpacity="0.25" />
            </filter>
            <filter id="nodeGlowEmerald" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#059669" floodOpacity="0.25" />
            </filter>
            <filter id="nodeGlowPurple" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#8B5CF6" floodOpacity="0.35" />
            </filter>

            {/* Markers */}
            <marker
              id="dotAmber"
              viewBox="0 0 6 6"
              refX="3"
              refY="3"
              markerWidth="4"
              markerHeight="4"
            >
              <circle cx="3" cy="3" r="2.5" fill="#D97706" />
            </marker>
            <marker
              id="dotEmerald"
              viewBox="0 0 6 6"
              refX="3"
              refY="3"
              markerWidth="4"
              markerHeight="4"
            >
              <circle cx="3" cy="3" r="2.5" fill="#059669" />
            </marker>
          </defs>

          {/* ======================================================== */}
          {/* CONNECTOR LINES                                          */}
          {/* ======================================================== */}

          {/* Branch A Vertical Connectors */}
          {branchANodes.map((_, idx) => {
            if (idx === branchANodes.length - 1) return null;
            const from = getBranchACoords(idx);
            const to = getBranchACoords(idx + 1);
            return (
              <g key={`edgeA_${idx}`}>
                <line
                  x1={from.x}
                  y1={from.y - nodeH / 2}
                  x2={to.x}
                  y2={to.y + nodeH / 2}
                  stroke="#D97706"
                  strokeWidth="2.5"
                  strokeOpacity="0.75"
                  strokeDasharray="4 2"
                />
                <circle cx={from.x} cy={(from.y - nodeH / 2 + to.y + nodeH / 2) / 2} r="3" fill="#FBBF24" />
              </g>
            );
          })}

          {/* Branch A to Apex Connector */}
          {branchANodes.length > 0 && (
            <g key="edgeA_to_apex">
              {(() => {
                const topA = getBranchACoords(branchANodes.length - 1);
                const targetX = anc1X;
                const targetY = ancY + nodeH / 2;
                const startY = topA.y - nodeH / 2;
                const midY = (startY + targetY) / 2;
                const d = `M ${topA.x} ${startY} C ${topA.x} ${midY}, ${targetX} ${midY}, ${targetX} ${targetY}`;
                return (
                  <>
                    <path
                      d={d}
                      fill="none"
                      stroke="#D97706"
                      strokeWidth="2.5"
                      strokeOpacity="0.85"
                      strokeDasharray="5 3"
                    />
                    <circle cx={(topA.x + targetX) / 2} cy={midY} r="3.5" fill="#FDE68A" />
                  </>
                );
              })()}
            </g>
          )}

          {/* Branch B Vertical Connectors */}
          {branchBNodes.map((_, idx) => {
            if (idx === branchBNodes.length - 1) return null;
            const from = getBranchBCoords(idx);
            const to = getBranchBCoords(idx + 1);
            return (
              <g key={`edgeB_${idx}`}>
                <line
                  x1={from.x}
                  y1={from.y - nodeH / 2}
                  x2={to.x}
                  y2={to.y + nodeH / 2}
                  stroke="#059669"
                  strokeWidth="2.5"
                  strokeOpacity="0.75"
                  strokeDasharray="4 2"
                />
                <circle cx={from.x} cy={(from.y - nodeH / 2 + to.y + nodeH / 2) / 2} r="3" fill="#34D399" />
              </g>
            );
          })}

          {/* Branch B to Apex Connector */}
          {branchBNodes.length > 0 && (
            <g key="edgeB_to_apex">
              {(() => {
                const topB = getBranchBCoords(branchBNodes.length - 1);
                const targetX = isCouple ? anc2X : anc1X;
                const targetY = ancY + nodeH / 2;
                const startY = topB.y - nodeH / 2;
                const midY = (startY + targetY) / 2;
                const d = `M ${topB.x} ${startY} C ${topB.x} ${midY}, ${targetX} ${midY}, ${targetX} ${targetY}`;
                return (
                  <>
                    <path
                      d={d}
                      fill="none"
                      stroke="#059669"
                      strokeWidth="2.5"
                      strokeOpacity="0.85"
                      strokeDasharray="5 3"
                    />
                    <circle cx={(topB.x + targetX) / 2} cy={midY} r="3.5" fill="#A7F3D0" />
                  </>
                );
              })()}
            </g>
          )}

          {/* Married Apex Connector between Ancestor 1 & Ancestor 2 */}
          {isCouple && (
            <g key="apex_couple_link">
              <line
                x1={anc1X + nodeW / 2}
                y1={ancY}
                x2={anc2X - nodeW / 2}
                y2={ancY}
                stroke="url(#marriageGold)"
                strokeWidth="3"
              />
              <line
                x1={anc1X + nodeW / 2}
                y1={ancY - 4}
                x2={anc2X - nodeW / 2}
                y2={ancY - 4}
                stroke="#D4AF37"
                strokeWidth="1"
                strokeOpacity="0.6"
              />
              <line
                x1={anc1X + nodeW / 2}
                y1={ancY + 4}
                x2={anc2X - nodeW / 2}
                y2={ancY + 4}
                stroke="#D4AF37"
                strokeWidth="1"
                strokeOpacity="0.6"
              />

              {/* Marriage Ring / Badge Seal */}
              <rect
                x={centerX - 18}
                y={ancY - 10}
                width="36"
                height="20"
                rx="4"
                fill="#15191E"
                stroke="#D4AF37"
                strokeWidth="1.5"
              />
              <text
                x={centerX}
                y={ancY + 3.5}
                textAnchor="middle"
                fill="#F3E5AB"
                fontSize="10"
                fontFamily="sans-serif"
                fontWeight="bold"
              >
                ⚭
              </text>
            </g>
          )}

          {/* ======================================================== */}
          {/* BRANCH A NODES (AMBER)                                   */}
          {/* ======================================================== */}
          {branchANodes.map((node, idx) => {
            const { x, y } = getBranchACoords(idx);
            const label = getGenerationLabel(idx, 'A');
            const isBasePerson = idx === 0;

            return (
              <g
                key={`nodeA_${node.personId}_${idx}`}
                tabIndex={0}
                role="button"
                aria-label={`Inspect dossier for ${node.name} (${label})`}
                onClick={() => onSelectPerson?.(node.personId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectPerson?.(node.personId);
                  }
                }}
                className="cursor-pointer group focus:outline-none"
              >
                <title>{`${node.name} (${label}) — Click to view profile dossier`}</title>

                {/* Node Container Box */}
                <rect
                  x={x - nodeW / 2}
                  y={y - nodeH / 2}
                  width={nodeW}
                  height={nodeH}
                  rx="4"
                  fill="url(#treeGradAmber)"
                  stroke={isBasePerson ? '#F59E0B' : '#D97706'}
                  strokeWidth={isBasePerson ? '2' : '1.5'}
                  filter="url(#nodeGlowAmber)"
                  className="transition-all duration-200 group-hover:stroke-[#FBBF24] group-hover:brightness-110 group-focus-visible:stroke-[#FBBF24] group-focus-visible:stroke-2"
                />

                {/* Corner Accents */}
                <path
                  d={`M ${x - nodeW / 2} ${y - nodeH / 2 + 8} L ${x - nodeW / 2} ${y - nodeH / 2} L ${x - nodeW / 2 + 8} ${y - nodeH / 2}`}
                  stroke="#F59E0B"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path
                  d={`M ${x + nodeW / 2 - 8} ${y - nodeH / 2} L ${x + nodeW / 2} ${y - nodeH / 2} L ${x + nodeW / 2} ${y - nodeH / 2 + 8}`}
                  stroke="#F59E0B"
                  strokeWidth="1.5"
                  fill="none"
                />

                {/* Generation Badge Header */}
                <rect
                  x={x - nodeW / 2 + 8}
                  y={y - nodeH / 2 + 7}
                  width={nodeW - 16}
                  height="16"
                  rx="2"
                  fill="#2A1B0B"
                  stroke="#B45309"
                  strokeWidth="0.8"
                  strokeOpacity="0.7"
                />
                <text
                  x={x}
                  y={y - nodeH / 2 + 18.5}
                  textAnchor="middle"
                  fill="#FBBF24"
                  fontSize="9.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  letterSpacing="0.05em"
                >
                  {label}
                </text>

                {/* Person Name */}
                <text
                  x={x}
                  y={y + 14}
                  textAnchor="middle"
                  fill="#FDE68A"
                  fontSize="12.5"
                  fontFamily="'Cinzel', 'Playfair Display', serif, sans-serif"
                  fontWeight="bold"
                  className="group-hover:fill-[#FFFFFF] transition-colors"
                >
                  {truncateName(node.name, 20)}
                </text>
              </g>
            );
          })}

          {/* ======================================================== */}
          {/* BRANCH B NODES (EMERALD)                                 */}
          {/* ======================================================== */}
          {branchBNodes.map((node, idx) => {
            const { x, y } = getBranchBCoords(idx);
            const label = getGenerationLabel(idx, 'B');
            const isBasePerson = idx === 0;

            return (
              <g
                key={`nodeB_${node.personId}_${idx}`}
                tabIndex={0}
                role="button"
                aria-label={`Inspect dossier for ${node.name} (${label})`}
                onClick={() => onSelectPerson?.(node.personId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectPerson?.(node.personId);
                  }
                }}
                className="cursor-pointer group focus:outline-none"
              >
                <title>{`${node.name} (${label}) — Click to view profile dossier`}</title>

                {/* Node Container Box */}
                <rect
                  x={x - nodeW / 2}
                  y={y - nodeH / 2}
                  width={nodeW}
                  height={nodeH}
                  rx="4"
                  fill="url(#treeGradEmerald)"
                  stroke={isBasePerson ? '#10B981' : '#059669'}
                  strokeWidth={isBasePerson ? '2' : '1.5'}
                  filter="url(#nodeGlowEmerald)"
                  className="transition-all duration-200 group-hover:stroke-[#34D399] group-hover:brightness-110 group-focus-visible:stroke-[#34D399] group-focus-visible:stroke-2"
                />

                {/* Corner Accents */}
                <path
                  d={`M ${x - nodeW / 2} ${y - nodeH / 2 + 8} L ${x - nodeW / 2} ${y - nodeH / 2} L ${x - nodeW / 2 + 8} ${y - nodeH / 2}`}
                  stroke="#10B981"
                  strokeWidth="1.5"
                  fill="none"
                />
                <path
                  d={`M ${x + nodeW / 2 - 8} ${y - nodeH / 2} L ${x + nodeW / 2} ${y - nodeH / 2} L ${x + nodeW / 2} ${y - nodeH / 2 + 8}`}
                  stroke="#10B981"
                  strokeWidth="1.5"
                  fill="none"
                />

                {/* Generation Badge Header */}
                <rect
                  x={x - nodeW / 2 + 8}
                  y={y - nodeH / 2 + 7}
                  width={nodeW - 16}
                  height="16"
                  rx="2"
                  fill="#122A1E"
                  stroke="#047857"
                  strokeWidth="0.8"
                  strokeOpacity="0.7"
                />
                <text
                  x={x}
                  y={y - nodeH / 2 + 18.5}
                  textAnchor="middle"
                  fill="#34D399"
                  fontSize="9.5"
                  fontFamily="monospace"
                  fontWeight="bold"
                  letterSpacing="0.05em"
                >
                  {label}
                </text>

                {/* Person Name */}
                <text
                  x={x}
                  y={y + 14}
                  textAnchor="middle"
                  fill="#A7F3D0"
                  fontSize="12.5"
                  fontFamily="'Cinzel', 'Playfair Display', serif, sans-serif"
                  fontWeight="bold"
                  className="group-hover:fill-[#FFFFFF] transition-colors"
                >
                  {truncateName(node.name, 20)}
                </text>
              </g>
            );
          })}

          {/* ======================================================== */}
          {/* APEX SHARED ANCESTOR 1 (PURPLE)                          */}
          {/* ======================================================== */}
          <g
            tabIndex={0}
            role="button"
            aria-label={`Inspect shared ancestor dossier for ${ancestor1.name}`}
            onClick={() => onSelectPerson?.(ancestor1.personId)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectPerson?.(ancestor1.personId);
              }
            }}
            className="cursor-pointer group focus:outline-none"
          >
            <title>{`${ancestor1.name} (Shared Common Ancestor) — Click to view profile dossier`}</title>

            <rect
              x={anc1X - nodeW / 2}
              y={ancY - nodeH / 2}
              width={nodeW}
              height={nodeH}
              rx="4"
              fill="url(#treeGradPurple)"
              stroke="#8B5CF6"
              strokeWidth="2"
              filter="url(#nodeGlowPurple)"
              className="transition-all duration-200 group-hover:stroke-[#A78BFA] group-hover:brightness-110 group-focus-visible:stroke-[#A78BFA] group-focus-visible:stroke-2"
            />

            {/* Gilded Top Cap */}
            <line
              x1={anc1X - nodeW / 2 + 10}
              y1={ancY - nodeH / 2}
              x2={anc1X + nodeW / 2 - 10}
              y2={ancY - nodeH / 2}
              stroke="#DDD6FE"
              strokeWidth="2"
            />

            {/* Corner Accents */}
            <path
              d={`M ${anc1X - nodeW / 2} ${ancY - nodeH / 2 + 8} L ${anc1X - nodeW / 2} ${ancY - nodeH / 2} L ${anc1X - nodeW / 2 + 8} ${ancY - nodeH / 2}`}
              stroke="#A78BFA"
              strokeWidth="1.5"
              fill="none"
            />
            <path
              d={`M ${anc1X + nodeW / 2 - 8} ${ancY - nodeH / 2} L ${anc1X + nodeW / 2} ${ancY - nodeH / 2} L ${anc1X + nodeW / 2} ${ancY - nodeH / 2 + 8}`}
              stroke="#A78BFA"
              strokeWidth="1.5"
              fill="none"
            />

            {/* Badge */}
            <rect
              x={anc1X - nodeW / 2 + 8}
              y={ancY - nodeH / 2 + 7}
              width={nodeW - 16}
              height="16"
              rx="2"
              fill="#261742"
              stroke="#7C3AED"
              strokeWidth="0.8"
            />
            <text
              x={anc1X}
              y={ancY - nodeH / 2 + 18.5}
              textAnchor="middle"
              fill="#C4B5FD"
              fontSize="9"
              fontFamily="monospace"
              fontWeight="bold"
              letterSpacing="0.05em"
            >
              {isCouple
                ? `MRCA CO-PARENT (G${genA})`
                : genA === 0
                ? 'MRCA DIRECT ANCESTOR (A)'
                : genB === 0
                ? 'MRCA DIRECT ANCESTOR (B)'
                : `SHARED MRCA (G${genA}/G${genB})`}
            </text>

            {/* Name */}
            <text
              x={anc1X}
              y={ancY + 14}
              textAnchor="middle"
              fill="#DDD6FE"
              fontSize="12.5"
              fontFamily="'Cinzel', 'Playfair Display', serif, sans-serif"
              fontWeight="bold"
              className="group-hover:fill-[#FFFFFF] transition-colors"
            >
              {truncateName(ancestor1.name, 20)}
            </text>
          </g>

          {/* ======================================================== */}
          {/* APEX SHARED ANCESTOR 2 (IF COUPLE)                       */}
          {/* ======================================================== */}
          {isCouple && ancestor2 && (
            <g
              tabIndex={0}
              role="button"
              aria-label={`Inspect shared ancestor dossier for ${ancestor2.name}`}
              onClick={() => onSelectPerson?.(ancestor2.personId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectPerson?.(ancestor2.personId);
                }
              }}
              className="cursor-pointer group focus:outline-none"
            >
              <title>{`${ancestor2.name} (Shared Common Ancestor Spouse) — Click to view profile dossier`}</title>

              <rect
                x={anc2X - nodeW / 2}
                y={ancY - nodeH / 2}
                width={nodeW}
                height={nodeH}
                rx="4"
                fill="url(#treeGradPurple)"
                stroke="#8B5CF6"
                strokeWidth="2"
                filter="url(#nodeGlowPurple)"
                className="transition-all duration-200 group-hover:stroke-[#A78BFA] group-hover:brightness-110 group-focus-visible:stroke-[#A78BFA] group-focus-visible:stroke-2"
              />

              {/* Gilded Top Cap */}
              <line
                x1={anc2X - nodeW / 2 + 10}
                y1={ancY - nodeH / 2}
                x2={anc2X + nodeW / 2 - 10}
                y2={ancY - nodeH / 2}
                stroke="#DDD6FE"
                strokeWidth="2"
              />

              {/* Corner Accents */}
              <path
                d={`M ${anc2X - nodeW / 2} ${ancY - nodeH / 2 + 8} L ${anc2X - nodeW / 2} ${ancY - nodeH / 2} L ${anc2X - nodeW / 2 + 8} ${ancY - nodeH / 2}`}
                stroke="#A78BFA"
                strokeWidth="1.5"
                fill="none"
              />
              <path
                d={`M ${anc2X + nodeW / 2 - 8} ${ancY - nodeH / 2} L ${anc2X + nodeW / 2} ${ancY - nodeH / 2} L ${anc2X + nodeW / 2} ${ancY - nodeH / 2 + 8}`}
                stroke="#A78BFA"
                strokeWidth="1.5"
                fill="none"
              />

              {/* Badge */}
              <rect
                x={anc2X - nodeW / 2 + 8}
                y={ancY - nodeH / 2 + 7}
                width={nodeW - 16}
                height="16"
                rx="2"
                fill="#261742"
                stroke="#7C3AED"
                strokeWidth="0.8"
              />
              <text
                x={anc2X}
                y={ancY - nodeH / 2 + 18.5}
                textAnchor="middle"
                fill="#C4B5FD"
                fontSize="9"
                fontFamily="monospace"
                fontWeight="bold"
                letterSpacing="0.05em"
              >
                {`MRCA CO-PARENT (G${genB})`}
              </text>

              {/* Name */}
              <text
                x={anc2X}
                y={ancY + 14}
                textAnchor="middle"
                fill="#DDD6FE"
                fontSize="12.5"
                fontFamily="'Cinzel', 'Playfair Display', serif, sans-serif"
                fontWeight="bold"
                className="group-hover:fill-[#FFFFFF] transition-colors"
              >
                {truncateName(ancestor2.name, 20)}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Interactive Helper Footer */}
      <div className="mt-2.5 pt-2 border-t border-[#2B333C] flex items-center justify-between text-[11px] text-[#8C8275] font-mono">
        <span>Click on any ancestor folio node to inspect profile dossier</span>
        <span className="text-[#D4AF37]">
          Apex Generation Distance: {genA} gens (Branch A) / {genB} gens (Branch B)
        </span>
      </div>
    </div>
  );
};
