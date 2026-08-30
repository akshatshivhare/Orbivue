import type { ChartDatum } from "./reportUtils";

type ReportChartsProps = {
  title: string;
  data: ChartDatum[];
};

export function ReportCharts({ title, data }: ReportChartsProps) {
  const maxValue = Math.max(...data.map((item) => item.value), 0);

  return (
    <section className="analysis-report-section">
      <div className="analysis-report-section-heading">
        <h3>{title}</h3>
        <span>Deterministic counts</span>
      </div>

      {data.length === 0 || maxValue === 0 ? (
        <p className="analysis-report-empty">Insufficient structured data for quantitative visualization.</p>
      ) : (
        <div className="analysis-report-bars" role="img" aria-label={`${title} bar chart`}>
          {data.map((item) => {
            const width = `${Math.max(8, (item.value / maxValue) * 100)}%`;

            return (
              <div className="analysis-report-bar-row" key={item.label}>
                <div className="analysis-report-bar-label">
                  <span>{item.label}</span>
                  <strong>{item.value}</strong>
                </div>
                <div className="analysis-report-bar-track">
                  <span className="analysis-report-bar-fill" style={{ width }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
