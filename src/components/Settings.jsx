import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useFuel } from '../hooks/useFuelContext';
import { useTheme } from '../hooks/useTheme';
import { Card, Input, Label, cn, PageWrapper, Modal, ConfirmModal } from './ui';
import { 
  Trash, Plus, Car, CurrencyDollar, WarningCircle, Palette, Pencil, 
  Check, MapPin, NavigationArrow, Tire, Bell, Wrench, GearSix, FloppyDisk,
  Globe, DownloadSimple, UploadSimple, Database, SignOut, CloudArrowUp, Spinner
} from '@phosphor-icons/react';
import { useLocationDetection } from '../hooks/useLocationDetection';
import { gasStationService } from '../services/gasStationService';
import { SavedStations } from './SavedStations';
import { backupService } from '../services/backupService';
import { excelService } from '../services/excelService';
import { cloudSyncService } from '../services/cloudSyncService';
import ImportResolver from './ImportResolver';
import { useNotifications } from '../hooks/useNotifications';
import { useTranslation } from 'react-i18next';
import { authService } from '../services/authService';
import { isNoOpSync, getResultTitle, getResultMessage } from '../utils/syncResultHelpers.js';

export default function Settings() {
  const { vehicles, selectedVehicleId, setSelectedVehicleId, fuelPrices, setFuelPrices, addVehicle, editVehicle, deleteVehicle, activeVehicle, maintenanceSettings, updateMaintenanceSettings, updateCategorySettings } = useFuel();
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  
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
    showToast(t('prices_saved'));
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

  // Manual upload state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);

  // Manual sync modal state
  const [manualSyncModalOpen, setManualSyncModalOpen] = useState(false);
  const [syncSummary, setSyncSummary] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncConfirmModal, setSyncConfirmModal] = useState({ isOpen: false, action: null });

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
      showToast(t('vehicle_added'));
    }
  };

  const handleSaveEdit = (id) => {
    if (editingName.trim()) {
      editVehicle(id, {
        name: editingName.trim(),
        tyreSize: editingTyreSize,
        tankCapacity: editingTankCapacity ? Number(editingTankCapacity) : null
      });
      showToast(t('updated'));
    }
    setEditingVehicleId(null);
  };

  const startEditing = (vehicle) => {
    setEditingVehicleId(vehicle.id);
    setEditingName(vehicle.name);
    setEditingTyreSize(vehicle.tyreSize || { width: 205, aspectRatio: 55, rimSize: 16 });
    setEditingTankCapacity(vehicle.tankCapacity || '');
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
    if (type === 'excel') excelService.exportData();
    else backupService.exportData();
  };

  const handleImportClick = (type = 'json') => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = type === 'excel' ? '.xlsx, .xls' : '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setIsImporting(true);
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

  const handleLogout = async () => {
    try {
      await authService.signOut();
      window.location.reload();
    } catch (error) {
      console.error('Logout error:', error);
      showToast('Logout failed');
    }
  };

  const handleManualUpload = async () => {
    setIsUploading(true);
    setUploadResult(null);
    try {
      const userId = await cloudSyncService.getUserId();
      if (!userId) {
        setUploadResult({
          success: false,
          message: 'You must be logged in to upload data to the cloud.'
        });
        setIsUploading(false);
        return;
      }

      const result = await cloudSyncService.uploadLocalDataToCloud(userId);
      setUploadResult(result);
    } catch (error) {
      setUploadResult({
        success: false,
        message: 'Upload failed due to an unexpected error.',
        details: [error.message]
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleOpenManualSync = async () => {
    try {
      const userId = await cloudSyncService.getUserId();
      if (!userId) {
        showToast('You must be logged in to sync data.');
        return;
      }

      const summary = await cloudSyncService.getSyncStatus(userId);
      setSyncSummary(summary);
      setManualSyncModalOpen(true);
    } catch (error) {
      console.error('Failed to fetch sync summary:', error);
      showToast('Failed to fetch sync status.');
    }
  };

  const handleManualSyncAction = async (action) => {
    // Show confirmation for destructive actions
    if (action === 'download') {
      setSyncConfirmModal({
        isOpen: true,
        action: 'download',
        title: 'Download Cloud Data',
        message: 'This will replace all local data on this device with your cloud data. Any unsynced local changes will be lost.',
        confirmText: 'Download'
      });
      return;
    } else if (action === 'merge') {
      setSyncConfirmModal({
        isOpen: true,
        action: 'merge',
        title: 'Merge Data',
        message: 'This will merge local and cloud data. Conflicts will be resolved by keeping the most recent version of each record.',
        confirmText: 'Merge'
      });
      return;
    }

    // Upload is non-destructive, proceed directly
    performSyncAction(action);
  };

  const performSyncAction = async (action) => {
    setIsSyncing(true);
    setSyncResult(null);
    try {
      const userId = await cloudSyncService.getUserId();
      if (!userId) {
        setSyncResult({
          success: false,
          message: 'You must be logged in to sync data.'
        });
        setIsSyncing(false);
        return;
      }

      let result;
      switch (action) {
        case 'upload':
          result = await cloudSyncService.uploadLocalDataToCloud(userId);
          break;
        case 'download':
          result = await cloudSyncService.downloadCloudDataToLocal(userId);
          break;
        case 'merge':
          result = await cloudSyncService.mergeLocalDataToCloud(userId);
          break;
        default:
          throw new Error('Unknown sync action');
      }

      setSyncResult(result);
      if (result.success) {
        showToast('Sync completed successfully');
      }
    } catch (error) {
      setSyncResult({
        success: false,
        message: 'Sync failed due to an unexpected error.',
        details: [error.message]
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSaveActiveVehicleDetails = () => {
    if (!activeVehicleForm) return;
    const { tyreSize, tankCapacity } = activeVehicleForm;
    const isMissingTyre = !tyreSize.width || !tyreSize.aspectRatio || !tyreSize.rimSize;
    const isMissingTank = !tankCapacity;

    if (isMissingTyre || isMissingTank) {
      setValidationModal({ isOpen: true, isMissingTyre, isMissingTank });
    } else {
      // Check if anything actually changed
      const currentTyre = activeVehicle.tyreSize || {};
      const hasTyreChanged = 
        tyreSize.width !== currentTyre.width || 
        tyreSize.aspectRatio !== currentTyre.aspectRatio || 
        tyreSize.rimSize !== currentTyre.rimSize;
      
      const hasTankChanged = parseFloat(tankCapacity) !== activeVehicle.tankCapacity;

      if (!hasTyreChanged && !hasTankChanged) {
        showToast(t('no_changes'));
        return;
      }

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
    showToast(t('details_saved'));
  };

  const currentLanguage = i18n.language.startsWith('ar') ? 'ar' : 'en';

  return (
    <PageWrapper className="space-y-6 pb-1">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('settings')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{t('settings_description')}</p>
      </div>

      <section>
         <h3 className="text-xs font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2 ms-1"><Car weight="duotone" className="w-4 h-4"/> {t('your_garage')}</h3>
         
         <div className="space-y-3 mb-4">
            {vehicles.map(v => (
               <div key={v.id} className={cn("glass-card group p-4 rounded-xl flex items-center justify-between shadow-sm dark:shadow-none border-slate-200 dark:border-slate-800", v.id === selectedVehicleId && "border-blue-500/50 bg-blue-50 dark:bg-blue-500/5")}>
                  {editingVehicleId === v.id ? (
                    <div className="flex-1 me-3 space-y-3">
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
                            <Check weight="duotone" className="w-4 h-4" />
                         </button>
                       </div>
                       
                       <div className="flex-1">
                         <Label className="text-[10px]">{t('tank_capacity')} ({t('liters')})</Label>
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
                           <Tire weight="duotone" className="w-3 h-3" /> {t('tyre_size')}
                         </p>
                           <div className="flex gap-2">
                             <Input
                               type="number"
                               value={editingTyreSize.width || ''}
                               onChange={e => setEditingTyreSize(prev => ({ ...prev, width: parseInt(e.target.value) || 0 }))}
                               className={cn("py-1 px-2 text-xs h-auto", (editingTyreSize.width === 0) && "border-red-500")}
                             />
                             <Input
                               type="number"
                               value={editingTyreSize.aspectRatio || ''}
                               onChange={e => setEditingTyreSize(prev => ({ ...prev, aspectRatio: parseInt(e.target.value) || 0 }))}
                               className={cn("py-1 px-2 text-xs h-auto", (editingTyreSize.aspectRatio === 0) && "border-red-500")}
                             />
                             <Input
                               type="number"
                               value={editingTyreSize.rimSize || ''}
                               onChange={e => setEditingTyreSize(prev => ({ ...prev, rimSize: parseInt(e.target.value) || 0 }))}
                               className={cn("py-1 px-2 text-xs h-auto", (editingTyreSize.rimSize === 0) && "border-red-500")}
                             />
                           </div>
                       </div>
                    </div>
                  ) : (
                     <div className="flex-1 me-3 flex items-center gap-2 cursor-pointer" onClick={() => setSelectedVehicleId(v.id)}>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${v.id === selectedVehicleId ? 'border-blue-500 bg-blue-500 text-white' : 'border-slate-300 dark:border-slate-700'}`}>
                          {v.id === selectedVehicleId && <Check weight="duotone" className="w-3 h-3" />}
                        </div>
                        <div>
                          <span className="font-semibold text-slate-900 dark:text-slate-200 block">{v.name}</span>
                          {v.tyreSize && (
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                              <Tire weight="duotone" className="w-3 h-3" /> {v.tyreSize.width}/{v.tyreSize.aspectRatio} R{v.tyreSize.rimSize}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); startEditing(v); }}
                          className="text-slate-400 hover:text-blue-400 p-1 opacity-40 group-hover:opacity-100 transition-opacity md:opacity-40 ms-auto"
                        >
                           <Pencil weight="duotone" className="w-3.5 h-3.5" />
                        </button>
                     </div>
                  )}
                  
                  <div className="shrink-0 flex items-center border-s border-slate-200 dark:border-slate-800 ps-2 ms-1">
                     <button 
                        onClick={() => setDeleteModal({ isOpen: true, vehicleId: v.id, vehicleName: v.name })} 
                        disabled={vehicles.length === 1 || editingVehicleId === v.id}
                        className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-2 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors"
                     >
                       <Trash weight="duotone" className="w-4 h-4" />
                     </button>
                  </div>
               </div>
            ))}
         </div>

         <form onSubmit={handleCreateVehicle} className="flex gap-2">
            <Input 
              type="text" 
              placeholder={t('new_vehicle_placeholder')} 
              value={newVehicleName}
              onChange={e => setNewVehicleName(e.target.value)}
              className="py-3"
            />
            <button type="submit" disabled={!newVehicleName} className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-slate-950 px-5 rounded-2xl font-bold transition flex items-center justify-center">
              <Plus weight="duotone" className="w-5 h-5"/>
            </button>
         </form>
      </section>

      {/* Language Section */}
      <section className="pt-4">
         <h3 className="text-xs font-bold text-orange-500 dark:text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-2 ms-1"><Globe weight="duotone" className="w-4 h-4"/> {t('language')}</h3>
         <Card className="px-5 py-6">
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-2xl relative z-20">
              {[
                { id: 'en', label: t('english') },
                { id: 'ar', label: t('arabic') }
              ].map(lang => (
                 <button
                    key={lang.id}
                    onClick={() => { i18n.changeLanguage(lang.id); showToast(t('updated')); }}
                    className={`relative flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                       currentLanguage === lang.id
                       ? 'text-slate-900 dark:text-white'
                       : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                 >
                    {currentLanguage === lang.id && (
                       <motion.div
                          layoutId="settingsLangTab"
                          className="absolute inset-0 bg-white dark:bg-orange-500 rounded-xl shadow-sm"
                          transition={{ type: "spring", stiffness: 400, damping: 30 }}
                       />
                    )}
                    <span className="relative z-10">{lang.label}</span>
                 </button>
              ))}
            </div>
         </Card>
      </section>

      <section className="pt-4">
          <div className="flex items-center justify-between mb-3">
           <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2 ms-1"><Tire weight="duotone" className="w-4 h-4"/> {t('active_vehicle_details')}</h3>
           {activeVehicleForm && (
             <button onClick={handleSaveActiveVehicleDetails} className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm">{t('save_details')}</button>
           )}
         </div>
         <Card className="px-5 py-5 space-y-3">
            {!activeVehicle || !activeVehicleForm ? (
              <p className="text-sm text-slate-500">{t('no_vehicle_selected')}</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{activeVehicle.name}</span>
                  {activeVehicleForm.tankCapacity && (
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-lg">
                      {activeVehicleForm.tankCapacity}{t('liters_abbr')} {t('tank_capacity')}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 items-start mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                  {['width', 'aspectRatio', 'rimSize'].map(field => (
                    <div key={field} className="flex flex-col">
                      <Label className="text-[10px] mb-1.5 h-4">{t(field === 'rimSize' ? 'rim' : field === 'aspectRatio' ? 'ratio' : 'width')}</Label>
                      <Input
                        type="number"
                        value={activeVehicleForm.tyreSize?.[field] || ''}
                        onChange={e => setActiveVehicleForm(prev => ({ ...prev, tyreSize: { ...prev.tyreSize, [field]: parseInt(e.target.value) || '' } }))}
                        className="py-2 px-2 text-xs h-10"
                      />
                    </div>
                  ))}
                  <div className="flex flex-col">
                    <Label className="text-[10px] mb-1.5 h-4 text-blue-600 dark:text-blue-400 font-bold">{t('liters')}</Label>
                    <Input
                      type="number"
                      value={activeVehicleForm.tankCapacity || ''}
                      onChange={e => setActiveVehicleForm(prev => ({ ...prev, tankCapacity: parseFloat(e.target.value) || '' }))}
                      className="py-2 px-2 text-xs h-10 bg-blue-50/50 dark:bg-blue-900/10"
                    />
                  </div>
                </div>
              </div>
            )}
         </Card>
      </section>

      <section className="pt-4">
         <h3 className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2 ms-1"><Palette weight="duotone" className="w-4 h-4"/> {t('theme_prefs')}</h3>
         <Card className="px-5 py-6">
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-2xl relative z-20">
              {['light', 'dark', 'system'].map(t_id => (
                 <button
                    key={t_id}
                    onClick={() => setTheme(t_id)}
                    className={`relative flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold capitalize transition-all ${
                       theme === t_id ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                    }`}
                 >
                    {theme === t_id && (
                       <motion.div layoutId="settingsThemeTab" className="absolute inset-0 bg-white dark:bg-indigo-500 rounded-xl shadow-sm" transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                    )}
                    <span className="relative z-10">{t_id === 'system' ? t('system_mode') : t_id === 'dark' ? t('dark_mode') : t('light_mode')}</span>
                 </button>
              ))}
            </div>
         </Card>
      </section>

      <section className="pt-4">
         <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2 ms-1"><NavigationArrow weight="duotone" className="w-4 h-4"/> {t('location_services')}</h3>
         <Card className="px-5 py-6">
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{t('detection')}</p>
                  <button onClick={() => setLocationEnabled(!locationEnabled)} className={`relative ms-1 inline-flex h-6 w-11 items-center rounded-full transition-colors ${locationEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${locationEnabled ? (isRtl ? '-translate-x-5' : 'translate-x-5') : (isRtl ? '-translate-x-1' : 'translate-x-1')}`} />
                  </button>
               </div>
               <button onClick={handleClearLocationCache} className="text-xs text-slate-500 dark:text-slate-400">{t('clear_cache')}</button>
            </div>
         </Card>
      </section>

      <section className="pt-4">
         <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2 ms-1"><Bell weight="duotone" className="w-4 h-4"/> {t('notifications')}</h3>
         <Card className="px-5 py-6">
            <div className="flex items-center justify-between">
               <p className="text-sm font-medium text-slate-900 dark:text-white">{t('maintenance')}</p>
               <button onClick={toggleNotifications} className={`relative ms-1 inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationsEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                 <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationsEnabled ? (isRtl ? '-translate-x-5' : 'translate-x-5') : (isRtl ? '-translate-x-1' : 'translate-x-1')}`} />
               </button>
            </div>
         </Card>
      </section>

      <section className="pt-4">
         <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2 ms-1"><CurrencyDollar weight="duotone" className="w-4 h-4"/> {t('fuel_prices')}</h3>
         <Card className="px-5 py-6">
            <div className="space-y-4">
               {['92', '95', 'diesel'].map(key => (
                 <div key={key}>
                   <Label>{key === 'diesel' ? t('petrol_diesel') : t('petrol_' + key)}</Label>
                   <Input type="number" step="0.01" value={priceForm[key]} onChange={e => setPriceForm({...priceForm, [key]: e.target.value})} />
                 </div>
               ))}
               <button onClick={handleSavePrices} className="w-full py-3.5 bg-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/20">{t('save_prices')}</button>
            </div>
         </Card>
      </section>

      <section className="pt-4">
         <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2 ms-1"><Database weight="duotone" className="w-4 h-4"/> {t('backup_restore')}</h3>
         <Card className="px-5 py-6">
            <div className="grid grid-cols-2 gap-3 mb-3">
               <button onClick={() => setFormatModal({ isOpen: true, type: 'export' })} className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-sm"><DownloadSimple weight="duotone" size={18} /> {t('export_data')}</button>
               <button onClick={() => setFormatModal({ isOpen: true, type: 'import' })} className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-sm"><UploadSimple weight="duotone" size={18} /> {t('import_data')}</button>
            </div>
            <button onClick={handleOpenManualSync} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm shadow-lg shadow-emerald-500/20 transition"><CloudArrowUp weight="duotone" size={18} /> Manual Sync</button>
         </Card>
      </section>

      <section className="pt-8 mb-2">
         <button onClick={handleLogout} className="w-full py-4 rounded-[1.5rem] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition flex justify-center gap-2 items-center mb-3">
            <SignOut weight="duotone" className="w-5 h-5" />
            {t('logout')}
         </button>
         <button onClick={() => setFactoryResetModal(true)} className="w-full py-4 rounded-[1.5rem] border border-red-500/20 text-red-500 font-bold hover:bg-red-500/10 transition flex justify-center gap-2 items-center">{t('reset_app')}</button>
      </section>

      <ConfirmModal isOpen={deleteModal.isOpen} onClose={() => setDeleteModal({ isOpen: false })} onConfirm={() => deleteVehicle(deleteModal.vehicleId)} title={t('delete') + ' ' + t('active_vehicle')} message={t('sure_question')} confirmText={t('delete')} variant="danger" />
      <ConfirmModal isOpen={factoryResetModal} onClose={() => setFactoryResetModal(false)} onConfirm={confirmFactoryReset} title={t('reset_app')} message={t('sure_question')} confirmText={t('delete')} variant="danger" />

      {/* Validation Modal for Active Vehicle Details */}
      <Modal 
        isOpen={validationModal.isOpen} 
        onClose={() => setValidationModal({ isOpen: false })} 
        title={t('active_vehicle_details')}
        size="sm"
      >
        <div className="p-1 space-y-4">
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-200 dark:border-amber-500/20 text-amber-700 dark:text-amber-400">
            <WarningCircle weight="duotone" className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="space-y-2 text-xs font-bold leading-relaxed">
              {validationModal.isMissingTank && <p>{t('missing_tank_warning')}</p>}
              {validationModal.isMissingTyre && <p>{t('missing_tyre_warning')}</p>}
            </div>
          </div>
          
          <div className="flex gap-2">
            <button 
              onClick={() => setValidationModal({ isOpen: false })}
              className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold text-xs"
            >
              {t('cancel')}
            </button>
            <button 
              onClick={confirmSaveActiveVehicleDetails}
              className="flex-1 py-3 bg-emerald-500 text-white rounded-xl font-bold text-xs shadow-lg shadow-emerald-500/20"
            >
              {t('save_anyway')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Backup Format Modal */}
      <Modal isOpen={formatModal.isOpen} onClose={() => setFormatModal({ isOpen: false })} title={formatModal.type === 'export' ? t('export_data') : t('import_data')} size="sm">
        <div className="grid grid-cols-2 gap-3 p-2">
           <button 
             onClick={() => { 
               setFormatModal({ isOpen: false }); 
               if (formatModal.type === 'export') handleExport('json');
               else handleImportClick('json');
             }} 
             className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 flex flex-col items-center gap-2 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
           >
             <Database weight="duotone" className="text-blue-500" /> 
             <span className="text-xs font-bold">JSON</span>
           </button>
           <button 
             onClick={() => { 
               setFormatModal({ isOpen: false }); 
               if (formatModal.type === 'export') handleExport('excel');
               else handleImportClick('excel');
             }} 
             className="p-4 rounded-2xl border border-slate-200 dark:border-white/10 flex flex-col items-center gap-2 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
           >
             <Database weight="duotone" className="text-emerald-500" /> 
             <span className="text-xs font-bold">{t('excel')}</span>
           </button>
        </div>
      </Modal>

      {/* Import Process Components */}
      {isImporting && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="font-bold text-slate-900 dark:text-white">{t('analyzing_file')}</p>
          </div>
        </div>
      )}

      {importAnalysis && (
        <ImportResolver 
          analysis={importAnalysis} 
          onCancel={() => setImportAnalysis(null)} 
          onApply={handleApplyImport} 
        />
      )}

      {importError && (
        <ConfirmModal 
          isOpen={true} 
          onClose={() => setImportError(null)} 
          onConfirm={() => setImportError(null)} 
          title={t('error')} 
          message={importError} 
          confirmText="OK" 
          variant="danger" 
        />
      )}

      {/* Manual Upload Loading Modal */}
      {isUploading && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center">
          <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
            <p className="font-bold text-slate-900 dark:text-white">Uploading to Cloud...</p>
          </div>
        </div>
      )}

      {/* Manual Upload Result Modal */}
      {uploadResult && (
        <Modal 
          isOpen={true} 
          onClose={() => setUploadResult(null)} 
          title={getResultTitle(uploadResult)}
          size="sm"
        >
          <div className="p-1 space-y-4">
            <div className={`flex items-start gap-3 p-4 rounded-2xl border ${uploadResult.success ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'}`}>
              {uploadResult.success ? (
                <Check weight="duotone" className="text-emerald-500 w-6 h-6 mt-0.5 flex-shrink-0" />
              ) : (
                <WarningCircle weight="duotone" className="text-red-500 w-6 h-6 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <p className={`font-semibold mb-1 ${uploadResult.success ? 'text-emerald-900 dark:text-emerald-400' : 'text-red-900 dark:text-red-400'}`}>
                  {getResultMessage(uploadResult)}
                </p>
                {uploadResult.success && isNoOpSync(uploadResult) && (
                  <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                    No action is needed.
                  </p>
                )}
                {uploadResult.counts && (uploadResult.counts.vehicles > 0 || uploadResult.counts.fillups > 0 || uploadResult.counts.maintenance > 0 || uploadResult.counts.tripEstimates > 0) && (
                  <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                    <div className="space-y-1">
                      {uploadResult.counts.vehicles > 0 && <div>• {uploadResult.counts.vehicles} vehicle{uploadResult.counts.vehicles !== 1 ? 's' : ''} uploaded</div>}
                      {uploadResult.counts.fillups > 0 && <div>• {uploadResult.counts.fillups} fill-up{uploadResult.counts.fillups !== 1 ? 's' : ''} synced</div>}
                      {uploadResult.counts.maintenance > 0 && <div>• {uploadResult.counts.maintenance} maintenance record{uploadResult.counts.maintenance !== 1 ? 's' : ''} uploaded</div>}
                      {uploadResult.counts.tripEstimates > 0 && <div>• {uploadResult.counts.tripEstimates} trip estimate{uploadResult.counts.tripEstimates !== 1 ? 's' : ''} uploaded</div>}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={() => setUploadResult(null)}
              className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold text-xs"
            >
              Close
            </button>
          </div>
        </Modal>
      )}

      {/* Manual Sync Modal */}
      <Modal
        isOpen={manualSyncModalOpen}
        onClose={() => {
          setManualSyncModalOpen(false);
          setSyncResult(null);
        }}
        title="Manual Sync"
        size="sm"
      >
        <div className="p-1 space-y-4">
          {/* Sync Summary */}
          {syncSummary && !syncResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Local Data</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                      <span className="text-slate-700 dark:text-slate-300">{syncSummary.localCounts?.vehicles || 0} Vehicles</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                      <span className="text-slate-700 dark:text-slate-300">{syncSummary.localCounts?.fillups || 0} Fill-ups</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                      <span className="text-slate-700 dark:text-slate-300">{syncSummary.localCounts?.maintenance || 0} Maintenance</span>
                    </div>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                  <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2">Cloud Data</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span className="text-slate-700 dark:text-slate-300">{syncSummary.cloudCounts?.vehicles || 0} Vehicles</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span className="text-slate-700 dark:text-slate-300">{syncSummary.cloudCounts?.fillups || 0} Fill-ups</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span className="text-slate-700 dark:text-slate-300">{syncSummary.cloudCounts?.maintenance || 0} Maintenance</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Sync Actions */}
          {!syncResult && !isSyncing && (
            <div className="space-y-3">
              <button
                onClick={() => handleManualSyncAction('upload')}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-2xl transition flex items-center justify-center gap-2"
              >
                <CloudArrowUp weight="duotone" className="w-5 h-5" />
                Upload local data to cloud
              </button>
              <button
                onClick={() => handleManualSyncAction('download')}
                className="w-full py-3.5 bg-blue-500 hover:bg-blue-400 text-white font-semibold rounded-2xl transition flex items-center justify-center gap-2"
              >
                <DownloadSimple weight="duotone" className="w-5 h-5" />
                Download cloud data to this device
              </button>
              <button
                onClick={() => handleManualSyncAction('merge')}
                className="w-full py-3.5 bg-purple-500 hover:bg-purple-400 text-white font-semibold rounded-2xl transition flex items-center justify-center gap-2"
              >
                <Globe weight="duotone" className="w-5 h-5" />
                Merge local and cloud data
              </button>
              <button
                onClick={() => setManualSyncModalOpen(false)}
                className="w-full py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold rounded-2xl transition"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Sync Loading */}
          {isSyncing && (
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="font-bold text-slate-900 dark:text-white">Syncing...</p>
            </div>
          )}

          {/* Sync Result */}
          {syncResult && (
            <div className="space-y-4">
              <div className={`flex items-start gap-3 p-4 rounded-2xl border ${syncResult.success ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'}`}>
                {syncResult.success ? (
                  <Check weight="duotone" className="text-emerald-500 w-6 h-6 mt-0.5 flex-shrink-0" />
                ) : (
                  <WarningCircle weight="duotone" className="text-red-500 w-6 h-6 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className={`font-semibold mb-1 ${syncResult.success ? 'text-emerald-900 dark:text-emerald-400' : 'text-red-900 dark:text-red-400'}`}>
                    {syncResult.message}
                  </p>
                  {syncResult.counts && (syncResult.counts.vehicles > 0 || syncResult.counts.fillups > 0 || syncResult.counts.maintenance > 0 || syncResult.counts.tripEstimates > 0) && (
                    <div className="mt-3 text-sm text-slate-600 dark:text-slate-400">
                      <div className="space-y-1">
                        {syncResult.counts.vehicles > 0 && <div>• {syncResult.counts.vehicles} vehicle{syncResult.counts.vehicles !== 1 ? 's' : ''}</div>}
                        {syncResult.counts.fillups > 0 && <div>• {syncResult.counts.fillups} fill-up{syncResult.counts.fillups !== 1 ? 's' : ''}</div>}
                        {syncResult.counts.maintenance > 0 && <div>• {syncResult.counts.maintenance} maintenance record{syncResult.counts.maintenance !== 1 ? 's' : ''}</div>}
                        {syncResult.counts.tripEstimates > 0 && <div>• {syncResult.counts.tripEstimates} trip estimate{syncResult.counts.tripEstimates !== 1 ? 's' : ''}</div>}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setManualSyncModalOpen(false);
                  setSyncResult(null);
                }}
                className="w-full py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold text-xs"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* Sync Confirmation Modal */}
      <ConfirmModal
        isOpen={syncConfirmModal.isOpen}
        onClose={() => setSyncConfirmModal({ isOpen: false, action: null })}
        onConfirm={() => {
          setSyncConfirmModal({ isOpen: false, action: null });
          performSyncAction(syncConfirmModal.action);
        }}
        title={syncConfirmModal.title}
        message={syncConfirmModal.message}
        confirmText={syncConfirmModal.confirmText}
        variant="danger"
      />

      {/* Global Setting Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-emerald-500 text-white px-6 py-3 rounded-full shadow-lg z-50 text-sm font-bold">
            {toastMessage}
          </motion.div>
        )}
      </AnimatePresence>
    </PageWrapper>
  );
}
