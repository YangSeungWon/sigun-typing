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
  /**
   * 지도에 깔 물길. 있을 때만 실린다.
   *
   * 지역 도형과 **같은 투영으로 구운 화면 좌표**다. 지리 좌표가 아니라
   * 픽셀이고 이름 같은 속성도 없다 — 그림이지 자료가 아니다.
   * 출처는 OpenStreetMap이고 표시 의무가 있다(scripts/build-geo.mts).
   */
  water?: {
    /** 강줄기. 선이라 stroke로 그린다. */
    lines: string;
    /** 호수·저수지·넓은 강. 면이라 fill로 그린다. */
    areas: string;
  };
}
