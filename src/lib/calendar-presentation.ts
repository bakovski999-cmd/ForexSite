import type {
  CalendarRelevance,
  DriverTag,
  EconomicCalendarEvent,
  NewsAnalysis,
  SignalDirection,
} from "@/lib/types";

export const pendingActualLabel = "чака се";
export const sourcePendingActualLabel = "чака се от източника";
export const unavailableFreeForecastLabel = "Няма безплатен консенсус";

type CalendarValuePanel = {
  key: "latest" | "forecast" | "actual";
  label: string;
  value: string;
  tone: CalendarValueTone;
  hint?: string;
};

type CalendarValueTone = "bullish" | "bearish" | "neutral";

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
    "actual" | "actualStatus" | "eventType" | "expectedGoldImpact" | "forecast" | "title"
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
    (event.forecastStatus === "unavailable_free" ? unavailableFreeForecastLabel : "-");
  const actualValue =
    event.actual ??
    (event.actualStatus === "source_pending" ? sourcePendingActualLabel : pendingActualLabel);
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
      hint: event.forecast ? "Консенсус/прогноза" : "Без надежден free forecast",
    },
    {
      key: "actual",
      label: "Нов факт",
      value: actualValue,
      tone: event.actual ? getComparableValueTone(event, event.actual, event.forecast) : "neutral",
      hint: event.actual
        ? `Публикувана стойност${event.actualSource ? ` от ${event.actualSource}` : ""}`
        : event.actualStatus === "source_pending"
          ? "Release часът е минал; сайтът проверява докато източникът публикува стойността"
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
    /(fomc statement|fomc press conference)/i.test(event.title) &&
    Boolean(event.actual)
  );
}

function getReleaseAnalysis(event: EconomicCalendarEvent) {
  if (!event.actual) {
    if (event.actualStatus === "source_pending") {
      return "Release часът е минал, но безплатният календарен източник още не е публикувал новия факт. Сайтът ще продължи да проверява и ще попълни стойността веднага щом се появи надежден actual.";
    }

    return "Новият факт още не е публикуван. Засега анализът е сценарен: пазарът ще сравни actual стойността с forecast-а и ще реагира през USD, доходности, Fed очаквания и risk sentiment.";
  }

  const actual = parseComparableValue(event.actual);
  const forecast = parseComparableValue(event.forecast);
  const source = event.actualSource ? ` Източник: ${event.actualSource}.` : "";

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
    event.actual ??
    (event.actualStatus === "source_pending" ? sourcePendingActualLabel : pendingActualLabel);

  return `В момента: последна стойност ${latest ?? "-"}, очаквана ${forecast ?? "-"}, нов факт ${actual}.`;
}
