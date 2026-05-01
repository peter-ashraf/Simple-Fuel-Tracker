import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Route, Calculator, TrendingUp, AlertCircle, Info, ChevronDown, Check, ArrowLeft, Trash2, Clock, MapPin, History, CheckSquare, Square, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Input, Label, PageWrapper, cn } from '../ui';
import { useFuel } from '../../hooks/useFuelContext';
import { calculateTripEstimate, convertConsumptionUnits, convertDistance } from '../../utils/tripEstimator';
import { formatCurrency2Dec, formatVolume2Dec, formatEfficiency2Dec } from '../../utils/formatting';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

export default function TripCostEstimator() {
  const { activeVehicleFillUpsByOdometer, fuelPrices, addTripEstimate, tripEstimates, deleteTripEstimate, deleteMultipleTripEstimates } = useFuel();
  const navigate = useNavigate();
  const [tripDistance, setTripDistance] = useState('');
  const [distanceUnit, setDistanceUnit] = useState('km');
  const [manualConsumption, setManualConsumption] = useState('');
  const [manualFuelPrice, setManualFuelPrice] = useState('');
  const [useManualConsumption, setUseManualConsumption] = useState(false);
  const [useManualPrice, setUseManualPrice] = useState(false);
  const [isRoundTrip, setIsRoundTrip] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isUnitDropdownOpen, setIsUnitDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  
  // Bulk selection state for saved estimates
  const [selectedEstimateIds, setSelectedEstimateIds] = useState(new Set());
  const [isEstimateSelectionMode, setIsEstimateSelectionMode] = useState(false);
  
  const toggleEstimateSelection = (id) => {
    const newSelected = new Set(selectedEstimateIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedEstimateIds(newSelected);
  };
  
  const selectAllEstimates = () => {
    if (selectedEstimateIds.size === tripEstimates.length) {
      setSelectedEstimateIds(new Set());
    } else {
      setSelectedEstimateIds(new Set(tripEstimates.map(e => e.id)));
    }
  };
  
  const handleBulkDeleteEstimates = () => {
    // Use bulk delete function to delete all at once
    deleteMultipleTripEstimates(Array.from(selectedEstimateIds));
    setSelectedEstimateIds(new Set());
    setIsEstimateSelectionMode(false);
  };
  
  const clearEstimateSelection = () => {
    setSelectedEstimateIds(new Set());
    setIsEstimateSelectionMode(false);
  };

  const distanceUnits = [
    { value: 'km', label: 'km' },
    { value: 'miles', label: 'miles' }
  ];

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsUnitDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Calculate estimate whenever inputs change
  useEffect(() => {
    if (tripDistance && parseFloat(tripDistance) > 0) {
      calculateEstimate();
    } else {
      setEstimate(null);
    }
  }, [tripDistance, distanceUnit, manualConsumption, manualFuelPrice, useManualConsumption, useManualPrice, isRoundTrip, activeVehicleFillUpsByOdometer]);

  const calculateEstimate = async () => {
    setIsCalculating(true);
    
    // Convert distance to km for calculation
    const distanceInKm = convertDistance(parseFloat(tripDistance), distanceUnit, 'km');
    const finalDistance = isRoundTrip ? distanceInKm * 2 : distanceInKm;

    const options = {
      manualConsumption: useManualConsumption && manualConsumption ? parseFloat(manualConsumption) : null,
      manualFuelPrice: useManualPrice && manualFuelPrice ? parseFloat(manualFuelPrice) : null,
      sampleSize: 5,
      excludeOutliers: true
    };

    // Simulate calculation delay for better UX
    await new Promise(resolve => setTimeout(resolve, 300));

    const result = calculateTripEstimate(activeVehicleFillUpsByOdometer, finalDistance, options);
    
    // Save estimate with additional metadata
    const estimateToSave = {
      ...result,
      inputDistance: parseFloat(tripDistance),
      distanceUnit,
      isRoundTrip,
      calculatedDistance: finalDistance,
      options
    };
    
    setEstimate(result);
    setIsCalculating(false);
  };

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'high': return 'text-emerald-600 dark:text-emerald-400';
      case 'medium': return 'text-amber-600 dark:text-amber-400';
      case 'low': return 'text-orange-600 dark:text-orange-400';
      default: return 'text-slate-500 dark:text-slate-400';
    }
  };

  const getConfidenceText = (confidence) => {
    switch (confidence) {
      case 'high': return 'High confidence';
      case 'medium': return 'Medium confidence';
      case 'low': return 'Low confidence';
      default: return 'No data';
    }
  };

  const formatConsumption = (value) => {
    return formatEfficiency2Dec(value);
  };

  const formatPrice = (value) => {
    return formatCurrency2Dec(value, '').replace('L.E ', '') + ' EGP/L';
  };

  return (
    <>
      {createPortal(
        <div className="fixed-button-container-no-nav">
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
              type="button"
              onClick={() => {
                if (estimate) {
                  const estimateToSave = {
                    ...estimate,
                    inputDistance: parseFloat(tripDistance),
                    distanceUnit,
                    isRoundTrip,
                    calculatedDistance: isRoundTrip ? convertDistance(parseFloat(tripDistance), distanceUnit, 'km') * 2 : convertDistance(parseFloat(tripDistance), distanceUnit, 'km'),
                    options: {
                      manualConsumption: useManualConsumption && manualConsumption ? parseFloat(manualConsumption) : null,
                      manualFuelPrice: useManualPrice && manualFuelPrice ? parseFloat(manualFuelPrice) : null,
                      sampleSize: 5,
                      excludeOutliers: true
                    }
                  };
                  addTripEstimate(estimateToSave);
                  // Navigate back to home after saving
                  navigate('/');
                }
              }}
              disabled={!estimate}
              className="flex-1 px-6 bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-500/25 active:scale-[0.98]"
            >
              <Check className="w-5 h-5" />
              <span>Save Estimate</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      <PageWrapper className="space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Trip Cost Estimator</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Estimate fuel cost for your planned trip</p>
      </div>

      {/* Input Section */}
      <Card className="space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Trip Details</h2>
        </div>

        {/* Distance Input */}
        <div className="space-y-2">
          <Label>Trip Distance</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={tripDistance}
              onChange={(e) => setTripDistance(e.target.value)}
              placeholder="Enter distance"
              className="flex-1"
              min="0"
              step="0.1"
            />
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsUnitDropdownOpen(!isUnitDropdownOpen)}
                className="flex items-center gap-2 px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors min-w-[80px] justify-between"
              >
                <span>{distanceUnits.find(u => u.value === distanceUnit)?.label}</span>
                <motion.div animate={{ rotate: isUnitDropdownOpen ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                  <ChevronDown className="w-4 h-4 text-slate-400" />
                </motion.div>
              </button>

              <AnimatePresence>
                {isUnitDropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.15 } }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className="absolute top-12 right-0 w-32 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50 origin-top-right"
                  >
                    <div className="p-1">
                      {distanceUnits.map(unit => (
                        <button
                          key={unit.value}
                          onClick={() => {
                            setDistanceUnit(unit.value);
                            setIsUnitDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors ${distanceUnit === unit.value ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                        >
                          <span>{unit.label}</span>
                          {distanceUnit === unit.value && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Round Trip Toggle */}
        <div className="flex items-center justify-between">
          <Label className="mb-0">Round Trip</Label>
          <button
            onClick={() => setIsRoundTrip(!isRoundTrip)}
            className={cn(
              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
              isRoundTrip ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
            )}
          >
            <span
              className={cn(
                "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                isRoundTrip ? "translate-x-6" : "translate-x-1"
              )}
            />
          </button>
        </div>

        {/* Manual Overrides */}
        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between">
            <Label className="mb-0">Manual Fuel Consumption</Label>
            <button
              onClick={() => setUseManualConsumption(!useManualConsumption)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                useManualConsumption ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  useManualConsumption ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
          
          {useManualConsumption && (
            <div className="space-y-2">
              <Input
                type="number"
                value={manualConsumption}
                onChange={(e) => setManualConsumption(e.target.value)}
                placeholder="km per liter"
                min="0"
                step="0.1"
              />
            </div>
          )}

          <div className="flex items-center justify-between">
            <Label className="mb-0">Manual Fuel Price</Label>
            <button
              onClick={() => setUseManualPrice(!useManualPrice)}
              className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                useManualPrice ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700"
              )}
            >
              <span
                className={cn(
                  "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                  useManualPrice ? "translate-x-6" : "translate-x-1"
                )}
              />
            </button>
          </div>
          
          {useManualPrice && (
            <div className="space-y-2">
              <Input
                type="number"
                value={manualFuelPrice}
                onChange={(e) => setManualFuelPrice(e.target.value)}
                placeholder="EGP per liter"
                min="0"
                step="0.01"
              />
            </div>
          )}
        </div>
      </Card>

      {/* Results Section */}
      {estimate && (
        <Card className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Estimation Results</h2>
          </div>

          {/* Main Results */}
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-200 dark:border-emerald-500/20">
              <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {formatCurrency2Dec(estimate.estimatedCost, '').replace('L.E ', '')}
              </div>
              <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mt-1">EGP Total Cost</div>
            </div>
            
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-500/10 rounded-2xl border border-blue-200 dark:border-blue-500/20">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {formatVolume2Dec(estimate.estimatedLiters, '').replace(' L', '')}
              </div>
              <div className="text-xs font-medium text-blue-700 dark:text-blue-300 mt-1">Liters Needed</div>
            </div>
          </div>

          {/* Estimation Details */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">Fuel Consumption Used:</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {formatConsumption(estimate.consumptionUsed)}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">Fuel Price Used:</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {formatPrice(estimate.priceUsed)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">Data Source:</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {estimate.methodUsed === 'manual_inputs' ? 'Manual inputs' : 
                 estimate.methodUsed === 'manual_consumption' ? 'Manual consumption' : 
                 'Historical data'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">Sample Size:</span>
              <span className="text-sm font-semibold text-slate-900 dark:text-white">
                {estimate.sampleSize > 0 ? `Based on ${estimate.sampleSize} fill-ups` : 'No data'}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-600 dark:text-slate-400">Confidence:</span>
              <span className={cn("text-sm font-semibold", getConfidenceColor(estimate.confidence))}>
                {getConfidenceText(estimate.confidence)}
              </span>
            </div>
          </div>

          {/* Confidence Message */}
          {estimate.confidence === 'none' && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-amber-700 dark:text-amber-300">
                <p className="font-semibold mb-1">Limited Data Available</p>
                <p>Add more fill-ups to get accurate estimates, or use manual inputs for better results.</p>
              </div>
            </div>
          )}

          {estimate.confidence === 'low' && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-500/10 rounded-xl border border-blue-200 dark:border-blue-500/20">
              <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-700 dark:text-blue-300">
                <p className="font-semibold mb-1">Limited Historical Data</p>
                <p>Estimate based on {estimate.sampleSize} fill-up{estimate.sampleSize !== 1 ? 's' : ''}. Add more data for better accuracy.</p>
              </div>
            </div>
          )}

          {/* Save Estimate Button */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => {
                const estimateToSave = {
                  ...estimate,
                  inputDistance: parseFloat(tripDistance),
                  distanceUnit,
                  isRoundTrip,
                  calculatedDistance: isRoundTrip ? convertDistance(parseFloat(tripDistance), distanceUnit, 'km') * 2 : convertDistance(parseFloat(tripDistance), distanceUnit, 'km'),
                  options: {
                    manualConsumption: useManualConsumption && manualConsumption ? parseFloat(manualConsumption) : null,
                    manualFuelPrice: useManualPrice && manualFuelPrice ? parseFloat(manualFuelPrice) : null,
                    sampleSize: 5,
                    excludeOutliers: true
                  }
                };
                addTripEstimate(estimateToSave);
                // Navigate back to home after saving
                navigate('/');
              }}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-medium py-3 px-4 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              Save Estimate to History
            </button>
          </div>

          {/* Raw Data Preview */}
          {estimate.rawData && estimate.rawData.length > 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Recent Data Used</h3>
              <div className="space-y-1">
                {estimate.rawData.slice(0, 3).map((data, index) => (
                  <div key={index} className="flex justify-between items-center text-xs">
                    <span className="text-slate-500 dark:text-slate-400">{data.date}</span>
                    <span className="text-slate-600 dark:text-slate-300">{data.kmPerLiter} km/L @ {data.pricePerLiter} EGP/L</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Loading State */}
      {isCalculating && (
        <Card className="flex items-center justify-center py-8">
          <div className="flex items-center gap-3">
            <div className="animate-spin w-5 h-5 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
            <span className="text-sm text-slate-600 dark:text-slate-400">Calculating estimate...</span>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {/* Saved Estimates History */}
      {tripEstimates.length > 0 && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-purple-500 dark:text-purple-400" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Saved Estimates</h2>
              {isEstimateSelectionMode ? (
                <span className="text-xs font-medium text-purple-600 dark:text-purple-400 px-2 py-0.5 bg-purple-100 dark:bg-purple-500/20 rounded-full">
                  {selectedEstimateIds.size} selected
                </span>
              ) : (
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                  {tripEstimates.length}
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {isEstimateSelectionMode ? (
                <>
                  <button
                    onClick={selectAllEstimates}
                    className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title={selectedEstimateIds.size === tripEstimates.length ? "Deselect All" : "Select All"}
                  >
                    {selectedEstimateIds.size === tripEstimates.length ? (
                      <><Square className="w-3 h-3" /><span className="hidden sm:inline">Deselect All</span></>
                    ) : (
                      <><CheckSquare className="w-3 h-3" /><span className="hidden sm:inline">Select All</span></>
                    )}
                  </button>
                  {selectedEstimateIds.size > 0 && (
                    <button
                      onClick={handleBulkDeleteEstimates}
                      className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-lg transition-colors"
                      title={`Delete ${selectedEstimateIds.size} selected`}
                    >
                      <Trash2 className="w-3 h-3" />
                      <span className="hidden sm:inline">Delete ({selectedEstimateIds.size})</span>
                    </button>
                  )}
                  <button
                    onClick={clearEstimateSelection}
                    className="px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    title="Cancel"
                  >
                    <X className="w-3 h-3 sm:hidden" />
                    <span className="hidden sm:inline">Cancel</span>
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setIsEstimateSelectionMode(true)}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title="Select"
                >
                  <CheckSquare className="w-3 h-3" />
                  <span className="hidden sm:inline">Select</span>
                </button>
              )}
            </div>
          </div>
          
          <div className="space-y-3">
            {tripEstimates.slice().reverse().map((saved) => (
              <div 
                key={saved.id}
                className={`rounded-xl p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/50 ${isEstimateSelectionMode ? 'cursor-pointer' : ''}`}
                onClick={isEstimateSelectionMode ? () => toggleEstimateSelection(saved.id) : undefined}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {isEstimateSelectionMode && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleEstimateSelection(saved.id);
                          }}
                          className="flex-shrink-0"
                        >
                          {selectedEstimateIds.has(saved.id) ? (
                            <CheckSquare className="w-4 h-4 text-purple-500" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </button>
                      )}
                      <p className="text-sm font-bold text-slate-900 dark:text-white">
                        {saved.inputDistance} {saved.distanceUnit}
                        {saved.isRoundTrip && (
                          <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">
                            (round trip: {saved.calculatedDistance.toFixed(1)} km)
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(saved.timestamp), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                  </div>
                  {!isEstimateSelectionMode && (
                    <button
                      onClick={() => deleteTripEstimate(saved.id)}
                      className="text-slate-400 hover:text-red-500 transition-colors p-1"
                      aria-label="Delete estimate"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="text-center p-2 bg-white dark:bg-slate-900 rounded-lg">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Cost</p>
                    <p className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {formatCurrency2Dec(saved.estimatedCost, '').replace('L.E ', '')} EGP
                    </p>
                  </div>
                  <div className="text-center p-2 bg-white dark:bg-slate-900 rounded-lg">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Liters</p>
                    <p className="text-sm font-bold text-blue-600 dark:text-blue-400">
                      {formatVolume2Dec(saved.estimatedLiters, '').replace(' L', '')} L
                    </p>
                  </div>
                  <div className="text-center p-2 bg-white dark:bg-slate-900 rounded-lg">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Efficiency</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
                      {formatEfficiency2Dec(saved.consumptionUsed)}
                    </p>
                  </div>
                </div>
                
                {saved.methodUsed !== 'historical_data' && (
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                    * Used manual {saved.methodUsed === 'manual_inputs' ? 'inputs' : 'consumption'}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {!estimate && !isCalculating && tripEstimates.length === 0 && (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <Route className="w-12 h-12 text-slate-400 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">Ready to Estimate</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
            Enter your trip distance above to get an estimated fuel cost based on your vehicle's historical performance.
          </p>
        </Card>
      )}

          </PageWrapper>
    </>
  );
}
