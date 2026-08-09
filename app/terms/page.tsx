import { LegalDoc, List, Section } from "@/components/LegalDoc";
import { DATA_VINTAGE, VINTAGE_LABEL } from "@/data/vintage";

export const metadata = {
  title: "이용약관 — 시군 타이핑",
  description: "시군 타이핑 이용 조건.",
};

export default function TermsPage() {
  return (
    <LegalDoc title="이용약관" effectiveDate="2026-08-06">
      <Section title="1. 서비스">
        <p>
          시군 타이핑은 대한민국 행정구역 이름을 입력하며 즐기는 웹 게임입니다.
          누구나 회원가입 없이 무료로 이용할 수 있습니다.
        </p>
      </Section>

      <Section title="2. 기록과 닉네임">
        <List
          items={[
            "랭킹에 올린 기록과 닉네임은 다른 이용자에게 공개됩니다.",
            "닉네임에 개인정보나 타인을 사칭·비방하는 표현을 쓰지 말아 주세요.",
            "부적절한 닉네임이나 부정하게 만들어진 기록은 예고 없이 삭제할 수 있습니다.",
          ]}
        />
      </Section>

      <Section title="3. 하지 말아야 할 것">
        <List
          items={[
            "매크로·자동 입력 등 사람이 직접 치지 않은 방법으로 기록을 만드는 행위",
            "기록 자료를 조작해 제출하는 행위",
            "서비스에 과도한 부하를 주거나 정상적인 운영을 방해하는 행위",
          ]}
        />
        <p>
          기록은 서버에서 다시 계산해 검증하며, 사람의 입력으로 보기 어려운 기록은
          등록을 거부하거나 삭제할 수 있습니다.
        </p>
      </Section>

      <Section title="4. 행정구역 자료에 대하여">
        <p>
          이 게임의 지역 데이터는 <strong>{VINTAGE_LABEL}</strong>이며,{" "}
          {DATA_VINTAGE.boundarySource} 자료를 바탕으로 합니다. 이후 개편된 지역은 반영되어 있지
          않을 수 있습니다.
        </p>
        <p>
          따라서 이 게임의 내용을 행정·법률·학술 등 정확성이 요구되는 용도의 근거로
          사용하지 마시기 바랍니다. 공식 정보는 행정안전부와 통계청 등 소관 기관의
          자료를 확인해 주세요.
        </p>
      </Section>

      <Section title="5. 서비스 변경과 중단">
        <p>
          서비스 내용은 예고 없이 변경될 수 있으며, 운영상 필요에 따라 일시
          중단되거나 종료될 수 있습니다. 채점 규칙이 바뀌는 경우 이전 기록과 새 기록은
          서로 다른 순위표로 구분해 표시합니다.
        </p>
      </Section>

      <Section title="6. 책임의 한계">
        <p>
          이 서비스는 있는 그대로 제공됩니다. 무료로 제공되는 게임의 특성상 기록의
          영구 보관이나 무중단 운영을 보장하지 않으며, 이용 중 발생한 손해에 대해
          법령이 정한 범위를 넘어서는 책임을 지지 않습니다.
        </p>
      </Section>

      <Section title="7. 저작권">
        <p>
          게임의 화면 구성과 코드에 대한 권리는 운영자 양승원에게 있습니다. 행정구역 경계와
          명칭 자료의 출처는 통계청과 행정표준코드관리시스템이며, 각 자료의 이용
          조건을 따릅니다.
        </p>
      </Section>

      <Section title="8. 준거법과 문의">
        <p>
          이 약관은 대한민국 법률을 따릅니다. 문의는{" "}
          <a
            href="mailto:sw.yang43@gmail.com"
            className="underline decoration-dim underline-offset-4 transition-colors hover:text-sign"
          >
            sw.yang43@gmail.com
          </a>{" "}
          으로 받습니다.
        </p>
      </Section>
    </LegalDoc>
  );
}
