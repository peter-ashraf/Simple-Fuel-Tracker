import { useFuel } from '../hooks/useFuelContext';
import { Card, MetricCard, PageWrapper } from './ui';
import { calculateTripMetrics } from '../utils/calculations';
import { format } from 'date-fns';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { Trophy, AlertTriangle, Circle, TrendingUp, Wallet } from 'lucide-react';
import { formatEfficiency2Dec, formatCurrency2Dec } from '../utils/formatting';
import chartjsPluginAnnotation from 'chartjs-plugin-annotation';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler, chartjsPluginAnnotation);

export default function Analytics() {
  const { activeVehicleFillUps, tyreComparisons, activeVehicle } = useFuel();
  
  if (activeVehicleFillUps.length < 2) {
    return (
      <PageWrapper className="py-20 text-center">
         <p className="text-slate-500 dark:text-slate-400 font-medium">Analytics requires at least 2 fill-ups to display trends.</p>
      </PageWrapper>
    );
  }

  // Calculate metrics
  const tripData = activeVehicleFillUps.map((fill, index) => {
    return {
      date: format(new Date(fill.timestamp), 'MMM d'),
      monthYear: format(new Date(fill.timestamp), 'yyyy-MM'),
      timestamp: fill.timestamp,
      ...calculateTripMetrics(activeVehicleFillUps, index)
    };
  }).slice(1); // Drop first trip as distance is 0

  if (tripData.length === 0) return null;

  // Build tyre size timeline from comparisons
  const tyreTimeline = tyreComparisons
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(comp => ({
      timestamp: comp.timestamp,
      newTyre: comp.new,
      originalTyre: comp.original,
      date: format(new Date(comp.timestamp), 'MMM d')
    }));

  // Find tyre change points on the chart
  const tyreChangeAnnotations = tyreTimeline.map((tyreChange, idx) => {
    const changeIndex = tripData.findIndex(t => new Date(t.timestamp).getTime() >= new Date(tyreChange.timestamp).getTime());
    if (changeIndex === -1) return null;
    return {
      type: 'line',
      xMin: changeIndex - 0.5,
      xMax: changeIndex - 0.5,
      borderColor: 'rgba(99, 102, 241, 0.5)',
      borderWidth: 2,
      borderDash: [5, 5],
      label: {
        display: true,
        content: `Tyre: ${tyreChange.new.width}/${tyreChange.new.aspectRatio} R${tyreChange.new.rimSize}`,
        position: 'start',
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        color: '#fff',
        font: { size: 10 },
        yAdjust: -10
      }
    };
  }).filter(Boolean);

  // Enhanced Efficiency Line Chart with gradient fill and shadow
  const lineChartData = {
    labels: tripData.map(t => t.date),
    datasets: [{
      label: 'Km / Liter',
      data: tripData.map(t => t.kmPerLiter),
      borderColor: '#10b981',
      backgroundColor: (context) => {
        const ctx = context.chart.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.3)');
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0.0)');
        return gradient;
      },
      tension: 0.4,
      pointBackgroundColor: '#10b981',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 2,
      pointRadius: 4,
      pointHoverRadius: 6,
      fill: true,
      borderWidth: 3,
    }]
  };
  
  const lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      title: { display: false },
      annotation: {
        annotations: tyreChangeAnnotations
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
      }
    },
    scales: {
      y: { 
        grid: { 
          color: 'rgba(148, 163, 184, 0.1)',
          drawBorder: false,
        },
        ticks: {
          color: 'rgba(148, 163, 184, 0.8)',
          font: { size: 11 }
        }
      },
      x: { 
        grid: { display: false },
        ticks: {
          color: 'rgba(148, 163, 184, 0.8)',
          font: { size: 10 }
        }
      }
    },
    elements: {
      point: {
        shadowColor: 'rgba(16, 185, 129, 0.5)',
        shadowBlur: 10,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
      }
    }
  };

  // Enhanced Monthly Spend Bar Chart with gradient
  const monthlySpendMap = {};
  activeVehicleFillUps.forEach(fill => {
     const my = format(new Date(fill.timestamp), 'MMM yy');
     if (!monthlySpendMap[my]) monthlySpendMap[my] = 0;
     monthlySpendMap[my] += (fill.liters * fill.pricePerLiter);
  });
  
  const barChartData = {
     labels: Object.keys(monthlySpendMap),
     datasets: [{
        label: 'Spend (EGP)',
        data: Object.values(monthlySpendMap),
        backgroundColor: (context) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 200);
          gradient.addColorStop(0, '#3b82f6');
          gradient.addColorStop(1, 'rgba(59, 130, 246, 0.3)');
          return gradient;
        },
        borderRadius: 6,
        borderSkipped: false,
     }]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { display: false },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 12,
        cornerRadius: 8,
        displayColors: false,
        callbacks: {
          label: (context) => `EGP ${context.raw.toFixed(0)}`
        }
      }
    },
    scales: {
      y: { 
        grid: { 
          color: 'rgba(148, 163, 184, 0.1)',
          drawBorder: false,
        },
        ticks: {
          color: 'rgba(148, 163, 184, 0.8)',
          font: { size: 11 }
        }
      },
      x: { 
        grid: { display: false },
        ticks: {
          color: 'rgba(148, 163, 184, 0.8)',
          font: { size: 10 }
        }
      }
    }
  };

  // Best / Worst
  const sortedByEfficiency = [...tripData].sort((a,b) => b.kmPerLiter - a.kmPerLiter);
  const bestTrip = sortedByEfficiency[0];
  const worstTrip = sortedByEfficiency[sortedByEfficiency.length - 1];

  return (
    <PageWrapper className="space-y-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">Analytics</h2>
      </div>

      {/* Stats Cards - Minimal Apple Health Style */}
      <div className="grid grid-cols-3 gap-3">
         <MetricCard variant="default" className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-1">
              <Trophy className="w-3 h-3 text-emerald-500 dark:text-emerald-400 neon-glow"/>
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Best</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tighter">{formatEfficiency2Dec(bestTrip.kmPerLiter)}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-500">{bestTrip.date}</p>
         </MetricCard>
         <MetricCard variant="secondary" className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-red-500 dark:text-red-400"/>
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Worst</span>
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tighter">{formatEfficiency2Dec(worstTrip.kmPerLiter)}</p>
            <p className="text-[10px] text-slate-500 dark:text-slate-500">{worstTrip.date}</p>
         </MetricCard>
         <MetricCard variant="default" className="flex flex-col gap-2 p-4">
            <div className="flex items-center gap-1">
              <Circle className="w-3 h-3 text-indigo-500 dark:text-indigo-400"/>
              <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Tyre</span>
            </div>
            <p className="text-base font-bold text-slate-900 dark:text-white leading-tight">
              {activeVehicle?.tyreSize ? `${activeVehicle.tyreSize.width}/${activeVehicle.tyreSize.aspectRatio} R${activeVehicle.tyreSize.rimSize}` : 'Not set'}
            </p>
            <p className="text-[10px] text-slate-500 dark:text-slate-500 truncate">{activeVehicle?.name || 'Active vehicle'}</p>
         </MetricCard>
      </div>

      {/* Charts - Enhanced with gradients and glow */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-500 dark:text-emerald-400 neon-glow" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Efficiency Trend</h3>
        </div>
        <div className="h-[200px]">
          <Line options={lineChartOptions} data={lineChartData} />
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-blue-500 dark:text-blue-400 neon-glow-blue" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Monthly Spend</h3>
        </div>
        <div className="h-[200px]">
          <Bar options={barChartOptions} data={barChartData} />
        </div>
      </Card>
    </PageWrapper>
  );
}
