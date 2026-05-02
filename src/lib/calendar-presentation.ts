import type {
  CalendarEventType,
  CalendarImpact,
  CalendarRelevance,
  DriverTag,
  EconomicCalendarEvent,
  NewsAnalysis,
  SignalDirection,
} from "@/lib/types";

export const emptyActualLabel = "";
export const unavailableFreeForecastLabel = "Няма безплатен консенсус";

type CalendarValuePanel = {
  key: "latest" | "forecast" | "actual";
  label: string;
  value: string;
  tone: CalendarValueTone;
  hint?: string;
};

type CalendarValueTone = "bullish" | "bearish" | "neutral";
type CalendarImpactStrengthTier = "Ниска" | "Средна" | "Силна" | "Критична";

export type CalendarImpactStrength = {
  score: number;
  tier: CalendarImpactStrengthTier;
  label: string;
  reason: string;
  comparisonNote: string;
};

type CalendarEventDriverDetail = {
  key: DriverTag;
  label: string;
  description: string;
};

export type CalendarEventDetail = {
  meaning: string;
  goldImpact: string;
  example: string;
  releaseAnalysis: string;
  driverDetails: CalendarEventDriverDetail[];
};

export type CalendarDirectionPresentation = {
  direction: SignalDirection;
  label: string;
};

const driverDetailCopy: Record<DriverTag, CalendarEventDriverDetail> = {
  usd: {
    key: "usd",
    label: "USD",
    description: "Златото се котира в долари, затова по-силен USD често прави XAU по-тежък за купувачи извън САЩ.",
  },
  real_yields: {
    key: "real_yields",
    label: "Реални доходности",
    description: "Когато реалните доходности се качват, златото губи част от привлекателността си, защото не носи лихва.",
  },
  nominal_yields: {
    key: "nominal_yields",
    label: "Номинални доходности",
    description: "Движението в държавните облигации влияе на очакванията за лихви и на краткосрочния натиск върху XAU.",
  },
  inflation: {
    key: "inflation",
    label: "Инфлация",
    description: "Инфлацията променя очакванията за Fed и реалната покупателна сила, което е централен канал за златото.",
  },
  fed: {
    key: "fed",
    label: "Fed",
    description: "По-мек Fed обикновено сваля лихвените очаквания, а по-твърд Fed подкрепя доходностите и долара.",
  },
  geopolitics: {
    key: "geopolitics",
    label: "Геополитика",
    description: "Геополитическото напрежение може да вдигне търсенето на защитни активи, включително злато.",
  },
  risk: {
    key: "risk",
    label: "Risk sentiment",
    description: "Когато пазарът търси защита, златото често получава подкрепа; при силен risk-on ефектът може да отслабне.",
  },
  physical_demand: {
    key: "physical_demand",
    label: "Физическо търсене",
    description: "Покупките от централни банки, бижутерският сектор и физическите пазари влияят върху по-дългия баланс.",
  },
  positioning: {
    key: "positioning",
    label: "Позициониране",
    description: "Когато големи участници са силно натрупани в една посока, реакцията след новина може да се ускори.",
  },
  technical: {
    key: "technical",
    label: "Технически режим",
    description: "Новината може да отключи пробив или отхвърляне около важни нива, ако пазарът вече е напрегнат.",
  },
};

const impactStrengthBase: Record<CalendarImpact, number> = {
  high: 38,
  medium: 23,
  low: 8,
};

const relevanceStrengthBonus: Record<CalendarRelevance, number> = {
  direct: 20,
  strong: 12,
  context: 2,
};

const eventTypeStrengthBonus: Record<CalendarEventType, number> = {
  central_bank: 22,
  inflation: 20,
  employment: 18,
  bonds: 18,
  growth: 12,
  business_surveys: 10,
  consumer_surveys: 8,
  housing: 7,
  speeches: 5,
  misc: 3,
};

