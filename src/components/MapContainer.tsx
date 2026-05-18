import { useEffect, useRef } from 'react';
import { LocateFixed, MapPin } from 'lucide-react';
import styles from './MapContainer.module.css';
import type { Location, RouteNode, RouteEdge, RouteSegment } from '../types';

interface LatLng { lat: number; lng: number; }

interface MapContainerProps {
  locations: Location[];
  onMarkerClick: (location: Location) => void;
  startPoint: LatLng | null;
  isSettingStartPoint: boolean;
  onMapClick: (lat: number, lng: number) => void;
  routePath: RouteSegment[] | null;
  userLocation: LatLng | null;
  // 편집 모드
  isEditMode: boolean;
  routeNodes: RouteNode[];
  routeEdges: RouteEdge[];
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  onNodeClickEditor: (nodeId: string) => void;
  onNodeDragEnd: (nodeId: string, lat: number, lng: number) => void;
  onEdgeClickEditor: (edgeId: string) => void;
  onMapClickEditor: (lat: number, lng: number) => void;
}

const SEJONG_CENTER = { lat: 37.5509, lng: 127.0741 };
const SEJONG_BOUNDS_SW = { lat: 37.548, lng: 127.072 };
const SEJONG_BOUNDS_NE = { lat: 37.554, lng: 127.076 };

const EDGE_COLORS: Record<RouteEdge['type'], string> = {
  flat:   '#888888',
  ramp:   '#1a6fff',
  stairs: '#e53935',
};

function rampColor(angle?: number): string {
  if (!angle || angle <= 7) return '#43a047';
  if (angle <= 15) return '#ff9800';
  return '#f4511e';
}

function segmentColor(seg: RouteSegment): string {
  if (seg.type === 'flat') return '#1a6fff';
  if (seg.type === 'stairs') return '#e53935';
  return rampColor(seg.rampAngle);
}

