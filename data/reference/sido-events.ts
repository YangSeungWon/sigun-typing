/**
 * 시도가 바뀐 **실제 날짜.**
 *
 * 경계 자료에서는 이걸 알 수 없다. SGIS 도형이 1975~2000년에는 5년 단위라,
 * 그 사이 어느 날 일어난 일이 다음 판에 처음 나타날 뿐이다 — 대구·인천직할시는
 * 1981년에 생겼는데 자료에서는 1985년 판에서 처음 보인다. 그대로 두면 화면이
 * "1985년에 대구직할시가 생겼다"고 말하게 된다.
 *
 * 그래서 여기만 **손으로 적는다.** 이 저장소에서 도형에서 유도하지 않고 사람이
 * 적어 넣은 유일한 사실이므로, 틀리면 여기만 고치면 된다.
 *
 * 짝은 `data/reference/boundary-changes.json`의 시도 사건과 `to`(자료에 처음
 * 나타난 해)로 맞춘다.
 */
export interface SidoEvent {
  /** 이 변화가 자료에 처음 나타난 해. boundary-changes.json의 `to`와 같다. */
  seenAt: string;
  /** 실제로 시행된 날. 여럿이면 여럿이다. */
  dates: { on: string; what: string }[];
}

export const SIDO_EVENTS: SidoEvent[] = [
  {
    seenAt: "1985",
    dates: [{ on: "1981-07-01", what: "대구·인천직할시 승격" }],
  },
  {
    seenAt: "1990",
    dates: [
      { on: "1986-11-01", what: "광주직할시 승격" },
      { on: "1989-01-01", what: "대전직할시 승격" },
    ],
  },
  {
    seenAt: "1995",
    dates: [{ on: "1995-01-01", what: "직할시가 광역시로 바뀜" }],
  },
  {
    seenAt: "2000",
    dates: [{ on: "1997-07-15", what: "울산광역시 승격" }],
  },
  {
    seenAt: "2007",
    dates: [{ on: "2006-07-01", what: "제주특별자치도 출범" }],
  },
  {
    seenAt: "2012",
    dates: [{ on: "2012-07-01", what: "세종특별자치시 출범" }],
  },
  {
    seenAt: "2023",
    dates: [{ on: "2023-06-11", what: "강원특별자치도 출범" }],
  },
  {
    seenAt: "2024",
    dates: [{ on: "2024-01-18", what: "전북특별자치도 출범" }],
  },
];

export const SIDO_EVENT_BY_YEAR = new Map(SIDO_EVENTS.map((e) => [e.seenAt, e]));
