import { useState, useEffect, useRef } from 'react';
import { Route, Calculator, TrendingUp, AlertCircle, Info, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, Input, Label, PageWrapper, cn } from '../ui';
import { useFuel } from '../../hooks/useFuelContext';
import { calculateTripEstimate, convertConsumptionUnits, convertDistance } from '../../utils/tripEstimator';

export default function TripCostEstimator() {
  const { activeVehicleFillUpsByOdometer, fuelPrices } = useFuel();
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
    return value > 0 ? `${value.toFixed(2)} km/L` : 'N/A';
  };

  const formatPrice = (value) => {
    return value > 0 ? `${value.toFixed(2)} EGP/L` : 'N/A';
  };

  return (
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
                {estimate.estimatedCost.toFixed(2)}
              </div>
              <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mt-1">EGP Total Cost</div>
            </div>
            
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-500/10 rounded-2xl border border-blue-200 dark:border-blue-500/20">
              <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {estimate.estimatedLiters.toFixed(1)}
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
      {!estimate && !isCalculating && (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <Route className="w-12 h-12 text-slate-400 dark:text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-slate-700 dark:text-slate-300 mb-2">Ready to Estimate</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
            Enter your trip distance above to get an estimated fuel cost based on your vehicle's historical performance.
          </p>
        </Card>
      )}
    </PageWrapper>
  );
}
