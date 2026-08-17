import { COURSES } from "@/data/courses";
import { CONQUEST_LEVELS, type CourseLevel } from "@/data/types";
import { sidoCourse } from "@/data/courses/sido";

/**
 * 서버가 첫 화면에 쥐여 주는 값.
 *
 * 첫 화면의 숫자는 거의 다 이 기기에만 있는 값이라 브라우저에서 센다. 그런데
 * 세려면 코스마다 이름·판번호·지역 수를 알아야 하고, 그걸 알자고 `COURSES`를
 * 클라이언트로 끌고 가면 245개 지역 객체(소스 92KB)가 통째로 따라온다 —
 * 첫 화면이 쓰는 것은 코스당 다섯 값, 다 합쳐 1KB가 안 된다.
 *
 * 그래서 서버가 얇게 깎아 내려보낸다. `components/home/*`가 `@/data/courses`를
 * import하지 않는다는 규칙이 이 파일의 존재 이유이고, 그 규칙은 주석이 아니라
 * 테스트가 지킨다(`lib/home/bundle.test.ts`).
 */
export interface CourseSummary {
  id: string;
  name: string;
  /**
   * 버튼과 한 줄 상태에 쓰는 짧은 이름. `부산 16개 구·군` → `부산`.
   *
   * 정식 이름에는 개수가 들어 있어서(`경기도 31 시군`) 그 옆에 진행도를 적으면
   * 한 줄에 31이 두 번 나온다. 버튼에 넣기에도 길다 — `부산 이어하기`는
   * 읽는 데 반 초지만 `부산 16개 구·군 이어하기`는 아니다.
   */
  shortName: string;
  version: number;
  /** 이 코스에 든 지역 수 */
  total: number;
  /**
   * 이 코스의 지역이 다른 코스에도 있는가(`data/types.ts`의 overlapping).
   * 정복도는 이런 코스를 세지 않는다 — 세면 같은 곳을 두 번 센다.
   */
  overlapping: boolean;
  /**
   * 이 코스가 다루는 행정계층(`data/types.ts`의 CourseLevel).
   *
   * 정복도는 지도를 덮는 두 층(시도·시군구)만 센다. 읍면동은 같은 지도를
   * 더 잘게 나눈 것이라 더하면 같은 땅을 두 번 세는 셈이 된다.
   */
  level: CourseLevel;
  /**
   * 이 코스가 속한 시도 코드.
   *
   * `geo.prefix`가 아니다. 그쪽은 원본 경계 파일의 옛 코드(21~39)라 서울만
   * 우연히 일치하고, 전남은 `"36"`인데 그건 **세종**의 시도 코드다 — 그대로
   * 쓰면 전남 진행률이 세종 자리에 찍힌다.
   *
   * 지역 코드 앞 두 자리가 진짜 시도 코드다. 코스마다 이 값이 하나뿐임은
   * `data/courses/codes.test.ts`가 이미 보장한다.
   */
  sido: string;
}

export interface SidoSummary {
  code: string;
  name: string;
  /** 이 시도의 시군·구 코스. 세종에는 없다. */
  courseId?: string;
  /** 이 시도에서 셀 수 있는 곳의 수. 코스가 없으면 0. */
  total: number;
}

export interface HomeSeed {
  courses: CourseSummary[];
  sido: SidoSummary[];
  /**
   * 245 = 17 시도 + 228 시군·구. 세지 않고 적어 두면 코스가 늘 때 거짓말이 된다.
   *
   * 두 가지가 빠진다.
   *
   * **겹치는 코스.** 전국 시군구 코스를 더하면 473이 되는데, 그 228곳은
   * 이미 시도별 코스로 세고 있는 바로 그 228곳이다.
   *
   * **지도를 덮지 않는 층.** 읍면동은 시군구를 더 잘게 나눈 것이라, 더하면
   * 같은 땅을 두 번 센다. 이 수가 답하는 질문은 "대한민국 지도를 얼마나
   * 채웠나"이지 "얼마나 많이 풀었나"가 아니다.
   */
  totalRegions: number;
}

/** 시도 코드 → 시도 이름. `11` → `서울` */
const SIDO_NAME = new Map(sidoCourse.regions.map((r) => [r.code, r.name]));

function summarize(course: (typeof COURSES)[number]): CourseSummary {
  const sido = course.regions[0].code.slice(0, 2);
  return {
    id: course.id,
    name: course.name,
    /*
     * 시군 코스의 짧은 이름은 그 시도의 이름이다 — 이미 데이터에 있으므로
     * 코스마다 손으로 적어 두지 않는다. 전국 코스만 자기 시도가 없다.
     */
    shortName: course.id === sidoCourse.id ? "전국" : (SIDO_NAME.get(sido) ?? course.name),
    overlapping: course.overlapping ?? false,
    level: course.level,
    version: course.version,
    total: course.regions.length,
    sido,
  };
}

export function buildHomeSeed(): HomeSeed {
  const courses = COURSES.map(summarize);
  /*
   * 시도 → 그 시도의 시군 코스.
   *
   * **시군구 층만 넣는다.** 전에는 "시도 코스가 아니고 겹치지도 않는 것"으로
   * 걸렀는데, 그러면 같은 시도에 다른 층의 코스가 생기는 순간 부딪친다 —
   * 종로구 17개 동은 시도가 `11`이라 서울 25개 구를 덮어쓴다. 무엇을 넣을지는
   * "시도 코스가 아니다"라는 소거법이 아니라 층으로 말해야 한다.
   */
  const byPrefix = new Map(
    courses
      .filter((c) => c.level === "sigungu" && !c.overlapping)
      .map((c) => [c.sido, c]),
  );

  /*
   * 시도 열일곱 줄. 그중 열여섯에만 시군 코스가 붙고 세종은 비어 있다 —
   * 세종은 시도이면서 그 아래 시군이 없다. 빈 줄로 두는 대신 화면에서
   * 걸러 내는데, 그건 `아는 곳 0`과 `셀 것이 없음`이 다른 말이기 때문이다.
   */
  const sido: SidoSummary[] = sidoCourse.regions.map((region) => {
    const course = byPrefix.get(region.code);
    return {
      code: region.code,
      name: region.name,
      ...(course ? { courseId: course.id } : {}),
      total: course?.total ?? 0,
    };
  });


  return {
    courses,
    sido,
    totalRegions: courses
      .filter((c) => !c.overlapping && CONQUEST_LEVELS.includes(c.level))
      .reduce((sum, c) => sum + c.total, 0),
  };
}
