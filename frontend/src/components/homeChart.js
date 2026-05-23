import React from 'react';
import { AreaClosed, Line, Bar } from '@visx/shape';
import { GridRows, GridColumns } from '@visx/grid';
import { scaleTime, scaleLinear } from '@visx/scale';
import { LinearGradient } from '@visx/gradient';

const HomeChart = ({ width, height, portfolioData = [] }) => {
  // Safety checks
  if (!width || !height || width <= 0 || height <= 0) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Chart loading...</div>
      </div>
    );
  }

  if (!portfolioData || portfolioData.length === 0) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>No portfolio data available</div>
      </div>
    );
  }

  // Transform portfolio data for the chart
  const chartData = portfolioData.map(item => ({
    date: new Date(item.date.split('/').reverse().join('-')), // Convert MM/DD/YYYY to YYYY-MM-DD
    value: item.value
  })).sort((a, b) => a.date - b.date);

  if (chartData.length === 0) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>No valid chart data</div>
      </div>
    );
  }

  // Chart dimensions and margins
  const margin = { top: 20, right: 20, bottom: 40, left: 60 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Scales
  const dateScale = scaleTime({
    domain: [chartData[0].date, chartData[chartData.length - 1].date],
    range: [0, chartWidth],
  });

  const valueScale = scaleLinear({
    domain: [0, Math.max(...chartData.map(d => d.value))],
    range: [chartHeight, 0],
  });

  // Safety check for scales
  if (!dateScale || !valueScale) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Error creating chart scales</div>
      </div>
    );
  }

  return (
    <svg width={width} height={height}>
      <defs>
        <LinearGradient
          id="area-gradient"
          from="#87CEEB"
          to="#000000"
          fromOpacity={0.8}
          toOpacity={0.1}
        />
      </defs>
      
      {/* Grid */}
      <GridRows
        scale={valueScale}
        width={chartWidth}
        strokeDasharray="3,3"
        stroke="#333"
        strokeOpacity={0.2}
        left={margin.left}
        top={margin.top}
      />
      <GridColumns
        scale={dateScale}
        height={chartHeight}
        strokeDasharray="3,3"
        stroke="#333"
        strokeOpacity={0.2}
        left={margin.left}
        top={margin.top}
      />

      {/* Area chart */}
      <AreaClosed
        data={chartData}
        x={d => dateScale(d.date)}
        y={d => valueScale(d.value)}
        yScale={valueScale}
        stroke="#87CEEB"
        strokeWidth={2}
        fill="url(#area-gradient)"
        left={margin.left}
        top={margin.top}
      />

      {/* Line chart */}
      <Line
        data={chartData}
        x={d => dateScale(d.date)}
        y={d => valueScale(d.value)}
        stroke="#87CEEB"
        strokeWidth={3}
        left={margin.left}
        top={margin.top}
      />

      {/* Y-axis labels */}
      {valueScale.ticks(5).map(tick => (
        <text
          key={tick}
          x={margin.left - 10}
          y={valueScale(tick) + margin.top}
          textAnchor="end"
          fontSize={12}
          fill="#87CEEB"
        >
          ${tick.toLocaleString()}
        </text>
      ))}

      {/* X-axis labels */}
      {dateScale.ticks(5).map(tick => (
        <text
          key={tick}
          x={dateScale(tick) + margin.left}
          y={height - margin.bottom + 15}
          textAnchor="middle"
          fontSize={12}
          fill="#87CEEB"
        >
          {tick.toLocaleDateString()}
        </text>
      ))}
    </svg>
  );
};

export default HomeChart;