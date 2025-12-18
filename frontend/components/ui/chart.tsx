"use client";

import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "@/lib/utils";

// Chart container
const ChartContainer = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<"div"> & {
        config: Record<string, { label?: React.ReactNode; color?: string }>;
        children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>["children"];
    }
>(({ id, className, children, config, ...props }, ref) => {
    const uniqueId = React.useId();
    const chartId = `chart-${id || uniqueId.replace(/:/g, "")}`;

    return (
        <div
            data-chart={chartId}
            ref={ref}
            className={cn(
                "w-full text-xs [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/50 [&_.recharts-curve.recharts-tooltip-cursor]:stroke-border [&_.recharts-dot[stroke='#fff']]:stroke-transparent [&_.recharts-layer]:outline-none [&_.recharts-polar-grid_[stroke='#ccc']]:stroke-border [&_.recharts-radial-bar-background-sector]:fill-muted [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-muted [&_.recharts-reference-line-line]:stroke-border [&_.recharts-sector[stroke='#fff']]:stroke-transparent [&_.recharts-sector]:outline-none [&_.recharts-surface]:outline-none",
                className
            )}
            {...props}
        >
            <ChartStyle id={chartId} config={config} />
            <RechartsPrimitive.ResponsiveContainer width="100%" height="100%">{children}</RechartsPrimitive.ResponsiveContainer>
        </div>
    );
});
ChartContainer.displayName = "Chart";

const ChartStyle = ({ id, config }: { id: string; config: Record<string, { label?: React.ReactNode; color?: string }> }) => {
    const colorConfig = Object.entries(config).filter(([, config]) => config.color);

    if (!colorConfig.length) {
        return null;
    }

    return (
        <style
            dangerouslySetInnerHTML={{
                __html: Object.entries(config)
                    .filter(([, config]) => config.color)
                    .map(([key, item]) => {
                        const color = item.color;
                        return [
                            `[data-chart=${id}] .color-${key} {`,
                            `  color: hsl(${color});`,
                            "}",
                        ].join("\n");
                    })
                    .join("\n"),
            }}
        />
    );
};

const ChartTooltip = RechartsPrimitive.Tooltip;

type TooltipPayload = {
    dataKey?: string | number;
    name?: string | number;
    color?: string;
    value?: number | string;
    payload?: Record<string, any>;
};

type CustomTooltipProps = React.HTMLAttributes<HTMLDivElement> & {
    active?: boolean;
    payload?: TooltipPayload[];
    label?: React.ReactNode;
    formatter?: (
        value: any,
        name: any,
        item: TooltipPayload,
        index: number,
        payload: TooltipPayload[]
    ) => React.ReactNode;
    labelFormatter?: RechartsPrimitive.TooltipProps<number, string>["labelFormatter"];
    labelClassName?: string;
    hideLabel?: boolean;
    hideIndicator?: boolean;
    indicator?: "line" | "dot" | "dashed";
    nameKey?: string;
    labelKey?: string;
    color?: string;
};

