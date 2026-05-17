import { PageIntro } from "@/components/page-intro";
import { StockValuationPanel } from "@/components/stock-valuation-panel";

type ValuationPageProps = {
  searchParams: Promise<{ analysis?: string | string[] }>;
};

export default async function ValuationPage({ searchParams }: ValuationPageProps) {
  const params = await searchParams;
  const analysis = Array.isArray(params.analysis) ? params.analysis[0] : params.analysis;

  return (
    <div className="space-y-6">
      <PageIntro
        kicker="Stock valuation"
        title="Справедлива цена"
        lead="DCF, EV/EBITDA, P/E и DCF Multiple модели с editable assumptions и source badges."
      />
      <StockValuationPanel initialAnalysisId={analysis ?? null} />
    </div>
  );
}
