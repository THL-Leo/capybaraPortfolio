import React, { useMemo, useCallback, useId } from 'react';
import { AreaClosed, Line, Bar } from '@visx/shape';
import { curveMonotoneX } from '@visx/curve';
import { GridRows, GridColumns } from '@visx/grid';
import { scaleTime, scaleLinear } from '@visx/scale';
import { withTooltip, Tooltip, TooltipWithBounds, defaultStyles } from '@visx/tooltip';
import { localPoint } from '@visx/event';
import { LinearGradient } from '@visx/gradient';
import { extent, bisector } from '@visx/vendor/d3-array';
import { timeFormat } from '@visx/vendor/d3-time-format';

const background = '#3b6978';
const background2 = '#204051';
const accentColor = '#edffea';
const accentColorDark = '#75daad';

const tooltipStyles = {
  ...defaultStyles,
  background,
  border: '1px solid white',
  color: 'white',
};

const formatDate = timeFormat("%b %d, '%y");
const formatDateShort = timeFormat('%b %d');

const formatMoneyFull = (n) =>
  `$${Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const formatMoneyCompact = (n) => {
  const v = Number(n);
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 10_000) return `$${Math.round(v / 1000)}k`;
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${Math.round(v)}`;
};

export function parseChartDate(dateStr) {
  if (!dateStr) return null;
  if (dateStr.includes('-') && dateStr.indexOf('-') === 4) {
    return new Date(dateStr);
  }
  if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return new Date(`${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`);
    }
  }
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

const getDate = (d) => d.date;
const getValue = (d) => d.value;
const bisectDate = bisector((d) => d.date).left;

const defaultMargin = { top: 24, right: 24, bottom: 52, left: 72 };

