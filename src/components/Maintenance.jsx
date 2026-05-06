import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wrench, Plus, Bell, DollarSign, Search, Edit2, Trash2, Calendar, Settings2, ShieldAlert, ChevronDown, Check, Square, CheckSquare, X, Palette, Layout } from 'lucide-react';
import { useFuel } from '../hooks/useFuelContext';
import { Card, PageWrapper, ConfirmModal } from './ui';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function Maintenance() {
  const { 
    maintenanceEntries, 
    deleteMaintenanceEntry, 
    activeVehicle,
    activeVehicleFillUps,
    maintenanceSettings,
    updateCategorySettings,
    categories,
    addMaintenanceCategory,
    updateMaintenanceCategory,
    deleteMaintenanceCategory,
    getCategoryById
  } = useFuel();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('overview'); // overview, history, settings
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [selectedLogs, setSelectedLogs] = useState(new Set());
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, entryId: null, isBulk: false });
  const [categoryModal, setCategoryModal] = useState({ isOpen: false, category: null });
  const categoryDropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Get current odometer
  const currentOdometer = activeVehicleFillUps.length > 0 
    ? activeVehicleFillUps[activeVehicleFillUps.length - 1].odometer 
    : 0;

  // Filter logs
  const filteredEntries = maintenanceEntries.filter(log => {
    const category = getCategoryById(log.type);
    const matchesSearch = !searchTerm || 
      (log.notes && log.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (category && category.name.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || log.type === selectedCategory;
    return matchesSearch && matchesCategory;
  }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  // Progress-based tasks for the overview
  const categoryProgress = useMemo(() => {
    return categories
      .filter(cat => {
        const catSettings = maintenanceSettings?.categorySettings?.[cat.id];
        return catSettings?.enabled !== false && cat.id !== 'custom';
      })
      .map(cat => {
        // Find latest completion
        const latestCompletion = maintenanceEntries
          .filter(e => e.type === cat.id)
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0];

        const catSettings = maintenanceSettings?.categorySettings?.[cat.id] || {};
        const interval = catSettings.intervalKm || cat.defaultInterval?.value || 0;
        const margin = catSettings.safetyMarginKm || cat.defaultSafetyMarginKm || 2000;
        
        let lastPerformedODO = latestCompletion?.performedAtODO || 0;
        let nextDueODO = latestCompletion?.nextDueODO || (lastPerformedODO + interval);
        let alertODO = nextDueODO - margin;

        const distanceSinceLast = currentOdometer - lastPerformedODO;
        const remainingKm = nextDueODO - currentOdometer;
        const progressPercent = interval > 0 ? (distanceSinceLast / interval) * 100 : 0;
        
        let status = 'upcoming';
        if (currentOdometer >= nextDueODO) status = 'overdue';
        else if (currentOdometer >= alertODO) status = 'due-soon';

        return {
          ...cat,
          lastPerformedODO,
          nextDueODO,
          alertODO,
          remainingKm,
          progressPercent,
          status,
          hasHistory: !!latestCompletion
        };
      })
      .sort((a, b) => {
        const statusPriority = { overdue: 0, 'due-soon': 1, upcoming: 2 };
        if (statusPriority[a.status] !== statusPriority[b.status]) {
          return statusPriority[a.status] - statusPriority[b.status];
        }
        return a.remainingKm - b.remainingKm;
      });
  }, [categories, maintenanceEntries, currentOdometer, maintenanceSettings]);

  return (
    <PageWrapper className="pb-24">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-emerald-500"/> 
            Maintenance
          </h2>
          <p className="text-sm text-slate-500 mt-1">{activeVehicle?.name || 'Your vehicle'}</p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex gap-2 mb-6 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-2xl relative z-20">
        {['overview', 'history', 'settings'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold capitalize transition-all ${
              activeTab === tab
                ? 'text-slate-900 dark:text-white'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            {activeTab === tab && (
              <motion.div
                layoutId="maintenanceActiveTab"
                className="absolute inset-0 bg-white dark:bg-slate-800 rounded-xl shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <span className="relative z-10">{tab}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-6"
          >
            {categoryProgress.length > 0 ? (
              <section>
                <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-emerald-500" />
                  Service Progress
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {categoryProgress.map(item => {
                    const status = item.status;
                    const progress = Math.max(2, Math.min(100, item.progressPercent));
                    let barColor = "bg-emerald-500";
                    let bgColor = "bg-emerald-500/10";
                    let textColor = "text-emerald-500";
                    
                    if (status === 'overdue') {
                      barColor = "bg-red-500";
                      bgColor = "bg-red-500/10";
                      textColor = "text-red-500";
                    } else if (status === 'due-soon') {
                      barColor = "bg-amber-500";
                      bgColor = "bg-amber-500/10";
                      textColor = "text-amber-500";
                    }

                    return (
                      <Card key={`progress-${item.id}`} className="p-5 flex flex-col justify-between min-h-[160px] border-0 shadow-none bg-slate-50 dark:bg-white/[0.03]">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-2">
                             <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: item.color }}>
                                <Wrench className="w-4 h-4" />
                             </div>
                             <div>
                                <p className="text-sm font-bold text-slate-900 dark:text-white leading-tight">{item.name}</p>
                                <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                                  {status.replace('-', ' ')}
                                </p>
                             </div>
                          </div>
                          <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${bgColor} ${textColor}`}>
                            {item.progressPercent.toFixed(0)}%
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex justify-between items-end">
                             <div className="flex flex-col">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Remaining</span>
                                <span className={`text-xl font-black tracking-tighter ${textColor}`}>
                                  {item.remainingKm > 0 ? `${item.remainingKm.toLocaleString()} km` : `${Math.abs(item.remainingKm).toLocaleString()} km past`}
                                </span>
                             </div>
                             <div className="text-right flex flex-col">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Next Due</span>
                                <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                                  {item.nextDueODO.toLocaleString()} km
                                </span>
                             </div>
                          </div>
                          <div className="relative w-full h-2 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                             <motion.div 
                               initial={{ width: 0 }}
                               animate={{ width: `${progress}%` }}
                               transition={{ duration: 1, ease: "easeOut" }}
                               className={`absolute top-0 left-0 h-full rounded-full ${barColor}`}
                             />
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ) : (
              <div className="p-8 text-center bg-slate-50 dark:bg-white/[0.03] rounded-3xl">
                <Bell className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
                <p className="text-sm text-slate-500 font-medium tracking-tight">No maintenance categories enabled.</p>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div 
            key="history"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-6"
          >
            <section>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-500" />
                  History & Logs
                </h3>
                <p className="text-xs font-bold text-slate-500 uppercase">{filteredEntries.length} Records</p>
              </div>

              <Card className="p-3 mb-4 relative z-30">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search logs..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm outline-none"
                    />
                  </div>
                  <div className="relative" ref={categoryDropdownRef}>
                    <button 
                      onClick={() => setDropdownOpen(!dropdownOpen)}
                      className="w-full sm:w-56 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl px-4 py-2 text-sm font-medium outline-none text-slate-700 dark:text-slate-300"
                    >
                      <span>{selectedCategory === 'all' ? 'All Categories' : getCategoryById(selectedCategory).name}</span>
                      <motion.div animate={{ rotate: dropdownOpen ? 180 : 0 }}>
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      </motion.div>
                    </button>
                    <AnimatePresence>
                      {dropdownOpen && (
                        <motion.div
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="absolute right-0 top-full mt-1 w-full sm:w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden"
                        >
                          <div className="max-h-60 overflow-y-auto p-1 py-1">
                             <button
                               onClick={() => { setSelectedCategory('all'); setDropdownOpen(false); }}
                               className={`w-full flex justify-between items-center px-3 py-2 text-sm font-medium rounded-lg ${selectedCategory === 'all' ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50'}`}
                             >
                                All Categories
                                {selectedCategory === 'all' && <Check className="w-4 h-4" />}
                             </button>
                             {categories.map(cat => (
                               <button
                                 key={cat.id}
                                 onClick={() => { setSelectedCategory(cat.id); setDropdownOpen(false); }}
                                 className={`w-full flex justify-between items-center px-3 py-2 text-sm font-medium rounded-lg ${selectedCategory === cat.id ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50'}`}
                               >
                                 {cat.name}
                                 {selectedCategory === cat.id && <Check className="w-4 h-4" />}
                               </button>
                             ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </Card>

              <div className="space-y-3">
                {filteredEntries.map(log => {
                  const category = getCategoryById(log.type);
                  const isExpanded = expandedCards.has(log.id);
                  const isSelected = selectedLogs.has(log.id);
                  return (
                    <div key={log.id} className="relative flex items-center gap-3">
                      <button 
                         onClick={() => {
                           const newSet = new Set(selectedLogs);
                           isSelected ? newSet.delete(log.id) : newSet.add(log.id);
                           setSelectedLogs(newSet);
                         }}
                         className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}
                      >
                         {isSelected && <Check className="w-3.5 h-3.5" />}
                      </button>
                      <Card className="p-4 flex-1 cursor-pointer" onClick={() => {
                          const newSet = new Set(expandedCards);
                          isExpanded ? newSet.delete(log.id) : newSet.add(log.id);
                          setExpandedCards(newSet);
                      }}>
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1.5">
                               <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: category.color }}></span>
                               <h3 className="font-bold text-slate-900 dark:text-white capitalize">{category.name}</h3>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-500">
                               <span>{format(new Date(log.timestamp), 'MMM d, yyyy')}</span>
                               <span className="font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">{log.performedAtODO.toLocaleString()} km</span>
                            </div>
                            {isExpanded && log.notes && (
                              <p className="text-sm text-slate-600 dark:text-slate-400 mt-3 p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl italic">"{log.notes}"</p>
                            )}
                          </div>
                          <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                            <button onClick={() => navigate(`/maintenance/edit/${log.id}`)} className="p-2 text-slate-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-xl transition-all">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => setDeleteModal({ isOpen: true, entryId: log.id, isBulk: false })} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </section>
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="space-y-4"
          >
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                  <Settings2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white">Category Settings</h3>
                  <p className="text-xs text-slate-500">Configure intervals and warning distances.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categories.map(category => {
                  if (category.id === 'custom') return null;
                  const catSettings = maintenanceSettings?.categorySettings?.[category.id] || {};
                  const interval = catSettings.intervalKm ?? category.defaultInterval?.value ?? 0;
                  const margin = catSettings.safetyMarginKm ?? category.defaultSafetyMarginKm ?? 2000;
                  const isEnabled = catSettings.enabled !== false;

                  return (
                    <div key={category.id} className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50 transition-all">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: category.color }}></span>
                          <span className="font-bold text-sm text-slate-900 dark:text-white">{category.name}</span>
                        </div>
                        <button
                          onClick={() => updateCategorySettings(category.id, { enabled: !isEnabled })}
                          className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${isEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                          <div className={`w-4 h-4 rounded-full bg-white transition-transform ${isEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                        </button>
                      </div>

                      {isEnabled && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Interval (km)</label>
                            <input
                              type="number"
                              value={interval}
                              onChange={(e) => updateCategorySettings(category.id, { intervalKm: Number(e.target.value) })}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-medium outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Warn before (km)</label>
                            <input
                              type="number"
                              value={margin}
                              onChange={(e) => updateCategorySettings(category.id, { safetyMarginKm: Number(e.target.value) })}
                              className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-sm font-medium outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="mt-10 pt-10 border-t border-slate-200 dark:border-slate-800">
                 <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                        <Layout className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-white">Service Types</h3>
                        <p className="text-xs text-slate-500">Create new service types or customize names.</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setCategoryModal({ isOpen: true, category: null })}
                      className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl transition-all flex items-center gap-2 px-4 py-2.5 text-sm font-bold shadow-lg shadow-emerald-500/20"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add New</span>
                    </button>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {categories.map(cat => (
                      <div key={`manage-${cat.id}`} className="flex items-center justify-between p-3 bg-white dark:bg-white/[0.03] border border-slate-200 dark:border-slate-800 rounded-2xl group transition-all">
                         <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }}></div>
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-200 truncate max-w-[80px]">{cat.name}</span>
                         </div>
                         <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => setCategoryModal({ isOpen: true, category: cat })} className="p-1.5 text-slate-400 hover:text-blue-500"><Edit2 className="w-3.5 h-3.5" /></button>
                            {cat.id !== 'oil_change' && cat.id !== 'custom' && (
                               <button onClick={() => deleteMaintenanceCategory(cat.id)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                            )}
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedLogs.size > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-4 right-4 z-50 pointer-events-none"
          >
            <div className="max-w-lg mx-auto bg-slate-900 dark:bg-white text-white dark:text-slate-900 p-4 rounded-3xl shadow-2xl flex items-center justify-between pointer-events-auto border border-white/10 dark:border-black/5">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500 text-white p-2 rounded-xl">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold">{selectedLogs.size} selected</p>
                  <p className="text-[10px] uppercase tracking-widest opacity-60 font-bold">Bulk Actions</p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (selectedLogs.size === filteredEntries.length) setSelectedLogs(new Set());
                    else setSelectedLogs(new Set(filteredEntries.map(l => l.id)));
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/10 dark:bg-black/5 hover:bg-white/20 dark:hover:bg-black/10 transition-colors text-xs font-bold"
                >
                  {selectedLogs.size === filteredEntries.length ? <><Square className="w-4 h-4" /> <span>Deselect</span></> : <><CheckSquare className="w-4 h-4" /> <span>Select All</span></>}
                </button>
                <button
                  onClick={() => setDeleteModal({ isOpen: true, entryId: null, isBulk: true })}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white transition-colors text-xs font-bold"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
                <button
                  onClick={() => setSelectedLogs(new Set())}
                  className="p-2 rounded-xl hover:bg-white/10 dark:hover:bg-black/5 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CategoryModal 
         isOpen={categoryModal.isOpen} 
         onClose={() => setCategoryModal({ isOpen: false, category: null })}
         category={categoryModal.category}
         onSave={(cat) => {
            if (categoryModal.category) updateMaintenanceCategory(categoryModal.category.id, cat);
            else addMaintenanceCategory(cat);
            setCategoryModal({ isOpen: false, category: null });
         }}
      />

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, entryId: null, isBulk: false })}
        onConfirm={() => {
          if (deleteModal.isBulk) {
            selectedLogs.forEach(id => deleteMaintenanceEntry(id));
            setSelectedLogs(new Set());
          } else {
            deleteMaintenanceEntry(deleteModal.entryId);
          }
          setDeleteModal({ isOpen: false, entryId: null, isBulk: false });
        }}
        title="Delete Maintenance Entry"
        message={deleteModal.isBulk ? `Are you sure you want to delete ${selectedLogs.size} maintenance logs?` : "Are you sure you want to delete this maintenance log?"}
      />
    </PageWrapper>
  );
}

function CategoryModal({ isOpen, onClose, category, onSave }) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#10b981');

  useEffect(() => {
    if (category) {
      setName(category.name);
      setColor(category.color);
    } else {
      setName('');
      setColor('#10b981');
    }
  }, [category, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
      <motion.div initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{category ? 'Edit Service Type' : 'New Service Type'}</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"><X className="w-5 h-5" /></button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Category Name</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Brake Pads, Air Filter" className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500/30 font-medium" />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-1.5">Theme Color</label>
              <div className="flex flex-wrap gap-2">
                {['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#64748b'].map(c => (
                  <button key={c} onClick={() => setColor(c)} className={`w-10 h-10 rounded-full border-4 transition-all ${color === c ? 'border-emerald-500 scale-110 shadow-lg' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button onClick={onClose} className="flex-1 py-3.5 px-4 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">Cancel</button>
            <button onClick={() => onSave({ name, color })} disabled={!name} className="flex-1 py-3.5 px-4 rounded-2xl text-sm font-bold bg-emerald-500 hover:bg-emerald-600 text-white transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50">Save Category</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