function calcBearing(from: LatLng, to: LatLng): number {
  const dL = ((to.lng - from.lng) * Math.PI) / 180;
  const φ1 = (from.lat * Math.PI) / 180;
  const φ2 = (to.lat * Math.PI) / 180;
  const y = Math.sin(dL) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dL);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const MapContainer = ({
  locations,
  onMarkerClick,
  startPoint,
  isSettingStartPoint,
  onMapClick,
  routePath,
  userLocation,
  isEditMode,
  routeNodes,
  routeEdges,
  selectedNodeId,
  selectedEdgeId,
  onNodeClickEditor,
  onNodeDragEnd,
  onEdgeClickEditor,
  onMapClickEditor,
}: MapContainerProps) => {
  const mapElement = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const locationMarkersRef = useRef<any[]>([]);
  const startMarkerRef = useRef<any>(null);
  const routePolylinesRef = useRef<any[]>([]);
  const routeArrowMarkersRef = useRef<any[]>([]);
  // 편집 모드 요소
  const editorNodeMarkersRef = useRef<{ id: string; marker: any }[]>([]);
  const editorEdgeLinesRef = useRef<{ id: string; polyline: any; arrowMarker: any }[]>([]);

  // 지도 초기화 (1회) — naver SDK 로딩 완료 대기 후 실행
  useEffect(() => {
    const initMap = () => {
      const { naver } = window;
      if (!mapElement.current || !naver?.maps || mapRef.current) return;

      const bounds = new naver.maps.LatLngBounds(
        new naver.maps.LatLng(SEJONG_BOUNDS_SW.lat, SEJONG_BOUNDS_SW.lng),
        new naver.maps.LatLng(SEJONG_BOUNDS_NE.lat, SEJONG_BOUNDS_NE.lng)
      );

      const map = new naver.maps.Map(mapElement.current, {
        center: new naver.maps.LatLng(SEJONG_CENTER.lat, SEJONG_CENTER.lng),
        zoom: 17,
        minZoom: 15,
        maxZoom: 19,
        maxBounds: bounds,
        zoomControl: false,
      });

      mapRef.current = map;
      map.fitBounds(bounds, { padding: { top: 50, right: 50, bottom: 50, left: 50 } });
    };

    if ((window as any).naver?.maps) {
      initMap();
    } else {
      const interval = setInterval(() => {
        if ((window as any).naver?.maps) {
          clearInterval(interval);
          initMap();
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, []);

  // 클릭 리스너 — isSettingStartPoint / isEditMode 분기
  useEffect(() => {
    if (!mapRef.current) return;
    const { naver } = window;
    const listener = naver.maps.Event.addListener(mapRef.current, 'click', (e: any) => {
      if (isSettingStartPoint) {
        onMapClick(e.coord.y, e.coord.x);
      } else if (isEditMode) {
        onMapClickEditor(e.coord.y, e.coord.x);
      }
    });
    return () => naver.maps.Event.removeListener(listener);
  }, [isSettingStartPoint, isEditMode, onMapClick, onMapClickEditor]);

  // 건물 마커 (편집 모드에서는 반투명하게)
  useEffect(() => {
    const { naver } = window;
    if (!mapRef.current || !naver) return;
    locationMarkersRef.current.forEach((m) => m.setMap(null));
    locationMarkersRef.current = locations.map((location) => {
      const opacity = isEditMode ? '0.4' : '1';
      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(location.lat, location.lng),
        map: mapRef.current,
        title: location.name,
        icon: {
          content: `<div style="background:white;padding:5px 10px;border-radius:20px;border:2px solid #c00000;font-weight:bold;font-size:12px;box-shadow:0 2px 5px rgba(0,0,0,0.2);white-space:nowrap;opacity:${opacity}">${location.name}</div>`,
          anchor: new naver.maps.Point(15, 15),
        },
      });
      if (!isEditMode) {
        naver.maps.Event.addListener(marker, 'click', () => onMarkerClick(location));
      }
      return marker;
    });
  }, [locations, onMarkerClick, isEditMode]);

  // 편집 모드: 노드 마커 + 엣지 폴리라인
  useEffect(() => {
    const { naver } = window;
    if (!mapRef.current || !naver) return;

    // 기존 편집 요소 제거
    editorNodeMarkersRef.current.forEach(({ marker }) => marker.setMap(null));
    editorEdgeLinesRef.current.forEach(({ polyline, arrowMarker }) => {
      polyline.setMap(null);
      arrowMarker?.setMap(null);
    });
    editorNodeMarkersRef.current = [];
    editorEdgeLinesRef.current = [];

    if (!isEditMode) return;

    const nodeMap = new Map<string, RouteNode>(routeNodes.map((n) => [n.id, n]));

    // 엣지 폴리라인
    routeEdges.forEach((edge) => {
      const a = nodeMap.get(edge.from);
      const b = nodeMap.get(edge.to);
      if (!a || !b) return;

      const isSelected = edge.id === selectedEdgeId;
      const color = EDGE_COLORS[edge.type];
      const weight = isSelected ? 8 : 5;
      const opacity = isSelected ? 1 : 0.75;

      const polyline = new naver.maps.Polyline({
        map: mapRef.current,
        path: [new naver.maps.LatLng(a.lat, a.lng), new naver.maps.LatLng(b.lat, b.lng)],
        strokeColor: color,
        strokeOpacity: opacity,
        strokeWeight: weight,
        clickable: true,
      });

      naver.maps.Event.addListener(polyline, 'click', () => onEdgeClickEditor(edge.id));

      // 경사로인 경우 높은 쪽 방향 화살표
      let arrowMarker: any = null;
      if (edge.type === 'ramp' && edge.rampHighEnd) {
        const midLat = (a.lat + b.lat) / 2;
        const midLng = (a.lng + b.lng) / 2;
        const bearingAtoB = calcBearing(a, b);
        // 높은 쪽이 'from'이면 화살표는 B→A 방향(내려가는 방향), 'to'면 A→B 방향
        const uplhillBearing = edge.rampHighEnd === 'to' ? bearingAtoB : (bearingAtoB + 180) % 360;
        const angleDisplay = edge.rampAngle ? `${edge.rampAngle}°` : '';

        arrowMarker = new naver.maps.Marker({
          position: new naver.maps.LatLng(midLat, midLng),
          map: mapRef.current,
          icon: {
            content: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;pointer-events:none;">
              <div style="background:white;border:2px solid #1a6fff;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;color:#1a6fff;font-size:13px;font-weight:bold;transform:rotate(${uplhillBearing}deg);box-shadow:0 1px 4px rgba(0,0,0,0.25)">↑</div>
              ${angleDisplay ? `<div style="background:#1a6fff;color:white;border-radius:4px;padding:1px 4px;font-size:10px;font-weight:bold">${angleDisplay}</div>` : ''}
            </div>`,
            anchor: new naver.maps.Point(11, 11),
          },
          clickable: false,
        });
      }

      editorEdgeLinesRef.current.push({ id: edge.id, polyline, arrowMarker });
    });

    // 노드 마커 (엣지 위에 렌더되도록 나중에 생성)
    routeNodes.forEach((node) => {
      const isSelected = node.id === selectedNodeId;
      const size = isSelected ? 18 : 12;
      const bg = isSelected ? '#1a6fff' : 'white';
      const border = isSelected ? '3px solid white' : '2px solid #555';
      const shadow = isSelected
        ? '0 0 0 3px rgba(26,111,255,0.4), 0 2px 6px rgba(0,0,0,0.3)'
        : '0 1px 4px rgba(0,0,0,0.3)';
      const label = node.label ?? node.id;

      const marker = new naver.maps.Marker({
        position: new naver.maps.LatLng(node.lat, node.lng),
        map: mapRef.current,
        draggable: true,
        icon: {
          content: `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;cursor:grab;">
            <div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:${border};box-shadow:${shadow};"></div>
            <div style="background:rgba(0,0,0,0.65);color:white;border-radius:4px;padding:1px 5px;font-size:10px;white-space:nowrap;max-width:80px;overflow:hidden;text-overflow:ellipsis">${label}</div>
          </div>`,
          anchor: new naver.maps.Point(size / 2, size / 2),
        },
        clickable: true,
      });

      naver.maps.Event.addListener(marker, 'click', () => onNodeClickEditor(node.id));
      naver.maps.Event.addListener(marker, 'dragend', (e: any) => {
        onNodeDragEnd(node.id, e.coord.lat(), e.coord.lng());
      });
      editorNodeMarkersRef.current.push({ id: node.id, marker });
    });
  }, [isEditMode, routeNodes, routeEdges, selectedNodeId, selectedEdgeId, onNodeClickEditor, onNodeDragEnd, onEdgeClickEditor]);

  // 출발지 마커
  useEffect(() => {
    const { naver } = window;
    if (!mapRef.current || !naver) return;
    if (startPoint) {
      const pos = new naver.maps.LatLng(startPoint.lat, startPoint.lng);
      if (!startMarkerRef.current) {
        startMarkerRef.current = new naver.maps.Marker({
          position: pos,
          map: mapRef.current,
          icon: {
            content: `<div style="background:#007bff;color:white;padding:5px 10px;border-radius:20px;font-weight:bold;font-size:12px;box-shadow:0 2px 5px rgba(0,0,0,0.3);white-space:nowrap;">출발</div>`,
            anchor: new naver.maps.Point(15, 15),
          },
        });
      } else {
        startMarkerRef.current.setPosition(pos);
        startMarkerRef.current.setMap(mapRef.current);
      }
    } else if (startMarkerRef.current) {
      startMarkerRef.current.setMap(null);
    }
  }, [startPoint]);

  // 경로 폴리라인 + 경사로 방향 화살표 (편집 모드에서는 숨김)
  useEffect(() => {
    const { naver } = window;
    if (!mapRef.current || !naver) return;

    routePolylinesRef.current.forEach((pl) => pl.setMap(null));
    routePolylinesRef.current = [];
    routeArrowMarkersRef.current.forEach((m) => m.setMap(null));
    routeArrowMarkersRef.current = [];

    if (isEditMode || !routePath || routePath.length === 0) return;

    for (const seg of routePath) {
      const naverPath = seg.points.map((p) => new naver.maps.LatLng(p.lat, p.lng));
      routePolylinesRef.current.push(new naver.maps.Polyline({
        map: mapRef.current,
        path: naverPath,
        strokeColor: segmentColor(seg),
        strokeOpacity: 0.92,
        strokeWeight: 6,
      }));

      // 경사로 방향 화살표 마커
      if (seg.type === 'ramp' && seg.isUphill !== undefined) {
        const pts = seg.points;
        const mid = pts[Math.floor(pts.length / 2)];
        const label = seg.isUphill ? '오르막' : '내리막';
        const color = segmentColor(seg);

        routeArrowMarkersRef.current.push(new naver.maps.Marker({
          position: new naver.maps.LatLng(mid.lat, mid.lng),
          map: mapRef.current,
          clickable: false,
          icon: {
            content: `<div style="background:${color};color:white;border-radius:6px;padding:3px 8px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.25);pointer-events:none;">${label}</div>`,
            anchor: new naver.maps.Point(0, 10),
          },
        }));
      }
    }
  }, [routePath, isEditMode]);

  const moveToMyLocation = () => {
    if (!mapRef.current || !userLocation) { alert('현재 위치를 불러오는 중입니다.'); return; }
    const { naver } = window;
    mapRef.current.setCenter(new naver.maps.LatLng(userLocation.lat, userLocation.lng));
    mapRef.current.setZoom(18);
  };

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div ref={mapElement} className={styles.map} />

      {/* 편집 모드 범례 */}
      {isEditMode && (
        <div style={{
          position: 'absolute', top: 12, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.75)', color: 'white', borderRadius: 20,
          padding: '6px 14px', fontSize: 13, fontWeight: 600, zIndex: 1500,
          display: 'flex', gap: 12, alignItems: 'center', pointerEvents: 'none',
        }}>
          <span style={{ color: '#aaa' }}>●</span>평지
          <span style={{ color: '#1a6fff' }}>●</span>경사로
          <span style={{ color: '#e53935' }}>●</span>계단
        </div>
      )}

      <button className={styles.locateButton} onClick={moveToMyLocation} title="현재 위치로 이동">
        <LocateFixed size={20} />
      </button>

      {/* 지도 클릭 안내 */}
      {isSettingStartPoint && (
        <div className={styles.startBanner}>
          <MapPin size={15} strokeWidth={2.5} />
          출발 위치를 탭하세요
        </div>
      )}

      {isEditMode && !selectedNodeId && (
        <div style={{
          position: 'absolute', bottom: 80, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(0,0,0,0.65)', color: 'white', borderRadius: 20,
          padding: '8px 16px', fontSize: 13, zIndex: 1500, pointerEvents: 'none',
          whiteSpace: 'nowrap',
        }}>
          빈 곳 클릭 → 노드 추가 &nbsp;|&nbsp; 노드 클릭 → 선택
        </div>
      )}
    </div>
  );
};

export default MapContainer;
