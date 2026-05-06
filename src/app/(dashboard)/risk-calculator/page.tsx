import { PageIntro } from "@/components/page-intro";
import { RiskCalculator } from "@/components/risk-calculator";

export default function RiskCalculatorPage() {
  return (
    <div className="space-y-6">
      <PageIntro
        kicker="Риск калкулатор"
        title="Провери broker margin риска, частичните продажби и средната цена."
        lead="Въведи реалния margin от платформата или фиксирания ливъридж за CFD акции. Калкулаторът показва кога позицията може да бъде затворена, какъв е буферът до stop-out и каква е печалбата в двете валути."
      />

      <RiskCalculator />
    </div>
  );
}