const driverStrengthBonus: Record<DriverTag, number> = {
  fed: 8,
  real_yields: 8,
  inflation: 7,
  usd: 6,
  nominal_yields: 6,
  risk: 4,
  positioning: 4,
  physical_demand: 3,
  geopolitics: 3,
  technical: 2,
};

const driverReasonLabels: Record<DriverTag, string> = {
  fed: "Fed/лихвени очаквания",
  real_yields: "реални доходности",
  inflation: "инфлация",
  usd: "USD",
  nominal_yields: "номинални доходности",
  risk: "risk sentiment",
  positioning: "позициониране",
  physical_demand: "физическо търсене",
  geopolitics: "геополитически риск",
  technical: "технически режим",
};

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function titleStrengthBonus(event: Pick<EconomicCalendarEvent, "eventType" | "title">) {
  const text = titleToDirectionText(event);
  let bonus = 0;

  if (/(fomc|federal funds|interest rate|rate decision|monetary policy|central bank|ecb|boj|boe)/.test(text)) {
    bonus += 8;
  }

  if (/(core cpi|consumer price index|core pce|personal consumption|non-farm|nonfarm|payroll|nfp)/.test(text)) {
    bonus += 8;
  }

  if (/(employment cost|eci|jobless claims|unemployment claims|jolts|advance gdp|gross domestic product)/.test(text)) {
    bonus += 5;
  }

  if (/(prices|price index|inflation expectations)/.test(text)) {
    bonus += event.eventType === "inflation" || event.eventType === "business_surveys" ? 6 : 3;
  }

  if (/(pmi|ism|business confidence|manufacturing|services)/.test(text)) {
    bonus += 2;
  }

  return bonus;
}

function getStrengthTier(score: number): CalendarImpactStrengthTier {
  if (score >= 90) {
    return "Критична";
  }

  if (score >= 75) {
    return "Силна";
  }

  if (score >= 55) {
    return "Средна";
  }

  return "Ниска";
}

function tierLabel(tier: CalendarImpactStrengthTier) {
  return `${tier} сила`;
}

function joinReasonParts(parts: string[]) {
  if (!parts.length) {
    return "Новината има ограничен директен канал към златото и се чете основно като част от общия макро фон.";
  }

  if (parts.length === 1) {
    return `Новината е важна за златото заради ${parts[0]}.`;
  }

  return `Новината е важна за златото заради ${parts.slice(0, -1).join(", ")} и ${parts.at(-1)}.`;
}

function getComparisonNote(event: Pick<EconomicCalendarEvent, "eventType" | "title" | "impact">) {
  const text = titleToDirectionText(event);

  if (event.eventType === "inflation" && /(prices|price index)/.test(text)) {
    return "Инфлационният компонент често е по-силен от activity PMI, защото директно променя Fed и real-yield очакванията.";
  }

  if (event.eventType === "central_bank") {
    return "Централните банки са сред най-силните XAU събития, защото движат едновременно USD, доходности и очаквания за цената на парите.";
  }

  if (event.eventType === "employment") {
    return "Трудовият пазар е силен XAU драйвер, защото променя вероятността Fed да остане по-твърд или да стане по-мек.";
  }

  if (event.eventType === "business_surveys") {
    return "PMI/ISM активността е важна, но обикновено е по-слаба от CPI, Core PCE, Fed решения и NFP, освен ако surprise-ът не е голям.";
  }

  if (event.eventType === "speeches") {
    return "Речите могат да движат пазара, но без конкретен policy сигнал са по-несигурни от числовите release-и.";
  }

  return event.impact === "high"
    ? "High-impact събитие: пазарът вероятно ще го сравнява с forecast-а и ще търси реакция в USD и доходностите."
    : "Това е по-скоро контекстен сигнал и обикновено тежи по-малко от Fed, инфлация, NFP и доходности.";
}

