export function PageIntro({
  title,
  lead,
  kicker,
}: {
  title: string;
  lead: string;
  kicker: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-amber-200/80">{kicker}</p>
      <h1 className="mt-3 text-4xl font-semibold text-white sm:text-5xl">{title}</h1>
      <p className="mt-4 text-base leading-7 text-slate-300 sm:text-lg">{lead}</p>
    </div>
  );
}
