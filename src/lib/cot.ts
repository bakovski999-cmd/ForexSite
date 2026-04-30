import type { CotSnapshot } from "@/lib/types";

export interface CotPositionRow {
  id: string;
  reportDate: string;
  previousReportDate?: string;
  long: number;
  short: number;
  net: number;
  openInterest: number;
  previousLong?: number;
  previousShort?: number;
  previousNet?: number;
  previousOpenInterest?: number;
  changeLong: number;
  changeShort: number;
  changeNet: number;
  changeOpenInterest: number;
  longOpenInterestShare: number;
  shortOpenInterestShare: number;
}

function percentOfOpenInterest(value: number, openInterest: number) {
  if (!Number.isFinite(value) || !Number.isFinite(openInterest) || openInterest <= 0) {
    return 0;
  }

  return (value / openInterest) * 100;
}

function computeDelta(current: number, previous?: number) {
  if (!Number.isFinite(current)) {
    return 0;
  }

  if (previous === undefined || !Number.isFinite(previous)) {
    return 0;
  }

  return current - previous;
}

export function buildCotPositionRows(snapshots: CotSnapshot[]): CotPositionRow[] {
  return snapshots.map((snapshot, index) => {
    const previous = snapshots[index + 1];
    const changeLong =
      snapshot.managedMoneyLongDelta ??
      computeDelta(snapshot.managedMoneyLong, previous?.managedMoneyLong);
    const changeShort =
      snapshot.managedMoneyShortDelta ??
      computeDelta(snapshot.managedMoneyShort, previous?.managedMoneyShort);
    const changeOpenInterest =
      snapshot.openInterestDelta ?? computeDelta(snapshot.openInterest, previous?.openInterest);
    const changeNet =
      snapshot.weeklyDelta ?? computeDelta(snapshot.managedMoneyNet, previous?.managedMoneyNet);

    return {
      id: snapshot.id,
      reportDate: snapshot.reportDate,
      previousReportDate: previous?.reportDate,
      long: snapshot.managedMoneyLong,
      short: snapshot.managedMoneyShort,
      net: snapshot.managedMoneyNet,
      openInterest: snapshot.openInterest,
      previousLong: previous?.managedMoneyLong,
      previousShort: previous?.managedMoneyShort,
      previousNet: previous?.managedMoneyNet,
      previousOpenInterest: previous?.openInterest,
      changeLong,
      changeShort,
      changeNet,
      changeOpenInterest,
      longOpenInterestShare: percentOfOpenInterest(snapshot.managedMoneyLong, snapshot.openInterest),
      shortOpenInterestShare: percentOfOpenInterest(snapshot.managedMoneyShort, snapshot.openInterest),
    };
  });
}

export function describeCotDelta(row: Pick<CotPositionRow, "changeLong" | "changeShort" | "changeNet">) {
  if (row.changeNet > 0 && row.changeLong >= row.changeShort) {
    return "спекулативната нетна дълга позиция се разширява";
  }

  if (row.changeNet > 0) {
    return "нетната позиция се подобрява, въпреки промени и в short страната";
  }

  if (row.changeNet < 0 && row.changeShort > 0) {
    return "натискът идва основно от повече short експозиция";
  }

  if (row.changeNet < 0) {
    return "спекулативната нетна дълга позиция се свива";
  }

  return "позиционирането е почти без седмична промяна";
}

type CotBias = "bullish" | "cooling" | "bearish" | "neutral";

export interface CotPositionAnalysis {
  bias: CotBias;
  biasLabel: string;
  comparisonLabel: string;
  headline: string;
  overview: string;
  longAnalysis: string;
  shortAnalysis: string;
  netAnalysis: string;
  openInterestAnalysis: string;
  goldImpact: string;
  conclusion: string;
}

const compactFormatter = new Intl.NumberFormat("bg-BG", {
  maximumFractionDigits: 1,
  notation: "compact",
});

const integerFormatter = new Intl.NumberFormat("bg-BG");

