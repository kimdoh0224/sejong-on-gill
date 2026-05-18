import { Navigation2, MapPinPlus, X, ChevronRight, MapPin, AlertTriangle } from 'lucide-react';
import styles from './DepartureSelector.module.css';

interface DepartureSelectorProps {
  destinationName: string;
  hasUserLocation: boolean;
  gpsError: boolean;
  isOutsideCampus: boolean;
  onSelectCurrentLocation: () => void;
  onSelectMapPoint: () => void;
  onCancel: () => void;
}

const DepartureSelector = ({
  destinationName,
  hasUserLocation,
  gpsError,
  isOutsideCampus,
  onSelectCurrentLocation,
  onSelectMapPoint,
  onCancel,
}: DepartureSelectorProps) => {
  const locationDisabled = !hasUserLocation || gpsError;

  let locationDesc: string;
  if (gpsError) {
    locationDesc = '위치 정보를 가져올 수 없습니다';
  } else if (!hasUserLocation) {
    locationDesc = 'GPS 위치를 확인하는 중...';
  } else if (isOutsideCampus) {
    locationDesc = '캠퍼스 근처가 아닙니다 — 경로가 부정확할 수 있습니다';
  } else {
    locationDesc = 'GPS 위치로 경로를 안내합니다';
  }

  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />

        {/* 목적지 헤더 */}
        <div className={styles.destHeader}>
          <div className={styles.destMeta}>
            <span className={styles.destChip}>
              <MapPin size={11} />
              목적지
            </span>
          </div>
          <p className={styles.destName}>{destinationName}</p>
          <button className={styles.closeBtn} onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <div className={styles.divider} />

        {/* 캠퍼스 외부 경고 배너 */}
        {isOutsideCampus && !gpsError && (
          <div className={styles.outsideBanner}>
            <AlertTriangle size={14} className={styles.outsideBannerIcon} />
            <span>현재 위치가 캠퍼스 근방이 아닙니다. 지도에서 직접 출발지를 선택하시면 더 정확한 안내가 가능합니다.</span>
          </div>
        )}

        {/* 본문 */}
        <div className={styles.body}>
          <p className={styles.question}>어디서 출발하시나요?</p>

          <div className={styles.options}>
            {/* 현재 위치 */}
            <button
              className={`${styles.optionCard} ${styles.optionNav} ${isOutsideCampus && !gpsError ? styles.optionWarn : ''}`}
              onClick={onSelectCurrentLocation}
              disabled={locationDisabled}
            >
              <span className={`${styles.optionIconWrap} ${gpsError ? styles.iconRed : isOutsideCampus ? styles.iconOrange : styles.iconBlue}`}>
                {isOutsideCampus && !gpsError
                  ? <AlertTriangle size={22} />
                  : <Navigation2 size={22} />
                }
              </span>
              <span className={styles.optionBody}>
                <span className={styles.optionTitle}>현재 위치 사용</span>
                <span className={`${styles.optionDesc} ${isOutsideCampus && !gpsError ? styles.descWarn : gpsError ? styles.descError : ''}`}>
                  {locationDesc}
                </span>
              </span>
              {!locationDisabled && <ChevronRight size={18} className={styles.optionArrow} />}
            </button>

            {/* 지도에서 선택 */}
            <button className={`${styles.optionCard} ${styles.optionMap}`} onClick={onSelectMapPoint}>
              <span className={`${styles.optionIconWrap} ${styles.iconGreen}`}>
                <MapPinPlus size={22} />
              </span>
              <span className={styles.optionBody}>
                <span className={styles.optionTitle}>지도에서 직접 선택</span>
                <span className={styles.optionDesc}>지도를 탭하여 출발지를 지정합니다</span>
              </span>
              <ChevronRight size={18} className={styles.optionArrow} />
            </button>
          </div>

          <button className={styles.cancelBtn} onClick={onCancel}>취소</button>
        </div>
      </div>
    </div>
  );
};

export default DepartureSelector;
