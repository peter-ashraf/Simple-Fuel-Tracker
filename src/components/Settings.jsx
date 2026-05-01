import { useState } from 'react';
import { useFuel } from '../hooks/useFuelContext';
import { useTheme } from '../hooks/useTheme';
import { Card, Input, Label, cn, PageWrapper, ConfirmModal } from './ui';
import { Trash2, Plus, CarFront, DollarSign, AlertCircle, Palette, Pencil, Check, MapPin, Navigation, Circle, Bell, Wrench, Settings2 } from 'lucide-react';
import { useLocationDetection } from '../hooks/useLocationDetection';
import { gasStationService } from '../services/gasStationService';
import { SavedStations } from './SavedStations';
import { backupService } from '../services/backupService';
import ImportResolver from './ImportResolver';
import { Download, Upload, Database } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { MAINTENANCE_CATEGORIES } from '../data/maintenanceCategories';

export default function Settings() {
  const { vehicles, selectedVehicleId, fuelPrices, setFuelPrices, addVehicle, editVehicle, deleteVehicle, activeVehicle, maintenanceSettings, updateMaintenanceSettings, updateCategorySettings } = useFuel();
  const { theme, setTheme } = useTheme();
  const [newVehicleName, setNewVehicleName] = useState('');
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editingTyreSize, setEditingTyreSize] = useState({ width: 205, aspectRatio: 55, rimSize: 16 });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, vehicleId: null, vehicleName: '' });
  const [factoryResetModal, setFactoryResetModal] = useState(false);
  
  // Location detection state
  const [locationEnabled, setLocationEnabled] = useState(true);
  const { permissionState, clearLocation } = useLocationDetection();

  // Notifications
  const { notificationsEnabled, permissionState: notificationPermission, toggleNotifications } = useNotifications();

  // Backup & Import state
  const [importAnalysis, setImportAnalysis] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState(null);

  const handleCreateVehicle = (e) => {
    e.preventDefault();
    if (newVehicleName.trim()) {
      addVehicle({ name: newVehicleName.trim(), type: 'car' });
      setNewVehicleName('');
    }
  };

  const handleSaveEdit = (id) => {
    if (editingName.trim()) {
      editVehicle(id, {
        name: editingName.trim(),
        tyreSize: editingTyreSize
      });
    }
    setEditingVehicleId(null);
  };

  const startEditing = (vehicle) => {
    setEditingVehicleId(vehicle.id);
    setEditingName(vehicle.name);
    setEditingTyreSize(vehicle.tyreSize || { width: 205, aspectRatio: 55, rimSize: 16 });
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

  const handleExport = () => {
    backupService.exportData();
  };

  const handleImportClick = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      setIsImporting(true);
      setImportError(null);
      try {
        const analysis = await backupService.analyzeImport(file);
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
                         />
                         <button onClick={() => handleSaveEdit(v.id)} className="text-emerald-500 hover:text-emerald-400 p-1.5 bg-emerald-500/10 rounded-lg">
                            <Check className="w-4 h-4" />
                         </button>
                       </div>
                       <div className="space-y-1.5">
                         <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                           <Circle className="w-3 h-3" /> Default Tyre Size
                         </p>
                         <div className="flex gap-2">
                           <div className="flex-1">
                             <Label className="text-[10px]">Width (mm)</Label>
                             <Input
                               type="number"
                               value={editingTyreSize.width}
                               onChange={e => setEditingTyreSize(prev => ({ ...prev, width: parseInt(e.target.value) || 0 }))}
                               className="py-1 px-2 text-xs h-auto"
                               min="100"
                               max="400"
                             />
                           </div>
                           <div className="flex-1">
                             <Label className="text-[10px]">Aspect (%)</Label>
                             <Input
                               type="number"
                               value={editingTyreSize.aspectRatio}
                               onChange={e => setEditingTyreSize(prev => ({ ...prev, aspectRatio: parseInt(e.target.value) || 0 }))}
                               className="py-1 px-2 text-xs h-auto"
                               min="20"
                               max="85"
                             />
                           </div>
                           <div className="flex-1">
                             <Label className="text-[10px]">Rim (in)</Label>
                             <Input
                               type="number"
                               value={editingTyreSize.rimSize}
                               onChange={e => setEditingTyreSize(prev => ({ ...prev, rimSize: parseInt(e.target.value) || 0 }))}
                               className="py-1 px-2 text-xs h-auto"
                               min="10"
                               max="24"
                             />
                           </div>
                         </div>
                         <p className="text-[10px] text-slate-400">
                           {editingTyreSize.width}/{editingTyreSize.aspectRatio} R{editingTyreSize.rimSize}
                         </p>
                       </div>
                    </div>
                  ) : (
                    <div className="flex-1 mr-3 flex items-center gap-2">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-200 block">{v.name}</span>
                        {v.tyreSize && (
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <Circle className="w-3 h-3" /> {v.tyreSize.width}/{v.tyreSize.aspectRatio} R{v.tyreSize.rimSize}
                          </span>
                        )}
                        {v.id === selectedVehicleId && <span className="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase">Active</span>}
                      </div>
                      <button
                        onClick={() => startEditing(v)}
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

      {/* Active Vehicle Tyre Size - Always Visible */}
      <section className="pt-4">
         <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2 ml-1"><Circle className="w-4 h-4"/> Active Vehicle Tyre Size</h3>
         <Card className="px-5 py-5 space-y-3">
            {!activeVehicle ? (
              <p className="text-sm text-slate-500">No active vehicle selected.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{activeVehicle.name}</span>
                  {activeVehicle.tyreSize ? (
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                      {activeVehicle.tyreSize.width}/{activeVehicle.tyreSize.aspectRatio} R{activeVehicle.tyreSize.rimSize}
                    </span>
                  ) : (
                    <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-lg">Not set</span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 items-start">
                  <div className="flex flex-col">
                    <Label className="text-[10px] mb-1.5 h-4">Width (mm)</Label>
                    <Input
                      type="number"
                      value={(activeVehicle.tyreSize?.width) || 205}
                      onChange={e => {
                        const width = parseInt(e.target.value) || 0;
                        const newSize = { ...(activeVehicle.tyreSize || { aspectRatio: 55, rimSize: 16 }), width };
                        editVehicle(activeVehicle.id, { tyreSize: newSize });
                      }}
                      className="py-2 px-2 text-xs h-10"
                      min="100"
                      max="400"
                    />
                  </div>
                  <div className="flex flex-col">
                    <Label className="text-[10px] mb-1.5 h-4">Aspect (%)</Label>
                    <Input
                      type="number"
                      value={(activeVehicle.tyreSize?.aspectRatio) || 55}
                      onChange={e => {
                        const aspectRatio = parseInt(e.target.value) || 0;
                        const newSize = { ...(activeVehicle.tyreSize || { width: 205, rimSize: 16 }), aspectRatio };
                        editVehicle(activeVehicle.id, { tyreSize: newSize });
                      }}
                      className="py-2 px-2 text-xs h-10"
                      min="20"
                      max="85"
                    />
                  </div>
                  <div className="flex flex-col">
                    <Label className="text-[10px] mb-1.5 h-4">Rim (in)</Label>
                    <Input
                      type="number"
                      value={(activeVehicle.tyreSize?.rimSize) || 16}
                      onChange={e => {
                        const rimSize = parseInt(e.target.value) || 0;
                        const newSize = { ...(activeVehicle.tyreSize || { width: 205, aspectRatio: 55 }), rimSize };
                        editVehicle(activeVehicle.id, { tyreSize: newSize });
                      }}
                      className="py-2 px-2 text-xs h-10"
                      min="10"
                      max="24"
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
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl">
              <button type="button" onClick={() => setTheme('light')} className={`py-3 text-sm font-bold rounded-xl transition cursor-pointer ${theme === 'light' ? 'bg-white dark:bg-indigo-500 text-slate-950 dark:text-white shadow-sm dark:shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Light</button>
              <button type="button" onClick={() => setTheme('dark')} className={`py-3 text-sm font-bold rounded-xl transition cursor-pointer ${theme === 'dark' ? 'bg-white dark:bg-indigo-500 text-slate-950 dark:text-white shadow-sm dark:shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Dark</button>
              <button type="button" onClick={() => setTheme('system')} className={`py-3 text-sm font-bold rounded-xl transition cursor-pointer ${theme === 'system' ? 'bg-white dark:bg-indigo-500 text-slate-950 dark:text-white shadow-sm dark:shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>System</button>
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
                     onClick={() => setLocationEnabled(!locationEnabled)}
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
                     onClick={handleClearLocationCache}
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
                     onClick={toggleNotifications}
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

      {/* Maintenance Settings - Unified Compact Design */}
      <section className="pt-4">
         <Card className="overflow-hidden">
            {/* Header with Stats */}
            <div className="px-5 py-4 bg-gradient-to-r from-blue-500/10 to-violet-500/10 dark:from-blue-500/5 dark:to-violet-500/5 border-b border-slate-200 dark:border-white/[0.06]">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                     <Settings2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                     <span className="text-sm font-bold text-slate-900 dark:text-white">Maintenance</span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px]">
                     {(() => {
                       const cats = Object.values(MAINTENANCE_CATEGORIES).filter(c => c.id !== 'custom');
                       const active = cats.filter(c => (maintenanceSettings?.categorySettings?.[c.id]?.enabled !== false)).length;
                       const disabled = cats.length - active;
                       return (
                         <>
                           <span className="text-emerald-500 font-medium">{active} active</span>
                           {disabled > 0 && <span className="text-slate-400">• {disabled} off</span>}
                         </>
                       );
                     })()}
                  </div>
               </div>
            </div>

            <div className="px-5 py-5 space-y-5">
               {/* Safety Margin - Slider + Input */}
               <div className="overflow-x-hidden">
                  <div className="flex items-center justify-between mb-3">
                     <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Warning Distance</span>
                     <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="100"
                          max="10000"
                          step="100"
                          value={maintenanceSettings?.defaultSafetyMarginKm ?? 2000}
                          onChange={e => {
                            const val = Math.min(10000, Math.max(100, Number(e.target.value)));
                            updateMaintenanceSettings({ defaultSafetyMarginKm: val });
                          }}
                          className="w-16 text-xs font-bold text-blue-600 dark:text-blue-400 bg-transparent border-b border-blue-300 dark:border-blue-600 text-right focus:outline-none focus:border-blue-500"
                        />
                        <span className="text-xs text-slate-500">km</span>
                     </div>
                  </div>
                  <input
                    type="range"
                    min="500"
                    max="5000"
                    step="100"
                    value={Math.min(5000, Math.max(500, maintenanceSettings?.defaultSafetyMarginKm ?? 2000))}
                    onChange={e => updateMaintenanceSettings({ defaultSafetyMarginKm: Number(e.target.value) })}
                    className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-blue-500 touch-none"
                  />
                  <div className="flex justify-between mt-1 text-[10px] text-slate-400">
                     <span>500 km</span>
                     <span>5000 km</span>
                  </div>
               </div>

               {/* Compact Category Grid */}
               <div className="pt-4 border-t border-slate-200 dark:border-slate-700/50 overflow-x-hidden">
                  <div className="flex items-center justify-between mb-3">
                     <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Categories</span>
                     <span className="text-[10px] text-slate-400">Tap to toggle</span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-1.5">
                     {Object.values(MAINTENANCE_CATEGORIES).filter(cat => cat.id !== 'custom').map(category => {
                       const catSettings = maintenanceSettings?.categorySettings?.[category.id] || {};
                       const isEnabled = catSettings.enabled !== false;
                       
                       return (
                         <button
                           key={category.id}
                           onClick={() => updateCategorySettings(category.id, { enabled: !isEnabled })}
                           className={`flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-all ${
                             isEnabled 
                               ? 'bg-slate-100 dark:bg-white/[0.08]' 
                               : 'bg-transparent hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                           }`}
                         >
                           {/* Status Dot */}
                           <div 
                             className={`w-2 h-2 rounded-full flex-shrink-0 transition-all ${
                               isEnabled ? '' : 'bg-slate-300 dark:bg-slate-600'
                             }`}
                             style={isEnabled ? { backgroundColor: category.color } : {}}
                           />
                           
                           {/* Name */}
                           <span className={`text-[11px] font-medium truncate flex-1 ${
                             isEnabled ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-500'
                           }`}>
                             {category.name}
                           </span>
                           
                           {/* Toggle Indicator */}
                           <div className={`w-7 h-4 rounded-full flex items-center px-0.5 transition-colors ${
                             isEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                           }`}>
                             <div className={`w-3 h-3 rounded-full bg-white transition-transform ${
                               isEnabled ? 'translate-x-3' : 'translate-x-0'
                             }`} />
                           </div>
                         </button>
                       );
                     })}
                  </div>
               </div>
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
                    value={fuelPrices[92] || ''} 
                    onChange={e => setFuelPrices({...fuelPrices, 92: Number(e.target.value)})}
                  />
               </div>
               <div>
                  <Label>Petrol 95 (EGP/L)</Label>
                  <Input 
                    type="number" step="0.01"
                    value={fuelPrices[95] || ''} 
                    onChange={e => setFuelPrices({...fuelPrices, 95: Number(e.target.value)})}
                  />
               </div>
               <div>
                  <Label>Diesel (EGP/L)</Label>
                  <Input 
                    type="number" step="0.01"
                    value={fuelPrices['diesel'] || ''} 
                    onChange={e => setFuelPrices({...fuelPrices, 'diesel': Number(e.target.value)})}
                  />
               </div>
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
                    onClick={handleExport}
                    className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                  >
                     <Download size={18} className="text-blue-500" /> Export
                  </button>
                  <button 
                    onClick={handleImportClick}
                    disabled={isImporting}
                    className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                  >
                     <Upload size={18} className="text-emerald-500" /> {isImporting ? 'Reading...' : 'Import'}
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

      {/* Import Resolution Modal */}
      {importAnalysis && (
        <ImportResolver 
          analysis={importAnalysis}
          onCancel={() => setImportAnalysis(null)}
          onApply={handleApplyImport}
        />
      )}

    </PageWrapper>
  );
}
