import type { CotSnapshot } from "@/lib/types";

export interface CotPositionRow {
  id: string;
  reportDate: string;
  long: number;
  short: number;
  net: number;
  openInterest: number;
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
      long: snapshot.managedMoneyLong,
      short: snapshot.managedMoneyShort,
      net: snapshot.managedMoneyNet,
      openInterest: snapshot.openInterest,
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
