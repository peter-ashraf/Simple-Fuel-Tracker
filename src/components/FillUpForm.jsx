import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Plus, MapPin, Wrench, ArrowLeft, AlertCircle } from 'lucide-react';
import { useFuel } from '../hooks/useFuelContext';
import { Input, Label, Card, PageWrapper, ConfirmModal, FuelGaugeSlider } from './ui';
import { useLocationDetection } from '../hooks/useLocationDetection';
import { useNotifications } from '../hooks/useNotifications';
import { gasStationService } from '../services/gasStationService';
import { StationSuggestion } from './StationSuggestion';
import { getMaintenanceCategory } from '../data/maintenanceCategories';
import { useNavigate } from 'react-router-dom';
import { DateInput } from './DateInput';

export default function FillUpForm() {
  const { fuelPrices, addFillUp, activeVehicleFillUps, addMaintenanceEntry, maintenanceEntries, activeVehicle } = useFuel();
  const navigate = useNavigate();
  const buttonContainerRef = useRef(null);
  const { checkOdometerThresholds } = useNotifications();

  // Force immediate positioning on mount and also immediately
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
        // Force reflow
        element.offsetHeight;
      }
    };
    
    // Apply immediately
    forcePositioning();
    
    // Also apply after a tiny delay to catch any race conditions
    const timeoutId = setTimeout(forcePositioning, 0);
    
    return () => clearTimeout(timeoutId);
  }, []);
  
  // Location detection state
  const {
    location,
    loading: locationLoading,
    error: locationError,
    permissionState,
    getCurrentLocation,
    requestPermission
  } = useLocationDetection();
  
  const [stations, setStations] = useState([]);
  const [showStationModal, setShowStationModal] = useState(false);
  const [stationLoading, setStationLoading] = useState(false);
  const [stationError, setStationError] = useState(null);
  const [convertModal, setConvertModal] = useState({ isOpen: false, noteData: null });
  const [validationError, setValidationError] = useState('');

  const [liters, setLiters] = useState('');
  const [moneySpent, setMoneySpent] = useState('');
  const [lastEditedField, setLastEditedField] = useState(null); // 'liters' or 'moneySpent'
  const [odometer, setOdometer] = useState('');
  const [selectedFuelType, setSelectedFuelType] = useState('92');
  
  // Advanced fields
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10)); // YYYY-MM-DD
  const [station, setStation] = useState('');
  const [notes, setNotes] = useState('');
  const [tankLevelAfter, setTankLevelAfter] = useState(100);
  
  // Handle station detection
  const handleDetectStation = async () => {
    console.log('🚀 Station detection started');
    console.log('🔐 Permission state:', permissionState);
    
    try {
      if (permissionState === 'denied') {
        console.log('🔒 Permission denied, trying to request again...');
        // Try to request permission again
        const granted = await requestPermission();
        console.log('🔑 Permission request result:', granted);
        if (!granted) {
          console.log('❌ Permission still denied');
          return;
        }
      }
      
      console.log('📍 Getting current location...');
      const locationData = await getCurrentLocation();
      console.log('📍 Location result:', locationData);
      
      if (!locationData) {
        console.log('❌ No location data received');
        return;
      }
      
      console.log('🔍 Searching for gas stations...');
      setStationLoading(true);
      setStationError(null);
      
      const nearbyStations = await gasStationService.findNearbyGasStations(
        locationData.latitude,
        locationData.longitude
      );
      console.log('⛽ Found stations:', nearbyStations);
      setStations(nearbyStations);
      
    } catch (error) {
      console.error('❌ Station detection failed:', error);
      setStationError(error.message);
    } finally {
      setStationLoading(false);
      console.log('✅ Station detection completed');
    }
  };
  
  const handleStationSelect = (station) => {
    setStation(station.name);
    setShowStationModal(false);
  };

  const handleAddUserStation = async (stationName) => {
    if (!location) {
      console.error('No location available to save station');
      return;
    }
    
    try {
      const savedStation = gasStationService.saveUserStation(
        stationName,
        location.latitude,
        location.longitude
      );
      
      console.log('✅ Station saved:', savedStation);
      
      // Auto-select the saved station
      setStation(stationName);
      setShowStationModal(false);
      
      // Clear cache to force refresh next time
      gasStationService.clearCache();
      
    } catch (error) {
      console.error('❌ Failed to save station:', error);
    }
  };

  const handleConvertToMaintenanceLog = () => {
    setConvertModal({ isOpen: true, noteData: notes.trim() });
  };

  const confirmConvertToMaintenanceLog = () => {
    if (convertModal.noteData) {
      const baseDate = new Date(date);
      const now = new Date();
      baseDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      
      addMaintenanceEntry({
        type: 'general_inspection',
        performedAtODO: odometer ? Number(odometer) : 0,
        intervalKm: 0,
        notes: convertModal.noteData + ` (Recorded during fill-up at ${station || 'gas station'})`
      });
      setNotes('');
      setConvertModal({ isOpen: false, noteData: null });
    }
  };
  
  // Auto-fill odometer suggestion from previous
  useEffect(() => {
     if (activeVehicleFillUps.length > 0 && !odometer) {
        setOdometer(String(activeVehicleFillUps[activeVehicleFillUps.length - 1].odometer));
     }
  }, [activeVehicleFillUps]);

  // Auto-calculate based on last edited field
  useEffect(() => {
    if (lastEditedField === 'liters' && liters && fuelPrices[selectedFuelType]) {
      const calculatedCost = Number(liters) * fuelPrices[selectedFuelType];
      setMoneySpent(calculatedCost.toFixed(2));
    } else if (lastEditedField === 'moneySpent' && moneySpent && fuelPrices[selectedFuelType]) {
      const calculatedLiters = Number(moneySpent) / fuelPrices[selectedFuelType];
      setLiters(calculatedLiters.toFixed(2));
    }
  }, [liters, moneySpent, selectedFuelType, fuelPrices, lastEditedField]);

  // Reset calculation when fuel type changes
  useEffect(() => {
    if (lastEditedField && fuelPrices[selectedFuelType]) {
      if (lastEditedField === 'liters' && liters) {
        const calculatedCost = Number(liters) * fuelPrices[selectedFuelType];
        setMoneySpent(calculatedCost.toFixed(2));
      } else if (lastEditedField === 'moneySpent' && moneySpent) {
        const calculatedLiters = Number(moneySpent) / fuelPrices[selectedFuelType];
        setLiters(calculatedLiters.toFixed(2));
      }
    }
  }, [selectedFuelType, fuelPrices]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError('');
    if ((!liters && !moneySpent) || !odometer) return;

    if (!fuelPrices[selectedFuelType] && (!liters || !moneySpent)) {
      setValidationError("Missing fuel price! Please set the global price in Settings, or manually enter both Liters and Total Money Spent.");
      return;
    }

    const newOdometer = Number(odometer);
    const newDate = new Date(date);
    const now = new Date();
    // Maintain chronological sort accurately by blending current time
    newDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
    
    if (activeVehicleFillUps.length > 0) {
      // Sort existing fillups by date safely
      const sortedFillUps = [...activeVehicleFillUps].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Find the immediately preceding and succeeding fill-ups based on the selected date
      let prevFillUp = null;
      let nextFillUp = null;

      for (const fillUp of sortedFillUps) {
        const fillUpDate = new Date(fillUp.timestamp);
        if (fillUpDate <= newDate) {
          prevFillUp = fillUp;
        } else if (!nextFillUp) {
          nextFillUp = fillUp;
        }
      }

      if (prevFillUp && newOdometer <= prevFillUp.odometer) {
        setValidationError(`Invalid distance! Odometer must be strictly greater than ${prevFillUp.odometer} km (log from ${new Date(prevFillUp.timestamp).toLocaleDateString()}).`);
        return;
      }
      
      if (nextFillUp && newOdometer >= nextFillUp.odometer) {
        setValidationError(`Invalid distance! Odometer must be strictly less than ${nextFillUp.odometer} km (log from ${new Date(nextFillUp.timestamp).toLocaleDateString()}).`);
        return;
      }
    }

    const currentPrice = fuelPrices[selectedFuelType] || 0;

    // Get previous odometer for threshold checking
    const previousOdometer = activeVehicleFillUps.length > 0 
      ? activeVehicleFillUps[activeVehicleFillUps.length - 1].odometer 
      : 0;

    addFillUp({
      timestamp: newDate.toISOString(),
      fuelType: selectedFuelType,
      liters: Number(liters) || 0,
      odometer: newOdometer,
      pricePerLiter: Number(currentPrice),
      station: station.trim(),
      notes: notes.trim(),
      tankLevelAfter: tankLevelAfter,
      tankCapacityLiters: activeVehicle?.tankCapacity || null,
      isPartialFill: tankLevelAfter < 100
    });
    
    // Check if we crossed any maintenance thresholds (redundant now with UI alerts but good for system notifications)
    checkOdometerThresholds(maintenanceEntries, newOdometer, previousOdometer);
    
    // Navigate back to dashboard after successful save
    navigate('/');
  };

  const activeAlerts = maintenanceEntries.filter(entry => {
    if (!entry.nextDueODO || !entry.alertODO) return false;
    const currentOdometer = activeVehicleFillUps.length > 0 
      ? activeVehicleFillUps[activeVehicleFillUps.length - 1].odometer 
      : 0;
    return currentOdometer >= entry.alertODO;
  });

  return (
  <>
    {createPortal(
      <div className="fixed-button-container">
        <div className="max-w-lg mx-auto flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex-1 px-6 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back</span>
          </button>
          <button 
             type="submit" 
             form="fillup-form"
             disabled={(!liters && !moneySpent) || !odometer}
             className="flex-1 px-6 bg-emerald-500 hover:bg-emerald-400 text-white font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-500/30 dark:shadow-[0_0_25px_rgba(16,185,129,0.4)] active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" />
            <span>Save Fill-up</span>
          </button>
        </div>
        
        {validationError && (
          <div className="max-w-lg mx-auto mt-2">
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold px-4 py-2 rounded-xl flex items-start gap-2 shadow-sm backdrop-blur-md">
               <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
               <p>{validationError}</p>
            </div>
          </div>
        )}
      </div>,
      document.body
    )}

    <PageWrapper>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white tracking-tight">Add Fill-up</h2>
      </div>

      <form id="fillup-form" onSubmit={handleSubmit} className="space-y-5 pb-32">
      <Card className="p-6">
         <div className="space-y-5">
            
            <div>
               <Label>Date</Label>
               <DateInput 
                 value={date} 
                 onChange={(value) => setDate(value)}
                 required
               />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Odometer (km)</Label>
                  <Input 
                    type="number" 
                    value={odometer} 
                    onChange={(e) => setOdometer(e.target.value)}
                    placeholder="12543"
                    required
                    min="0"
                  />
                  {activeAlerts.length > 0 && (
                    <div className="mt-3 space-y-2">
                       {activeAlerts.map(alert => (
                         <div 
                           key={alert.id}
                           className={`p-3 rounded-xl border flex items-center justify-between animate-in fade-in slide-in-from-top-2 duration-300 ${
                             alert.status === 'critical' 
                              ? 'bg-red-50 dark:bg-red-500/10 border-red-100 dark:border-red-500/20 text-red-700 dark:text-red-400' 
                              : 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 text-amber-700 dark:text-amber-400'
                           }`}
                         >
                            <div className="flex items-center gap-2">
                               <div className="w-2 h-2 rounded-full" style={{ backgroundColor: alert.categoryColor }}></div>
                               <span className="text-xs font-black uppercase tracking-wider">{alert.categoryName} {alert.status === 'critical' ? 'Overdue!' : 'Due Soon'}</span>
                            </div>
                            <span className="text-[10px] font-bold">Due at {alert.nextDueODO.toLocaleString()} km</span>
                         </div>
                       ))}
                    </div>
                  )}
                </div>
               <div>
                 <Label>Liters</Label>
                 <Input 
                   type="number" 
                   step="0.01"
                   value={liters} 
                   onChange={(e) => {
                     setLastEditedField('liters');
                     setLiters(e.target.value);
                   }}
                   placeholder="45.5"
                   min="0.1"
                 />
               </div>
            </div>
            <div>
               <Label>Money Spent (EGP)</Label>
               <Input 
                 type="number" 
                 step="0.01"
                 value={moneySpent} 
                 onChange={(e) => {
                   setLastEditedField('moneySpent');
                   setMoneySpent(e.target.value);
                 }}
                 placeholder="1000.00"
                 min="0.1"
               />
            </div>

            <div>
               <Label>Fuel Grade</Label>
               <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900/50 rounded-2xl relative z-20">
                 {['92', '95', 'diesel'].map(t => (
                    <button
                       key={t}
                       type="button"
                       onClick={() => setSelectedFuelType(t)}
                       className={`relative flex-1 py-3 px-3 rounded-xl text-sm font-bold capitalize transition-all ${
                          selectedFuelType === t
                          ? 'text-slate-900 dark:text-white'
                          : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                       }`}
                    >
                       {selectedFuelType === t && (
                          <motion.div
                             layoutId="fillUpFuelGradeTab"
                             className="absolute inset-0 bg-white dark:bg-emerald-500 rounded-xl shadow-sm"
                             transition={{ type: "spring", stiffness: 400, damping: 30 }}
                          />
                       )}
                       <span className="relative z-10">{t === 'diesel' ? 'Diesel' : t}</span>
                    </button>
                 ))}
               </div>
                <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium text-center mt-2 opacity-80">Will apply current price: {fuelPrices[selectedFuelType]} EGP/L</p>
            </div>

            {activeVehicle?.tankCapacity ? (
               <div>
                 <Label>Fuel Level After Fill</Label>
                 <div className="bg-slate-100 dark:bg-white/[0.03] rounded-3xl p-4">
                    <FuelGaugeSlider value={tankLevelAfter} onChange={setTankLevelAfter} />
                 </div>
               </div>
            ) : null}

         </div>
      </Card>

      <Card className="p-6">
         <div className="space-y-4">
            <div>
               <Label>Station (Optional)</Label>
               <div className="flex gap-2">
                  <Input 
                    type="text" 
                    value={station}
                    onChange={e => setStation(e.target.value)}
                    placeholder="e.g. Total, Mobil, Wataniya"
                    className="flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setShowStationModal(true)}
                    className="px-3 py-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 rounded-xl transition-colors border-0"
                    title="Detect nearby gas stations"
                  >
                     <MapPin className="w-4 h-4" />
                  </button>
               </div>
            </div>
            <div>
               <Label>Notes (Optional)</Label>
               <div className="space-y-2">
                 <textarea 
                   className="w-full bg-white dark:bg-white/[0.06] border-0 rounded-2xl px-5 py-4 text-left text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all font-medium resize-none"
                   rows="2"
                   value={notes}
                   onChange={e => setNotes(e.target.value)}
                   placeholder="e.g. Changed oil, tire pressure checked..."
                 />
                 {notes.trim() && (
                   <button
                     type="button"
                     onClick={handleConvertToMaintenanceLog}
                     className="flex items-center gap-2 px-3 py-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 rounded-xl transition-colors text-sm border-0"
                   >
                     <Wrench className="w-4 h-4" />
                     Convert to Maintenance Log
                   </button>
                 )}
               </div>
            </div>
         </div>
      </Card>

      </form>
    </PageWrapper>

    {/* Station Suggestion Modal */}
    <StationSuggestion
      show={showStationModal}
      stations={stations}
      loading={stationLoading}
      error={stationError}
      permissionState={permissionState}
      onStationSelect={handleStationSelect}
      onDetectLocation={handleDetectStation}
      onAddUserStation={handleAddUserStation}
      onClose={() => setShowStationModal(false)}
    />

    {/* Convert to Maintenance Log Confirmation Modal */}
    <ConfirmModal
      isOpen={convertModal.isOpen}
      onClose={() => setConvertModal({ isOpen: false, noteData: null })}
      onConfirm={confirmConvertToMaintenanceLog}
      title="Convert to Maintenance Log"
      message="Convert this note to a maintenance log? This will clear the notes field and create a separate maintenance record."
      confirmText="Convert"
      cancelText="Cancel"
      variant="info"
    />
    </>
  );
}
