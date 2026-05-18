import type { RouteNode, RouteEdge, RouteSegment } from '../types';
import { haversine } from '../utils/haversine';
import type { LatLng } from '../utils/haversine';

function nearestNode(point: LatLng, nodes: RouteNode[]): RouteNode {
  return nodes.reduce((best, n) =>
    haversine(point, n) < haversine(point, best) ? n : best
  );
}

// 두 노드 사이 엣지 키 (방향 무관)
function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function findRoute(
  start: LatLng,
  dest: LatLng,
  nodes: RouteNode[],
  edges: RouteEdge[],
  barrierFree = true,
  destName?: string
): RouteSegment[] {
  const fallback = (pts: LatLng[]): RouteSegment[] => [{ points: pts, type: 'flat' }];

  if (nodes.length === 0) return fallback([start, dest]);

  const startNode = nearestNode(start, nodes);
  const nodeMap = new Map<string, RouteNode>(nodes.map((n) => [n.id, n]));

  // 엣지 룩업 맵 (두 노드 ID 쌍 → 엣지)
  const edgeMap = new Map<string, RouteEdge>();
  for (const edge of edges) {
    edgeMap.set(edgeKey(edge.from, edge.to), edge);
  }

  const adj = new Map<string, { id: string; cost: number }[]>();
  nodes.forEach((n) => adj.set(n.id, []));

  const STAIR_PENALTY = barrierFree ? 1_000_000 : 0;
  // 경사로 각도 페널티: 1도당 기본 거리의 5% 추가 (낮은 각도 선호)
  const RAMP_ANGLE_FACTOR = 0.05;

  for (const edge of edges) {
    const a = nodeMap.get(edge.from);
    const b = nodeMap.get(edge.to);
    if (!a || !b) continue;
    const base = haversine(a, b);
    let cost = base;
    if (!edge.accessible) cost += STAIR_PENALTY;
    if (edge.type === 'ramp' && edge.rampAngle) {
      cost += base * edge.rampAngle * RAMP_ANGLE_FACTOR;
    }
    adj.get(edge.from)!.push({ id: edge.to, cost });
    adj.get(edge.to)!.push({ id: edge.from, cost });
  }

  const dist = new Map<string, number>(nodes.map((n) => [n.id, Infinity]));
  const prev = new Map<string, string | null>(nodes.map((n) => [n.id, null]));
  const visited = new Set<string>();
  dist.set(startNode.id, 0);

  for (;;) {
    let u: string | null = null;
    let minD = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < minD) { minD = d; u = id; }
    }
    if (!u || minD === Infinity) break;
    visited.add(u);

    for (const { id: v, cost } of adj.get(u) ?? []) {
      if (visited.has(v)) continue;
      const alt = dist.get(u)! + cost;
      if (alt < dist.get(v)!) {
        dist.set(v, alt);
        prev.set(v, u);
      }
    }
  }

  let destNode: RouteNode;

  if (destName) {
    const nameNorm = destName.toLowerCase();
    const candidates = nodes.filter(
      (n) => n.label && n.label.toLowerCase().includes(nameNorm)
    );

    if (candidates.length > 0) {
      const reachable = candidates.filter((n) => (dist.get(n.id) ?? Infinity) < Infinity);
      if (reachable.length > 0) {
        destNode = reachable.reduce((best, n) =>
          dist.get(n.id)! < dist.get(best.id)! ? n : best
        );
      } else {
        destNode = candidates.reduce((best, n) =>
          haversine(dest, n) < haversine(dest, best) ? n : best
        );
      }
    } else {
      destNode = nearestNode(dest, nodes);
    }
  } else {
    destNode = nearestNode(dest, nodes);
  }

  if (startNode.id === destNode.id) return fallback([start, dest]);

  // 경로 역추적 — 노드 ID 순서 복원
  const nodeIdPath: string[] = [];
  let cur: string | null = destNode.id;
  while (cur) {
    nodeIdPath.unshift(cur);
    cur = prev.get(cur) ?? null;
  }

  if (nodeIdPath.length === 0) return fallback([start, dest]);

  // 엣지별로 세그먼트 구성 (연속된 같은 타입은 병합)
  const segments: RouteSegment[] = [];

  // start → 첫 노드 (flat 연결선)
  const firstNode = nodeMap.get(nodeIdPath[0])!;
  segments.push({ points: [start, { lat: firstNode.lat, lng: firstNode.lng }], type: 'flat' });

  for (let i = 0; i < nodeIdPath.length - 1; i++) {
    const fromId = nodeIdPath[i];
    const toId = nodeIdPath[i + 1];
    const edge = edgeMap.get(edgeKey(fromId, toId));
    const fromNode = nodeMap.get(fromId)!;
    const toNode = nodeMap.get(toId)!;
    const segType = edge?.type ?? 'flat';
    const segAngle = edge?.rampAngle;

    // 이동 방향 기준으로 오르막 여부 계산
    let isUphill: boolean | undefined;
    if (edge?.type === 'ramp' && edge.rampHighEnd) {
      const sameDir = edge.from === fromId;
      // rampHighEnd가 'to'이면 to쪽이 높음
      // 같은 방향 이동: to가 높으면 오르막
      // 반대 방향 이동: from(=원래 to)이 높으면 오르막 → rampHighEnd==='from'
      isUphill = sameDir ? edge.rampHighEnd === 'to' : edge.rampHighEnd === 'from';
    }

    const pt0 = { lat: fromNode.lat, lng: fromNode.lng };
    const pt1 = { lat: toNode.lat, lng: toNode.lng };

    const last = segments[segments.length - 1];
    if (last.type === segType && last.rampAngle === segAngle && last.isUphill === isUphill) {
      last.points.push(pt1);
    } else {
      segments.push({ points: [pt0, pt1], type: segType, rampAngle: segAngle, isUphill });
    }
  }

  // 마지막 노드 → dest (flat 연결선)
  const lastNode = nodeMap.get(nodeIdPath[nodeIdPath.length - 1])!;
  const lastSeg = segments[segments.length - 1];
  if (lastSeg.type === 'flat') {
    lastSeg.points.push(dest);
  } else {
    segments.push({ points: [{ lat: lastNode.lat, lng: lastNode.lng }, dest], type: 'flat' });
  }

  return segments;
}