const ChartTooltipContent = React.forwardRef<HTMLDivElement, CustomTooltipProps>(
    (
        {
            active,
            payload,
            className,
            indicator = "dot",
            hideLabel = false,
            hideIndicator = false,
            label,
            labelFormatter,
            labelClassName,
            formatter,
            color,
            nameKey,
            labelKey,
        },
        ref
    ) => {
        const safePayload = (payload as TooltipPayload[] | undefined) || [];
        const tooltipLabel = React.useMemo(() => {
            if (hideLabel || !safePayload.length) {
                return null;
            }

            const [item] = safePayload;
            const key = `${labelKey || item.dataKey || item.name || "value"}`;
            const itemConfig = item.payload?.config?.[key] || {};

            if (labelFormatter) {
                return (
                    <div className={cn("font-medium", labelClassName)}>
                        {labelFormatter(label, safePayload as any)}
                    </div>
                );
            }

            if (!label) {
                return null;
            }

            return (
                <div className={cn("font-medium", labelClassName)}>
                    {typeof label === "string" ? label : itemConfig.label || key}
                </div>
            );
        }, [label, labelFormatter, safePayload, hideLabel, labelClassName, labelKey]);

        if (!active || !safePayload.length) {
            return null;
        }

        const nestLabel = safePayload.length === 1 && indicator !== "dot";

        return (
            <div
                ref={ref}
                className={cn(
                    "grid min-w-[8rem] items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-md",
                    className
                )}
            >
                {!nestLabel ? tooltipLabel : null}
                <div className="grid gap-1.5">
                    {safePayload.map((item, index) => {
                        const key = `${nameKey || item.name || item.dataKey || "value"}`;
                        const itemConfig = item.payload?.config?.[key] || {};
                        const indicatorColor = color || item.payload?.fill || item.color || "hsl(221.2 83.2% 53.3%)";

                        return (
                            <div
                                key={item.dataKey}
                                className={cn(
                                    "flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5 [&>svg]:text-muted-foreground",
                                    indicator === "dot" && "items-center"
                                )}
                            >
                                {formatter && item?.value !== undefined && item.name ? (
                                    formatter(item.value, item.name, item, index, safePayload)
                                ) : (
                                    <>
                                        {!hideIndicator ? (
                                            <div
                                                className={cn(
                                                    "shrink-0 rounded-[2px] border-[--color-border] bg-[--color-bg]",
                                                    {
                                                        "h-2.5 w-2.5": indicator === "dot",
                                                        "w-1": indicator === "line",
                                                        "w-0 border-[1.5px] border-dashed bg-transparent":
                                                            indicator === "dashed",
                                                        "my-0.5": nestLabel && indicator === "dashed",
                                                    }
                                                )}
                                                style={
                                                    {
                                                        "--color-bg": indicatorColor,
                                                        "--color-border": indicatorColor,
                                                    } as React.CSSProperties
                                                }
                                            />
                                        ) : null}
                                        <div
                                            className={cn(
                                                "flex flex-1 justify-start gap-2 leading-none",
                                                nestLabel ? "items-start" : "items-center"
                                            )}
                                        >
                                            <div className="grid gap-1.5">
                                                {nestLabel ? (
                                                    <span className="font-medium">{tooltipLabel}</span>
                                                ) : null}
                                                <span className="text-muted-foreground">
                                                    {itemConfig.label || item.name}
                                                </span>
                                            </div>
                                            {item.value && (
                                                <span className="font-mono font-medium tabular-nums text-foreground">
                                                    {typeof item.value === "number"
                                                        ? item.value.toLocaleString("vi-VN")
                                                        : item.value}
                                                </span>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }
);
ChartTooltipContent.displayName = "ChartTooltipContent";

const ChartLegend = RechartsPrimitive.Legend;
type LegendPayloadItem = {
    value?: React.ReactNode;
    dataKey?: string | number;
    color?: string;
    payload?: Record<string, any>;
};

const ChartLegendContent = React.forwardRef<
    HTMLDivElement,
    React.ComponentProps<"div"> & {
        payload?: LegendPayloadItem[];
        verticalAlign?: RechartsPrimitive.LegendProps["verticalAlign"];
        hideIcon?: boolean;
        nameKey?: string;
    }
>(({ className, hideIcon = false, payload, verticalAlign = "bottom", nameKey }, ref) => {
    const safePayload = payload || [];

    if (!safePayload?.length) {
        return null;
    }

    return (
        <div
            ref={ref}
            className={cn(
                "flex items-center justify-center gap-4",
                verticalAlign === "top" ? "pb-3" : "pt-3",
                className
            )}
        >
            {safePayload.map((item) => {
                const key = `${nameKey || item.dataKey || "value"}`;
                const itemConfig = item.payload?.config?.[key] || {};

                return (
                    <div
                        key={item.value ? String(item.value) : String(item.dataKey ?? Math.random())}
                        className={cn(
                            "flex items-center gap-1.5 [&>svg]:h-3 [&>svg]:w-3 [&>svg]:text-muted-foreground"
                        )}
                    >
                        {!hideIcon ? (
                            <div
                                className="h-2 w-2 shrink-0 rounded-[2px]"
                                style={{
                                    backgroundColor: item.color,
                                }}
                            />
                        ) : null}
                        {itemConfig.label || item.value}
                    </div>
                );
            })}
        </div>
    );
});
ChartLegendContent.displayName = "ChartLegendContent";

export { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent };

