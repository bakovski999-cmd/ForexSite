import { PageIntro } from "@/components/page-intro";
import { RiskCalculator } from "@/components/risk-calculator";

export default function RiskCalculatorPage() {
  return (
    <div className="space-y-6">
      <PageIntro
        kicker="Риск калкулатор"
        title="Провери liquidation цената, частичните продажби и средната цена."
        lead="Въведи сумата, ливъриджа, входната цена, броя акции и целевата продажна цена. След това можеш да сметнеш продажби на части, осредняване при натрупване и общия резултат при избрана изходна цена."
      />

      <RiskCalculator />
    </div>
  );
}
