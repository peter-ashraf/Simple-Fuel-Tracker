import { useState, useMemo, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Wrench, Plus, Bell, CurrencyDollar, MagnifyingGlass, Pencil, Trash, CalendarBlank, 
  GearSix, ShieldWarning, CaretDown, Check, Square, CheckSquare, 
  X, Palette, Layout, Pulse, Drop, Shield, BatteryCharging, Car, Disc, Lightning, Clock,
  DotsThreeVertical, CaretRight, FloppyDisk, Warning, Engine, Tire
} from '@phosphor-icons/react';
import { useFuel } from '../hooks/useFuelContext';
import { Card, PageWrapper, ConfirmModal, Modal, Input, Label, cn, IconPicker, ICON_MAP_DATA } from './ui';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const ICON_MAP = { 
  ...ICON_MAP_DATA,
  Zap: ICON_MAP_DATA.Lightning, 
  Droplet: ICON_MAP_DATA.Drop, 
  Battery: ICON_MAP_DATA.BatteryCharging,
  Disc: ICON_MAP_DATA.Tire
};

export default function Maintenance() {
  const { 
    maintenanceEntries, 
    deleteMaintenanceEntry, 
    activeVehicle,
    activeVehicleFillUps,
    maintenanceSettings,
    categories,
    getCategoryById,
    maintenanceSystems,
    setMaintenanceSystems,
    addMaintenanceCategory,
    updateMaintenanceCategory
  } = useFuel();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  
  const [activeTab, setActiveTab] = useState('overview'); // overview, history, settings
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedSystemId, setSelectedSystemId] = useState(null);
  
  // Modals & Editing State
  const [editingSystemId, setEditingSystemId] = useState(null);
  const [editSystemName, setEditSystemName] = useState('');
  const [editSystemIcon, setEditSystemIcon] = useState('Wrench');
  const [newSubCatName, setNewSubCatName] = useState('');
  const [isPickingIcon, setIsPickingIcon] = useState(false);
  const [renamingCatId, setRenamingCatId] = useState(null);
  const [renamingCatName, setRenamingCatName] = useState('');
  const [justSavedCatId, setJustSavedCatId] = useState(null);
  const [systemSaveFeedback, setSystemSaveFeedback] = useState(false);
  
  // Confirm Modals
  const [confirmDeleteSystem, setConfirmDeleteSystem] = useState(null); // stores id
  const [confirmDeleteCat, setConfirmDeleteCat] = useState(null); // stores id

  const categoryDropdownRef = useRef(null);
  const isRtl = i18n.language.startsWith('ar');

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

  const currentOdometer = activeVehicleFillUps.length > 0 
    ? activeVehicleFillUps[activeVehicleFillUps.length - 1].odometer 
    : 0;

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
        <svg width={size} height={size} className={cn("transform", isRtl ? "rotate-90" : "-rotate-90")}>
          <circle cx={size / 2} cy={size / 2} r={radius} stroke="currentColor" strokeWidth={strokeWidth} fill="transparent" className="text-slate-100 dark:text-white/5" />
          <motion.circle
            cx={size / 2} cy={size / 2} r={radius} stroke={color} strokeWidth={strokeWidth} fill="transparent" strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }} transition={{ duration: 1.5 }} strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children}
          <span className="text-[10px] font-black mt-0.5" style={{ color }}>{Math.round(percentage)}%</span>
        </div>
      </div>
    );
  };

  const categoryProgress = useMemo(() => {
    return categories.map(cat => {
      const logs = maintenanceEntries.filter(e => e.type === cat.id).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
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
      if (!isTracked) status = 'untracked';
      else if (currentOdometer >= nextDueODO) status = 'overdue';
      else if (currentOdometer >= alertODO) status = 'due-soon';
      return { ...cat, remainingKm, progressPercent, status, isTracked, intervalKm: interval, latestLogId: latestCompletion?.id || null };
    });
  }, [categories, maintenanceEntries, currentOdometer, maintenanceSettings]);

  const systemStatus = useMemo(() => {
    return maintenanceSystems.map(system => {
      const systemCategories = categoryProgress.filter(cp => system.categories.includes(cp.id));
      const trackedCategories = systemCategories.filter(cp => cp.isTracked);
      const overdueCount = systemCategories.filter(cp => cp.status === 'overdue').length;
      const dueSoonCount = systemCategories.filter(cp => cp.status === 'due-soon').length;
      let healthScore = 100;
      if (trackedCategories.length > 0) healthScore = 100 - (trackedCategories.reduce((sum, cp) => sum + Math.max(0, Math.min(100, cp.progressPercent)), 0) / trackedCategories.length);
      let status = overdueCount > 0 ? 'overdue' : dueSoonCount > 0 ? 'due-soon' : trackedCategories.length === 0 ? 'untracked' : 'healthy';
      
      let desc = t(status);
      let subDesc = status === 'due-soon' ? `${Math.min(...systemCategories.filter(c => c.isTracked).map(c => c.remainingKm)).toLocaleString()} ${t('km_left')}` : '';
      let color = status === 'overdue' ? "#ef4444" : status === 'due-soon' ? "#f59e0b" : status === 'untracked' ? "#94a3b8" : "#10b981";

      return { ...system, categories: systemCategories, healthScore, status, desc, subDesc, displayColor: color };
    });
  }, [categoryProgress, maintenanceSystems, t]);

  const activeSystem = selectedSystemId ? systemStatus.find(s => s.id === selectedSystemId) : null;
  const editingSystem = editingSystemId ? maintenanceSystems.find(s => s.id === editingSystemId) : null;

  const handleSaveSystemName = () => {
    if (!editingSystemId || !editSystemName.trim()) return;
    
    const currentSystem = maintenanceSystems.find(s => s.id === editingSystemId);
    if (currentSystem?.name === editSystemName.trim() && currentSystem?.icon === editSystemIcon) {
      setSystemSaveFeedback('no-change');
      setTimeout(() => {
        setSystemSaveFeedback(false);
        setEditingSystemId(null);
      }, 1000);
      return;
    }

    setMaintenanceSystems(prev => prev.map(s => s.id === editingSystemId ? { ...s, name: editSystemName, icon: editSystemIcon } : s));
    setSystemSaveFeedback('saved');
    setTimeout(() => {
      setSystemSaveFeedback(false);
      setEditingSystemId(null);
    }, 1000);
  };

  const handleRenameCategory = (catId, newName) => {
    if (!newName.trim()) {
      setRenamingCatId(null);
      return;
    }
    
    const cat = getCategoryById(catId);
    if (cat.name === newName.trim()) {
      setRenamingCatId(null);
      return;
    }

    updateMaintenanceCategory(catId, { name: newName });
    setJustSavedCatId(catId);
    setTimeout(() => setJustSavedCatId(null), 2000);
    setRenamingCatId(null);
  };

  const handleDeleteSystem = () => {
    setMaintenanceSystems(prev => prev.filter(s => s.id !== confirmDeleteSystem));
    setConfirmDeleteSystem(null);
    setEditingSystemId(null);
  };

  const handleAddSubCategory = () => {
    if (!newSubCatName.trim() || !editingSystemId) return;
    const newCat = addMaintenanceCategory({ name: newSubCatName, color: editingSystem.color });
    setMaintenanceSystems(prev => prev.map(s => s.id === editingSystemId ? { ...s, categories: [...s.categories, newCat.id] } : s));
    setNewSubCatName('');
  };

  const handleAddSystem = () => {
    const newId = `system_${Date.now()}`;
    const newSystem = {
      id: newId,
      name: t('new_system'),
      icon: 'Wrench',
      categories: [],
      color: '#3b82f6'
    };
    setMaintenanceSystems(prev => [...prev, newSystem]);
    setEditingSystemId(newId);
    setEditSystemName(newSystem.name);
    setEditSystemIcon(newSystem.icon);
  };

  const handleDeleteSubCategory = () => {
    setMaintenanceSystems(prev => prev.map(s => s.id === editingSystemId ? { ...s, categories: s.categories.filter(id => id !== confirmDeleteCat) } : s));
    setConfirmDeleteCat(null);
  };

  const translateSystemName = (name) => {
    const key = name.toLowerCase();
    const translation = t(key);
    return translation === key ? name : translation;
  };

  return (
    <PageWrapper className="pb-24">
      <div className="mb-6">
        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">{t('maintenance')}</h2>
      </div>

      <div className="flex gap-2 mb-8 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-2xl relative z-20">
        {['overview', 'history', 'settings'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`relative flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold capitalize transition-all ${activeTab === tab ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
            {activeTab === tab && <motion.div layoutId="maintenanceActiveTab" className="absolute inset-0 bg-white dark:bg-slate-800 rounded-xl shadow-sm" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
            <span className="relative z-10">{t(tab)}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div key="overview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="grid grid-cols-2 gap-4">
            {systemStatus.map(system => {
              const isOverdue = system.status === 'overdue';
              const Icon = ICON_MAP[system.icon] || Wrench;
              return (
                <Card key={system.id} className={cn("p-4 flex flex-col items-center text-center rounded-[2rem] cursor-pointer transition-all active:scale-[0.96]", isOverdue && "ring-2 ring-red-500/50 bg-red-500/5")} onClick={() => setSelectedSystemId(system.id)}>
                  <CircularProgress percentage={system.healthScore} color={system.displayColor} size={70} strokeWidth={5}>
                    <Icon className={cn("w-6 h-6", isOverdue ? 'text-red-500' : system.status === 'due-soon' ? 'text-amber-500' : 'text-slate-900 dark:text-white')} />
                  </CircularProgress>
                  <div className="mt-3">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight">{translateSystemName(system.name)}</h4>
                    <p className={cn("text-[10px] font-bold mt-0.5", isOverdue ? 'text-red-500' : system.status === 'due-soon' ? 'text-amber-500' : 'text-slate-500')}>{system.desc}</p>
                    <p className="text-[8px] font-medium text-slate-400 mt-0.5 uppercase">{system.subDesc}</p>
                  </div>
                </Card>
              );
            })}
          </motion.div>
        )}

        {activeTab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-6">
            <div className="p-3 bg-white dark:bg-white/[0.03] rounded-3xl border border-slate-200 dark:border-slate-700/50">
               <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <MagnifyingGlass weight="duotone" className={`absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400`} />
                    <input type="text" placeholder={t('search')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={cn("w-full py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl text-sm outline-none", isRtl ? "pr-9 pl-4" : "pl-9 pr-4")} />
                  </div>
                  <div className="relative" ref={categoryDropdownRef}>
                    <button onClick={() => setDropdownOpen(!dropdownOpen)} className="w-full flex items-center justify-between bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-xl px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      <span>{selectedCategory === 'all' ? t('all_categories') : t(getCategoryById(selectedCategory).id)}</span>
                      <motion.div animate={{ rotate: dropdownOpen ? 180 : 0 }}><CaretDown weight="duotone" className="w-4 h-4 text-slate-400" /></motion.div>
                    </button>
                    <AnimatePresence>
                      {dropdownOpen && (
                        <motion.div className="absolute right-0 top-full mt-1 w-full bg-white dark:bg-slate-800 border rounded-xl shadow-xl z-50 overflow-hidden">
                           <div className="max-h-60 overflow-y-auto p-1">
                              <button onClick={() => { setSelectedCategory('all'); setDropdownOpen(false); }} className="w-full text-start px-3 py-2 text-sm rounded-lg hover:bg-slate-50">{t('all_categories')}</button>
                              {categories.map(cat => (
                                <button key={cat.id} onClick={() => { setSelectedCategory(cat.id); setDropdownOpen(false); }} className="w-full text-start px-3 py-2 text-sm rounded-lg hover:bg-slate-50">{t(cat.id)}</button>
                              ))}
                           </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
               </div>
            </div>

            <div className="relative">
              <div className={`absolute ${isRtl ? 'right-4' : 'left-4'} top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700`} />
              <div className={cn("space-y-4", isRtl ? "pr-10" : "pl-10")}>
                {filteredEntries.map((log) => {
                  const category = getCategoryById(log.type);
                  return (
                    <div key={log.id} className="relative">
                      <div className={`absolute ${isRtl ? '-right-10' : '-left-10'} top-4 w-4 h-4 rounded-full border-2 border-white dark:border-slate-800`} style={{ backgroundColor: category.color }} />
                      <Card className="p-4 cursor-pointer" onClick={() => navigate(`/maintenance/edit/${log.id}`)}>
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-bold text-slate-900 dark:text-white">{t(category.id)}</h3>
                            <p className="text-xs text-slate-500">{format(new Date(log.timestamp), 'MMM d, yyyy')} • {log.performedAtODO.toLocaleString()} km</p>
                          </div>
                          <Pencil weight="duotone" className="w-4 h-4 text-slate-400" />
                        </div>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'settings' && (
          <motion.div key="settings" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="grid grid-cols-1 gap-3">
            {maintenanceSystems.map(system => {
              const Icon = ICON_MAP[system.icon] || Wrench;
              return (
                <Card key={system.id} className="p-4 flex items-center justify-between cursor-pointer" onClick={() => { setEditingSystemId(system.id); setEditSystemName(system.name); setEditSystemIcon(system.icon || 'Wrench'); }}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-white" style={{ backgroundColor: system.color }}><Icon className="w-5 h-5" /></div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">{translateSystemName(system.name)}</h4>
                      <p className="text-[10px] text-slate-500">{system.categories.length} {t('sub_categories')}</p>
                    </div>
                  </div>
                  <CaretRight weight="duotone" className={cn("w-5 h-5 text-slate-300", isRtl && "rotate-180")} />
                </Card>
              );
            })}
            
            <button 
              onClick={handleAddSystem} 
              className="p-4 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center gap-3 text-slate-400 hover:text-emerald-500 hover:border-emerald-500/50 transition-all active:scale-[0.98]"
            >
              <Plus weight="bold" className="w-5 h-5" />
              <span className="text-sm font-bold">{t('add_system')}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <Modal isOpen={!!selectedSystemId} onClose={() => setSelectedSystemId(null)} title={translateSystemName(activeSystem?.name || '')}>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {activeSystem?.categories.map(item => (
            <Card key={item.id} className="p-4 bg-slate-50 dark:bg-white/[0.02] cursor-pointer" onClick={() => { setSelectedSystemId(null); navigate(item.isTracked ? `/maintenance/edit/${item.latestLogId}` : `/maintenance/add?type=${item.id}`); }}>
              <div className="flex justify-between items-center mb-2">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900 dark:text-white">{t(item.id)}</span>
                  <span className="text-[10px] font-bold text-slate-400">{Math.round(100 - item.progressPercent)}% {t('healthy')}</span>
                </div>
                <span className={cn("text-[10px] font-black uppercase", item.status === 'overdue' ? 'text-red-500' : 'text-emerald-500')}>{t(item.status)}</span>
              </div>
              {!item.isUntracked && (
                <div className="space-y-2">
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden"><div className="h-full bg-emerald-500" style={{ width: `${item.progressPercent}%` }} /></div>
                  <p className="text-[10px] text-slate-500">{t('next_due')}: {item.remainingKm.toLocaleString()} {t('km_left')}</p>
                </div>
              )}
            </Card>
          ))}
        </div>
      </Modal>

      <Modal isOpen={!!editingSystemId} onClose={() => setEditingSystemId(null)} title={t('edit') + ' ' + t('systems')}>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsPickingIcon(true)}
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0 hover:opacity-90 transition-opacity relative group overflow-hidden" 
              style={{ backgroundColor: editingSystem?.color }}
            >
              {(() => {
                const Icon = ICON_MAP[editSystemIcon] || Wrench;
                return <Icon weight="duotone" className="w-7 h-7" />;
              })()}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Pencil weight="bold" className="w-4 h-4 text-white" />
              </div>
              <div className="absolute top-1 right-1 w-4 h-4 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Pencil weight="bold" className="w-2.5 h-2.5 text-white" />
              </div>
            </button>
            <div className="flex-1">
              <Label>{t('system_name')}</Label>
              <Input value={editSystemName} onChange={(e) => setEditSystemName(e.target.value)} placeholder={t('systems')} />
            </div>
          </div>
          
          <div className="space-y-2">
            {editingSystem?.categories.map(catId => {
              const cat = getCategoryById(catId);
              const isRenaming = renamingCatId === catId;
              return (
                <div key={catId} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-white/5 rounded-2xl">
                  {isRenaming ? (
                    <input autoFocus className="bg-white dark:bg-slate-800 rounded px-2 py-1 text-xs w-full" value={renamingCatName} onChange={(e) => setRenamingCatName(e.target.value)} onBlur={() => handleRenameCategory(catId, renamingCatName)} />
                  ) : (
                    <span className="text-xs font-bold">{t(cat.id) || cat.name}</span>
                  )}
                  <div className="flex gap-1">
                    <button 
                      onClick={() => { 
                        if (isRenaming) {
                          handleRenameCategory(catId, renamingCatName);
                        } else {
                          setRenamingCatId(catId); 
                          setRenamingCatName(cat.name); 
                        }
                      }} 
                      className={cn("p-1.5 transition-colors", isRenaming || justSavedCatId === catId ? "text-emerald-500" : "text-slate-400")}
                    >
                      {isRenaming ? (
                        <Check weight="bold" className="w-3.5 h-3.5" />
                      ) : justSavedCatId === catId ? (
                        <Check weight="bold" className="w-3.5 h-3.5" />
                      ) : (
                        <Pencil weight="duotone" className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button onClick={() => setConfirmDeleteCat(catId)} className="p-1.5 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors">
                      <Trash weight="duotone" className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={() => setConfirmDeleteSystem(editingSystemId)} className="p-4 bg-red-50 dark:bg-red-500/10 text-red-500 rounded-2xl transition-all active:scale-[0.98]">
              <Trash weight="duotone" className="w-6 h-6" />
            </button>
            <button 
              onClick={handleSaveSystemName} 
              className={cn(
                "flex-1 py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2",
                systemSaveFeedback === 'saved' ? "bg-emerald-500 text-white" : 
                systemSaveFeedback === 'no-change' ? "bg-slate-200 dark:bg-slate-800 text-slate-500" :
                "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
              )}
            >
              {systemSaveFeedback === 'saved' ? (
                <>
                  <Check weight="bold" className="w-5 h-5" />
                  <span>{t('saved')}</span>
                </>
              ) : systemSaveFeedback === 'no-change' ? (
                <>
                  <X weight="bold" className="w-5 h-5" />
                  <span>{t('no_changes')}</span>
                </>
              ) : (
                <span>{t('save')}</span>
              )}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal 
        isOpen={!!confirmDeleteSystem} 
        onClose={() => setConfirmDeleteSystem(null)} 
        onConfirm={handleDeleteSystem} 
        title={t('delete_system')} 
        message={t('delete_system_warning') || "Deleting this system will remove its tracking data. This action cannot be undone."} 
        confirmText={t('delete')} 
        variant="danger" 
      />
      <ConfirmModal isOpen={!!confirmDeleteCat} onClose={() => setConfirmDeleteCat(null)} onConfirm={handleDeleteSubCategory} title={t('delete')} message={t('delete') + "?"} confirmText={t('delete')} variant="danger" />

      <IconPicker 
        isOpen={isPickingIcon} 
        onClose={() => setIsPickingIcon(false)} 
        currentIcon={editSystemIcon} 
        onSelect={setEditSystemIcon} 
      />
    </PageWrapper>
  );
}
