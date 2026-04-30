import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";

import type { CotSeries, CotSnapshot } from "@/lib/types";

const CFTC_BASE_URL = "https://www.cftc.gov";
const GOLD_MARKET_NAME = "GOLD - COMMODITY EXCHANGE INC.";

type CotCsvRow = Record<string, string>;

function buildZipUrl(reportType: "combined" | "futures_only", year: number) {
  const prefix = reportType === "combined" ? "com" : "fut";
  return `${CFTC_BASE_URL}/files/dea/history/${prefix}_disagg_txt_${year}.zip`;
}

function buildSourceUrl(reportType: "combined" | "futures_only", year: number) {
  return buildZipUrl(reportType, year);
}

async function fetchZipText(url: string) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch CFTC archive: ${url}`);
  }

  const zipBuffer = Buffer.from(await response.arrayBuffer());
  const zip = new AdmZip(zipBuffer);
  const firstEntry = zip.getEntries()[0];
  if (!firstEntry) {
    throw new Error(`CFTC archive is empty: ${url}`);
  }

  return firstEntry.getData().toString("utf8");
}

export function parseCotCsv(csvText: string, reportType: "combined" | "futures_only", sourceUrl: string) {
  const rows = parse(csvText, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
  }) as CotCsvRow[];

  const goldRows = rows
    .filter((row) => row.Market_and_Exchange_Names === GOLD_MARKET_NAME)
    .sort((left, right) =>
      String(right["Report_Date_as_YYYY-MM-DD"]).localeCompare(
        String(left["Report_Date_as_YYYY-MM-DD"]),
      ),
    );

  const snapshots = goldRows.map((row, index) => {
    const managedMoneyLong = Number(row.M_Money_Positions_Long_All);
    const managedMoneyShort = Number(row.M_Money_Positions_Short_All);
    const producerNet =
      Number(row.Prod_Merc_Positions_Long_All) - Number(row.Prod_Merc_Positions_Short_All);
    const swapDealerNet =
      Number(row.Swap_Positions_Long_All) - Number(row.Swap__Positions_Short_All);
    const otherReportablesNet =
      Number(row.Other_Rept_Positions_Long_All) - Number(row.Other_Rept_Positions_Short_All);
    const managedMoneyNet = managedMoneyLong - managedMoneyShort;
    const previousNet =
      index < goldRows.length - 1
        ? Number(goldRows[index + 1].M_Money_Positions_Long_All) -
          Number(goldRows[index + 1].M_Money_Positions_Short_All)
        : managedMoneyNet;

    const snapshot: CotSnapshot = {
      id: `${reportType}-${row["Report_Date_as_YYYY-MM-DD"]}`,
      reportDate: row["Report_Date_as_YYYY-MM-DD"],
      reportType,
      marketName: row.Market_and_Exchange_Names,
      openInterest: Number(row.Open_Interest_All),
      managedMoneyLong,
      managedMoneyShort,
      managedMoneyNet,
      swapDealerNet,
      producerNet,
      otherReportablesNet,
      weeklyDelta: managedMoneyNet - previousNet,
      sourceUrl,
    };

    return snapshot;
  });

  return snapshots;
}

export async function fetchCotSeries(reportType: "combined" | "futures_only"): Promise<CotSeries> {
  const currentYear = new Date().getUTCFullYear();
  const years = [currentYear, currentYear - 1];

  const results = await Promise.all(
    years.map(async (year) => {
      const sourceUrl = buildSourceUrl(reportType, year);
      const csvText = await fetchZipText(sourceUrl);
      return parseCotCsv(csvText, reportType, sourceUrl);
    }),
  );

  const snapshots = results.flat().sort((left, right) => right.reportDate.localeCompare(left.reportDate));

  return {
    reportType,
    label: reportType === "combined" ? "Futures + Options" : "Futures only",
    snapshots: snapshots.slice(0, 16),
  };
}