export function getCalendarImpactStrength(event: EconomicCalendarEvent): CalendarImpactStrength {
  const driverBonus = Math.min(
    event.affectedDrivers.reduce((sum, driver) => sum + (driverStrengthBonus[driver] ?? 0), 0),
    24,
  );
  const currencyBonus = event.currency === "USD" ? 7 : event.currency === "XAU" ? 8 : 0;
  const titleBonus = titleStrengthBonus(event);

  let score =
    impactStrengthBase[event.impact] +
    relevanceStrengthBonus[event.relevance] +
    eventTypeStrengthBonus[event.eventType] +
    driverBonus +
    currencyBonus +
    titleBonus;

  if (event.eventType === "speeches" && !/(fed|fomc|powell|ecb|monetary|policy|rate|central bank)/i.test(event.title)) {
    score = Math.min(score, 54);
  }

  const normalizedScore = clampScore(score);
  const tier = getStrengthTier(normalizedScore);
  const importantDrivers = event.affectedDrivers
    .filter((driver) => ["fed", "real_yields", "inflation", "usd", "nominal_yields", "risk", "positioning"].includes(driver))
    .map((driver) => driverReasonLabels[driver])
    .slice(0, 4);
  const reason = joinReasonParts(importantDrivers);

  return {
    score: normalizedScore,
    tier,
    label: tierLabel(tier),
    reason,
    comparisonNote: getComparisonNote(event),
  };
}

export function isStrongGoldCalendarEvent(
  event: Pick<EconomicCalendarEvent, "impact" | "relevance">,
) {
  return event.impact === "high" && isHighGoldRelevance(event.relevance);
}

function isHighGoldRelevance(relevance: CalendarRelevance) {
  return relevance === "direct" || relevance === "strong";
}

export function isStrongGoldNews(
  analysis: Pick<NewsAnalysis, "confidence" | "directionalScore" | "impactDirection">,
) {
  return (
    analysis.impactDirection !== "neutral" &&
    analysis.impactDirection !== "mixed" &&
    analysis.confidence >= 0.6 &&
    Math.abs(analysis.directionalScore) >= 0.45
  );
}

export function getGoldNewsImpactScore(
  analysis: Pick<NewsAnalysis, "confidence" | "directionalScore" | "impactDirection">,
) {
  if (analysis.impactDirection === "neutral" || analysis.impactDirection === "mixed") {
    return 0;
  }

  return Math.abs(analysis.directionalScore) * analysis.confidence;
}

export function getCalendarDirectionPresentation(
  event: Pick<
    EconomicCalendarEvent,
    "actual" | "actualSource" | "actualStatus" | "eventType" | "expectedGoldImpact" | "forecast" | "title"
  >,
): CalendarDirectionPresentation {
  if (!event.actual) {
    return {
      direction: event.expectedGoldImpact,
      label: "Зависи от резултата",
    };
  }

  if (isToneBasedFedEvent(event)) {
    return {
      direction: "mixed",
      label: "Тонът е решаващ",
    };
  }

  if (isPublishedReleasePackage(event)) {
    return {
      direction: "mixed",
      label: "Пакет от данни",
    };
  }

  const actual = parseComparableValue(event.actual);
  const forecast = parseComparableValue(event.forecast);

  if (actual !== null && forecast !== null && actual === forecast) {
    return {
      direction: "neutral",
      label: "В рамките на очакването",
    };
  }

  if (event.expectedGoldImpact === "bullish") {
    return {
      direction: "bullish",
      label: "Подкрепя златото",
    };
  }

  if (event.expectedGoldImpact === "bearish") {
    return {
      direction: "bearish",
      label: "Натиск за златото",
    };
  }

  if (event.expectedGoldImpact === "neutral") {
    return {
      direction: "neutral",
      label: "Неутрално",
    };
  }

  return {
    direction: "mixed",
    label: event.actualStatus === "published" ? "Смесен прочит" : "Зависи от резултата",
  };
}

