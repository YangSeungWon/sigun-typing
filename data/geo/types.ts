/** scripts/build-geo.ts가 만들어 내는 코스별 지도 데이터. */
export interface RegionShape {
  /** data/courses의 지역 코드와 같다 */
  code: string;
  name: string;
  /** 미리 계산된 SVG path — 런타임에는 투영 계산이 필요 없다 */
  d: string;
  /** 라벨을 놓을 무게중심 (화면 좌표) */
  cx: number;
  cy: number;
}

export interface CourseGeo {
  id: string;
  width: number;
  height: number;
  /** 코스 순서와 같은 순서 */
  regions: RegionShape[];
}
