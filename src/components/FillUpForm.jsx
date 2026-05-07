import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Plus, MapPin, Wrench, ArrowLeft, AlertCircle } from 'lucide-react';
import { useFuel } from '../hooks/useFuelContext';
import { Input, Label, Card, PageWrapper, ConfirmModal, FuelGaugeSlider, cn } from './ui';
import { useLocationDetection } from '../hooks/useLocationDetection';
import { useNotifications } from '../hooks/useNotifications';
import { gasStationService } from '../services/gasStationService';
import { StationSuggestion } from './StationSuggestion';
import { useNavigate } from 'react-router-dom';
import { DateInput } from './DateInput';
import { useTranslation } from 'react-i18next';

export default function FillUpForm() {
  const { fuelPrices, addFillUp, activeVehicleFillUps, addMaintenanceEntry, maintenanceEntries, activeVehicle, getCategoryById } = useFuel();
  const navigate = useNavigate();
  const buttonContainerRef = useRef(null);
  const { checkOdometerThresholds } = useNotifications();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');

  // Force immediate positioning on mount
  useEffect(() => {
    const forcePositioning = () => {
      if (buttonContainerRef.current) {
        const element = buttonContainerRef.current;
        element.style.position = 'fixed';
        element.style.bottom = '80px';
        element.style.left = '0';
        element.style.right = '0';
        element.style.zIndex = '50';
        element.style.transition = 'none';
        element.style.transform = 'translateZ(0)';
        element.offsetHeight;
      }
    };
    forcePositioning();
    const timeoutId = setTimeout(forcePositioning, 0);
    return () => clearTimeout(timeoutId);
  }, []);
  
  const { location, permissionState, getCurrentLocation, requestPermission } = useLocationDetection();
  
  const [stations, setStations] = useState([]);
  const [showStationModal, setShowStationModal] = useState(false);
  const [stationLoading, setStationLoading] = useState(false);
  const [stationError, setStationError] = useState(null);
  const [convertModal, setConvertModal] = useState({ isOpen: false, noteData: null });
  const [validationError, setValidationError] = useState('');

  const [liters, setLiters] = useState('');
  const [moneySpent, setMoneySpent] = useState('');
  const [lastEditedField, setLastEditedField] = useState(null); 
  const [odometer, setOdometer] = useState('');
  const [selectedFuelType, setSelectedFuelType] = useState('92');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10)); 
  const [station, setStation] = useState('');
  const [notes, setNotes] = useState('');
  const [tankLevelAfter, setTankLevelAfter] = useState(100);
  
  const handleDetectStation = async () => {
    try {
      if (permissionState === 'denied') {
        const granted = await requestPermission();
        if (!granted) return;
      }
      const locationData = await getCurrentLocation();
      if (!locationData) return;
      setStationLoading(true);
      const nearbyStations = await gasStationService.findNearbyGasStations(locationData.latitude, locationData.longitude);
      setStations(nearbyStations);
    } catch (error) {
      setStationError(error.message);
    } finally {
      setStationLoading(false);
    }
  };
  
  const handleStationSelect = (station) => {
    setStation(station.name);
    setShowStationModal(false);
  };

  const handleAddUserStation = async (stationName) => {
    if (!location) return;
    try {
      gasStationService.saveUserStation(stationName, location.latitude, location.longitude);
      setStation(stationName);
      setShowStationModal(false);
      gasStationService.clearCache();
    } catch (error) {
      console.error(error);
    }
  };

  const handleConvertToMaintenanceLog = () => setConvertModal({ isOpen: true, noteData: notes.trim() });

  const confirmConvertToMaintenanceLog = () => {
    if (convertModal.noteData) {
      addMaintenanceEntry({
        type: 'general_inspection',
        performedAtODO: odometer ? Number(odometer) : 0,
        intervalKm: 0,
        notes: convertModal.noteData
      });
      setNotes('');
      setConvertModal({ isOpen: false, noteData: null });
    }
  };
  
  useEffect(() => {
     if (activeVehicleFillUps.length > 0 && !odometer) {
        setOdometer(String(activeVehicleFillUps[activeVehicleFillUps.length - 1].odometer));
     }
  }, [activeVehicleFillUps]);

  useEffect(() => {
    if (lastEditedField === 'liters' && liters && fuelPrices[selectedFuelType]) {
      setMoneySpent((Number(liters) * fuelPrices[selectedFuelType]).toFixed(2));
    } else if (lastEditedField === 'moneySpent' && moneySpent && fuelPrices[selectedFuelType]) {
      setLiters((Number(moneySpent) / fuelPrices[selectedFuelType]).toFixed(2));
    }
  }, [liters, moneySpent, selectedFuelType, fuelPrices, lastEditedField]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((!liters && !moneySpent) || !odometer) return;
    const newOdometer = Number(odometer);
    const newDate = new Date(date);
    const now = new Date();
    newDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    
    addFillUp({
      timestamp: newDate.toISOString(),
      fuelType: selectedFuelType,
      liters: Number(liters) || 0,
      odometer: newOdometer,
      pricePerLiter: Number(fuelPrices[selectedFuelType] || 0),
      station: station.trim(),
      notes: notes.trim(),
      tankLevelAfter: tankLevelAfter,
      tankCapacityLiters: activeVehicle?.tankCapacity || null,
      isPartialFill: tankLevelAfter < 100
    });
    
    navigate('/');
  };

  const activeAlerts = maintenanceEntries.filter(entry => {
    if (!entry.nextDueODO || !entry.alertODO) return false;
    const currentOdo = activeVehicleFillUps.length > 0 ? activeVehicleFillUps[activeVehicleFillUps.length - 1].odometer : 0;
    return currentOdo >= entry.alertODO;
  });

  return (
  <>
    {createPortal(
      <div className="fixed-button-container" ref={buttonContainerRef}>
        <div className="max-w-lg mx-auto flex gap-3">
          <button type="button" onClick={() => navigate('/')} className="flex-1 px-6 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all">
            <ArrowLeft className={cn("w-5 h-5", isRtl && "rotate-180")} /> <span>{t('back')}</span>
          </button>
          <button type="submit" form="fillup-form" disabled={(!liters && !moneySpent) || !odometer} className="flex-1 px-6 bg-emerald-500 text-white font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-xl shadow-emerald-500/30 active:scale-[0.98]">
            <Plus className="w-5 h-5" /> <span>{t('save')}</span>
          </button>
        </div>
      </div>,
      document.body
    )}

    <PageWrapper>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">{t('add_fillup')}</h2>
      </div>

      <form id="fillup-form" onSubmit={handleSubmit} className="space-y-5 pb-32">
        <Card className="p-6">
           <div className="space-y-5">
              <div>
                 <Label>{t('history')}</Label>
                 <DateInput value={date} onChange={setDate} required />
              </div>

              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('odometer')}</Label>
                    <Input type="number" value={odometer} onChange={(e) => setOdometer(e.target.value)} placeholder="12543" required min="0" />
                    {activeAlerts.length > 0 && (
                      <div className="mt-3 space-y-2">
                         {activeAlerts.map(alert => {
                           const cat = getCategoryById(alert.type);
                           const isOverdue = Number(odometer) >= alert.nextDueODO;
                           return (
                             <div key={alert.id} className={cn("p-3 rounded-xl border flex flex-col gap-1", isOverdue ? 'bg-red-50 dark:bg-red-500/10 text-red-700' : 'bg-amber-50 dark:bg-amber-500/10 text-amber-700')}>
                                <span className="text-[10px] font-black uppercase tracking-wider">{t(cat?.id)} {isOverdue ? t('overdue') : t('due_soon')}</span>
                                <span className="text-[10px] font-bold">Due: {alert.nextDueODO.toLocaleString()} km</span>
                             </div>
                           );
                         })}
                      </div>
                    )}
                  </div>
                 <div>
                   <Label>{t('liters')}</Label>
                   <Input type="number" step="0.01" value={liters} onChange={(e) => { setLastEditedField('liters'); setLiters(e.target.value); }} placeholder="45.5" />
                 </div>
              </div>
              <div>
                 <Label>{t('total_spent')} (EGP)</Label>
                 <Input type="number" step="0.01" value={moneySpent} onChange={(e) => { setLastEditedField('moneySpent'); setMoneySpent(e.target.value); }} placeholder="1000.00" />
              </div>

              <div>
                 <Label>{t('fuel_prices')}</Label>
                 <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-2xl relative z-20">
                   {['92', '95', 'diesel'].map(t_id => (
                      <button key={t_id} type="button" onClick={() => setSelectedFuelType(t_id)} className={`relative flex-1 py-3 px-3 rounded-xl text-sm font-bold transition-all ${selectedFuelType === t_id ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
                         {selectedFuelType === t_id && <motion.div layoutId="fillUpFuelGradeTab" className="absolute inset-0 bg-white dark:bg-emerald-500 rounded-xl shadow-sm" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
                         <span className="relative z-10">{t_id}</span>
                      </button>
                   ))}
                 </div>
              </div>

              {activeVehicle?.tankCapacity && (
                 <div>
                   <Label>Fuel Level After Fill</Label>
                   <div className="bg-slate-100 dark:bg-white/[0.03] rounded-3xl p-4"><FuelGaugeSlider value={tankLevelAfter} onChange={setTankLevelAfter} /></div>
                 </div>
              )}
           </div>
        </Card>

        <Card className="p-6">
           <div className="space-y-4">
              <div>
                 <Label>Station (Optional)</Label>
                 <div className="flex gap-2">
                    <Input type="text" value={station} onChange={e => setStation(e.target.value)} placeholder="..." className="flex-1" />
                    <button type="button" onClick={() => setShowStationModal(true)} className="px-3 py-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 rounded-xl"><MapPin className="w-4 h-4" /></button>
                 </div>
              </div>
              <div>
                 <Label>{t('config')} (Optional)</Label>
                 <div className="space-y-2">
                   <textarea className="input-field min-h-[80px]" rows="2" value={notes} onChange={e => setNotes(e.target.value)} placeholder="..." />
                   {notes.trim() && (
                     <button type="button" onClick={handleConvertToMaintenanceLog} className="flex items-center gap-2 px-3 py-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 rounded-xl text-sm"><Wrench className="w-4 h-4" /> {t('add_maintenance')}</button>
                   )}
                 </div>
              </div>
           </div>
        </Card>
      </form>
    </PageWrapper>

    <StationSuggestion show={showStationModal} stations={stations} loading={stationLoading} error={stationError} permissionState={permissionState} onStationSelect={handleStationSelect} onDetectLocation={handleDetectStation} onAddUserStation={handleAddUserStation} onClose={() => setShowStationModal(false)} />
    <ConfirmModal isOpen={convertModal.isOpen} onClose={() => setConvertModal({ isOpen: false })} onConfirm={confirmConvertToMaintenanceLog} title={t('add_maintenance')} message={t('healthy') + "?"} confirmText={t('save')} cancelText={t('cancel')} variant="info" />
  </>
  );
}
