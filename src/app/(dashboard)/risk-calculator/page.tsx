import { PageIntro } from "@/components/page-intro";
import { RiskCalculator } from "@/components/risk-calculator";

export default function RiskCalculatorPage() {
  return (
    <div className="space-y-6">
      <PageIntro
        kicker="Риск калкулатор"
        title="Провери риска по реалните данни от твоя брокер."
        lead="Калкулаторът не е вързан към конкретен брокер. Въведи реалния Margin/Used Margin от платформата, fixed leverage от спецификацията на продукта или account leverage, ако инструментът го следва. Така виждаш кога позицията може да бъде затворена, какъв е буферът до stop-out и каква е печалбата в двете валути."
      />

      <RiskCalculator />
    </div>
  );
}
