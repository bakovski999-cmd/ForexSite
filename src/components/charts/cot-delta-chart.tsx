"use client";

import type { EChartsOption } from "echarts";

import { BaseChart } from "@/components/charts/base-chart";
import { describeCotDelta, type CotPositionRow } from "@/lib/cot";

type TooltipParam = {
  name?: string;
};

type TooltipSize = {
  contentSize: [number, number];
  viewSize: [number, number];
};

function formatDeltaCompact(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  const absolute = Math.abs(value);

  if (absolute >= 1000) {
    return `${sign}${(absolute / 1000).toFixed(absolute >= 100000 ? 0 : 1)}K`;
  }

  return `${sign}${absolute}`;
}

function formatContracts(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${new Intl.NumberFormat("en-US").format(Math.abs(value))}`;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}.${year}` : value;
}

function getTooltipPosition(point: number[], _params: unknown, _dom: unknown, _rect: unknown, size: TooltipSize) {
  const margin = 12;
  const [pointerX, pointerY] = point;
  const [contentWidth, contentHeight] = size.contentSize;
  const [viewWidth, viewHeight] = size.viewSize;

  const preferredLeft = pointerX + margin;
  const preferredTop = pointerY - contentHeight - margin;
  const maxLeft = Math.max(margin, viewWidth - contentWidth - margin);
  const maxTop = Math.max(margin, viewHeight - contentHeight - margin);

  return [
    Math.min(Math.max(preferredLeft, margin), maxLeft),
    Math.min(Math.max(preferredTop, margin), maxTop),
  ];
}

function buildCotDeltaOption(rows: CotPositionRow[]): EChartsOption {
  const labelByDate = new Map(rows.map((row) => [row.reportDate.slice(5), row]));
  const startValue = Math.max(0, rows.length - 12);

  return {
    tooltip: {
      trigger: "item",
      triggerOn: "mousemove|click",
      appendTo: "body",
      confine: true,
      extraCssText: [
        "max-width: min(320px, calc(100vw - 32px))",
        "white-space: normal",
        "line-height: 1.45",
        "padding: 12px 14px",
        "border-radius: 14px",
        "box-shadow: 0 18px 42px rgba(2,6,23,0.32)",
        "z-index: 9999",
      ].join(";"),
      position: getTooltipPosition,
      axisPointer: {
        type: "shadow",
        shadowStyle: { color: "rgba(148,163,184,0.08)" },
      },
      backgroundColor: "#0f1729",
      borderColor: "rgba(255,255,255,0.1)",
      textStyle: { color: "#f8fafc" },
      formatter: (params) => {
        const entry = Array.isArray(params) ? (params as TooltipParam[])[0] : (params as TooltipParam);
        const label = entry?.name ?? "";
        const row = labelByDate.get(label);

        if (!row) {
          return "";
        }

        return [
          `<strong>Дата: ${formatDate(row.reportDate)}</strong>`,
          `Net промяна: ${formatContracts(row.changeNet)} контракта`,
          `Long промяна: ${formatContracts(row.changeLong)}`,
          `Short промяна: ${formatContracts(row.changeShort)}`,
          `Open interest: ${formatContracts(row.changeOpenInterest)}`,
          `Извод: ${describeCotDelta(row)}`,
        ].join("<br/>");
      },
    },
    grid: { left: 44, right: 22, top: 34, bottom: 72, containLabel: true },
    xAxis: {
      type: "category",
      data: rows.map((row) => row.reportDate.slice(5)),
      axisLabel: { color: "#94a3b8", hideOverlap: true, interval: 0, margin: 12 },
      axisLine: { lineStyle: { color: "rgba(255,255,255,0.14)" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: {
        color: "#94a3b8",
        formatter: (value: number) => formatDeltaCompact(value),
      },
      splitLine: { lineStyle: { color: "rgba(255,255,255,0.08)" } },
    },
    dataZoom: [
      {
        type: "inside",
        startValue,
        endValue: rows.length - 1,
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
      },
      {
        type: "slider",
        startValue,
        endValue: rows.length - 1,
        height: 18,
        bottom: 20,
        borderColor: "rgba(255,255,255,0.08)",
        fillerColor: "rgba(249,206,103,0.18)",
        handleStyle: { color: "#f9ce67" },
        moveHandleStyle: { color: "#f9ce67" },
        textStyle: { color: "#94a3b8" },
      },
    ],
    series: [
      {
        name: "Net промяна",
        type: "bar",
        data: rows.map((row) => ({
          value: row.changeNet,
          itemStyle: {
            borderRadius: row.changeNet >= 0 ? [8, 8, 0, 0] : [0, 0, 8, 8],
            color: row.changeNet >= 0 ? "#34d399" : "#fb7185",
          },
          label: {
            position: row.changeNet >= 0 ? "top" : "bottom",
          },
        })),
        barMaxWidth: 28,
        barCategoryGap: "52%",
        label: {
          show: true,
          color: "#e2e8f0",
          fontSize: 12,
          fontWeight: 700,
          formatter: (params) => {
            const value = Number(params.value ?? 0);
            return Math.abs(value) >= 10000 ? formatDeltaCompact(value) : "";
          },
        },
        labelLayout: {
          hideOverlap: true,
        },
        markLine: {
          symbol: "none",
          silent: true,
          lineStyle: { color: "rgba(226,232,240,0.42)", width: 1 },
          data: [{ yAxis: 0 }],
          label: { show: false },
        },
      },
    ],
  };
}

export function CotDeltaChart({
  rows,
  height = 320,
}: {
  rows: CotPositionRow[];
  height?: number;
}) {
  return <BaseChart height={height} option={buildCotDeltaOption(rows)} />;
}
