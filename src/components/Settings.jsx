import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useFuel } from '../hooks/useFuelContext';
import { useTheme } from '../hooks/useTheme';
import { Card, Input, Label, cn, PageWrapper, Modal, ConfirmModal } from './ui';
import { Trash2, Plus, CarFront, DollarSign, AlertCircle, Palette, Pencil, Check, MapPin, Navigation, Circle, Bell, Wrench, Settings2, Save } from 'lucide-react';
import { useLocationDetection } from '../hooks/useLocationDetection';
import { gasStationService } from '../services/gasStationService';
import { SavedStations } from './SavedStations';
import { backupService } from '../services/backupService';
import { excelService } from '../services/excelService';
import ImportResolver from './ImportResolver';
import { Download, Upload, Database } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { MAINTENANCE_CATEGORIES } from '../data/maintenanceCategories';

export default function Settings() {
  const { vehicles, selectedVehicleId, setSelectedVehicleId, fuelPrices, setFuelPrices, addVehicle, editVehicle, deleteVehicle, activeVehicle, maintenanceSettings, updateMaintenanceSettings, updateCategorySettings } = useFuel();
  const { theme, setTheme } = useTheme();
  const [newVehicleName, setNewVehicleName] = useState('');
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editingTyreSize, setEditingTyreSize] = useState({ width: 205, aspectRatio: 55, rimSize: 16 });
  const [editingTankCapacity, setEditingTankCapacity] = useState('');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, vehicleId: null, vehicleName: '' });
  const [factoryResetModal, setFactoryResetModal] = useState(false);
  const [validationModal, setValidationModal] = useState({ isOpen: false });
  const [formatModal, setFormatModal] = useState({ isOpen: false, type: 'export' });

  // Fuel Price Form State
  const [priceForm, setPriceForm] = useState({ 92: '', 95: '', diesel: '' });

  useEffect(() => {
    if (fuelPrices) {
      setPriceForm({
        92: fuelPrices[92] || '',
        95: fuelPrices[95] || '',
        diesel: fuelPrices.diesel || ''
      });
    }
  }, [fuelPrices]);

  const handleSavePrices = () => {
    setFuelPrices({
      92: Number(priceForm[92]),
      95: Number(priceForm[95]),
      diesel: Number(priceForm.diesel)
    });
    showToast('Fuel prices updated successfully');
  };
  // Active Vehicle Form State
  const [activeVehicleForm, setActiveVehicleForm] = useState(null);

  useEffect(() => {
    if (activeVehicle) {
      setActiveVehicleForm({
        tyreSize: activeVehicle.tyreSize || { width: '', aspectRatio: '', rimSize: '' },
        tankCapacity: activeVehicle.tankCapacity || ''
      });
    }
  }, [activeVehicle?.id]);
  
  // Location detection state
  const [locationEnabled, setLocationEnabled] = useState(true);
  const { permissionState, clearLocation } = useLocationDetection();

  // Notifications
  const { notificationsEnabled, permissionState: notificationPermission, toggleNotifications } = useNotifications();

  const [importAnalysis, setImportAnalysis] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState(null);

  const [toastMessage, setToastMessage] = useState('');
  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const handleCreateVehicle = (e) => {
    e.preventDefault();
    if (newVehicleName.trim()) {
      addVehicle({ name: newVehicleName.trim(), type: 'car' });
      setNewVehicleName('');
      showToast('Vehicle added successfully');
    }
  };

  const handleSaveEdit = (id) => {
    if (editingName.trim()) {
      editVehicle(id, {
        name: editingName.trim(),
        tyreSize: editingTyreSize,
        tankCapacity: editingTankCapacity ? Number(editingTankCapacity) : null
      });
      showToast('Vehicle updated successfully');
    }
    setEditingVehicleId(null);
  };

  const startEditing = (vehicle) => {
    setEditingVehicleId(vehicle.id);
    setEditingName(vehicle.name);
    setEditingTyreSize(vehicle.tyreSize || { width: 205, aspectRatio: 55, rimSize: 16 });
    setEditingTankCapacity(vehicle.tankCapacity || '');
  };

  const handleClearApp = () => {
    setFactoryResetModal(true);
  };

  const confirmFactoryReset = () => {
    window.localStorage.clear();
    window.location.reload();
  };
  
  const handleClearLocationCache = () => {
    gasStationService.clearCache();
    clearLocation();
  };

  const handleExport = (type = 'json') => {
    if (type === 'excel') {
      excelService.exportData();
    } else {
      backupService.exportData();
    }
  };

  const handleImportClick = (type = 'json') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'excel' ? '.xlsx, .xls' : '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      setIsImporting(true);
      setImportError(null);
      try {
        const analysis = type === 'excel' ? await excelService.analyzeImport(file) : await backupService.analyzeImport(file);
        setImportAnalysis(analysis);
      } catch (err) {
        setImportError(err.message);
      } finally {
        setIsImporting(false);
      }
    };
    input.click();
  };

  const handleApplyImport = (resolutions, newRecords) => {
    backupService.applyImport(importAnalysis.payload, resolutions, newRecords);
    setImportAnalysis(null);
  };

  const handleSaveActiveVehicleDetails = () => {
    if (!activeVehicleForm) return;
    
    const { tyreSize, tankCapacity } = activeVehicleForm;
    const isMissingTyre = !tyreSize.width || !tyreSize.aspectRatio || !tyreSize.rimSize;
    const isMissingTank = !tankCapacity;

    if (isMissingTyre || isMissingTank) {
      setValidationModal({ isOpen: true, isMissingTyre, isMissingTank });
    } else {
      confirmSaveActiveVehicleDetails();
    }
  };

  const confirmSaveActiveVehicleDetails = () => {
    if (!activeVehicleForm) return;
    editVehicle(activeVehicle.id, {
      tyreSize: activeVehicleForm.tyreSize,
      tankCapacity: activeVehicleForm.tankCapacity ? parseFloat(activeVehicleForm.tankCapacity) : null
    });
    setValidationModal({ isOpen: false });
    showToast('Vehicle details saved securely');
  };

  return (
    <PageWrapper className="space-y-6 pb-1">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage vehicles and fuel preferences.</p>
      </div>

      <section>
         <h3 className="text-xs font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2 ml-1"><CarFront className="w-4 h-4"/> Your Garage</h3>
         
         <div className="space-y-3 mb-4">
            {vehicles.map(v => (
               <div key={v.id} className={cn("glass-card group p-4 rounded-xl flex items-center justify-between shadow-sm dark:shadow-none border-slate-200 dark:border-slate-800", v.id === selectedVehicleId && "border-blue-500/50 bg-blue-50 dark:bg-blue-500/5")}>
                  {editingVehicleId === v.id ? (
                    <div className="flex-1 mr-3 space-y-3">
                       <div className="flex items-center gap-2">
                         <Input
                           type="text"
                           value={editingName}
                           onChange={e => setEditingName(e.target.value)}
                           autoFocus
                           className="py-1.5 px-3 text-sm h-auto bg-slate-100 dark:bg-slate-900 focus:ring-blue-500/50 focus:border-blue-500/50"
                           onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(v.id);
                              if (e.key === 'Escape') setEditingVehicleId(null);
                           }}
                           onClick={(e) => e.stopPropagation()}
                         />
                         <button onClick={() => handleSaveEdit(v.id)} className="text-emerald-500 hover:text-emerald-400 p-1.5 bg-emerald-500/10 rounded-lg">
                            <Check className="w-4 h-4" />
                         </button>
                       </div>
                       
                       <div className="flex-1">
                         <Label className="text-[10px]">Tank Capacity (Liters)</Label>
                         <Input
                           type="number"
                           value={editingTankCapacity}
                           onChange={e => setEditingTankCapacity(e.target.value)}
                           className="py-1 px-2 text-xs h-auto bg-slate-100 dark:bg-slate-900"
                           placeholder="e.g. 40"
                         />
                       </div>

                       <div className="space-y-1.5">
                         <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                           <Circle className="w-3 h-3" /> Default Tyre Size
                         </p>
                           <div className="flex-1">
                             <Label className="text-[10px]">Width (mm)</Label>
                             <Input
                               type="number"
                               value={editingTyreSize.width || ''}
                               onChange={e => {
                                 const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                 setEditingTyreSize(prev => ({ ...prev, width: isNaN(val) ? 0 : val }));
                               }}
                               className={cn("py-1 px-2 text-xs h-auto", (editingTyreSize.width === 0) && "border-red-500")}
                             />
                           </div>
                           <div className="flex-1">
                             <Label className="text-[10px]">Aspect (%)</Label>
                             <Input
                               type="number"
                               value={editingTyreSize.aspectRatio || ''}
                               onChange={e => {
                                 const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                 setEditingTyreSize(prev => ({ ...prev, aspectRatio: isNaN(val) ? 0 : val }));
                               }}
                               className={cn("py-1 px-2 text-xs h-auto", (editingTyreSize.aspectRatio === 0) && "border-red-500")}
                             />
                           </div>
                           <div className="flex-1">
                             <Label className="text-[10px]">Rim (in)</Label>
                             <Input
                               type="number"
                               value={editingTyreSize.rimSize || ''}
                               onChange={e => {
                                 const val = e.target.value === '' ? 0 : parseInt(e.target.value);
                                 setEditingTyreSize(prev => ({ ...prev, rimSize: isNaN(val) ? 0 : val }));
                               }}
                               className={cn("py-1 px-2 text-xs h-auto", (editingTyreSize.rimSize === 0) && "border-red-500")}
                             />
                           </div>
                         <p className="text-[10px] text-slate-400">
                           {editingTyreSize.width}/{editingTyreSize.aspectRatio} R{editingTyreSize.rimSize}
                         </p>
                       </div>
                    </div>
                  ) : (
                     <div className="flex-1 mr-3 flex items-center gap-2 cursor-pointer" onClick={() => setSelectedVehicleId(v.id)}>
                       <div className="flex items-center gap-3">
                         <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${v.id === selectedVehicleId ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 dark:border-slate-700'}`}>
                           {v.id === selectedVehicleId && <Check className="w-3 h-3" />}
                         </div>
                         <div>
                           <span className="font-semibold text-slate-900 dark:text-slate-200 block">{v.name}</span>
                           {v.tyreSize && (
                             <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                               <Circle className="w-3 h-3" /> {v.tyreSize.width}/{v.tyreSize.aspectRatio} R{v.tyreSize.rimSize}
                             </span>
                           )}
                         </div>
                       </div>
                       <button
                         onClick={(e) => { e.stopPropagation(); startEditing(v); }}
                         className="text-slate-400 hover:text-blue-400 p-1 opacity-40 group-hover:opacity-100 transition-opacity md:opacity-40 ml-auto"
                       >
                          <Pencil className="w-3.5 h-3.5" />
                       </button>
                     </div>
                  )}
                  
                  <div className="shrink-0 flex items-center border-l border-slate-200 dark:border-slate-800 pl-2 ml-1">
                     <button 
                        onClick={() => {
                          setDeleteModal({ isOpen: true, vehicleId: v.id, vehicleName: v.name });
                        }} 
                        disabled={vehicles.length === 1 || editingVehicleId === v.id}
                        className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-2 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                  </div>
               </div>
            ))}
         </div>

         <form onSubmit={handleCreateVehicle} className="flex gap-2">
            <Input 
              type="text" 
              placeholder="New vehicle name (e.g., Wife's Car)" 
              value={newVehicleName}
              onChange={e => setNewVehicleName(e.target.value)}
              className="py-3"
            />
            <button type="submit" disabled={!newVehicleName} className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-slate-950 px-5 rounded-2xl font-bold transition flex items-center justify-center">
              <Plus className="w-5 h-5"/>
            </button>
         </form>
      </section>

      <section className="pt-4">
         <div className="flex items-center justify-between mb-3">
           <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2 ml-1"><Circle className="w-4 h-4"/> Active Vehicle Details</h3>
           {activeVehicleForm && (
             <button
               onClick={handleSaveActiveVehicleDetails}
               className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm"
             >
               Save Details
             </button>
           )}
         </div>
         <Card className="px-5 py-5 space-y-3">
            {!activeVehicle || !activeVehicleForm ? (
              <p className="text-sm text-slate-500">No active vehicle selected.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{activeVehicle.name}</span>
                  {activeVehicleForm.tyreSize?.width ? (
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                      {activeVehicleForm.tyreSize.width}/{activeVehicleForm.tyreSize.aspectRatio} R{activeVehicleForm.tyreSize.rimSize}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg">Tyres not set</span>
                  )}
                  {activeVehicleForm.tankCapacity && (
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-lg ml-2">
                      {activeVehicleForm.tankCapacity}L Tank
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 items-start mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                  <div className="flex flex-col">
                    <Label className="text-[10px] mb-1.5 h-4">Width (mm)</Label>
                    <Input
                      type="number"
                      value={activeVehicleForm.tyreSize?.width || ''}
                      onChange={e => {
                        const width = e.target.value === '' ? '' : parseInt(e.target.value);
                        setActiveVehicleForm(prev => ({ ...prev, tyreSize: { ...prev.tyreSize, width } }));
                      }}
                      className={cn("py-2 px-2 text-xs h-10", (!activeVehicleForm.tyreSize?.width) && "border-amber-500/50")}
                    />
                  </div>
                  <div className="flex flex-col">
                    <Label className="text-[10px] mb-1.5 h-4">Aspect (%)</Label>
                    <Input
                      type="number"
                      value={activeVehicleForm.tyreSize?.aspectRatio || ''}
                      onChange={e => {
                        const aspectRatio = e.target.value === '' ? '' : parseInt(e.target.value);
                        setActiveVehicleForm(prev => ({ ...prev, tyreSize: { ...prev.tyreSize, aspectRatio } }));
                      }}
                      className={cn("py-2 px-2 text-xs h-10", (!activeVehicleForm.tyreSize?.aspectRatio) && "border-amber-500/50")}
                    />
                  </div>
                  <div className="flex flex-col">
                    <Label className="text-[10px] mb-1.5 h-4">Rim (in)</Label>
                    <Input
                      type="number"
                      value={activeVehicleForm.tyreSize?.rimSize || ''}
                      onChange={e => {
                        const rimSize = e.target.value === '' ? '' : parseInt(e.target.value);
                        setActiveVehicleForm(prev => ({ ...prev, tyreSize: { ...prev.tyreSize, rimSize } }));
                      }}
                      className={cn("py-2 px-2 text-xs h-10", (!activeVehicleForm.tyreSize?.rimSize) && "border-amber-500/50")}
                    />
                  </div>
                  <div className="flex flex-col">
                    <Label className="text-[10px] mb-1.5 h-4 text-blue-600 dark:text-blue-400 font-bold">Tank (L)</Label>
                    <Input
                      type="number"
                      value={activeVehicleForm.tankCapacity || ''}
                      onChange={e => {
                        const cap = e.target.value === '' ? '' : parseFloat(e.target.value);
                        setActiveVehicleForm(prev => ({ ...prev, tankCapacity: cap }));
                      }}
                      className={cn("py-2 px-2 text-xs h-10 border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/10 focus:ring-blue-500", (!activeVehicleForm.tankCapacity) && "border-amber-500/50")}
                      placeholder="e.g. 40"
                    />
                  </div>
                </div>
              </div>
            )}
         </Card>
      </section>

      <section className="pt-4">
         <h3 className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2 ml-1"><Palette className="w-4 h-4"/> Theme Preferences</h3>
         <Card className="px-5 py-6">
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-2xl relative z-20">
              {['light', 'dark', 'system'].map(t => (
                 <button
                    key={t}
                    onClick={() => { setTheme(t); showToast(`${t.charAt(0).toUpperCase() + t.slice(1)} theme applied`); }}
                    className={`relative flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold capitalize transition-all ${
                       theme === t
                       ? 'text-slate-900 dark:text-white'
                       : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                 >
                    {theme === t && (
                       <motion.div
                          layoutId="settingsThemeTab"
                          className="absolute inset-0 bg-white dark:bg-indigo-500 rounded-xl shadow-sm"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                       />
                    )}
                    <span className="relative z-10">{t}</span>
                 </button>
              ))}
            </div>
         </Card>
      </section>

      <section className="pt-4">
         <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2 ml-1"><Navigation className="w-4 h-4"/> Location Services</h3>
         
         <Card className="px-5 py-6">
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                  <div>
                     <p className="text-sm font-medium text-slate-900 dark:text-white">Gas Station Detection</p>
                     <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Automatically detect nearby gas stations when adding fill-ups</p>
                  </div>
                  <button
                     onClick={() => { setLocationEnabled(!locationEnabled); showToast(locationEnabled ? 'Location detection disabled' : 'Location detection enabled'); }}
                     className={`relative ms-1 inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        locationEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                     }`}
                  >
                     <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        locationEnabled ? 'translate-x-5' : 'translate-x-1'
                     }`} />
                  </button>
               </div>
               
               <div className="flex items-center justify-between">
                  <div>
                     <p className="text-sm font-medium text-slate-900 dark:text-white">Location Permission</p>
                     <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {permissionState === 'granted' ? '✅ Location access granted' :
                         permissionState === 'denied' ? '❌ Location access denied' :
                         permissionState === 'prompt' ? '📍 Location permission required' :
                         '📍 Checking permission...'}
                     </p>
                  </div>
                  <MapPin className="w-4 h-4 text-slate-400" />
               </div>
               
               <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50">
                  <button
                     onClick={() => { handleClearLocationCache(); showToast('Location cache cleared'); }}
                     className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                  >
                     Clear Location Cache
                  </button>
               </div>
            </div>
         </Card>
      </section>

      {/* Notifications Section */}
      <section className="pt-4">
         <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2 ml-1"><Bell className="w-4 h-4"/> Notifications</h3>
         
         <Card className="px-5 py-6">
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                  <div>
                     <p className="text-sm font-medium text-slate-900 dark:text-white">Maintenance Reminders</p>
                     <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Get notified when maintenance is due based on date or mileage</p>
                  </div>
                  <button
                     onClick={() => { toggleNotifications(); showToast(notificationsEnabled ? 'Notifications disabled' : 'Notifications enabled'); }}
                     className={`relative ms-1 inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        notificationsEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                     }`}
                  >
                     <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        notificationsEnabled ? 'translate-x-5' : 'translate-x-1'
                     }`} />
                  </button>
               </div>
               
               <div className="flex items-center justify-between">
                  <div>
                     <p className="text-sm font-medium text-slate-900 dark:text-white">Notification Permission</p>
                     <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {notificationPermission === 'granted' ? '✅ Notifications enabled' :
                         notificationPermission === 'denied' ? '❌ Notifications blocked' :
                         notificationPermission === 'default' ? '📍 Permission not requested' :
                         '📍 Checking permission...'}
                     </p>
                  </div>
                  <Bell className={`w-4 h-4 ${notificationsEnabled ? 'text-emerald-500' : 'text-slate-400'}`} />
               </div>
               
               {notificationPermission === 'denied' && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-600 dark:text-amber-400">
                     <AlertCircle size={14} className="inline mr-1" />
                     Please enable notifications in your browser settings to receive maintenance reminders.
                  </div>
               )}
            </div>
         </Card>
      </section>



      <section className="pt-4">
         <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2 ml-1"><MapPin className="w-4 h-4"/> Saved Gas Stations</h3>
         
         <Card className="px-5 py-6">
            <SavedStations onStationUpdate={() => {
              // Force refresh of any station detection if needed
              gasStationService.clearCache();
            }} />
         </Card>
      </section>

      <section className="pt-4">
         <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2 ml-1"><DollarSign className="w-4 h-4"/> Global Fuel Prices</h3>
         
         <Card className="px-5 py-6">
            <div className="space-y-4">
               <div>
                  <Label>Petrol 92 (EGP/L)</Label>
                  <Input 
                    type="number" step="0.01"
                    value={priceForm[92]} 
                    onChange={e => setPriceForm({...priceForm, 92: e.target.value})}
                  />
               </div>
               <div>
                  <Label>Petrol 95 (EGP/L)</Label>
                  <Input 
                    type="number" step="0.01"
                    value={priceForm[95]} 
                    onChange={e => setPriceForm({...priceForm, 95: e.target.value})}
                  />
               </div>
               <div>
                  <Label>Diesel (EGP/L)</Label>
                  <Input 
                    type="number" step="0.01"
                    value={priceForm['diesel']} 
                    onChange={e => setPriceForm({...priceForm, 'diesel': e.target.value})}
                  />
               </div>
               
               <button
                  onClick={handleSavePrices}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 mt-2 active:scale-[0.98]"
               >
                  <Save size={18} /> Save Prices
               </button>
            </div>
         </Card>
      </section>

      <section className="pt-4">
         <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2 ml-1"><Database className="w-4 h-4"/> Data Backup & Recovery</h3>
         
         <Card className="px-5 py-6">
            <div className="space-y-4">
               <p className="text-xs text-slate-500 dark:text-slate-400">
                  Export your data to a JSON file for safe-keeping, or import a previous backup to restore your history.
               </p>
               
               <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => setFormatModal({ isOpen: true, type: 'export' })}
                    className="flex items-center justify-center gap-2 py-4 px-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  >
                     <Download size={18} className="text-blue-500" /> Export
                  </button>
                  <button 
                    onClick={() => setFormatModal({ isOpen: true, type: 'import' })}
                    disabled={isImporting}
                    className="flex items-center justify-center gap-2 py-4 px-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                     <Upload size={18} className="text-emerald-500" /> Import
                  </button>
               </div>

               {importError && (
                 <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-500 font-semibold flex items-center gap-2">
                   <AlertCircle size={14} /> {importError}
                 </div>
               )}
            </div>
         </Card>
      </section>

      <section className="pt-8 mb-2">
         <button onClick={handleClearApp} className="w-full py-4 rounded-[1.5rem] border border-red-500/20 text-red-500 font-bold hover:bg-red-500/10 transition flex justify-center gap-2 items-center shadow-lg shadow-red-500/5">
            <AlertCircle className="w-5 h-5" /> Factory Reset App
         </button>
         <p className="text-center text-xs text-slate-500 mt-3">Clears all local storage data and refreshes.</p>
      </section>

      {/* Vehicle Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, vehicleId: null, vehicleName: '' })}
        onConfirm={() => deleteVehicle(deleteModal.vehicleId)}
        title="Delete Vehicle"
        message={`Are you sure you want to delete ${deleteModal.vehicleName}? All its history will be lost.`}
        confirmText="Delete Vehicle"
        variant="danger"
      />

      {/* Factory Reset Confirmation Modal */}
      <ConfirmModal
        isOpen={factoryResetModal}
        onClose={() => setFactoryResetModal(false)}
        onConfirm={confirmFactoryReset}
        title="Factory Reset App"
        message="DANGER: Are you sure you want to completely erase all data in this app? This action is irreversible offline."
        confirmText="Reset App"
        variant="danger"
      />

      {/* Validation Modal for Active Vehicle Details */}
      <ConfirmModal
        isOpen={validationModal.isOpen}
        onClose={() => setValidationModal({ isOpen: false })}
        onConfirm={confirmSaveActiveVehicleDetails}
        title="Missing Specifications"
        message={
          <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <p>You are missing some vehicle specifications which will disable certain features:</p>
            <ul className="list-disc pl-5 font-medium text-amber-600 dark:text-amber-500">
              {validationModal.isMissingTyre && <li>Tyre Comparisons won't be calculated accurately.</li>}
              {validationModal.isMissingTank && <li>Fuel consumption for partial fill-ups cannot be estimated.</li>}
            </ul>
            <p className="pt-2">Do you want to save anyway?</p>
          </div>
        }
        confirmText="Save Anyway"
        cancelText="Go Back"
      />

      {/* Backup Format Selection Modal */}
      <Modal
        isOpen={formatModal.isOpen}
        onClose={() => setFormatModal({ isOpen: false })}
        title={formatModal.type === 'export' ? "Export Data" : "Import Data"}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {formatModal.type === 'export' 
              ? "Choose the format you'd like to save your data in:" 
              : "Choose the format of the file you'd like to import:"}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setFormatModal({ isOpen: false });
                if (formatModal.type === 'export') handleExport('json');
                else handleImportClick('json');
              }}
              className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Database className="w-6 h-6 text-blue-500" />
              </div>
              <span className="font-bold text-slate-900 dark:text-white text-sm">JSON</span>
              <span className="text-[10px] text-slate-500 mt-1">Standard Backup</span>
            </button>
            
            <button
              onClick={() => {
                setFormatModal({ isOpen: false });
                if (formatModal.type === 'export') handleExport('excel');
                else handleImportClick('excel');
              }}
              className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all group"
            >
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Database className="w-6 h-6 text-emerald-500" />
              </div>
              <span className="font-bold text-slate-900 dark:text-white text-sm">Excel</span>
              <span className="text-[10px] text-slate-500 mt-1">Spreadsheet (.xlsx)</span>
            </button>
          </div>
          
          <button
            onClick={() => setFormatModal({ isOpen: false })}
            className="w-full py-3 mt-2 text-sm font-bold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </Modal>

      {/* Import Resolution Modal */}
      {importAnalysis && (
        <ImportResolver 
          analysis={importAnalysis}
          onCancel={() => setImportAnalysis(null)}
          onApply={handleApplyImport}
        />
      )}

      {/* Global Setting Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-emerald-500/90 backdrop-blur-md text-white px-4 py-2.5 rounded-full shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 z-50 text-sm font-semibold max-w-[90%]"
          >
            <Check className="w-4 h-4" />
            <span className="truncate">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </PageWrapper>
  );
}