function formatDate(value?: string) {
  if (!value) {
    return "предишната седмица";
  }

  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function formatCompact(value: number) {
  return compactFormatter.format(value);
}

function formatSigned(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${integerFormatter.format(Math.round(value))}`;
}

function directionWord(value: number, positive: string, negative: string, neutral: string) {
  if (value > 0) {
    return positive;
  }

  if (value < 0) {
    return negative;
  }

  return neutral;
}

function classifyCotBias(row: CotPositionRow): CotBias {
  if (row.net > 0 && row.changeNet > 0 && row.changeLong >= row.changeShort) {
    return "bullish";
  }

  if (row.net > 0 && row.changeNet < 0) {
    return "cooling";
  }

  if (row.net < 0 || (row.changeNet < 0 && row.changeShort > 0 && row.changeLong < 0)) {
    return "bearish";
  }

  return "neutral";
}

function biasLabel(bias: CotBias) {
  switch (bias) {
    case "bullish":
      return "Bullish COT импулс";
    case "cooling":
      return "Охлаждане на long импулса";
    case "bearish":
      return "Bearish COT натиск";
    default:
      return "Неутрален COT прочит";
  }
}

export function buildCotPositionAnalysis(row: CotPositionRow): CotPositionAnalysis {
  const bias = classifyCotBias(row);
  const currentDate = formatDate(row.reportDate);
  const previousDate = formatDate(row.previousReportDate);
  const longDirection = directionWord(row.changeLong, "са се увеличили", "са намалели", "са без промяна");
  const shortDirection = directionWord(row.changeShort, "са се увеличили", "са намалели", "са без промяна");
  const netDirection = directionWord(row.changeNet, "се е подобрила", "е отслабнала", "е без промяна");
  const oiDirection = directionWord(row.changeOpenInterest, "се е увеличил", "е намалял", "е без промяна");

  const overview = `Този ред сравнява COT отчета от ${currentDate} с ${previousDate}. Основният фокус е managed money позиционирането: колко long и short контракта държат спекулативните участници и как се променя нетната им експозиция към златото.`;

  const longAnalysis = `Long позициите ${longDirection} с ${formatSigned(row.changeLong)} контракта и сега са ${integerFormatter.format(row.long)}. Повече long обикновено означава по-силен спекулативен интерес към покачване на златото; по-малко long означава прибиране на риск или затваряне на част от bullish експозицията.`;

  const shortAnalysis = `Short позициите ${shortDirection} с ${formatSigned(row.changeShort)} контракта и сега са ${integerFormatter.format(row.short)}. Ръст в short страната добавя натиск срещу златото, докато спад в short позициите често показва покриване на къси позиции и може да помага на цената.`;

  const netAnalysis = `Net позицията ${netDirection} с ${formatSigned(row.changeNet)} контракта и остава ${formatSigned(row.net)}. Net се смята като Long минус Short. Положителна net стойност означава, че спекулантите като група още са повече long, отколкото short.`;

  const openInterestAnalysis = `Open interest ${oiDirection} с ${formatSigned(row.changeOpenInterest)} контракта до ${integerFormatter.format(row.openInterest)}. Ако open interest расте заедно с net long, движението има по-широко участие. Ако open interest пада, част от движението може да е редуциране или затваряне на позиции, а не свеж агресивен поток.`;

  const goldImpact =
    bias === "bullish"
      ? "За златото това е позитивен COT сигнал: спекулативната long страна се разширява и net позицията се подобрява. Само по себе си това не е гаранция за ръст, но казва, че позиционирането подкрепя bullish тезата."
      : bias === "cooling"
        ? "За златото това е сигнал за охлаждане: пазарът остава net long, но седмичният импулс отслабва. Това не е автоматично bearish, но показва, че купувачите са по-предпазливи спрямо предишната седмица."
        : bias === "bearish"
          ? "За златото това е негативен COT сигнал: net позицията се влошава и short/редуциращият поток натежава. Такъв отчет може да ограничи възходящия импулс, особено ако макро средата също подкрепя долара и доходностите."
          : "За златото това е по-скоро неутрален COT сигнал: няма достатъчно ясно разширяване или свиване на позиционирането, затова по-важни стават макро новините, доларът и реалните доходности.";

  const conclusion =
    bias === "bullish"
      ? `Изводът: към ${currentDate} златото получава по-силна спекулативна подкрепа, защото net позицията е ${formatCompact(row.net)} и се увеличава спрямо ${previousDate}. Това показва добавяне на bullish експозиция, особено ако long страната расте по-бързо от short страната.`
      : bias === "cooling"
        ? `Изводът: към ${currentDate} златото все още има спекулативна long подкрепа, защото net позицията е ${formatCompact(row.net)}. Но спрямо ${previousDate} има охлаждане: net позицията спада с ${formatSigned(row.changeNet)}, което означава, че импулсът е по-слаб от предишната седмица.`
        : bias === "bearish"
          ? `Изводът: към ${currentDate} COT картината се влошава спрямо ${previousDate}. Net позицията е ${formatSigned(row.net)}, а седмичната промяна е ${formatSigned(row.changeNet)}, което показва натиск върху bullish тезата за златото.`
          : `Изводът: към ${currentDate} COT отчетът не дава силен еднопосочен сигнал спрямо ${previousDate}. Net позицията е ${formatSigned(row.net)}, но седмичната промяна не е достатъчно ясна, затова трябва да се чете заедно с новини, USD и доходности.`;

  return {
    bias,
    biasLabel: biasLabel(bias),
    comparisonLabel: `${currentDate} спрямо ${previousDate}`,
    headline: `COT анализ: ${currentDate}`,
    overview,
    longAnalysis,
    shortAnalysis,
    netAnalysis,
    openInterestAnalysis,
    goldImpact,
    conclusion,
  };
}
