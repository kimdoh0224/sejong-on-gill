# 세종온길 — 배리어프리 길찾기

세종대학교 캠퍼스 내 휠체어·이동 약자를 위한 배리어프리 경로 안내 웹앱입니다.  
건물별 편의시설 정보 조회, 경사로·계단 회피 경로 탐색, 개발자용 지도 편집 기능을 제공합니다.

## 주요 기능

- **건물 마커 & 시설 정보** — 캠퍼스 건물 23개의 경사로·엘리베이터·화장실·주차장 보유 여부 및 상세 설명 제공
- **배리어프리 경로 탐색** — 현재 위치 또는 지도 직접 선택으로 출발지를 지정하고, 계단을 최대한 우회하는 최적 경로 계산 (Dijkstra)
- **경사 정보 표시** — 경로 내 경사로 구간별 각도·오르막/내리막 방향·거리 표시 (데스크탑 패널 + 모바일 하단 바)
- **시설 필터** — 경사로·엘리베이터·화장실·주차장 조건으로 건물 필터링
- **개발자 지도 편집** — 비밀번호 인증 후 노드/엣지 추가·수정·삭제, JSON 내보내기

## 기술 스택

| 구분 | 내용 |
|------|------|
| 프레임워크 | React 19 + TypeScript |
| 빌드 도구 | Vite 8 |
| 지도 SDK | Naver Maps JavaScript API v3 |
| 아이콘 | lucide-react |
| 스타일 | CSS Modules |

## 시작하기

### 사전 준비

- Node.js 18 이상
- Naver Cloud Platform Maps API 키 ([발급 링크](https://www.ncloud.com/product/applicationService/maps))

### 설치

```bash
npm install
```

### 환경 변수 설정

프로젝트 루트에 `.env` 파일을 생성합니다.

```env
# 개발자 편집 모드 접근 비밀번호 (?dev 쿼리 파라미터 사용 시 요구됨)
VITE_DEV_PASSWORD=your_password_here
```

> Naver Maps API 키는 `index.html`의 스크립트 태그 `ncpKeyId` 파라미터에 직접 설정되어 있습니다.

### 개발 서버 실행

```bash
npm run dev
```

### 빌드

```bash
npm run build
```

## 프로젝트 구조

```
src/
├── components/
│   ├── DepartureSelector.tsx   출발지 선택 모달
│   ├── DetailPanel.tsx         건물 상세 정보 패널
│   ├── DevAuthModal.tsx        개발자 모드 인증 모달
│   ├── EdgePanel.tsx           경로 구간 추가/편집 패널
│   ├── MapContainer.tsx        Naver 지도 및 마커/폴리라인 렌더링
│   ├── OverlayUI.tsx           필터 칩 및 하단 액션 버튼
│   └── RouteInfoPanel.tsx      경로 경사 정보 패널
├── data/
│   ├── locations.json          건물 위치 및 편의시설 데이터
│   ├── nodes.json              경로 그래프 노드
│   └── edges.json              경로 그래프 엣지
├── hooks/
│   └── useBarrierFreeData.ts   데이터 로드 및 시설 필터 훅
├── services/
│   └── routeFinder.ts          Dijkstra 기반 배리어프리 경로 탐색
├── types/
│   ├── index.ts                공통 타입 정의
│   └── naver-maps.d.ts         Naver Maps 전역 타입 선언
└── utils/
    └── haversine.ts            Haversine 거리 계산 유틸
```

## 데이터 구조

### `locations.json`

건물별 위치 좌표와 배리어프리 시설 보유 여부를 담습니다.

```json
{
  "locations": [
    {
      "id": 1,
      "name": "집현관",
      "category": "BUILDING",
      "lat": 37.5490053,
      "lng": 127.0737571,
      "facilities": {
        "ramp":     { "exists": true,  "description": "정문 우측 경사로 설치" },
        "elevator": { "exists": true,  "description": "전층 엘리베이터 운영 (4대)" },
        "toilet":   { "exists": true,  "description": "1층 장애인 전용 화장실" },
        "parking":  { "exists": true,  "description": "본관 앞 전용 주차구역" }
      }
    }
  ]
}
```

### `nodes.json` / `edges.json`

경로 탐색에 사용하는 그래프 데이터입니다.

```json
// nodes.json
{ "nodes": [{ "id": "node_xxx", "lat": 37.549, "lng": 127.074, "label": "정문" }] }

// edges.json
{ "edges": [{
  "id": "edge_xxx",
  "from": "node_aaa",
  "to": "node_bbb",
  "type": "ramp",
  "accessible": true,
  "rampHighEnd": "to",
  "rampAngle": 8
}] }
```

엣지 타입: `flat` (평지) | `ramp` (경사로) | `stairs` (계단)

## 경로 탐색 알고리즘

`src/services/routeFinder.ts`에서 Dijkstra 알고리즘으로 최적 경로를 계산합니다.

- **배리어프리 모드**: 계단 엣지에 대형 페널티(1,000,000) 부여 → 사실상 우회
- **경사로 페널티**: 경사 각도에 비례한 비용 추가 → 완만한 경사로 선호
- **목적지 매칭**: 건물 이름이 포함된 노드 라벨 중 최단 거리 노드를 종점으로 선택
- **세그먼트 병합**: 연속된 같은 타입의 엣지를 하나의 세그먼트로 병합하여 렌더링 최적화

## 개발자 편집 모드

URL에 `?dev` 쿼리 파라미터를 추가하면 비밀번호 입력 후 지도 편집 기능이 활성화됩니다.

```
http://localhost:5173/?dev
```

- **노드 추가**: 빈 지도 클릭
- **노드 이동**: 드래그
- **노드 연결**: 노드 클릭 → 다른 노드 클릭 → 구간 정보 입력
- **엣지 편집**: 폴리라인 클릭
- **JSON 저장**: 상단 "JSON 저장" 버튼으로 그래프 파일 다운로드
- **초기화**: 상단 "초기화" 버튼으로 기본 데이터로 복원

편집된 그래프는 `localStorage`에 자동 저장되어 페이지 새로고침 후에도 유지됩니다.

## 정보 수정 제안

시설 정보 오류나 누락이 있을 경우, 앱 내 하단 **"정보 수정 제안"** 링크(Google Form)를 통해 제보해 주세요.
