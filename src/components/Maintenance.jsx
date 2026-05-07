import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wrench, Plus, Bell, DollarSign, Search, Edit2, Trash2, Calendar, 
  Settings2, ShieldAlert, ChevronDown, Check, Square, CheckSquare, 
  X, Palette, Layout, Activity, Droplet, Shield, Battery, Car, Disc, Zap, Clock,
  MoreVertical, ChevronRight, Save, Trash, AlertTriangle
} from 'lucide-react';
import { useFuel } from '../hooks/useFuelContext';
import { Card, PageWrapper, ConfirmModal, Modal, Input, Label } from './ui';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

const ICON_MAP = { Zap, Disc, Droplet, Shield, Battery, Car, Wrench, Activity, Settings2 };

export default function Maintenance() {
  const { 
    maintenanceEntries, 
    deleteMaintenanceEntry, 
    activeVehicle,
    activeVehicleFillUps,
    maintenanceSettings,
    updateCategorySettings,
    categories,
    getCategoryById,
    maintenanceSystems,
    setMaintenanceSystems,
    addMaintenanceCategory,
    deleteMaintenanceCategory,
    updateMaintenanceCategory
  } = useFuel();
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('overview'); // overview, history, settings
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedSystemId, setSelectedSystemId] = useState(null);
  
  // Modals & Editing State
  const [editingSystemId, setEditingSystemId] = useState(null);
  const [editSystemName, setEditSystemName] = useState('');
  const [newSubCatName, setNewSubCatName] = useState('');
  const [renamingCatId, setRenamingCatId] = useState(null);
  const [renamingCatName, setRenamingCatName] = useState('');
  
  // Confirm Modals
  const [confirmDeleteSystem, setConfirmDeleteSystem] = useState(null); // stores id
  const [confirmDeleteCat, setConfirmDeleteCat] = useState(null); // stores id

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
  const filteredEntries = useMemo(() => {
    return maintenanceEntries.filter(log => {
      const category = getCategoryById(log.type);
      const matchesSearch = !searchTerm || 
        (log.notes && log.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (category && category.name.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'all' || log.type === selectedCategory;
      return matchesSearch && matchesCategory;
    }).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [maintenanceEntries, searchTerm, selectedCategory, getCategoryById]);

  // Circular Progress Component
  const CircularProgress = ({ size = 90, strokeWidth = 6, percentage = 0, color = "#3b82f6", children }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (percentage / 100) * circumference;

    return (
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            fill="transparent"
            className="text-slate-100 dark:text-white/5"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          {children}
        </div>
      </div>
    );
  };

  // Progress-based tasks logic
  const categoryProgress = useMemo(() => {
    return categories.map(cat => {
      const logs = maintenanceEntries
        .filter(e => e.type === cat.id)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      const latestCompletion = logs[0];

      const catSettings = maintenanceSettings?.categorySettings?.[cat.id] || {};
      const interval = catSettings.intervalKm || cat.defaultInterval?.value || 0;
      const margin = catSettings.safetyMarginKm || cat.defaultSafetyMarginKm || 2000;
      
      let lastPerformedODO = latestCompletion?.performedAtODO || 0;
      let nextDueODO = latestCompletion?.nextDueODO || (lastPerformedODO + interval);
      let alertODO = nextDueODO - margin;

      const remainingKm = nextDueODO - currentOdometer;
      const progressPercent = interval > 0 ? ((currentOdometer - lastPerformedODO) / interval) * 100 : 0;
      
      let status = 'upcoming';
      const isTracked = !!latestCompletion;

      if (!isTracked) {
        status = 'untracked';
      } else if (currentOdometer >= nextDueODO) {
        status = 'overdue';
      } else if (currentOdometer >= alertODO) {
        status = 'due-soon';
      }

      return {
        ...cat,
        remainingKm,
        progressPercent,
        status,
        isTracked,
        intervalKm: interval,
        latestLogId: latestCompletion?.id || null
      };
    });
  }, [categories, maintenanceEntries, currentOdometer, maintenanceSettings]);

  // Aggregate into Systems Status
  const systemStatus = useMemo(() => {
    return maintenanceSystems.map(system => {
      const systemCategories = categoryProgress.filter(cp => system.categories.includes(cp.id));
      const trackedCategories = systemCategories.filter(cp => cp.isTracked);
      
      const overdueCount = systemCategories.filter(cp => cp.status === 'overdue').length;
      const dueSoonCount = systemCategories.filter(cp => cp.status === 'due-soon').length;
      
      let healthScore = 100;
      if (trackedCategories.length > 0) {
        const totalProgress = trackedCategories.reduce((sum, cp) => sum + Math.max(0, Math.min(100, cp.progressPercent)), 0);
        healthScore = 100 - (totalProgress / trackedCategories.length);
      } else {
        healthScore = 100;
      }

      let status = 'healthy';
      if (overdueCount > 0) status = 'overdue';
      else if (dueSoonCount > 0) status = 'due-soon';
      else if (trackedCategories.length === 0) status = 'untracked';

      let desc = 'Good';
      let subDesc = 'No Issues';
      let color = "#3b82f6";

      if (status === 'overdue') {
        desc = 'Needs Attention';
        subDesc = 'Overdue';
        color = "#ef4444";
      } else if (status === 'due-soon') {
        desc = 'Check Soon';
        const trackedItems = systemCategories.filter(c => c.isTracked);
        const minRemaining = trackedItems.length > 0 ? Math.min(...trackedItems.map(c => c.remainingKm)) : 0;
        subDesc = `${minRemaining.toLocaleString()} km to change`;
        color = "#f59e0b";
      } else if (status === 'untracked') {
        desc = 'Not Tracked';
        subDesc = 'Tap to Setup';
        color = "#94a3b8";
        healthScore = 0;
      }

      return {
        ...system,
        categories: systemCategories,
        healthScore,
        status,
        desc,
        subDesc,
        displayColor: color,
        overdueCount
      };
    });
  }, [categoryProgress, maintenanceSystems]);

  const activeSystem = selectedSystemId ? systemStatus.find(s => s.id === selectedSystemId) : null;
  const editingSystem = editingSystemId ? maintenanceSystems.find(s => s.id === editingSystemId) : null;

  // Settings Handlers
  const handleSaveSystemName = () => {
    if (!editingSystemId || !editSystemName.trim()) return;
    setMaintenanceSystems(prev => prev.map(s => s.id === editingSystemId ? { ...s, name: editSystemName } : s));
  };

  const handleRenameCategory = (catId, newName) => {
    if (!newName.trim()) return;
    updateMaintenanceCategory(catId, { name: newName });
    setRenamingCatId(null);
  };

  const handleDeleteSystem = () => {
    if (!confirmDeleteSystem) return;
    setMaintenanceSystems(prev => prev.filter(s => s.id !== confirmDeleteSystem));
    setConfirmDeleteSystem(null);
    setEditingSystemId(null);
  };

  const handleAddSubCategory = () => {
    if (!newSubCatName.trim() || !editingSystemId) return;
    const newCat = addMaintenanceCategory({ name: newSubCatName, color: editingSystem.color });
    setMaintenanceSystems(prev => prev.map(s => 
      s.id === editingSystemId ? { ...s, categories: [...s.categories, newCat.id] } : s
    ));
    setNewSubCatName('');
  };

  const handleDeleteSubCategory = () => {
    if (!confirmDeleteCat) return;
    setMaintenanceSystems(prev => prev.map(s => 
      s.id === editingSystemId ? { ...s, categories: s.categories.filter(id => id !== confirmDeleteCat) } : s
    ));
    setConfirmDeleteCat(null);
  };

  return (
    <PageWrapper className="pb-24">
      <div className="mb-6">
        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Maintenance</h2>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-2xl relative z-20">
        {['overview', 'history', 'settings'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold capitalize transition-all ${
              activeTab === tab ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
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
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="grid grid-cols-2 gap-4"
          >
            {systemStatus.map(system => {
              const isOverdue = system.status === 'overdue';
              const Icon = ICON_MAP[system.icon] || Wrench;

              return (
                <Card 
                  key={system.id} 
                  className={`p-4 flex flex-col items-center text-center rounded-[2rem] border-0 shadow-sm cursor-pointer transition-all active:scale-[0.96] hover:shadow-xl ${
                    isOverdue 
                      ? 'ring-2 ring-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.12)] dark:shadow-[0_0_30px_rgba(239,68,68,0.15)] bg-white dark:bg-red-500/5' 
                      : 'bg-white dark:bg-white/[0.03]'
                  }`}
                  onClick={() => setSelectedSystemId(system.id)}
                >
                  <CircularProgress percentage={system.healthScore} color={system.displayColor} size={70} strokeWidth={5}>
                    <Icon className={`w-6 h-6 ${isOverdue ? 'text-red-500' : system.status === 'due-soon' ? 'text-amber-500' : 'text-slate-900 dark:text-white'}`} />
                  </CircularProgress>
                  
                  <div className="mt-3">
                    <p className="text-[9px] font-bold text-slate-400">{Math.round(system.healthScore)}%</p>
                    <h4 className="text-sm font-black text-slate-900 dark:text-white mt-0.5 leading-tight">{system.name}</h4>
                    <p className={`text-[10px] font-bold mt-0.5 ${isOverdue ? 'text-red-500' : system.status === 'due-soon' ? 'text-amber-500' : 'text-slate-500 dark:text-slate-400'}`}>
                      {system.desc} {isOverdue && <ShieldAlert className="inline w-2.5 h-2.5 ml-0.5" />}
                    </p>
                    <p className="text-[8px] font-medium text-slate-400 dark:text-slate-500 mt-0.5 tracking-tight uppercase">
                      {system.subDesc}
                    </p>
                  </div>
                </Card>
              );
            })}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
            <section>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-500" /> History & Logs
                </h3>
                <p className="text-xs font-bold text-slate-500 uppercase">{filteredEntries.length} Records</p>
              </div>

              <div className="p-3 mb-4 relative z-30 bg-white dark:bg-white/[0.03] rounded-3xl border border-slate-200 dark:border-slate-700/50">
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
                        <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute right-0 top-full mt-1 w-full sm:w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden">
                          <div className="max-h-60 overflow-y-auto p-1 py-1">
                             <button onClick={() => { setSelectedCategory('all'); setDropdownOpen(false); }} className={`w-full flex justify-between items-center px-3 py-2 text-sm font-medium rounded-lg ${selectedCategory === 'all' ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50'}`}>All Categories {selectedCategory === 'all' && <Check className="w-4 h-4" />}</button>
                             {categories.map(cat => (
                               <button key={cat.id} onClick={() => { setSelectedCategory(cat.id); setDropdownOpen(false); }} className={`w-full flex justify-between items-center px-3 py-2 text-sm font-medium rounded-lg ${selectedCategory === cat.id ? 'bg-emerald-50 dark:bg-emerald-500/20 text-emerald-600' : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50'}`}>{cat.name} {selectedCategory === cat.id && <Check className="w-4 h-4" />}</button>
                             ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700" />
                <div className="space-y-4 pl-10">
                  {filteredEntries.map((log) => {
                    const category = getCategoryById(log.type);
                    return (
                      <div key={log.id} className="relative">
                        <div className="absolute -left-10 top-4 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800" style={{ backgroundColor: category.color }} />
                        <Card className="p-4 cursor-pointer" onClick={() => navigate(`/maintenance/edit/${log.id}`)}>
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2 mb-1.5">
                                 <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: category.color }}></span>
                                 <h3 className="font-bold text-slate-900 dark:text-white capitalize">{category.name}</h3>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-slate-500">
                                 <span>{format(new Date(log.timestamp), 'MMM d, yyyy')}</span>
                                 <span className="font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-lg">{log.performedAtODO.toLocaleString()} km</span>
                              </div>
                            </div>
                            <Edit2 className="w-4 h-4 text-slate-400" />
                          </div>
                        </Card>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div key="settings" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-6">
            <div className="grid grid-cols-1 gap-3">
              {maintenanceSystems.map(system => {
                const Icon = ICON_MAP[system.icon] || Wrench;
                return (
                  <Card key={system.id} className="p-4 flex items-center justify-between cursor-pointer active:scale-[0.98]" onClick={() => {
                    setEditingSystemId(system.id);
                    setEditSystemName(system.name);
                  }}>
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white" style={{ backgroundColor: system.color }}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white">{system.name}</h4>
                        <p className="text-[10px] text-slate-500">{system.categories.length} sub-categories</p>
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300" />
                  </Card>
                );
              })}
              <button 
                className="w-full py-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex items-center justify-center gap-2 text-slate-400 hover:text-emerald-500 hover:border-emerald-500/50 transition-all text-sm font-bold"
                onClick={() => {
                  const id = `sys_${Date.now()}`;
                  setMaintenanceSystems(prev => [...prev, { id, name: 'New System', icon: 'Wrench', categories: [], color: '#64748b' }]);
                }}
              >
                <Plus className="w-5 h-5" />
                Add New System
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Detailed System Modal (Overview) */}
      <Modal
        isOpen={!!selectedSystemId}
        onClose={() => setSelectedSystemId(null)}
        title={activeSystem?.name + " Details"}
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
          {activeSystem?.categories.map(item => {
            const isOverdue = item.status === 'overdue';
            const isDueSoon = item.status === 'due-soon';
            const isUntracked = item.status === 'untracked';
            const textColor = isOverdue ? "text-red-500" : isDueSoon ? "text-amber-500" : isUntracked ? "text-slate-400" : "text-emerald-500";

            return (
              <Card 
                key={`detail-${item.id}`} 
                className="p-4 bg-slate-50 dark:bg-white/[0.02] border-0 shadow-none rounded-2xl cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors"
                onClick={() => {
                  setSelectedSystemId(null);
                  if (item.isTracked && item.latestLogId) {
                    navigate(`/maintenance/edit/${item.latestLogId}`);
                  } else {
                    navigate(`/maintenance/add?type=${item.id}`);
                  }
                }}
              >
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-sm font-bold text-slate-900 dark:text-white">{item.name}</span>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-wider ${textColor}`}>
                    {isUntracked ? 'Untracked' : `${item.progressPercent.toFixed(0)}%`}
                  </span>
                </div>
                
                {!isUntracked ? (
                  <div className="space-y-3">
                    <div className="flex justify-between items-end text-[10px] font-bold">
                      <span className="text-slate-400 uppercase tracking-widest">Remaining</span>
                      <span className={textColor}>
                        {item.remainingKm > 0 ? `${item.remainingKm.toLocaleString()} km` : `${Math.abs(item.remainingKm).toLocaleString()} km past`}
                      </span>
                    </div>
                    <div className="h-2 bg-slate-200 dark:bg-white/5 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${isOverdue ? 'bg-red-500' : isDueSoon ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.max(2, Math.min(100, item.progressPercent))}%` }} />
                    </div>
                    <div className="flex justify-between items-center pt-2">
                      <p className="text-[10px] text-slate-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Interval: {item.intervalKm.toLocaleString()} km</p>
                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1">View Details <ChevronRight className="w-3 h-3" /></span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-[10px] text-slate-500 leading-relaxed italic">No history found. Tap to setup tracking for this category.</p>
                    <div className="w-full py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-bold text-slate-500 uppercase tracking-widest text-center shadow-sm">Log Initial Service</div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </Modal>

      {/* System Settings Modal (Editing) */}
      <Modal
        isOpen={!!editingSystemId}
        onClose={() => setEditingSystemId(null)}
        title="Manage System"
      >
        <div className="space-y-6">
          <div>
            <Label>System Name</Label>
            <div className="flex gap-2">
              <Input 
                value={editSystemName} 
                onChange={(e) => setEditSystemName(e.target.value)}
                placeholder="System Name"
              />
              <button onClick={handleSaveSystemName} className="px-4 bg-emerald-500 text-white rounded-xl font-bold transition-all active:scale-95">
                <Save className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <Label>Sub-Categories</Label>
            <div className="space-y-2 mb-4 max-h-60 overflow-y-auto pr-1">
              {editingSystem?.categories.map(catId => {
                const cat = getCategoryById(catId);
                const isRenaming = renamingCatId === catId;

                return (
                  <div key={catId} className="group flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-2xl">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.color }} />
                      {isRenaming ? (
                        <div className="flex gap-1 flex-1">
                          <input 
                            autoFocus
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-bold w-full outline-none"
                            value={renamingCatName}
                            onChange={(e) => setRenamingCatName(e.target.value)}
                            onBlur={() => handleRenameCategory(catId, renamingCatName)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRenameCategory(catId, renamingCatName)}
                          />
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-slate-900 dark:text-white">{cat.name}</span>
                      )}
                    </div>
                    <div className="flex gap-1 transition-opacity">
                      {isRenaming ? (
                        <button onClick={() => handleRenameCategory(catId, renamingCatName)} className="text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 p-1.5 rounded-lg transition-colors">
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button onClick={() => { setRenamingCatId(catId); setRenamingCatName(cat.name); }} className="text-slate-400 hover:text-emerald-500 hover:bg-slate-200 dark:hover:bg-white/10 p-1.5 rounded-lg transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button onClick={() => setConfirmDeleteCat(catId)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <Input 
                value={newSubCatName} 
                onChange={(e) => setNewSubCatName(e.target.value)}
                placeholder="New sub-category..."
                className="text-xs"
              />
              <button onClick={handleAddSubCategory} className="px-4 bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-white rounded-xl font-bold transition-all active:scale-95">
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-white/5">
            <button 
              onClick={() => setConfirmDeleteSystem(editingSystemId)}
              className="w-full py-3 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-2xl text-xs font-bold uppercase tracking-widest hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
            >
              <Trash className="w-4 h-4" />
              Delete Entire System
            </button>
          </div>
        </div>
      </Modal>

      {/* Confirmation Modals */}
      <ConfirmModal
        isOpen={!!confirmDeleteSystem}
        onClose={() => setConfirmDeleteSystem(null)}
        onConfirm={handleDeleteSystem}
        title="Delete System"
        message="Are you sure you want to delete this whole system? All categories within it will no longer be visible in the dashboard. This action cannot be undone."
        confirmText="Delete System"
        variant="danger"
      />

      <ConfirmModal
        isOpen={!!confirmDeleteCat}
        onClose={() => setConfirmDeleteCat(null)}
        onConfirm={handleDeleteSubCategory}
        title="Remove Category"
        message="Remove this category from the system? You will still be able to find it in the global history, but it won't show up on the dashboard cards."
        confirmText="Remove"
        variant="danger"
      />
    </PageWrapper>
  );
}
