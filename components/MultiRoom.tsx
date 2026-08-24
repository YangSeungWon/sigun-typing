"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { COURSES, getCourse } from "@/data/courses";
import { COURSE_PICKER_GROUPS } from "@/lib/courses/picker";
import { useRoom } from "@/lib/multiplayer/useRoom";
import { useCourseGeo } from "@/lib/useCourseGeo";
import { useHideFooter } from "@/lib/useImmersive";
import { getSavedNickname, saveNickname } from "@/lib/score/client";
import { track } from "@/lib/analytics/track";
import { MultiRace } from "./MultiRace";
import { Standings } from "./Standings";

interface MultiRoomProps {
  /** 링크로 들어온 방 코드 */
  initialCode?: string;
}

export function MultiRoom({ initialCode }: MultiRoomProps) {
  const {
    connected,
    room,
    raceStart,
    error,
    selfId,
    create,
    join,
    leave,
    setReady,
    setRules,
    start,
    nominate,
    next,
    sendProgress,
    sendFinish,
    sendGiveUp,
  } = useRoom();

  /*
   * 실제로 출발했다. **이게 성사 여부다.**
   *
   * 방마다 판마다 한 번만 세야 하는데, 방에 있는 모두가 같은 순간에 이 코드를
   * 지난다. 그래서 이벤트 id를 방·판으로 짓는다 — 서버가 event_id가 겹치면
   * 버리므로 여덟 명이 보내도 한 건으로 남는다. 방장 한 사람에게 맡기면
   * 그 사람의 전송이 유실될 때 판 하나가 통째로 안 세어진다.
   *
   * total에 그때 붙어 있던 사람 수를 싣는다. 1이면 혼자 달린 것이고, 그게
   * 잦으면 부를 사람이 없다는 뜻이다.
   */
  const startSent = useRef<string | null>(null);
  useEffect(() => {
    if (!room || room.status !== "counting") return;
    const key = `${room.id}-${room.round}`;
    // 방 상태는 타건마다 날아온다. 한 판에 한 번만 센다.
    if (startSent.current === key) return;
    startSent.current = key;
    track({
      name: "versus_start",
      id: `versus-${key}`,
      courseId: room.courseId,
      mode: "multi",
      total: room.players.filter((p) => p.connected).length,
    });
  }, [room]);

  /*
   * 대결 화면에 도달했다.
   *
   * 여기서부터 세지 않으면 대결이 안 쓰이는 이유를 영영 못 가른다 — 아무도
   * 안 왔는지, 왔는데 혼자였는지가 갈리지 않는다.
   */
  useEffect(() => {
    track({ name: "versus_view" });
  }, []);

  const nameRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const [courseId, setCourseId] = useState(COURSES[0].id);
  const [busy, setBusy] = useState(false);
  /**
   * 방을 만들 것인가, 남의 방에 들어갈 것인가.
   *
   * 한 화면에 이름·코스 열일곱 개·방 코드가 함께 있었다. 정보량 자체는 많지
   * 않지만 사람은 실제로 **둘 중 하나만** 한다 — 카톡으로 코드를 받은 사람에게
   * 코스 목록은 통째로 남의 일이다. 먼저 갈래를 고르게 하면 그 뒤에 보이는
   * 것은 자기 일뿐이다.
   */
  const [tab, setTab] = useState<"create" | "join">("create");
  // 대기실에 있는 동안 지도를 받아 둔다. 출발 신호를 받고 부르면
  // 첫 문제에서만 지도가 비는데, 회상 게임에서는 문제가 안 보이는 것과 같다.
  const geo = useCourseGeo(room?.courseId);
  /*
   * 방에 들어간 순간부터 푸터를 걷는다. 방 코드를 부르는 화면 아래에
   * 행정구역 데이터 출처가 붙어 있을 이유가 없다. 방을 고르는 첫 화면은
   * 여느 화면과 같으므로 그대로 둔다 — 조건이 `room`인 이유다.
   *
   * 경주 중에는 useImmersive가 어차피 다 걷는다. 겹쳐도 하는 일이 같아
   * 문제가 없고, 표시를 따로 두었으므로 경주가 끝나 immersive가 풀려도
   * 이쪽은 방에 남아 있는 동안 유지된다.
   */
  useHideFooter(Boolean(room));

  // 저장해 둔 이름은 ref로 직접 넣는다. 상태로 들면 서버 렌더 결과와 달라
  // 하이드레이션이 어긋난다.
  const attachName = useCallback((el: HTMLInputElement | null) => {
    nameRef.current = el;
    if (el && !el.value) el.value = getSavedNickname();
  }, []);

  const attachCode = useCallback(
    (el: HTMLInputElement | null) => {
      codeRef.current = el;
      if (el && !el.value && initialCode) el.value = initialCode.toUpperCase();
    },
    [initialCode],
  );

  const nickname = () => {
    const name = (nameRef.current?.value ?? "").trim() || "익명";
    saveNickname(name);
    return name;
  };

  const doCreate = async () => {
    setBusy(true);
    const ok = await create(courseId, nickname());
    // 만들려다 실패한 것과 만든 것은 다른 일이다. 성공한 것만 센다.
    if (ok) track({ name: "versus_create", courseId, mode: "multi" });
    setBusy(false);
  };

  /** 코드를 받았거나 링크를 눌러서 남의 방으로. 어느 쪽이든 부름을 받은 사람이다. */
  const enter = async (code: string) => {
    setBusy(true);
    const ok = await join(code.trim().toUpperCase(), nickname());
    if (ok) track({ name: "versus_join", mode: "multi" });
    setBusy(false);
  };

  const doJoinCode = (code: string) => enter(code);

  const doJoin = async () => {
    const code = (codeRef.current?.value ?? "").trim();
    if (!code) return;
    await enter(code);
  };

  // ── 초대 링크로 들어온 사람 ───────────────────────────────────
  if (!room && initialCode) {
    /*
     * 방 코드를 받아쓰게 하지 않는다. 카톡에서 링크를 누른 사람에게 필요한
     * 것은 이름 하나뿐이고, 그 앞에 코스 목록과 방 만들기 상자를 늘어놓으면
     * 자기가 뭘 하러 왔는지 잊는다.
     */
    return (
      <div className="flex w-full max-w-sm flex-col gap-6">
        <header className="flex flex-col gap-2 text-center">
          <span className="text-sm font-medium text-dim">
            초대받았습니다
          </span>
          <span className="font-mono text-4xl font-semibold tracking-[0.2em]">
            {initialCode.toUpperCase()}
          </span>
        </header>

        <input
          ref={attachName}
          maxLength={12}
          placeholder="이름"
          aria-label="이름"
          autoFocus
          onKeyDown={(e) => e.key === "Enter" && doJoinCode(initialCode)}
          className="rounded-lg border border-edge bg-paint px-4 py-3 text-center text-lg text-ink placeholder:text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        />
        <button
          type="button"
          onClick={() => doJoinCode(initialCode)}
          disabled={!connected || busy}
          className="rounded-lg bg-sign px-5 py-4 text-lg font-medium text-on-sign transition-colors hover:bg-sign-deep disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          들어가기
        </button>
        <p className="text-center font-mono text-sm text-dim" role="status" aria-live="polite">
          {error ?? (connected ? "" : "서버에 연결하는 중…")}
        </p>
        <Link href="/rooms" className="text-center text-sm text-dim underline underline-offset-4">
          직접 방 만들기
        </Link>
      </div>
    );
  }

  // ── 아직 방에 들어가기 전 ─────────────────────────────────────
  if (!room) {
    return (
      <div className="flex w-full max-w-md flex-col gap-8">
        {/*
          제목이 없었다. 다른 화면은 다 갖고 있고, 탭 바로 들어온 사람에게는
          여기가 어디인지 말해 주는 것이 이 한 줄뿐이다.
        */}
        <h1 className="text-4xl font-bold tracking-tight">친구와 대결</h1>

        <section className="flex flex-col gap-3">
          <label htmlFor="nickname" className="text-sm font-medium text-dim">
            이름
          </label>
          <input
            id="nickname"
            ref={attachName}
            maxLength={12}
            placeholder="이름"
            className="rounded-lg border border-edge bg-paint px-4 py-3 text-ink placeholder:text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          />
        </section>

        {/* 갈래를 먼저 고른다. 고른 쪽만 아래에 펼쳐진다. */}
        <div className="flex gap-2">
          {(
            [
              ["create", "방 만들기"],
              ["join", "코드로 참가"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-pressed={tab === id}
              className={`flex-1 rounded-lg px-4 py-3 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                tab === id
                  ? "bg-sign text-on-sign"
                  : "border border-edge text-ink hover:bg-concrete-deep"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "create" ? (
        <section className="flex flex-col gap-3 rounded-xl border border-edge bg-paint p-6">
          <label htmlFor="course" className="text-sm font-medium text-dim">
            코스
          </label>
          {/*
            칩 열일곱 개였다. 코스를 고르는 것이 이 화면의 전부일 때는 그게
            맞았는데, 위에 이름 칸과 갈래 버튼이 생기면서 칩들이 열한 줄을
            차지하고 **정작 `대결방 만들기` 버튼을 화면 밖으로 밀어냈다.**
            휴대폰에서는 아래 탭 바 뒤에 숨어서 아예 보이지 않았다.

            목록으로 충분하다. 브라우저 기본 select를 쓰는 이유: 휴대폰에서
            운영체제 선택기가 뜨는 것이 직접 만든 어떤 것보다 낫고, 키보드와
            스크린리더도 공짜로 따라온다.

            시도별로 묶는다 — 읍면동이 들어오며 270개가 됐고, `중구 9개 동`이
            부산인지 대구인지는 이름만 봐서 알 수 없다.
          */}
          <select
            id="course"
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="rounded-lg border border-edge bg-paint px-4 py-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            {COURSE_PICKER_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <button
            type="button"
            onClick={doCreate}
            disabled={!connected || busy}
            className="rounded-lg bg-sign px-5 py-3 font-medium text-on-sign transition-colors hover:bg-sign-deep disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
          >
            대결방 만들기
          </button>
        </section>
        ) : (
        <section className="flex flex-col gap-3 rounded-xl border border-edge p-6">
          <h2 className="text-sm font-medium text-dim">
            받은 방 코드를 넣으세요
          </h2>
          <div className="flex gap-2">
            <input
              ref={attachCode}
              maxLength={6}
              placeholder="ABC123"
              aria-label="방 코드"
              onKeyDown={(e) => e.key === "Enter" && doJoin()}
              className="w-40 rounded-lg border border-edge bg-paint px-4 py-3 font-mono tracking-[0.2em] text-ink uppercase placeholder:text-dim focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            />
            <button
              type="button"
              onClick={doJoin}
              disabled={!connected || busy}
              className="flex-1 rounded-lg border border-edge px-5 py-3 font-medium text-ink transition-colors hover:bg-concrete-deep disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              들어가기
            </button>
          </div>
        </section>
        )}

        <p className="font-mono text-sm text-dim" role="status" aria-live="polite">
          {error ?? (connected ? "서버에 연결되었습니다" : "서버에 연결하는 중…")}
        </p>
      </div>
    );
  }

  const course = getCourse(room.courseId);
  const isHost = room.hostId === selfId;
  const me = room.players.find((p) => p.id === selfId);

  /*
   * ── 세는 중 / 경주 중 / 끝난 뒤 ───────────────────────────────
   *
   * **세는 동안에도 경주 화면을 띄운다.** 대기실에 머물다가 출발 신호에 화면이
   * 바뀌면 휴대폰에서는 그 순간 자판이 없다 — 자판은 사람이 화면을 눌러야
   * 올라오는데, 그동안 남들은 이미 달린다. 판을 미리 깔아 두면 세는 3초 안에
   * 한 번 누르는 것으로 준비가 끝난다.
   */
  if (
    room.status === "counting" ||
    room.status === "racing" ||
    room.status === "finished"
  ) {
    if (!course) return null;
    return (
      <div className="flex w-full max-w-xl flex-col gap-6">
        <RoomHeader
          code={room.id}
          courseName={course.name}
          round={room.round}
          onLeave={leave}
        />
        <MultiRace
          course={course}
          geo={geo}
          room={room}
          raceStart={raceStart}
          selfId={selfId}
          onProgress={sendProgress}
          onFinish={sendFinish}
          onGiveUp={sendGiveUp}
        />
        {room.status === "finished" && (
          <NextRound
            picks={room.picks}
            myPick={room.players.find((p) => p.id === selfId)?.pick ?? null}
            isHost={isHost}
            onNominate={nominate}
            onNext={next}
          />
        )}
      </div>
    );
  }

  // ── 대기실 ────────────────────────────────────────────────────
  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <RoomHeader
        code={room.id}
        courseName={course?.name ?? room.courseId}
        round={room.round}
        onLeave={leave}
      />

      <InviteLink code={room.id} courseName={course?.name ?? room.courseId} />

      <Standings
        players={room.players}
        total={room.total}
        selfId={selfId}
        hostId={room.hostId}
        showReady
      />

      {/*
        이 판의 규칙.

        방장이 정하지만 **모두가 본다.** 무슨 규칙으로 겨루는지 모르고 달리게
        하면 안 된다. 방장 아닌 사람에게는 켜짐·꺼짐만 보이고 눌리지 않는다.
      */}
      <RoomRules rules={room.rules} isHost={isHost} onChange={setRules} />

      {room.status === "waiting" && (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setReady(!me?.ready)}
            className={`flex-1 rounded-lg px-5 py-3 font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
              me?.ready
                ? "border border-edge text-ink hover:bg-concrete-deep"
                : "bg-expressway text-on-sign hover:brightness-110"
            }`}
          >
            {me?.ready ? "준비 취소" : "준비"}
          </button>
          {isHost && (
            <button
              type="button"
              onClick={start}
              className="flex-1 rounded-lg bg-sign px-5 py-3 font-medium text-on-sign transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
            >
              출발
            </button>
          )}
        </div>
      )}

      <p className="font-mono text-sm text-dim" role="status" aria-live="polite">
        {error ?? (isHost ? "전원이 준비하면 출발할 수 있습니다" : "방장이 출발시킬 때까지 기다립니다")}
      </p>
    </div>
  );
}

/** 이 판의 규칙. 방장은 누를 수 있고 나머지는 읽는다. */
function RoomRules({
  rules,
  isHost,
  onChange,
}: {
  rules: { hint: boolean; skip: boolean };
  isHost: boolean;
  onChange: (r: { hint?: boolean; skip?: boolean }) => void;
}) {
  const rows = [
    {
      key: "hint" as const,
      name: "초성 힌트",
      /* 값을 안 물린다. 경주에서는 힌트를 여는 동안 상대가 달리는 것이 이미 값이다. */
      note: "Tab을 누르면 초성이 보입니다",
      on: rules.hint,
    },
    {
      key: "skip" as const,
      name: "모르겠으면 넘기기",
      note: "넘긴 곳은 맞힌 것으로 안 셉니다",
      on: rules.skip,
    },
  ];

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-edge p-4">
      <h2 className="text-sm font-medium text-dim">이 판의 규칙</h2>
      <ul className="flex flex-col gap-1">
        {rows.map((r) => (
          <li key={r.key} className="flex items-baseline justify-between gap-3">
            <span className="flex flex-col">
              <span className="text-base">{r.name}</span>
              <span className="text-xs text-dim">{r.note}</span>
            </span>
            {isHost ? (
              <button
                type="button"
                onClick={() => onChange({ [r.key]: !r.on })}
                aria-pressed={r.on}
                className={`shrink-0 rounded-lg border px-3 py-1.5 font-mono text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                  r.on
                    ? "border-sign bg-sign/15 text-ink"
                    : "border-edge text-dim hover:bg-concrete-deep"
                }`}
              >
                {r.on ? "켜짐" : "꺼짐"}
              </button>
            ) : (
              <span className={`shrink-0 font-mono text-sm ${r.on ? "text-sign-deep" : "text-dim"}`}>
                {r.on ? "켜짐" : "꺼짐"}
              </span>
            )}
          </li>
        ))}
      </ul>
      {/* 달리는 중에 규칙이 바뀌면 먼저 지나간 사람과 나중 사람이 다른 게임을 한 것이 된다. */}
      {isHost && <p className="text-xs text-dim">출발하면 바꿀 수 없습니다</p>}
    </section>
  );
}

/**
 * 다음 판.
 *
 * 한 판이 끝나면 방이 그대로 남는다. 코드를 다시 부르고 링크를 다시 보내야
 * 한다면, 그건 친구들과 한 판 더 하는 자리가 아니라 매번 처음부터 모이는
 * 자리다.
 *
 * 고르는 것은 방장이되 **모두가 하고 싶은 곳을 말할 수 있다.** 표가 결정을
 * 대신하면 여덟 명이 다 고를 때까지 아무도 시작을 못 하고, 한 명이 안 고르면
 * 방이 멈춘다. 여기서 표가 하는 일은 방장에게 무엇을 하고 싶은지 알려 주는
 * 것이다.
 */
function NextRound({
  picks,
  myPick,
  isHost,
  onNominate,
  onNext,
}: {
  picks: { courseId: string; votes: number }[];
  myPick: string | null;
  isHost: boolean;
  onNominate: (courseId: string | null) => void;
  onNext: (courseId?: string) => void;
}) {
  /* 방장이 그냥 누르면 표가 가장 많은 곳으로 간다. 그게 없으면 서버가 방금 한 코스를 다시 연다. */
  const leading = picks[0]?.courseId;

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-edge p-5">
      <h2 className="text-sm font-medium text-dim">다음 판</h2>

      <label className="sr-only" htmlFor="next-course">
        하고 싶은 코스
      </label>
      <select
        id="next-course"
        value={myPick ?? ""}
        onChange={(e) => onNominate(e.target.value || null)}
        className="rounded-lg border border-edge bg-paint px-4 py-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <option value="">하고 싶은 코스 고르기</option>
        {COURSE_PICKER_GROUPS.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {/*
        표는 이름과 수만 적는다. 막대나 비율로 그리면 투표처럼 보이는데,
        정하는 것은 방장이라 그 그림이 거짓말이 된다.
      */}
      {picks.length > 0 && (
        <ul className="flex flex-col gap-1 text-sm">
          {picks.map((p) => (
            <li key={p.courseId} className="flex items-baseline justify-between gap-3">
              <span className={p.courseId === myPick ? "font-medium" : "text-dim"}>
                {getCourse(p.courseId)?.name ?? p.courseId}
              </span>
              <span className="font-mono tabular-nums text-dim">{p.votes}표</span>
            </li>
          ))}
        </ul>
      )}

      {isHost ? (
        <button
          type="button"
          onClick={() => onNext(leading)}
          className="rounded-lg bg-sign px-5 py-3 font-medium text-on-sign transition-colors hover:bg-sign-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
        >
          {leading ? `${getCourse(leading)?.name ?? leading} 한 판 더` : "같은 코스 한 판 더"}
        </button>
      ) : (
        <p className="text-sm text-dim">방장이 다음 판을 열면 대기실로 돌아갑니다</p>
      )}
    </section>
  );
}

/**
 * 방 윗줄. 나가는 문과 방 코드, 그리고 몇 판째 무슨 코스인지.
 *
 * 나가는 문이 `← 시군 타이핑`이었다. 누르면 실제로 방에서 빠지긴 했다 —
 * 화면이 바뀌면서 소켓이 끊기니까. 다만 그렇게 읽히지 않았다. 홈으로 가는
 * 링크의 생김새를 하고 있었고 목적지도 홈이었다.
 *
 * 링크가 아니라 단추다. 주소를 옮기는 일이 아니라 방에서 빠지는 일이고, 둘은
 * 눌렀을 때 일어나는 일이 다르다. 나가면 대결 첫 화면에 그대로 선다.
 */
function RoomHeader({
  code,
  courseName,
  round,
  onLeave,
}: {
  code: string;
  courseName: string;
  round: number;
  onLeave: () => void;
}) {
  return (
    <header className="flex flex-col gap-2">
      {/*
        판이 도는 중이라고 가리거나 다시 묻지 않는다. 지금까지도 이 자리를
        누르면 아무것도 안 묻고 방에서 빠졌고, 이번에 바꾸는 것은 그 동작이
        아니라 이름과 목적지다. 판 도중에 그만두는 문은 판 안에 따로 있다 —
        `여기까지 하기`는 방에 남는다.
      */}
      <button
        type="button"
        onClick={onLeave}
        className="group inline-flex w-fit items-center gap-2 font-sans text-base font-medium text-ink/70 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        <span
          aria-hidden="true"
          className="transition-transform duration-150 group-hover:-translate-x-0.5"
        >
          ←
        </span>
        나가기
      </button>
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-mono text-3xl font-semibold tracking-[0.2em]">
          {code}
        </span>
        <span className="flex items-baseline gap-2.5 text-sm text-dim">
          {/* 첫 판에는 안 적는다. `1판째`는 아무 말도 아니다. */}
          {round > 1 && <span className="font-mono tabular-nums">{round}판째</span>}
          <span>{courseName}</span>
        </span>
      </div>
    </header>
  );
}

/**
 * 초대 링크.
 *
 * 코드를 불러 주는 것과 링크를 보내는 것은 마찰이 다르다. 여섯 자리를
 * 받아쓰게 하면 단톡방에서 오타가 나고, 오타가 나면 그 사람은 안 들어온다.
 * 링크를 누른 사람은 이름만 넣고 바로 방에 들어간다.
 */
function InviteLink({ code, courseName }: { code: string; courseName: string }) {
  const [copied, setCopied] = useState(false);

  /*
   * 문구에 코스를 싣는다.
   *
   * 여태 `같이 한 판 하자` 한 줄이라, 무슨 판인지가 링크 안에만 있었다. 단톡방에
   * 붙은 주소를 눌러 봐야 아는 것과 붙은 자리에서 읽히는 것은 다르다.
   *
   * 카드로 하지 않는 이유는 페이지 쪽에 적어 두었다. 문구는 카카오톡이든
   * 디스코드든 문자든 어디서나 같게 나가고, 캐시되어 굳지도 않는다.
   */
  const text = `시군 타이핑\n${courseName}\n\n같이 한 판?`;

  const copy = async () => {
    // 주소는 누를 때 만든다. 렌더 중에 window를 읽으면 서버 렌더와 어긋난다.
    const url = `${window.location.origin}/rooms?code=${code}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "시군 타이핑", text, url });
        return;
      } catch {
        return;
      }
    }
    try {
      // 시트가 없는 곳에서는 문구와 주소를 함께 넘긴다. 주소만 가면 아까 그
      // 한 줄로 되돌아가는 셈이다.
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // 클립보드가 막힌 환경. 위에 적힌 방 코드를 불러 주는 수밖에 없다.
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={copy}
        className="rounded-lg border border-sign bg-sign/10 px-5 py-3 font-medium text-ink transition-colors hover:bg-sign/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
      >
        {copied ? "복사했습니다 — 단톡방에 붙여 넣으세요" : "친구 초대 링크 복사"}
      </button>
      {/* `이름만 넣으면 들어옵니다`는 눌러 보면 아는 것이다. 남길 값은 정원뿐이다. */}
      <p className="font-mono text-sm text-dim">최대 8명</p>
    </div>
  );
}

/**
 * 남은 시간 표시. 실제 출발은 서버가 status를 racing으로 바꾸는 순간이고
 * 이 숫자는 보여 주기용이다 — 클라이언트 시계가 어긋나도 출발은 어긋나지 않는다.
 */
