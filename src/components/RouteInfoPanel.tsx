import { TrendingUp, TrendingDown, Minus, Route } from 'lucide-react';
import type { RouteSegment } from '../types';
import { haversine } from '../utils/haversine';
import styles from './RouteInfoPanel.module.css';

interface RouteInfoPanelProps {
  routePath: RouteSegment[];
}

function segmentDist(seg: RouteSegment): number {
  let d = 0;
  for (let i = 0; i < seg.points.length - 1; i++) {
    d += haversine(seg.points[i], seg.points[i + 1]);
  }
  return d;
}

function steepnessLevel(angle: number): 'easy' | 'moderate' | 'steep' {
  if (angle <= 3) return 'easy';
  if (angle <= 7) return 'moderate';
  return 'steep';
}

const STEEPNESS_LABEL = { easy: '완만', moderate: '보통', steep: '가파름' };
const STEEPNESS_COLOR = { easy: '#15803d', moderate: '#a16207', steep: '#b91c1c' };
const STEEPNESS_BG    = { easy: '#dcfce7', moderate: '#fef9c3', steep: '#fee2e2' };

const RouteInfoPanel = ({ routePath }: RouteInfoPanelProps) => {
  const rampSegs = routePath.filter((s) => s.type === 'ramp');
  const totalDist = Math.round(routePath.reduce((sum, s) => sum + segmentDist(s), 0));

  return (
    <>
      {/* ── 데스크탑: 좌측 패널 ─────────────────────── */}
      <div className={styles.desktopPanel}>
        <div className={styles.panelHeader}>
          <Route size={14} className={styles.headerIcon} />
          <span className={styles.headerTitle}>경로 경사 정보</span>
          <span className={styles.totalDistBadge}>{totalDist}m</span>
        </div>

        {rampSegs.length === 0 ? (
          <div className={styles.noRamp}>
            <Minus size={13} />
            <span>경사로 없음 — 평탄한 경로</span>
          </div>
        ) : (
          <div className={styles.rampList}>
            {rampSegs.map((seg, i) => {
              const angle = seg.rampAngle ?? 0;
              const level = steepnessLevel(angle);
              const dist  = Math.round(segmentDist(seg));
              return (
                <div key={i} className={styles.rampItem}
                  style={{ background: STEEPNESS_BG[level], borderColor: STEEPNESS_BG[level] }}>
                  <div className={styles.rampTop}>
                    <span className={styles.levelBadge}
                      style={{ color: STEEPNESS_COLOR[level], background: STEEPNESS_BG[level] }}>
                      {STEEPNESS_LABEL[level]}
                    </span>
                    <span className={styles.rampDist}>{dist}m</span>
                  </div>
                  <div className={styles.rampDetail}>
                    {seg.isUphill === undefined
                      ? <Minus size={12} className={styles.dirIcon} />
                      : seg.isUphill
                        ? <TrendingUp size={12} className={styles.dirIcon} />
                        : <TrendingDown size={12} className={styles.dirIcon} />
                    }
                    <span className={styles.rampAngle}>
                      {angle > 0 ? `${angle}° · ` : ''}
                      {seg.isUphill === undefined ? '방향 미상' : seg.isUphill ? '오르막' : '내리막'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 모바일: 하단 컴팩트 바 ──────────────────── */}
      <div className={styles.mobileBar}>
        <div className={styles.mobileSummary}>
          <Route size={13} className={styles.headerIcon} />
          <span className={styles.mobileTotalDist}>총 {totalDist}m</span>
          {rampSegs.length > 0 && (
            <span className={styles.mobileSep}>·</span>
          )}
          {rampSegs.length === 0 ? (
            <span className={styles.mobileFlat}>경사로 없음</span>
          ) : (
            <span className={styles.mobileRampCount}>경사로 {rampSegs.length}구간</span>
          )}
        </div>

        {rampSegs.length > 0 && (
          <div className={styles.mobileChips}>
            {rampSegs.map((seg, i) => {
              const angle = seg.rampAngle ?? 0;
              const level = steepnessLevel(angle);
              const dist  = Math.round(segmentDist(seg));
              return (
                <div key={i} className={styles.mobileChip}
                  style={{ background: STEEPNESS_BG[level], color: STEEPNESS_COLOR[level] }}>
                  {seg.isUphill === undefined
                    ? <Minus size={11} />
                    : seg.isUphill
                      ? <TrendingUp size={11} />
                      : <TrendingDown size={11} />
                  }
                  <span>{STEEPNESS_LABEL[level]}</span>
                  {angle > 0 && <span>{angle}°</span>}
                  <span>{dist}m</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
};

export default RouteInfoPanel;
