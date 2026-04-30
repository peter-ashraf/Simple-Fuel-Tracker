import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calculator, RotateCcw, Save, Clock, Circle, TrendingUp, AlertTriangle, Check, History, ChevronDown, Pencil, Gauge, ArrowLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Input, Label, PageWrapper } from './ui';
import { useFuel } from '../hooks/useFuelContext';
import { compareTyreSizes, validateTyreDimensions, commonTyreSizes, formatTyreSize } from '../utils/tyreCalculator';
import { formatTo2Decimals } from '../utils/formatting';
import TyreComparisonHistory from './TyreComparisonHistory';

export default function TyreCalculator() {
  const { addTyreComparison, activeVehicle } = useFuel();
  const navigate = useNavigate();
  const originalTyre = activeVehicle?.tyreSize || { width: 205, aspectRatio: 55, rimSize: 16 };
  const [newTyre, setNewTyre] = useState({ width: 215, aspectRatio: 55, rimSize: 16 });
  const [result, setResult] = useState(null);
  const [errors, setErrors] = useState([]);
  const [saved, setSaved] = useState(false);
  const [sizesOpen, setSizesOpen] = useState(false);

  const handleCalculate = () => {
    setSaved(false);

    const originalValidation = validateTyreDimensions(originalTyre);
    const newValidation = validateTyreDimensions(newTyre);

    const allErrors = [
      ...originalValidation.errors.map(e => `Original tyre: ${e}`),
      ...newValidation.errors.map(e => `New tyre: ${e}`)
    ];

    if (allErrors.length > 0) {
      setErrors(allErrors);
      setResult(null);
      return;
    }

    setErrors([]);
    const comparison = compareTyreSizes(originalTyre, newTyre, {
      speedKmh: 100,
      gearRatio: 1.0,
      finalDriveRatio: 3.5
    });
    setResult(comparison);
  };

  const handleSave = () => {
    if (result) {
      addTyreComparison(result);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    }
  };

  const handleReset = () => {
    setNewTyre({ width: 215, aspectRatio: 55, rimSize: 16 });
    setResult(null);
    setErrors([]);
    setSaved(false);
    setSizesOpen(false);
  };

  const handleQuickSelect = (size) => {
    setNewTyre(size);
    setSizesOpen(false);
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
              onClick={handleSave}
              disabled={!result || saved}
              className="flex-1 px-6 bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-500/25 active:scale-[0.98]"
            >
              <Save className="w-5 h-5" />
              <span>{saved ? 'Saved' : 'Save Comparison'}</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      <PageWrapper className="space-y-6">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Circle className="w-6 h-6 text-emerald-500" />
          Tyre Size Calculator
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Compare tyre sizes and see impact on speedometer and RPM
        </p>
      </div>

      {/* Original Tyre - Read Only */}
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Circle className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Original Tyre</h2>
          </div>
          <Link
            to="/settings"
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Pencil className="w-3 h-3" />
            Edit in Settings
          </Link>
        </div>
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">Vehicle:</span>
            <span className="font-semibold">{activeVehicle?.name || 'Default Vehicle'}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">Size:</span>
            <span className="font-bold text-slate-900 dark:text-white">{formatTyreSize(originalTyre)}</span>
          </div>
          {!activeVehicle?.tyreSize && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
              No tyre size set for this vehicle. Click &quot;Edit in Settings&quot; to add one.
            </p>
          )}
        </div>
      </Card>

      {/* New Tyre */}
      <Card className="space-y-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Circle className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">New Tyre</h2>
          </div>

          {/* Common Sizes Dropdown */}
          <div className="relative">
            <button
              onClick={() => setSizesOpen(!sizesOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-700"
            >
              <span>Common Sizes</span>
              <motion.div animate={{ rotate: sizesOpen ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                <ChevronDown className="w-3 h-3" />
              </motion.div>
            </button>

            <AnimatePresence>
              {sizesOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.95, transition: { duration: 0.15 } }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="absolute top-9 right-0 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl overflow-hidden z-50 origin-top-right"
                >
                  <div className="p-1 max-h-48 overflow-y-auto scrollbar-none">
                    {commonTyreSizes.map((size, index) => (
                      <button
                        key={index}
                        onClick={() => handleQuickSelect(size)}
                        className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors"
                      >
                        {size.label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 items-start">
          <div className="flex flex-col">
            <Label className="text-xs mb-4 h-4">Width (mm)</Label>
            <Input
              type="number"
              value={newTyre.width}
              onChange={(e) => setNewTyre({ ...newTyre, width: parseInt(e.target.value) || 0 })}
              min="100"
              max="400"
              className="text-center font-bold h-10"
            />
          </div>
          <div className="flex flex-col">
            <Label className="text-xs mb-4 h-4">Aspect Ratio (%)</Label>
            <Input
              type="number"
              value={newTyre.aspectRatio}
              onChange={(e) => setNewTyre({ ...newTyre, aspectRatio: parseInt(e.target.value) || 0 })}
              min="20"
              max="85"
              className="text-center font-bold h-10"
            />
          </div>
          <div className="flex flex-col">
            <Label className="text-xs mb-4 h-4">Rim Size (in)</Label>
            <Input
              type="number"
              value={newTyre.rimSize}
              onChange={(e) => setNewTyre({ ...newTyre, rimSize: parseInt(e.target.value) || 0 })}
              min="10"
              max="24"
              className="text-center font-bold h-10"
            />
          </div>
        </div>

        <div className="text-center text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/50 rounded-lg py-2">
          {formatTyreSize(newTyre)}
        </div>
      </Card>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 font-medium">
            <AlertTriangle className="w-4 h-4" />
            Validation Errors
          </div>
          {errors.map((error, index) => (
            <p key={index} className="text-sm text-red-600 dark:text-red-400">{error}</p>
          ))}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleCalculate}
          className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-4 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          <Calculator className="w-5 h-5" />
          Calculate Difference
        </button>
        <button
          onClick={handleReset}
          className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium py-4 px-4 rounded-xl transition-colors flex items-center justify-center"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* Results */}
      {result && (
        <Card className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Comparison Results
            </h2>
            <button
              onClick={handleSave}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                saved 
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>

          {/* Tyre Specs Comparison */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-blue-700 dark:text-blue-400">Original</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Size:</span>
                  <span className="font-medium">{formatTyreSize(result.original)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Diameter:</span>
                  <span className="font-medium">{result.original.diameter}&quot;</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Circumference:</span>
                  <span className="font-medium">{result.original.circumference}&quot;</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Sidewall:</span>
                  <span className="font-medium">{result.original.sidewallMm} mm</span>
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400">New</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Size:</span>
                  <span className="font-medium">{formatTyreSize(result.new)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Diameter:</span>
                  <span className="font-medium">{result.new.diameter}&quot;</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Circumference:</span>
                  <span className="font-medium">{result.new.circumference}&quot;</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-400">Sidewall:</span>
                  <span className="font-medium">{result.new.sidewallMm} mm</span>
                </div>
              </div>
            </div>
          </div>

          {/* Differences */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300">Size Differences</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {result.differences.diameterDifference > 0 ? '+' : ''}{result.differences.diameterDifference}&quot;
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Diameter Change</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {result.differences.circumferenceDifference}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Circumference Change</div>
              </div>
            </div>
          </div>

          {/* Speed Impact */}
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <Gauge className="w-4 h-4" />
              Speed Impact at {result.speedImpact.speedometerSpeed} km/h
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {result.speedImpact.speedometerSpeed} km/h
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Speedometer</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                  {result.speedImpact.actualSpeed} km/h
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Actual Speed</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                  {result.speedImpact.speedPercentageChange}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Difference</div>
              </div>
            </div>
          </div>

          {/* RPM Impact */}
          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-purple-700 dark:text-purple-400 flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              RPM Impact at {result.speedImpact.speedometerSpeed} km/h
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  {result.rpmImpact.originalRPM}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">Original RPM</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  {result.rpmImpact.newRPM}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">New RPM</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-bold text-purple-600 dark:text-purple-400">
                  {result.rpmImpact.rpmPercentageChange}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">RPM Change</div>
              </div>
            </div>
          </div>

          {/* Timestamp */}
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Clock className="w-3 h-3" />
            Calculated: {new Date(result.timestamp).toLocaleString()}
          </div>
        </Card>
      )}

      {/* Comparison History */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-slate-500" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Recent Comparisons</h2>
        </div>
        <TyreComparisonHistory />
      </section>

          </PageWrapper>
    </>
  );
}
