"use client";

import dynamic from "next/dynamic";
import type { EChartsOption } from "echarts";

const ReactECharts = dynamic(() => import("echarts-for-react"), {
  ssr: false,
});

type BaseChartProps = {
  option: EChartsOption;
  height?: number;
  className?: string;
};

export function BaseChart({ option, height = 300, className }: BaseChartProps) {
  return (
    <ReactECharts
      option={option}
      className={className}
      style={{ height, width: "100%" }}
      opts={{ renderer: "svg" }}
    />
  );
}
