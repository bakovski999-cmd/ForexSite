import { NewsIntelBoard } from "@/components/news-intel-board";
import { PageIntro } from "@/components/page-intro";
import { SectionCard } from "@/components/section-card";
import { loadDashboardSnapshot } from "@/lib/data/dashboard";

export default async function NewsPage() {
  const snapshot = await loadDashboardSnapshot();

  return (
    <div className="space-y-6">
      <PageIntro
        kicker="Новини"
        title="Какво означават последните новини за златото."
        lead="Тук всяка новина е минала през кратко аналитично тълкуване на български, с посока, времеви хоризонт и драйверите, през които най-вероятно ще удари пазара."
      />

      <SectionCard title="Новинарска лента и обяснения" eyebrow="Филтриран поток">
        <NewsIntelBoard news={snapshot.news} />
      </SectionCard>
    </div>
  );
}