export function getCalendarValuePanels(event: EconomicCalendarEvent): CalendarValuePanel[] {
  const forecastValue =
    event.forecast ??
    (event.forecastStatus === "unavailable_free" ? emptyActualLabel : "-");
  const actualValue = event.actual ?? emptyActualLabel;
  const latestValue = event.actual && event.previous
    ? event.previous
    : event.latestActual ?? event.previous ?? "-";

  return [
    {
      key: "latest",
      label: "Последна",
      value: latestValue,
      tone: getComparableValueTone(event, latestValue, event.forecast),
      hint: event.latestActualPeriod
        ? `Официална стойност за ${event.latestActualPeriod}`
        : "Последна налична стойност",
    },
    {
      key: "forecast",
      label: "Очаквана",
      value: forecastValue,
      tone: "neutral",
      hint: event.forecast
        ? "Консенсус/прогноза"
        : event.forecastStatus === "unavailable_free"
          ? unavailableFreeForecastLabel
          : "Без forecast",
    },
    {
      key: "actual",
      label: "Нов факт",
      value: actualValue,
      tone: event.actual ? getComparableValueTone(event, event.actual, event.forecast) : "neutral",
      hint: event.actual
        ? `Публикувана стойност${event.actualSource ? ` от ${event.actualSource}` : ""}`
        : event.actualStatus === "source_pending"
          ? "Release часът е минал; сайтът проверява наличните надеждни източници"
          : "Ще се обнови при release",
    },
  ];
}

export function getCalendarEventDetail(event: EconomicCalendarEvent): CalendarEventDetail {
  const valueContext = getValueContext(event);
  const releaseAnalysis = getReleaseAnalysis(event);

  if (event.eventType === "central_bank") {
    return {
      meaning:
        "Това е събитие за централна банка или лихвена политика. Пазарът следи не само самото решение, а и тона: дали Fed звучи по-меко, по-твърдо или оставя вратата отворена за по-дълго високи лихви.",
      goldImpact:
        "За златото основният канал е през реални доходности, USD и очакванията за бъдещите лихви. По-ниски очаквания за лихви обикновено помагат на XAU, а по-високи доходности и по-силен долар често го ограничават.",
      example:
        `Пример: ако Fed запази лихвата, но говори по-меко от очакваното, доларът и доходностите могат да отслабнат и това да подкрепи златото. ${valueContext}`,
      releaseAnalysis,
      driverDetails: getDriverDetails(event),
    };
  }

  if (event.eventType === "inflation") {
    return {
      meaning:
        "Това е инфлационна новина. Тя показва дали ценовият натиск се охлажда или остава твърде силен, което веднага променя Fed очакванията за следващите лихвени решения.",
      goldImpact:
        "Златото реагира през real-yield канала: по-мека инфлация може да свали реалните доходности и да помогне на XAU, докато по-гореща инфлация може да върне страх от по-твърд Fed и да натисне златото.",
      example:
        `Пример: ако CPI излезе под очакванията, пазарът може да заложи на по-ранно облекчаване от Fed; това често отслабва USD и подкрепя златото. ${valueContext}`,
      releaseAnalysis,
      driverDetails: getDriverDetails(event),
    };
  }

  if (event.eventType === "employment") {
    return {
      meaning:
        "Това е новина за трудовия пазар. Тя показва колко силна е икономиката и дали Fed има причина да остане твърд, или може да си позволи по-мека политика.",
      goldImpact:
        "При employment данните XAU реагира през USD, доходности и risk sentiment. Много силен трудов пазар често подкрепя долара и доходностите, а слаб трудов пазар може да засили очакванията за по-мек Fed.",
      example:
        `Пример: ако NFP или заетостта излезе по-слаба от прогнозата, доходностите могат да паднат и златото да получи подкрепа. ${valueContext}`,
      releaseAnalysis,
      driverDetails: getDriverDetails(event),
    };
  }

  if (event.eventType === "bonds") {
    return {
      meaning:
        "Това е събитие около облигации, доходности или аукциони. То показва как пазарът оценява цената на парите и търсенето на държавен дълг.",
      goldImpact:
        "Златото е чувствително към доходностите. Ако доходностите се качат, алтернативната цена да държиш XAU се повишава; ако паднат, златото често получава въздух.",
      example:
        `Пример: слаб аукцион или скок в доходностите може да натисне XAU, докато спад в доходностите може да го подкрепи. ${valueContext}`,
      releaseAnalysis,
      driverDetails: getDriverDetails(event),
    };
  }

  if (event.eventType === "growth" || event.eventType === "business_surveys" || event.eventType === "consumer_surveys") {
    return {
      meaning:
        "Това е новина за икономическа активност, доверие или растеж. Тя помага на пазара да прецени дали икономиката се ускорява, охлажда или навлиза в по-рискова фаза.",
      goldImpact:
        "При тези данни златото реагира най-често през USD, номинални доходности и risk sentiment. По-силни данни могат да подкрепят долара, а по-слаби данни могат да засилят търсенето на защита.",
      example:
        `Пример: ако GDP, PMI или доверие излезе много под очакванията, пазарът може да потърси защита и XAU да се подкрепи, особено ако доходностите падат. ${valueContext}`,
      releaseAnalysis,
      driverDetails: getDriverDetails(event),
    };
  }

  return {
    meaning:
      "Това събитие е част от макро фона, който може да промени очакванията за долара, лихвите, риска или търсенето на защитни активи.",
    goldImpact:
      event.explanationBg ||
      "Златото реагира, когато новината промени баланса между USD, доходности, Fed очаквания и risk sentiment.",
    example:
      `Пример: резултат под очакванията често се чете като по-мек макро сигнал, а резултат над очакванията като по-силен макро сигнал. Реакцията зависи от това кой драйвер доминира след публикуването. ${valueContext}`,
    releaseAnalysis,
    driverDetails: getDriverDetails(event),
  };
}