function normalizeChartData(rawData) {
  return (rawData || [])
    .map((item) => {
      const date = parseChartDate(item.date);
      const value = item.value ?? item.total;
      return date && value != null ? { date, value: Number(value) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date);
}

function SinglePointChart({ width, height, point, bgGradientId, areaGradientId }) {
  const margin = defaultMargin;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;
  const cx = margin.left + innerWidth / 2;
  const cy = margin.top + innerHeight / 2;
  const gridY = cy;

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <rect x={0} y={0} width={width} height={height} fill={`url(#${bgGradientId})`} rx={14} />
      <LinearGradient id={bgGradientId} from={background} to={background2} />
      <LinearGradient id={areaGradientId} from={accentColor} to={accentColor} toOpacity={0.15} />

      <line
        x1={margin.left}
        y1={gridY}
        x2={width - margin.right}
        y2={gridY}
        stroke={accentColor}
        strokeOpacity={0.2}
        strokeDasharray="4,4"
      />

      <circle cx={cx} cy={gridY} r={8} fill={accentColorDark} stroke="white" strokeWidth={2} />

      <text
        x={cx}
        y={gridY - 28}
        textAnchor="middle"
        fill={accentColor}
        fontSize={28}
        fontWeight={600}
      >
        {formatMoneyFull(getValue(point))}
      </text>
      <text
        x={cx}
        y={gridY + 36}
        textAnchor="middle"
        fill={accentColor}
        fontSize={13}
        opacity={0.85}
      >
        {formatDate(getDate(point))}
      </text>
      <text
        x={cx}
        y={gridY + 56}
        textAnchor="middle"
        fill={accentColor}
        fontSize={12}
        opacity={0.65}
      >
        Trend appears after your next sync
      </text>
    </svg>
  );
}

const NetWorthChartInner = ({
  width,
  height,
  portfolioData,
  data,
  margin = defaultMargin,
  showTooltip,
  hideTooltip,
  tooltipData,
  tooltipTop = 0,
  tooltipLeft = 0,
}) => {
  const uid = useId().replace(/:/g, '');
  const bgGradientId = `area-bg-${uid}`;
  const areaGradientId = `area-fill-${uid}`;

  const series = useMemo(
    () => normalizeChartData(data || portfolioData),
    [data, portfolioData],
  );

  const innerWidth = Math.max(0, width - margin.left - margin.right);
  const innerHeight = Math.max(0, height - margin.top - margin.bottom);

  const dateScale = useMemo(() => {
    if (series.length === 0) {
      return scaleTime({
        range: [margin.left, innerWidth + margin.left],
        domain: [new Date(), new Date()],
      });
    }
    if (series.length === 1) {
      const d = getDate(series[0]);
      const pad = 86400000 * 3;
      return scaleTime({
        range: [margin.left, innerWidth + margin.left],
        domain: [new Date(d.getTime() - pad), new Date(d.getTime() + pad)],
      });
    }
    return scaleTime({
      range: [margin.left, innerWidth + margin.left],
      domain: extent(series, getDate),
    });
  }, [innerWidth, margin.left, series]);

  const valueScale = useMemo(() => {
    if (series.length === 0) {
      return scaleLinear({
        range: [innerHeight + margin.top, margin.top],
        domain: [0, 1],
        nice: true,
      });
    }
    const values = series.map(getValue);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const yMin = minVal === maxVal ? minVal * 0.95 : minVal * 0.95;
    const yMax = minVal === maxVal ? maxVal * 1.05 : maxVal * 1.02;
    return scaleLinear({
      range: [innerHeight + margin.top, margin.top],
      domain: [yMin, yMax],
      nice: true,
    });
  }, [margin.top, innerHeight, series]);

  const handleTooltip = useCallback(
    (event) => {
      if (series.length < 2) return;
      const { x } = localPoint(event) || { x: 0 };
      const x0 = dateScale.invert(x);
      const index = bisectDate(series, x0, 1);
      const d0 = series[index - 1];
      const d1 = series[index];
      let d = d0;
      if (d1) {
        d = x0 - getDate(d0) > getDate(d1) - x0 ? d1 : d0;
      }
      showTooltip({
        tooltipData: d,
        tooltipLeft: dateScale(getDate(d)),
        tooltipTop: valueScale(getValue(d)),
      });
    },
    [showTooltip, valueScale, dateScale, series],
  );

  if (!width || !height || width < 10 || height < 10) {
    return null;
  }

  if (series.length === 0) {
    return (
      <div
        className="capy-chart-empty"
        style={{ width, height }}
      >
        No chart data available
      </div>
    );
  }

  if (series.length === 1) {
    return (
      <div style={{ position: 'relative', overflow: 'visible' }}>
        <SinglePointChart
          width={width}
          height={height}
          point={series[0]}
          bgGradientId={bgGradientId}
          areaGradientId={areaGradientId}
        />
      </div>
    );
  }

  const xTicks = dateScale.ticks(Math.min(5, series.length));

  return (
    <div style={{ position: 'relative', overflow: 'visible' }}>
      <svg width={width} height={height} style={{ overflow: 'visible' }}>
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill={`url(#${bgGradientId})`}
          rx={14}
        />
        <LinearGradient id={bgGradientId} from={background} to={background2} />
        <LinearGradient id={areaGradientId} from={accentColor} to={accentColor} toOpacity={0.15} />

        <GridRows
          left={margin.left}
          scale={valueScale}
          width={innerWidth}
          strokeDasharray="1,3"
          stroke={accentColor}
          strokeOpacity={0.15}
          pointerEvents="none"
        />
        <GridColumns
          top={margin.top}
          scale={dateScale}
          height={innerHeight}
          strokeDasharray="1,3"
          stroke={accentColor}
          strokeOpacity={0.2}
          pointerEvents="none"
        />

        <AreaClosed
          data={series}
          x={(d) => dateScale(getDate(d)) ?? 0}
          y={(d) => valueScale(getValue(d)) ?? 0}
          yScale={valueScale}
          strokeWidth={2}
          stroke={accentColorDark}
          fill={`url(#${areaGradientId})`}
          curve={curveMonotoneX}
        />

        <Bar
          x={margin.left}
          y={margin.top}
          width={innerWidth}
          height={innerHeight}
          fill="transparent"
          rx={14}
          onTouchStart={handleTooltip}
          onTouchMove={handleTooltip}
          onMouseMove={handleTooltip}
          onMouseLeave={() => hideTooltip()}
        />

        {tooltipData && (
          <g>
            <Line
              from={{ x: tooltipLeft, y: margin.top }}
              to={{ x: tooltipLeft, y: innerHeight + margin.top }}
              stroke={accentColorDark}
              strokeWidth={2}
              pointerEvents="none"
              strokeDasharray="5,2"
            />
            <circle
              cx={tooltipLeft}
              cy={tooltipTop}
              r={4}
              fill={accentColorDark}
              stroke="white"
              strokeWidth={2}
              pointerEvents="none"
            />
          </g>
        )}

        {valueScale.ticks(5).map((tick) => (
          <text
            key={tick}
            x={margin.left - 10}
            y={valueScale(tick)}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={11}
            fill={accentColor}
            opacity={0.9}
          >
            {formatMoneyCompact(tick)}
          </text>
        ))}

        {xTicks.map((tick) => (
          <text
            key={tick.getTime()}
            x={dateScale(tick)}
            y={height - 12}
            textAnchor="middle"
            fontSize={11}
            fill={accentColor}
            opacity={0.85}
          >
            {formatDateShort(tick)}
          </text>
        ))}
      </svg>

      {tooltipData && (
        <div>
          <TooltipWithBounds
            top={tooltipTop - 12}
            left={tooltipLeft + 12}
            style={tooltipStyles}
          >
            {formatMoneyFull(getValue(tooltipData))}
          </TooltipWithBounds>
          <Tooltip
            top={innerHeight + margin.top - 14}
            left={tooltipLeft}
            style={{
              ...defaultStyles,
              minWidth: 72,
              textAlign: 'center',
              transform: 'translateX(-50%)',
              background,
              color: 'white',
            }}
          >
            {formatDate(getDate(tooltipData))}
          </Tooltip>
        </div>
      )}
    </div>
  );
};

const NetWorthChart = withTooltip(NetWorthChartInner);

export default NetWorthChart;
