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

export type DailyCurrencyBias = "positive" | "negative" | "mixed" | "neutral" | "pending";

export type DailyCurrencyEventBreakdown = {
  eventId: string;
  title: string;
  impactScore: number;
  impactLabel: string;
  valueLine: string;
  plainRead: string;
  effectLine: string;
  bias: DailyCurrencyBias;
};

export type DailyCurrencyAnalysis = {
  currency: string;
  currencyBias: DailyCurrencyBias;
  goldBias: SignalDirection;
  headline: string;
  summary: string;
  keyEventTitle: string;
  eventBreakdown: DailyCurrencyEventBreakdown[];
  finalCurrencyRead: string;
  goldImpact: string;
  tradingExample: string;
  badgeLabel: string;
  score: number;
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

export function getDailyCurrencyAnalyses(events: EconomicCalendarEvent[]): DailyCurrencyAnalysis[] {
  const groups = events.reduce<Record<string, EconomicCalendarEvent[]>>((accumulator, event) => {
    accumulator[event.currency] ??= [];
    accumulator[event.currency].push(event);
    return accumulator;
  }, {});

  return Object.entries(groups)
    .sort(([firstCurrency], [secondCurrency]) => firstCurrency.localeCompare(secondCurrency))
    .map(([currency, currencyEvents]) => getDailyCurrencyAnalysis(currency, currencyEvents));
}

export function getDailyCurrencyAnalysis(
  currency: string,
  events: EconomicCalendarEvent[],
): DailyCurrencyAnalysis {
  const sortedEvents = [...events].sort((first, second) => {
    const firstTime = new Date(first.startsAt).getTime();
    const secondTime = new Date(second.startsAt).getTime();
    return firstTime - secondTime || first.title.localeCompare(second.title);
  });
  const reads = sortedEvents.map(getCurrencyEventRead);
  const weightedReads = reads.filter((read) => read.sign !== 0);
  const positiveReads = weightedReads.filter((read) => read.sign > 0);
  const negativeReads = weightedReads.filter((read) => read.sign < 0);
  const totalWeight = weightedReads.reduce((sum, read) => sum + read.weight, 0);
  const weightedScore = weightedReads.reduce((sum, read) => sum + read.sign * read.weight, 0);
  const scoreRatio = totalWeight ? weightedScore / totalWeight : 0;
  const strongestReadScore = reads.reduce((maxScore, read) => Math.max(maxScore, read.strength.score), 0);
  const score = totalWeight ? Math.round(Math.min(100, Math.abs(scoreRatio) * 55 + strongestReadScore * 0.45)) : 0;
  const hasPending = reads.some((read) => read.bias === "pending");
  const currencyBias = getDailyCurrencyBias(positiveReads.length, negativeReads.length, weightedScore, totalWeight, hasPending);
  const dominantCurrencyBias = scoreRatio > 0.12 ? "positive" : scoreRatio < -0.12 ? "negative" : "neutral";
  const goldBias = getDailyGoldBias(currency, reads);
  const keyRead =
    reads
      .filter((read) => read.bias !== "pending")
      .sort((first, second) => second.weight - first.weight)[0] ??
    reads.sort((first, second) => second.weight - first.weight)[0];
  const keyEventTitle = keyRead?.event.title ?? "Няма ключова новина";
  const eventBreakdown = reads
    .sort((first, second) => second.weight - first.weight)
    .map((read) => ({
      eventId: read.event.id,
      title: read.event.title,
      impactScore: read.strength.score,
      impactLabel: read.strength.tier,
      valueLine: read.valueLine,
      plainRead: read.plainRead,
      effectLine: read.effectLine,
      bias: read.bias,
    }));
  const headline = getDailyHeadline(currency, currencyBias, dominantCurrencyBias, goldBias);
  const summary = getDailySummary(currency, currencyBias, dominantCurrencyBias, keyEventTitle, hasPending, reads);
  const finalCurrencyRead = getFinalCurrencyRead(currency, currencyBias, dominantCurrencyBias, score, positiveReads.length, negativeReads.length);
  const goldImpact = getDailyGoldImpact(currency, goldBias, currencyBias, dominantCurrencyBias);
  const tradingExample = getDailyTradingExample(currency, currencyBias, dominantCurrencyBias, goldBias, keyRead, reads);

  return {
    currency,
    currencyBias,
    goldBias,
    headline,
    summary,
    keyEventTitle,
    eventBreakdown,
    finalCurrencyRead,
    goldImpact,
    tradingExample,
    badgeLabel: getDailyBadgeLabel(currency, currencyBias, dominantCurrencyBias, goldBias),
    score,
  };
}

type CurrencyEventRead = {
  event: EconomicCalendarEvent;
  strength: CalendarImpactStrength;
  valueLine: string;
  plainRead: string;
  effectLine: string;
  bias: DailyCurrencyBias;
  sign: -1 | 0 | 1;
  weight: number;
};

function getCurrencyEventRead(event: EconomicCalendarEvent): CurrencyEventRead {
  const strength = getCalendarImpactStrength(event);
  const actual = parseComparableValue(event.actual);
  const forecast = parseComparableValue(event.forecast);
  const titleText = titleToDirectionText(event);

  if (!event.actual) {
    return {
      event,
      strength,
      valueLine: event.forecast
        ? `Очаква се ${event.forecast}; нов факт още не е публикуван.`
        : "Още няма публикуван нов факт.",
      plainRead: "Това остава сценарий, защото пазарът още няма числото, с което да сравни очакването.",
      effectLine: `Ефект: засега няма категоричен прочит за ${event.currency}; реакцията идва след публикуването.`,
      bias: "pending",
      sign: 0,
      weight: strength.score,
    };
  }

  if (isToneBasedFedEvent(event) || isPublishedReleasePackage(event) || actual === null || forecast === null) {
    const isPublished = event.actual === "Публикувано";
    return {
      event,
      strength,
      valueLine: isPublished ? "Събитието е публикувано, но няма едно просто число." : `Нов факт: ${event.actual}.`,
      plainRead:
        event.eventType === "speeches" || event.eventType === "central_bank"
          ? "Тук тонът е решаващ: пазарът чете дали езикът е по-твърд за лихвите или по-мек."
          : "Това е пакет или текстово събитие, затова се чете през детайлите, а не през едно число.",
      effectLine: `Ефект: сценарен прочит за ${event.currency}; гледат се тонът, USD, доходностите и реакцията на пазара.`,
      bias: "mixed",
      sign: 0,
      weight: strength.score,
    };
  }

  const higherThanForecast = actual > forecast;
  const lowerThanForecast = actual < forecast;

  if (!higherThanForecast && !lowerThanForecast) {
    return {
      event,
      strength,
      valueLine: `${event.actual} при очакване ${event.forecast}.`,
      plainRead: `${getShortEventName(event)} е точно около очакването. С по-прости думи: числото не носи нова изненада спрямо прогнозата.`,
      effectLine: `Ефект: неутрално за ${event.currency}; реакция може да има само от ревизии, тон или позициониране.`,
      bias: "neutral",
      sign: 0,
      weight: strength.score,
    };
  }

  const badWhenHigher = isBadForCurrencyWhenHigher(titleText);
  const sign: -1 | 1 = badWhenHigher
    ? higherThanForecast ? -1 : 1
    : higherThanForecast ? 1 : -1;
  const bias: DailyCurrencyBias = sign > 0 ? "positive" : "negative";
  const relation = higherThanForecast ? "над очакването" : "под очакването";

  return {
    event,
    strength,
    valueLine: `${event.actual} при очакване ${event.forecast}.`,
    plainRead: `${getShortEventName(event)} е ${relation}. ${getPlainEventExplanation(event, higherThanForecast, badWhenHigher)}`,
    effectLine: getCurrencyEffectLine(event, sign),
    bias,
    sign,
    weight: strength.score,
  };
}

function getDailyCurrencyBias(
  positiveCount: number,
  negativeCount: number,
  weightedScore: number,
  totalWeight: number,
  hasPending: boolean,
): DailyCurrencyBias {
  if (!totalWeight) {
    return hasPending ? "pending" : "neutral";
  }

  const ratio = weightedScore / totalWeight;

  if (positiveCount > 0 && negativeCount > 0) {
    return "mixed";
  }

  if (ratio > 0.12) {
    return "positive";
  }

  if (ratio < -0.12) {
    return "negative";
  }

  return "neutral";
}

function getDailyGoldBias(currency: string, reads: CurrencyEventRead[]): SignalDirection {
  const weightedGoldReads = reads.flatMap((read) => {
    if (read.bias === "pending") {
      return [];
    }

    if (currency === "USD" && (read.bias === "positive" || read.bias === "negative")) {
      return [{ sign: read.bias === "positive" ? -1 : 1, weight: read.weight }];
    }

    const direction = getCalendarDirectionPresentation(read.event).direction;

    if (direction === "bullish") {
      return [{ sign: 1, weight: read.weight }];
    }

    if (direction === "bearish") {
      return [{ sign: -1, weight: read.weight }];
    }

    return [];
  });

  const totalWeight = weightedGoldReads.reduce((sum, read) => sum + read.weight, 0);

  if (!totalWeight) {
    return reads.some((read) => read.bias === "pending") ? "mixed" : "neutral";
  }

  const weightedScore = weightedGoldReads.reduce((sum, read) => sum + read.sign * read.weight, 0);
  const hasBullish = weightedGoldReads.some((read) => read.sign > 0);
  const hasBearish = weightedGoldReads.some((read) => read.sign < 0);

  if (hasBullish && hasBearish) {
    return "mixed";
  }

  if (weightedScore / totalWeight > 0.12) {
    return "bullish";
  }

  if (weightedScore / totalWeight < -0.12) {
    return "bearish";
  }

  return "neutral";
}

function getDailyHeadline(
  currency: string,
  currencyBias: DailyCurrencyBias,
  dominantCurrencyBias: DailyCurrencyBias,
  goldBias: SignalDirection,
) {
  if (currencyBias === "pending") {
    return `${currency}: чака се нов факт`;
  }

  if (currencyBias === "mixed") {
    const side = dominantCurrencyBias === "positive" ? `по-силен ${currency}` : dominantCurrencyBias === "negative" ? `по-слаб ${currency}` : "балансиран прочит";
    return `${currency}: смесени данни, превес към ${side}`;
  }

  if (currencyBias === "positive") {
    return `${currency}: по-силен валутен прочит`;
  }

  if (currencyBias === "negative") {
    return `${currency}: по-слаб валутен прочит`;
  }

  return goldBias === "neutral" ? `${currency}: в рамките на очакването` : `${currency}: неутрален валутен прочит`;
}

function getDailySummary(
  currency: string,
  currencyBias: DailyCurrencyBias,
  dominantCurrencyBias: DailyCurrencyBias,
  keyEventTitle: string,
  hasPending: boolean,
  reads: CurrencyEventRead[],
) {
  const pendingText = hasPending
    ? " Част от редовете още нямат публикуван нов факт, затова те се четат само като сценарий."
    : "";
  const keyText = `Най-голяма тежест има "${keyEventTitle}", защото силата на влияние е най-висока сред видимите новини за ${currency}.`;

  if (currencyBias === "pending") {
    return `${keyText} Все още няма достатъчно публикувани actual стойности, за да има финален дневен прочит.${pendingText}`;
  }

  if (currencyBias === "mixed") {
    const side =
      dominantCurrencyBias === "positive"
        ? `по-силен ${currency}`
        : dominantCurrencyBias === "negative"
          ? `по-слаб ${currency}`
          : "балансиран прочит";
    return `${keyText} Данните са смесени, но по-важната новина тежи повече и накланя общия прочит към ${side}.${pendingText}`;
  }

  const directionText =
    currencyBias === "positive"
      ? `по-силен ${currency}`
      : currencyBias === "negative"
        ? `по-слаб ${currency}`
        : "неутрален резултат";
  const actualCount = reads.filter((read) => read.bias !== "pending").length;

  return `${keyText} От ${actualCount} публикувани реда общият прочит е ${directionText}.${pendingText}`;
}

function getFinalCurrencyRead(
  currency: string,
  currencyBias: DailyCurrencyBias,
  dominantCurrencyBias: DailyCurrencyBias,
  score: number,
  positiveCount: number,
  negativeCount: number,
) {
  if (currencyBias === "pending") {
    return `Крайното тегло за ${currency} още не е готово: липсват публикувани actual стойности.`;
  }

  if (currencyBias === "mixed") {
    const side =
      dominantCurrencyBias === "positive"
        ? `по-силен ${currency}`
        : dominantCurrencyBias === "negative"
          ? `по-слаб ${currency}`
          : "неутрално";
    return `Крайното тегло е смесено: ${positiveCount} реда подкрепят валутата, ${negativeCount} реда тежат срещу нея. Превесът е към ${side}, защото по-силните новини получават по-голяма тежест.`;
  }

  if (currencyBias === "positive") {
    return `Крайното тегло е: по-силен ${currency}. Увереността на прочита е около ${score}%, защото публикуваните данни са основно над/по-добри спрямо очакването.`;
  }

  if (currencyBias === "negative") {
    return `Крайното тегло е: по-слаб ${currency}. Увереността на прочита е около ${score}%, защото публикуваните данни са основно под/по-лоши спрямо очакването.`;
  }

  return `Крайното тегло е неутрално: числата са близо до очакването или сигналите се компенсират.`;
}

function getDailyGoldImpact(
  currency: string,
  goldBias: SignalDirection,
  currencyBias: DailyCurrencyBias,
  dominantCurrencyBias: DailyCurrencyBias,
) {
  if (currency === "USD") {
    if (currencyBias === "pending") {
      return "За златото това още е сценарий. Когато излезе actual, USD каналът е ключов: по-силен долар обикновено натиска XAU, а по-слаб долар обикновено го подкрепя.";
    }

    const usdSide =
      currencyBias === "mixed"
        ? dominantCurrencyBias
        : currencyBias;

    if (usdSide === "positive") {
      return "За златото това е по-скоро натиск: по-силен USD прави XAU по-скъп за купувачи извън САЩ, а по-високи доходности (лихвите по облигациите) намаляват привлекателността на актив без лихва.";
    }

    if (usdSide === "negative") {
      return "За златото това е по-скоро подкрепа: по-слаб USD и по-меки очаквания за доходности правят XAU по-лесен за купуване и намаляват конкуренцията от облигациите.";
    }
  }

  if (goldBias === "bullish") {
    return `За златото прочитът е подкрепящ, но при ${currency} каналът често е индиректен: минава през USD cross-effect, риск апетит и очаквания за централната банка.`;
  }

  if (goldBias === "bearish") {
    return `За златото прочитът е натиск, но при ${currency} ефектът обикновено е по-индиректен от USD новините и трябва да се потвърди от движението в долара и доходностите.`;
  }

  if (goldBias === "neutral") {
    return `За златото ефектът е ограничен или неутрален. При ${currency} новините често са контекст, освен ако не променят силно global risk sentiment (дали пазарът търси риск или защита).`;
  }

  return `За златото прочитът е смесен. При ${currency} гледаме дали новината променя USD, риск апетита, инфлационните очаквания или централната банка.`;
}

function getDailyTradingExample(
  currency: string,
  currencyBias: DailyCurrencyBias,
  dominantCurrencyBias: DailyCurrencyBias,
  goldBias: SignalDirection,
  keyRead: CurrencyEventRead | undefined,
  reads: CurrencyEventRead[],
) {
  const keyTitle = keyRead?.event.title ?? "ключовата новина";
  const keyValue = keyRead?.valueLine ?? "още няма публикувана стойност";

  if (currencyBias === "pending") {
    return `Търговски пример: ако след публикуването ${keyTitle} излезе по-силно от очакваното, трейдърът първо гледа дали това подкрепя ${currency}. Ако излезе по-слабо, гледа обратния сценарий. До actual стойността няма нужда да се прави категоричен извод.`;
  }

  if (currency === "USD" && currencyBias === "mixed") {
    const inflationRead = reads.find((read) => read.event.eventType === "inflation");
    const activityRead = reads.find((read) => read.event.eventType === "business_surveys" || read.event.eventType === "growth");

    if (inflationRead && activityRead) {
      return `Търговски пример: представи си, че активността е по-слаба (${activityRead.valueLine}), но инфлационният сигнал е по-силен (${inflationRead.valueLine}). С по-прости думи: бизнесът не ускорява силно, но ценовият натиск (натиск цените да растат) остава висок. Пазарът може да купува USD, защото Fed (централната банка на САЩ) има по-малко причина да бърза с по-меки лихви. Това често означава по-силен долар и натиск върху златото, дори част от данните да изглеждат слаби.`;
    }
  }

  const currencyText =
    currencyBias === "mixed"
      ? dominantCurrencyBias === "positive"
        ? `лек превес към по-силен ${currency}`
        : dominantCurrencyBias === "negative"
          ? `лек превес към по-слаб ${currency}`
          : "балансиран прочит"
      : currencyBias === "positive"
        ? `по-силен ${currency}`
        : currencyBias === "negative"
          ? `по-слаб ${currency}`
          : "неутрален прочит";
  const goldText =
    goldBias === "bullish"
      ? "подкрепа за златото"
      : goldBias === "bearish"
        ? "натиск върху златото"
        : goldBias === "neutral"
          ? "ограничен ефект върху златото"
          : "смесена реакция в златото";

  return `Търговски пример: ако трейдър гледа ${keyTitle}, той сравнява новия факт с очакването: ${keyValue} Ако това накланя деня към ${currencyText}, следва да провери дали USD и доходностите потвърждават реакцията. За XAU крайният прочит е ${goldText}, но най-добре се потвърждава от реалното движение след release-а.`;
}

function getDailyBadgeLabel(
  currency: string,
  currencyBias: DailyCurrencyBias,
  dominantCurrencyBias: DailyCurrencyBias,
  goldBias: SignalDirection,
) {
  if (currencyBias === "pending") {
    return "Крайно тегло: чака actual";
  }

  const currencyText =
    currencyBias === "mixed"
      ? dominantCurrencyBias === "positive"
        ? `смесено, превес ${currency}`
        : dominantCurrencyBias === "negative"
          ? `смесено, натиск ${currency}`
          : "смесено"
      : currencyBias === "positive"
        ? `по-силен ${currency}`
        : currencyBias === "negative"
          ? `по-слаб ${currency}`
          : "неутрално";
  const goldText =
    goldBias === "bullish"
      ? "подкрепа за XAU"
      : goldBias === "bearish"
        ? "натиск за XAU"
        : goldBias === "neutral"
          ? "неутрално за XAU"
          : "смесено за XAU";

  return `Крайно тегло: ${currencyText} / ${goldText}`;
}

function getShortEventName(event: Pick<EconomicCalendarEvent, "eventType" | "title">) {
  const text = titleToDirectionText(event);

  if (/(prices|price index|cpi|pce|ppi)/.test(text)) {
    return "Инфлационната част";
  }

  if (/(pmi|ism|manufacturing|services)/.test(text)) {
    return "PMI/ISM";
  }

  if (/(gdp|gross domestic product)/.test(text)) {
    return "GDP";
  }

  if (/(employment cost|wage|earnings|payroll|nfp|employment)/.test(text)) {
    return "Трудовият сигнал";
  }

  if (/(unemployment|jobless claims|initial claims|continuing claims)/.test(text)) {
    return "Заявките/безработицата";
  }

  if (/(rate|fomc|fed|ecb|monetary policy)/.test(text)) {
    return "Лихвеният сигнал";
  }

  return event.title;
}

function getPlainEventExplanation(
  event: Pick<EconomicCalendarEvent, "eventType" | "title">,
  higherThanForecast: boolean,
  badWhenHigher: boolean,
) {
  const text = titleToDirectionText(event);

  if (badWhenHigher) {
    return higherThanForecast
      ? "С по-прости думи: има повече слабост в труда/заявките, което тежи на валутата."
      : "С по-прости думи: има по-малко слабост в труда/заявките, което подкрепя валутата.";
  }

  if (/(prices|price index|cpi|pce|ppi|inflation)/.test(text)) {
    return higherThanForecast
      ? "С по-прости думи: бизнесите/потребителите виждат по-високи цени, което може да означава по-силен инфлационен натиск (натиск цените да растат)."
      : "С по-прости думи: ценовият натиск е по-мек от прогнозата, което намалява натиска върху централната банка.";
  }

  if (/(pmi|ism|manufacturing|services)/.test(text)) {
    return higherThanForecast
      ? "С по-прости думи: бизнес активността е по-силна от очакваното."
      : "С по-прости думи: секторът още може да расте, но по-бавно от прогнозата.";
  }

  if (/(gdp|retail|confidence|sales)/.test(text)) {
    return higherThanForecast
      ? "С по-прости думи: икономиката изглежда по-жива от прогнозата."
      : "С по-прости думи: икономиката изглежда по-мека от прогнозата.";
  }

  if (/(employment cost|wage|earnings|payroll|nfp|employment)/.test(text)) {
    return higherThanForecast
      ? "С по-прости думи: трудовият пазар или разходите за труд са по-силни от очакваното."
      : "С по-прости думи: трудовият сигнал е по-мек от очакваното.";
  }

  if (/(rate|yield|auction|fomc|fed|ecb|monetary policy)/.test(text)) {
    return higherThanForecast
      ? "С по-прости думи: лихвеният сигнал е по-твърд (по-високи лихви/доходности) от прогнозата."
      : "С по-прости думи: лихвеният сигнал е по-мек (по-ниски лихви/доходности) от прогнозата.";
  }

  return higherThanForecast
    ? "С по-прости думи: числото е по-силно от прогнозата."
    : "С по-прости думи: числото е по-слабо от прогнозата.";
}

function getCurrencyEffectLine(event: EconomicCalendarEvent, sign: -1 | 1) {
  const currencyEffect = sign > 0 ? `плюс за ${event.currency}` : `минус за ${event.currency}`;

  if (event.currency === "USD") {
    const goldEffect = sign > 0 ? "по-силен долар и натиск за златото" : "по-слаб долар и подкрепа за златото";
    return `Ефект: ${currencyEffect}; за XAU това обикновено значи ${goldEffect}.`;
  }

  return `Ефект: ${currencyEffect}; за XAU влиянието е по-индиректно и се гледа през USD, риск апетита и доходностите.`;
}

function isBadForCurrencyWhenHigher(text: string) {
  return /(unemployment|jobless claims|initial claims|continuing claims)/.test(text);
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
