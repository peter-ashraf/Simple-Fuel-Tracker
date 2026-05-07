import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useFuel } from '../hooks/useFuelContext';
import { useTheme } from '../hooks/useTheme';
import { Card, Input, Label, cn, PageWrapper, Modal, ConfirmModal } from './ui';
import { 
  Trash2, Plus, CarFront, DollarSign, AlertCircle, Palette, Pencil, 
  Check, MapPin, Navigation, Circle, Bell, Wrench, Settings2, Save,
  Globe, Download, Upload, Database
} from 'lucide-react';
import { useLocationDetection } from '../hooks/useLocationDetection';
import { gasStationService } from '../services/gasStationService';
import { SavedStations } from './SavedStations';
import { backupService } from '../services/backupService';
import { excelService } from '../services/excelService';
import ImportResolver from './ImportResolver';
import { useNotifications } from '../hooks/useNotifications';
import { useTranslation } from 'react-i18next';

export default function Settings() {
  const { vehicles, selectedVehicleId, setSelectedVehicleId, fuelPrices, setFuelPrices, addVehicle, editVehicle, deleteVehicle, activeVehicle, maintenanceSettings, updateMaintenanceSettings, updateCategorySettings } = useFuel();
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();
  
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
    showToast(t('save_prices') + ' ' + t('healthy'));
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
      showToast('Vehicle added');
    }
  };

  const handleSaveEdit = (id) => {
    if (editingName.trim()) {
      editVehicle(id, {
        name: editingName.trim(),
        tyreSize: editingTyreSize,
        tankCapacity: editingTankCapacity ? Number(editingTankCapacity) : null
      });
      showToast('Updated');
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
    showToast(t('save_details') + ' ' + t('healthy'));
  };

  const currentLanguage = i18n.language.startsWith('ar') ? 'ar' : 'en';

  return (
    <PageWrapper className="space-y-6 pb-1">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('settings')}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage vehicles and fuel preferences.</p>
      </div>

      <section>
         <h3 className="text-xs font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2 ms-1"><CarFront className="w-4 h-4"/> {t('your_garage')}</h3>
         
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
                            <Check className="w-4 h-4" />
                         </button>
                       </div>
                       
                       <div className="flex-1">
                         <Label className="text-[10px]">{t('tank_capacity')} (Liters)</Label>
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
                           <Circle className="w-3 h-3" /> {t('tyre_size')}
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
                        <button
                          onClick={(e) => { e.stopPropagation(); startEditing(v); }}
                          className="text-slate-400 hover:text-blue-400 p-1 opacity-40 group-hover:opacity-100 transition-opacity md:opacity-40 ms-auto"
                        >
                           <Pencil className="w-3.5 h-3.5" />
                        </button>
                     </div>
                  )}
                  
                  <div className="shrink-0 flex items-center border-s border-slate-200 dark:border-slate-800 ps-2 ms-1">
                     <button 
                        onClick={() => setDeleteModal({ isOpen: true, vehicleId: v.id, vehicleName: v.name })} 
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
              placeholder="New vehicle name" 
              value={newVehicleName}
              onChange={e => setNewVehicleName(e.target.value)}
              className="py-3"
            />
            <button type="submit" disabled={!newVehicleName} className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-slate-950 px-5 rounded-2xl font-bold transition flex items-center justify-center">
              <Plus className="w-5 h-5"/>
            </button>
         </form>
      </section>

      {/* Language Section */}
      <section className="pt-4">
         <h3 className="text-xs font-bold text-orange-500 dark:text-orange-400 uppercase tracking-wider mb-3 flex items-center gap-2 ms-1"><Globe className="w-4 h-4"/> {t('language')}</h3>
         <Card className="px-5 py-6">
            <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-2xl relative z-20">
              {[
                { id: 'en', label: t('english') },
                { id: 'ar', label: t('arabic') }
              ].map(lang => (
                 <button
                    key={lang.id}
                    onClick={() => { i18n.changeLanguage(lang.id); showToast(`${lang.label} applied`); }}
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
           <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-2 ms-1"><Circle className="w-4 h-4"/> {t('active_vehicle')} Details</h3>
           {activeVehicleForm && (
             <button onClick={handleSaveActiveVehicleDetails} className="bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm">{t('save_details')}</button>
           )}
         </div>
         <Card className="px-5 py-5 space-y-3">
            {!activeVehicle || !activeVehicleForm ? (
              <p className="text-sm text-slate-500">No vehicle selected.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">{activeVehicle.name}</span>
                  {activeVehicleForm.tankCapacity && (
                    <span className="text-xs font-bold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded-lg">
                      {activeVehicleForm.tankCapacity}L {t('tank_capacity')}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-2 items-start mt-4 border-t border-slate-100 dark:border-slate-800 pt-4">
                  {['width', 'aspectRatio', 'rimSize'].map(field => (
                    <div key={field} className="flex flex-col">
                      <Label className="text-[10px] mb-1.5 h-4">{field}</Label>
                      <Input
                        type="number"
                        value={activeVehicleForm.tyreSize?.[field] || ''}
                        onChange={e => setActiveVehicleForm(prev => ({ ...prev, tyreSize: { ...prev.tyreSize, [field]: parseInt(e.target.value) || '' } }))}
                        className="py-2 px-2 text-xs h-10"
                      />
                    </div>
                  ))}
                  <div className="flex flex-col">
                    <Label className="text-[10px] mb-1.5 h-4 text-blue-600 dark:text-blue-400 font-bold">Liters</Label>
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
         <h3 className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2 ms-1"><Palette className="w-4 h-4"/> {t('theme_prefs')}</h3>
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
         <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2 ms-1"><Navigation className="w-4 h-4"/> {t('location_services')}</h3>
         <Card className="px-5 py-6">
            <div className="space-y-4">
               <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">Detection</p>
                  <button onClick={() => setLocationEnabled(!locationEnabled)} className={`relative ms-1 inline-flex h-6 w-11 items-center rounded-full transition-colors ${locationEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${locationEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
               </div>
               <button onClick={handleClearLocationCache} className="text-xs text-slate-500 dark:text-slate-400">Clear Cache</button>
            </div>
         </Card>
      </section>

      <section className="pt-4">
         <h3 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-3 flex items-center gap-2 ms-1"><Bell className="w-4 h-4"/> {t('notifications')}</h3>
         <Card className="px-5 py-6">
            <div className="flex items-center justify-between">
               <p className="text-sm font-medium text-slate-900 dark:text-white">Maintenance</p>
               <button onClick={toggleNotifications} className={`relative ms-1 inline-flex h-6 w-11 items-center rounded-full transition-colors ${notificationsEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                 <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${notificationsEnabled ? 'translate-x-5' : 'translate-x-1'}`} />
               </button>
            </div>
         </Card>
      </section>

      <section className="pt-4">
         <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2 ms-1"><DollarSign className="w-4 h-4"/> {t('fuel_prices')}</h3>
         <Card className="px-5 py-6">
            <div className="space-y-4">
               {['92', '95', 'diesel'].map(key => (
                 <div key={key}>
                   <Label>Petrol {key}</Label>
                   <Input type="number" step="0.01" value={priceForm[key]} onChange={e => setPriceForm({...priceForm, [key]: e.target.value})} />
                 </div>
               ))}
               <button onClick={handleSavePrices} className="w-full py-3.5 bg-emerald-500 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/20">{t('save_prices')}</button>
            </div>
         </Card>
      </section>

      <section className="pt-4">
         <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2 ms-1"><Database className="w-4 h-4"/> {t('backup_restore')}</h3>
         <Card className="px-5 py-6">
            <div className="grid grid-cols-2 gap-3">
               <button onClick={() => setFormatModal({ isOpen: true, type: 'export' })} className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-sm"><Download size={18} /> {t('export_data')}</button>
               <button onClick={() => setFormatModal({ isOpen: true, type: 'import' })} className="flex items-center justify-center gap-2 py-4 rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-bold text-sm"><Upload size={18} /> {t('import_data')}</button>
            </div>
         </Card>
      </section>

      <section className="pt-8 mb-2">
         <button onClick={() => setFactoryResetModal(true)} className="w-full py-4 rounded-[1.5rem] border border-red-500/20 text-red-500 font-bold hover:bg-red-500/10 transition flex justify-center gap-2 items-center">{t('reset_app')}</button>
      </section>

      <ConfirmModal isOpen={deleteModal.isOpen} onClose={() => setDeleteModal({ isOpen: false })} onConfirm={() => deleteVehicle(deleteModal.vehicleId)} title={t('delete') + ' Vehicle'} message={`Are you sure?`} confirmText={t('delete')} variant="danger" />
      <ConfirmModal isOpen={factoryResetModal} onClose={() => setFactoryResetModal(false)} onConfirm={confirmFactoryReset} title={t('reset_app')} message="Are you sure?" confirmText={t('delete')} variant="danger" />

      {/* Backup Format Modal */}
      <Modal isOpen={formatModal.isOpen} onClose={() => setFormatModal({ isOpen: false })} title={formatModal.type === 'export' ? t('export_data') : t('import_data')} size="sm">
        <div className="grid grid-cols-2 gap-3 p-2">
           <button onClick={() => { setFormatModal({ isOpen: false }); handleExport('json'); }} className="p-4 rounded-2xl border flex flex-col items-center gap-2"><Database className="text-blue-500" /> JSON</button>
           <button onClick={() => { setFormatModal({ isOpen: false }); handleExport('excel'); }} className="p-4 rounded-2xl border flex flex-col items-center gap-2"><Database className="text-emerald-500" /> Excel</button>
        </div>
      </Modal>

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
