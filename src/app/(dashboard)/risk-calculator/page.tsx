import { PageIntro } from "@/components/page-intro";
import { RiskCalculator } from "@/components/risk-calculator";

export default function RiskCalculatorPage() {
  return (
    <div className="space-y-6">
      <PageIntro
        kicker="Риск калкулатор"
        title="Провери liquidation цената и планираната печалба."
        lead="Въведи сумата, ливъриджа, входната цена, броя акции и целевата продажна цена. Калкулаторът показва колко маржин изисква позицията, къде се изчерпва зададеният риск и какъв е очакваният резултат."
      />

      <RiskCalculator />
    </div>
  );
}