function parseComparableValue(value: string | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(/[$,%KMkBb\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function getComparableValueTone(
  event: Pick<EconomicCalendarEvent, "eventType" | "forecast" | "title">,
  value: string | undefined,
  benchmark: string | undefined,
): CalendarValueTone {
  const actual = parseComparableValue(value);
  const forecast = parseComparableValue(benchmark);

  if (actual === null || forecast === null || actual === forecast) {
    return "neutral";
  }

  const direction = inferGoldDirectionFromSurprise(event, actual > forecast);

  if (direction === "bullish" || direction === "bearish") {
    return direction;
  }

  return "neutral";
}

function inferGoldDirectionFromSurprise(
  event: Pick<EconomicCalendarEvent, "eventType" | "title">,
  hotterOrStronger: boolean,
): SignalDirection {
  const text = titleToDirectionText(event);

  if (/(unemployment|jobless claims|initial claims|continuing claims)/.test(text)) {
    return hotterOrStronger ? "bullish" : "bearish";
  }

  if (
    /(cpi|pce|ppi|inflation|earnings|prices|employment cost|labor cost|labour cost|wage|compensation|payroll|non farm|nonfarm|gdp|pmi|ism|retail|confidence|jolts)/.test(text)
  ) {
    return hotterOrStronger ? "bearish" : "bullish";
  }

  if (/(treasury|yield|auction|interest rate|fed|fomc|rate)/.test(text)) {
    return hotterOrStronger ? "bearish" : "bullish";
  }

  return "neutral";
}

function titleToDirectionText(event: Pick<EconomicCalendarEvent, "eventType" | "title">) {
  return `${event.eventType} ${event.title}`.toLowerCase();
}

function isToneBasedFedEvent(
  event: Pick<EconomicCalendarEvent, "actual" | "eventType" | "title">,
) {
  return (
    event.eventType === "central_bank" &&
    /(fomc statement|fomc press conference|monetary policy statement|ecb press conference)/i.test(event.title) &&
    Boolean(event.actual)
  );
}

function isPublishedReleasePackage(
  event: Pick<EconomicCalendarEvent, "actual" | "actualSource" | "title">,
) {
  return (
    event.actual === "Публикувано" &&
    event.actualSource === "FRED release calendar" &&
    /(gross domestic product|personal income and outlays|retail sales|industrial production)/i.test(event.title)
  );
}

function getReleaseAnalysis(event: EconomicCalendarEvent) {
  if (!event.actual) {
    if (event.actualStatus === "source_pending") {
      return "Release часът е минал, но все още няма надеждно публикувана стойност за този ред. Сайтът продължава да проверява ForexFactory, official API/release pages и whitelist-натите public fallback източници; в основния календар клетката остава празна, за да не показва шум или измислени данни.";
    }

    return "Новият факт още не е публикуван. Засега анализът е сценарен: пазарът ще сравни actual стойността с forecast-а и ще реагира през USD, доходности, Fed очаквания и risk sentiment.";
  }

  const actual = parseComparableValue(event.actual);
  const forecast = parseComparableValue(event.forecast);
  const source = event.actualSource ? ` Източник: ${event.actualSource}.` : "";

  if (isPublishedReleasePackage(event)) {
    return `Release пакетът е публикуван.${source} Този ред няма една обща actual стойност, защото съдържа няколко отделни показателя. За анализ гледай конкретните редове от същия release, например GDP, GDP Price Index, Core PCE, Personal Income или Spending, където има отделна стойност, очакване и прочит за златото.`;
  }

  if (isToneBasedFedEvent(event)) {
    return `Събитието е публикувано, но то няма числова actual стойност като CPI или GDP.${source} Пазарът чете тона: дали Fed звучи по-меко, по-твърдо или потвърждава очакванията. Затова посоката идва от езика в statement-а, пресконференцията, реакцията на USD и доходностите.`;
  }

  if (actual === null || forecast === null) {
    return `Публикуван е нов факт: ${event.actual}.${source} Ако тонът или стойността са по-меко четене за USD/доходности, това обикновено помага на златото; ако подкрепят по-високи лихви и по-силен долар, ефектът често е натиск върху XAU.`;
  }

  if (actual === forecast) {
    return `Публикуван е нов факт ${event.actual}, при очаквана стойност ${event.forecast}; резултатът е в рамките на очакването. Това обикновено е по-слаб числов directional сигнал за златото, но реакция пак може да има от тона, ревизии, позициониране или движението в USD и доходностите.${source}`;
  }

  const relation =
    actual > forecast ? "над очакването" : actual < forecast ? "под очакването" : "точно около очакването";
  const direction =
    event.expectedGoldImpact === "bullish"
      ? "Текущият прочит е по-скоро подкрепящ за златото."
      : event.expectedGoldImpact === "bearish"
        ? "Текущият прочит е по-скоро натиск за златото."
        : "Текущият прочит е смесен и зависи от реакцията на USD и доходностите.";

  return `Публикуван е нов факт ${event.actual}, при очаквана стойност ${event.forecast}; резултатът е ${relation}. ${direction}${source}`;
}

function getDriverDetails(event: EconomicCalendarEvent) {
  return event.affectedDrivers.map((driver) => driverDetailCopy[driver] ?? {
    key: driver,
    label: driver,
    description: "Този драйвер участва в общата оценка за потенциалната реакция на XAU.",
  });
}

function getValueContext(event: EconomicCalendarEvent) {
  const latest = event.latestActual ?? event.previous;
  const forecast =
    event.forecast ??
    (event.forecastStatus === "unavailable_free" ? unavailableFreeForecastLabel : undefined);
  const actual =
    event.actual ?? "още няма публикуван нов факт";

  return `В момента: последна стойност ${latest ?? "-"}, очаквана ${forecast ?? "-"}, нов факт ${actual}.`;
}
