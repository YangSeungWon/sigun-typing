/**
 * 게임이 보는 것은 "코스 하나에 담긴 순서 있는 장소 목록"이 전부다.
 * 시도/시군/구 같은 행정계층은 데이터 설명일 뿐, 규칙을 바꾸지 않는다.
 */
export interface Region {
  /** 행정표준코드 등 안정적인 식별자 */
  code: string;
  /** 게임에서 입력할 표준 표기 */
  name: string;
  /**
   * 함께 정답으로 인정할 표기.
   * 원본 경계 데이터의 정식 명칭도 여기 들어 있어야 지도와 이어진다
   * (`종로` → `종로구`, `수원` → `수원시`).
   */
  aliases?: string[];
}

/** 코스 선택 화면의 1단계. 시도가 늘어나도 목록이 평평해지지 않게 묶는다. */
export type CourseGroup =
  | "nationwide"
  | "capital"
  | "gangwon"
  | "chungcheong"
  | "honam"
  | "yeongnam"
  | "jeju";

/** 원본 경계 파일과 그 안에서 이 코스가 차지하는 범위. */
export interface CourseGeoSource {
  file: "provinces" | "municipalities";
  /**
   * 원본 코드 접두사. 이름만으로는 고를 수 없다 —
   * `중구`는 서울·부산·대구·인천·대전·울산에 모두 있다.
   */
  prefix?: string;
  /**
   * 남길 정점 비율(%). 기본 12.
   * 같은 1000px에 담기는 해안선의 양이 코스마다 다르므로 하나로 못 정한다 —
   * 전국 지도는 훨씬 촘촘해서 낮은 값으로도 형태가 남고, 도시 자치구는
   * 원래 정점이 적어 높은 값이 필요하다.
   */
  simplifyPercent?: number;
}

export interface Course {
  id: string;
  /** 코스 이름 */
  name: string;
  /** 선택 화면에서 묶일 권역 */
  group: CourseGroup;
  /** 상위 행정구역 이름. 전국 코스는 없음. */
  parentName?: string;
  /** 목록에서 개수를 셀 때 쓰는 단위 — "구", "시군", "시도". 규칙에는 관여하지 않는다. */
  placeUnit: string;
  /**
   * 코스 판번호. 기록을 비교할 수 있는지는 세 축이 함께 정한다 —
   * `courseId · courseVersion · scoringVersion`.
   *
   * ── 올려야 하는 변경 ─────────────────────────────────────────
   *   · 장소가 늘거나 빠질 때 (총 타수가 달라진다)
   *   · 순서가 바뀔 때 (같은 시드가 다른 문제를 낸다)
   *   · 표준 표기나 별칭이 바뀌어 정답 판정이 달라질 때
   *   · 힌트 페널티에 영향을 주는 콘텐츠가 바뀔 때
   *
   * ── 올리지 않는 변경 ─────────────────────────────────────────
   *   · 코스 이름·설명 문구
   *   · 지도 색이나 단순화 비율
   *   · 권역 분류
   */
  version: number;
  /** 이 코스가 무엇을 따라 걷는지 — 선택 화면에 노출된다 */
  description: string;
  /** 지도를 만들 원본. 없으면 지도 없이 이름만으로 플레이한다. */
  geo?: CourseGeoSource;
  /**
   * 순서가 이 게임의 전부다. 가나다순이 아니라 지리적으로 인접한 지역을 잇는
   * 경로여야 한다. 지하철 노선이 재미있는 이유와 같다.
   */
  regions: Region[];
}
