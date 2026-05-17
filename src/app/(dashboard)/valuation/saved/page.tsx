import { PageIntro } from "@/components/page-intro";
import { SavedValuationsPanel } from "@/features/valuation/saved-valuations-panel";

export default function SavedValuationsPage() {
  return (
    <div className="space-y-6">
      <PageIntro
        kicker="Stock valuation"
        title="Запазени анализи"
        lead="Следи fair value спрямо текущата цена и отвори всеки анализ за редакция."
      />
      <SavedValuationsPanel />
    </div>
  );
}
