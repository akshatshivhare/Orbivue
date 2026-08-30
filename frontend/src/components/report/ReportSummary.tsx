import type { SummaryCard } from "./reportUtils";

type ReportSummaryProps = {
  cards: SummaryCard[];
};

export function ReportSummary({ cards }: ReportSummaryProps) {
  return (
    <section className="analysis-report-summary" aria-label="Report summary statistics">
      {cards.map((card) => (
        <article className="analysis-report-stat" key={card.label}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          {card.note && <small>{card.note}</small>}
        </article>
      ))}
    </section>
  );
}
