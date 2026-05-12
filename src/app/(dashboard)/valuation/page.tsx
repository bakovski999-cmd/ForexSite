import { PageIntro } from "@/components/page-intro";
import { StockValuationPanel } from "@/components/stock-valuation-panel";

export default function ValuationPage() {
  return (
    <div className="space-y-6">
      <PageIntro
        kicker="Stock valuation"
        title="Справедлива цена"
        lead="DCF, EV/EBITDA, P/E и DCF Multiple модели с editable assumptions, source badges и запазени анализи."
      />
      <StockValuationPanel />
    </div>
  );
}
