import type { ReactNode } from "react";

interface LegalDocProps {
  title: string;
  /** 시행일. 문서를 고칠 때마다 함께 올린다. */
  effectiveDate: string;
  children: ReactNode;
}

/** 약관·방침처럼 길게 읽는 문서의 공통 틀. */
export function LegalDoc({ title, effectiveDate, children }: LegalDocProps) {
  return (
    <main id="main" tabIndex={-1} className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-14">
      <header className="flex flex-col gap-3">
        <h1 className="text-4xl font-bold tracking-tight">{title}</h1>
        <p className="font-mono text-xs text-dim">시행일 {effectiveDate}</p>
      </header>

      <div className="flex flex-col gap-8 leading-relaxed">{children}</div>

    </main>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="flex flex-col gap-3 text-ink/90">{children}</div>
    </section>
  );
}

export function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-dim">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
