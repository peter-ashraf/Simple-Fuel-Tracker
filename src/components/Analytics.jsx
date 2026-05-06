import { useFuel } from '../hooks/useFuelContext';
import { Card, MetricCard, PageWrapper } from './ui';
import { calculateTripMetrics } from '../utils/calculations';
import { format } from 'date-fns';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler } from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, AlertTriangle, Circle, TrendingUp, Wallet, ChevronLeft, ChevronRight, Calendar, Activity, Gauge, DollarSign, ChevronDown } from 'lucide-react';
import { useState, useMemo, useRef, useEffect } from 'react';
import { formatEfficiency2Dec, formatCurrency2Dec, formatTo2Decimals } from '../utils/formatting';
import chartjsPluginAnnotation from 'chartjs-plugin-annotation';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler, chartjsPluginAnnotation);

export default function Analytics() {
  const { activeVehicleFillUps, tyreComparisons, activeVehicle, stats } = useFuel();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [activeGraphIndex, setActiveGraphIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const graphDropdownRef = useRef(null);
  const [isGraphDropdownOpen, setIsGraphDropdownOpen] = useState(false);

  // Group everything by month for the selector
  const monthlyGroups = useMemo(() => {
    const groups = {};
    activeVehicleFillUps.forEach((fill, index) => {
      const date = new Date(fill.timestamp);
      const key = format(date, 'yyyy-MM');
      const label = format(date, 'MMM yy');
      
      if (!groups[key]) {
        groups[key] = { 
          key, 
          label, 
          fills: [], 
          totalCost: 0, 
          totalLiters: 0,
          distance: 0,
          longestTrip: 0
        };
      }
      
      groups[key].fills.push({ fill, index });
      groups[key].totalCost += fill.liters * fill.pricePerLiter;
      groups[key].totalLiters += fill.liters;
      
      if (index > 0) {
        const prevFill = activeVehicleFillUps[index - 1];
        if (prevFill.vehicleId === fill.vehicleId) {
          const dist = fill.odometer - prevFill.odometer;
          groups[key].distance += dist;
          if (dist > groups[key].longestTrip) groups[key].longestTrip = dist;
        }
      }
    });
    return Object.values(groups).sort((a, b) => b.key.localeCompare(a.key));
  }, [activeVehicleFillUps]);

  const yearsWithMonths = useMemo(() => {
    const years = {};
    monthlyGroups.forEach(group => {
      const year = group.key.split('-')[0];
      if (!years[year]) years[year] = [];
      years[year].push(group);
    });
    return Object.entries(years).sort((a, b) => b[0].localeCompare(a[0]));
  }, [monthlyGroups]);

  const selectedData = useMemo(() => {
    if (monthlyGroups.length === 0) return null;
    const group = monthlyGroups.find(g => g.key === selectedMonth) || monthlyGroups[0];
    if (!group) return null;
    
    const avgEff = group.distance > 0 && group.totalLiters > 0 ? group.distance / group.totalLiters : 0;
    const costPerKm = group.distance > 0 ? group.totalCost / group.distance : 0;
    const dateObj = new Date(group.key + '-01');
    const monthName = format(dateObj, 'MMMM');
    const monthLabel = format(dateObj, 'MMMM yy');
    const cardTitle = format(dateObj, 'MMMM yyyy').toUpperCase() + ' SPEND';
    
    return { ...group, avgEff, costPerKm, monthName, monthLabel, cardTitle };
  }, [monthlyGroups, selectedMonth]);

  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsMonthDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  const sortedByEfficiency = [...tripData].sort((a,b) => b.kmPerLiter - a.kmPerLiter);
  const bestTrip = sortedByEfficiency[0];
  const worstTrip = sortedByEfficiency[sortedByEfficiency.length - 1];

  // Price Evolution Data
  const priceChartData = {
    labels: activeVehicleFillUps.map(f => format(new Date(f.timestamp), 'MMM d')),
    datasets: [{
      label: 'Price per Liter (EGP)',
      data: activeVehicleFillUps.map(f => f.pricePerLiter),
      borderColor: '#3b82f6',
      backgroundColor: (context) => {
        const ctx = context.chart.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.3)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');
        return gradient;
      },
      tension: 0.3,
      pointBackgroundColor: '#3b82f6',
      pointBorderColor: '#fff',
      pointBorderWidth: 2,
      fill: true,
      borderWidth: 3,
    }]
  };

  // Trip Cost Distribution Data
  const tripCostData = {
    labels: tripData.map(t => t.date),
    datasets: [{
      label: 'Trip Cost (EGP)',
      data: tripData.map(t => t.tripCost),
      backgroundColor: (context) => {
        const ctx = context.chart.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, 200);
        gradient.addColorStop(0, '#8b5cf6');
        gradient.addColorStop(1, 'rgba(139, 92, 246, 0.3)');
        return gradient;
      },
      borderRadius: 8,
    }]
  };

  const graphs = [
    { 
      id: 'efficiency', 
      title: 'Efficiency History', 
      subtitle: 'Kilometers per liter over time',
      icon: TrendingUp, 
      color: 'emerald',
      render: () => <Line options={lineChartOptions} data={lineChartData} /> 
    },
    { 
      id: 'spending', 
      title: 'Monthly Spending', 
      subtitle: 'Total fuel cost per month',
      icon: Wallet, 
      color: 'blue',
      render: () => <Bar options={barChartOptions} data={barChartData} /> 
    },
    { 
      id: 'price', 
      title: 'Fuel Price Evolution', 
      subtitle: 'Market price changes recorded',
      icon: DollarSign, 
      color: 'indigo',
      render: () => <Line options={lineChartOptions} data={priceChartData} /> 
    },
    { 
      id: 'costs', 
      title: 'Trip Cost Distribution', 
      subtitle: 'Expense per fill-up entry',
      icon: Activity, 
      color: 'violet',
      render: () => <Bar options={barChartOptions} data={tripCostData} /> 
    },
  ];

  const paginate = (newIndex) => {
    setDirection(newIndex > activeGraphIndex ? 1 : -1);
    setActiveGraphIndex(newIndex);
  };

  const variants = {
    enter: (direction) => ({
      x: direction > 0 ? 500 : -500,
      opacity: 0,
      scale: 0.95
    }),
    center: {
      zIndex: 1,
      x: 0,
      opacity: 1,
      scale: 1
    },
    exit: (direction) => ({
      zIndex: 0,
      x: direction < 0 ? 500 : -500,
      opacity: 0,
      scale: 0.95
    })
  };

  return (
    <PageWrapper className="space-y-8 pb-10">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Analytics</h2>
        <div className="bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">{activeVehicle?.name || 'Active Vehicle'}</span>
        </div>
      </div>

      {/* Premium Monthly Insights Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Monthly Insights</h3>
          </div>
          
          {/* Custom Month Selector Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)}
              className="flex items-center gap-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full px-4 py-2 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 transition-all cursor-pointer shadow-sm"
            >
              <span>{selectedData ? selectedData.monthLabel : 'Select Month'}</span>
              <motion.div animate={{ rotate: isMonthDropdownOpen ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                <ChevronDown size={14} className="text-slate-400" />
              </motion.div>
            </button>

            <AnimatePresence>
              {isMonthDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 origin-top-right backdrop-blur-xl"
                >
                  <div className="max-h-64 overflow-y-auto p-1 no-scrollbar">
                    {yearsWithMonths.map(([year, months]) => (
                      <div key={year} className="mb-1 last:mb-0">
                        <div className="px-3 py-1.5 text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest bg-slate-50/50 dark:bg-white/5 rounded-lg mb-1">
                          {year}
                        </div>
                        {months.map(group => (
                          <button
                            key={group.key}
                            onClick={() => {
                              setSelectedMonth(group.key);
                              setIsMonthDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-colors ${selectedMonth === group.key 
                              ? 'bg-emerald-500 text-white' 
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                          >
                            {format(new Date(group.key + '-01'), 'MMMM')}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {selectedData && (
          <div className="grid grid-cols-2 gap-3">
             {/* Large Main Metric */}
             <div className="col-span-2 relative overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 rounded-[2rem] p-6 text-white shadow-xl shadow-emerald-500/20">
                <div className="absolute -right-6 -bottom-6 opacity-10 rotate-12">
                   <Wallet size={120} />
                </div>
                <div className="relative z-10">
                   <p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-80 mb-1">
                      {selectedData.cardTitle}
                   </p>
                   <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-black tracking-tighter">{formatCurrency2Dec(selectedData.totalCost, '').replace('L.E ', '')}</span>
                      <span className="text-sm font-bold opacity-80">EGP</span>
                   </div>
                   <div className="flex items-center gap-4 mt-6">
                      <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                         <Activity size={14} className="text-emerald-200" />
                         <span className="text-xs font-bold">{selectedData.fills.length} Fill-ups</span>
                      </div>
                      <div className="flex items-center gap-1.5 bg-white/10 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10">
                         <TrendingUp size={14} className="text-emerald-200" />
                         <span className="text-xs font-bold">{formatEfficiency2Dec(selectedData.avgEff)}</span>
                      </div>
                   </div>
                </div>
             </div>

             {/* Secondary Metrics */}
             <div className="bg-white dark:bg-white/[0.03] backdrop-blur-xl border border-slate-200 dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                   <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-indigo-500" />
                   </div>
                   <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Cost / KM</p>
                </div>
                <div className="flex items-baseline gap-1">
                   <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{selectedData.costPerKm.toFixed(2)}</span>
                   <span className="text-[10px] text-slate-500 font-bold">EGP</span>
                </div>
             </div>

             <div className="bg-white dark:bg-white/[0.03] backdrop-blur-xl border border-slate-200 dark:border-white/[0.08] rounded-3xl p-5 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                   <div className="w-7 h-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                      <Gauge className="w-4 h-4 text-amber-500" />
                   </div>
                   <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Distance</p>
                </div>
                <div className="flex items-baseline gap-1">
                   <span className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{selectedData.distance.toLocaleString()}</span>
                   <span className="text-[10px] text-slate-500 font-bold">KM</span>
                </div>
             </div>
          </div>
        )}
      </section>

      {/* Global Records Cards */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 px-1">
          <Trophy className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">All-Time Records</h3>
        </div>
        <div className="grid grid-cols-3 gap-3">
           <MetricCard variant="default" className="flex flex-col gap-2 p-4 border border-emerald-500/10">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3 h-3 text-emerald-500 dark:text-emerald-400 neon-glow"/>
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Best Efficiency</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tighter">{formatEfficiency2Dec(bestTrip.kmPerLiter)}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-500">{bestTrip.date}</p>
           </MetricCard>
           <MetricCard variant="secondary" className="flex flex-col gap-2 p-4 border border-red-500/10">
              <div className="flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-red-500 dark:text-red-400"/>
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Worst Efficiency</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tighter">{formatEfficiency2Dec(worstTrip.kmPerLiter)}</p>
              <p className="text-[10px] text-slate-500 dark:text-slate-500">{worstTrip.date}</p>
           </MetricCard>
           <MetricCard variant="default" className="flex flex-col gap-2 p-4 border border-indigo-500/10">
              <div className="flex items-center gap-1">
                <Circle className="w-3 h-3 text-indigo-500 dark:text-indigo-400"/>
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-slate-500">Tyre Profile</span>
              </div>
              <p className="text-base font-bold text-slate-900 dark:text-white leading-tight">
                {activeVehicle?.tyreSize ? `${activeVehicle.tyreSize.width}/${activeVehicle.tyreSize.aspectRatio} R${activeVehicle.tyreSize.rimSize}` : 'Not set'}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-500 truncate">{activeVehicle?.name || 'Active vehicle'}</p>
           </MetricCard>
        </div>
      </section>

      {/* Charts Carousel Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Trends & Visualization</h3>
          </div>
          
          {/* Graph Selector Dropdown */}
          <div className="relative" ref={graphDropdownRef}>
            <button
              onClick={() => setIsGraphDropdownOpen(!isGraphDropdownOpen)}
              className="flex items-center gap-2 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-full px-4 py-2 text-[10px] font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 transition-all cursor-pointer shadow-sm"
            >
              <span className="max-w-[100px] truncate">{graphs[activeGraphIndex].title}</span>
              <motion.div animate={{ rotate: isGraphDropdownOpen ? 180 : 0 }}>
                <ChevronDown size={14} className="text-slate-400" />
              </motion.div>
            </button>

            <AnimatePresence>
              {isGraphDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full right-0 mt-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50 origin-top-right backdrop-blur-xl"
                >
                  <div className="p-1">
                    {graphs.map((graph, idx) => {
                      const GraphIcon = graph.icon;
                      return (
                        <button
                          key={graph.id}
                          onClick={() => {
                            paginate(idx);
                            setIsGraphDropdownOpen(false);
                          }}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${activeGraphIndex === idx 
                            ? 'bg-emerald-500 text-white' 
                            : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'}`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${activeGraphIndex === idx ? 'bg-white/20' : 'bg-slate-100 dark:bg-white/5'}`}>
                             <GraphIcon size={16} className={activeGraphIndex === idx ? 'text-white' : 'text-slate-500'} />
                          </div>
                          <div>
                             <p className="text-xs font-bold">{graph.title}</p>
                             <p className={`text-[9px] ${activeGraphIndex === idx ? 'text-white/70' : 'text-slate-400'}`}>{graph.subtitle}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        
        <div className="relative min-h-[320px] px-8 sm:px-12">
          <AnimatePresence initial={false} custom={direction} mode="wait">
             <motion.div
               key={activeGraphIndex}
               custom={direction}
               variants={variants}
               initial="enter"
               animate="center"
               exit="exit"
               transition={{
                 x: { type: "spring", stiffness: 300, damping: 30 },
                 opacity: { duration: 0.2 },
                 scale: { duration: 0.2 }
               }}
               className="w-full"
             >
                <Card className="p-6 relative overflow-hidden group">
                   <div className="flex items-center gap-3 mb-8">
                      {(() => {
                        const GraphIcon = graphs[activeGraphIndex].icon;
                        return (
                          <div className={`w-10 h-10 rounded-2xl bg-${graphs[activeGraphIndex].color}-500/10 flex items-center justify-center text-${graphs[activeGraphIndex].color}-500`}>
                             <GraphIcon size={20} />
                          </div>
                        );
                      })()}
                      <div>
                         <h3 className="text-base font-bold text-slate-900 dark:text-white leading-tight">{graphs[activeGraphIndex].title}</h3>
                         <p className="text-[10px] font-medium text-slate-400 tracking-wide uppercase">{graphs[activeGraphIndex].subtitle}</p>
                      </div>
                   </div>
                   
                   <div className="h-[220px] w-full">
                      {graphs[activeGraphIndex].render()}
                   </div>

                   {/* Carousel Dots */}
                   <div className="flex justify-center gap-1.5 mt-8">
                      {graphs.map((_, idx) => (
                         <button
                           key={idx}
                           onClick={() => paginate(idx)}
                           className={`h-1 rounded-full transition-all duration-300 ${activeGraphIndex === idx ? 'w-6 bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'w-2 bg-slate-200 dark:bg-white/10'}`}
                         />
                      ))}
                   </div>
                </Card>
             </motion.div>
          </AnimatePresence>
          
          {/* Navigation Arrows */}
          <button 
            onClick={() => paginate((activeGraphIndex - 1 + graphs.length) % graphs.length)}
            className="absolute left-0 top-1/2 -translate-y-1/2 p-2 text-slate-400/50 hover:text-emerald-500 transition-colors z-20"
          >
            <ChevronLeft size={32} />
          </button>
          <button 
            onClick={() => paginate((activeGraphIndex + 1) % graphs.length)}
            className="absolute right-0 top-1/2 -translate-y-1/2 p-2 text-slate-400/50 hover:text-emerald-500 transition-colors z-20"
          >
            <ChevronRight size={32} />
          </button>
        </div>
      </section>
    </PageWrapper>
  );
}
