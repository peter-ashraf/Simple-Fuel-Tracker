import { useFuel } from '../hooks/useFuelContext';
import { Card, PageWrapper } from './ui';
import { calculateTripMetrics } from '../utils/calculations';
import { format } from 'date-fns';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { Trophy, AlertTriangle } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

export default function Analytics() {
  const { activeVehicleFillUps } = useFuel();
  
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
      ...calculateTripMetrics(activeVehicleFillUps, index)
    };
  }).slice(1); // Drop first trip as distance is 0

  if (tripData.length === 0) return null;

  // Efficiency Line Chart Data
  const lineChartData = {
    labels: tripData.map(t => t.date),
    datasets: [{
      label: 'Km / Liter',
      data: tripData.map(t => t.kmPerLiter),
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.5)',
      tension: 0.3,
      pointBackgroundColor: '#10b981',
    }]
  };
  
  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: { display: false },
      title: { display:false }
    },
    scales: {
      y: { grid: { color: 'rgba(255, 255, 255, 0.05)' } },
      x: { grid: { display: false } }
    }
  };

  // Monthly Spend Bar Chart Data
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
        backgroundColor: '#3b82f6',
        borderRadius: 4
     }]
  };

  const barChartOptions = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: {
      y: { grid: { color: 'rgba(255, 255, 255, 0.05)' } },
      x: { grid: { display: false } }
    }
  };

  // Best / Worst
  const sortedByEfficiency = [...tripData].sort((a,b) => b.kmPerLiter - a.kmPerLiter);
  const bestTrip = sortedByEfficiency[0];
  const worstTrip = sortedByEfficiency[sortedByEfficiency.length - 1];

  return (
    <PageWrapper className="space-y-6">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Analytics</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Deep dive into your fuel consumption.</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
         <Card className="flex flex-col gap-2 p-4">
            <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1"><Trophy className="w-3 h-3"/> Best Trip</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{bestTrip.kmPerLiter.toFixed(1)} <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">km/L</span></p>
            <p className="text-[11px] text-slate-500">{bestTrip.date}</p>
         </Card>
         <Card className="flex flex-col gap-2 p-4">
            <p className="text-[10px] uppercase font-bold text-red-500 dark:text-red-400 tracking-wider flex items-center gap-1"><AlertTriangle className="w-3 h-3"/> Worst Trip</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white flex items-end gap-1 px-1">
               {worstTrip.kmPerLiter.toFixed(1)} <span className="text-sm text-slate-500 dark:text-slate-400 font-medium mb-[2px]">km/L</span>
            </p>
            <p className="text-[11px] text-slate-500">{worstTrip.date}</p>
         </Card>
      </div>

      <Card>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Efficiency Trend (Km/L)</h3>
        <Line options={lineChartOptions} data={lineChartData} />
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Monthly Spend (EGP)</h3>
        <Bar options={barChartOptions} data={barChartData} />
      </Card>
    </PageWrapper>
  );
}
