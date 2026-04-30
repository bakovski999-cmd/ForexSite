import { cn } from "@/lib/utils";

export function SectionCard({
  title,
  eyebrow,
  children,
  className,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[28px] border border-white/10 bg-[#10192d]/88 p-6 shadow-[0_30px_90px_rgba(5,8,20,0.45)] backdrop-blur",
        className,
      )}
    >
      <div className="mb-5 flex items-end justify-between gap-3">
        <div>
          {eyebrow ? (
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-amber-200/75">
              {eyebrow}
            </p>
          ) : null}
          <h2 className="mt-2 text-xl font-semibold text-white">{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}
