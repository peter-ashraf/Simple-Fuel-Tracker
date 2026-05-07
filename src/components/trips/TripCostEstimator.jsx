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
import { useTranslation } from 'react-i18next';

export default function TripCostEstimator() {
  const { activeVehicleFillUpsByOdometer, fuelPrices, addTripEstimate, tripEstimates, deleteTripEstimate, deleteMultipleTripEstimates } = useFuel();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');

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
  
  const [selectedEstimateIds, setSelectedEstimateIds] = useState(new Set());
  const [isEstimateSelectionMode, setIsEstimateSelectionMode] = useState(false);
  
  useEffect(() => {
    if (tripDistance && parseFloat(tripDistance) > 0) calculateEstimate();
    else setEstimate(null);
  }, [tripDistance, distanceUnit, manualConsumption, manualFuelPrice, useManualConsumption, useManualPrice, isRoundTrip, activeVehicleFillUpsByOdometer]);

  const calculateEstimate = async () => {
    setIsCalculating(true);
    const distanceInKm = convertDistance(parseFloat(tripDistance), distanceUnit, 'km');
    const finalDistance = isRoundTrip ? distanceInKm * 2 : distanceInKm;
    const options = {
      manualConsumption: useManualConsumption && manualConsumption ? parseFloat(manualConsumption) : null,
      manualFuelPrice: useManualPrice && manualFuelPrice ? parseFloat(manualFuelPrice) : null,
      sampleSize: 5,
      excludeOutliers: true
    };
    await new Promise(resolve => setTimeout(resolve, 300));
    const result = calculateTripEstimate(activeVehicleFillUpsByOdometer, finalDistance, options);
    setEstimate(result);
    setIsCalculating(false);
  };

  const getConfidenceColor = (confidence) => {
    switch (confidence) {
      case 'high': return 'text-emerald-500';
      case 'medium': return 'text-amber-500';
      case 'low': return 'text-orange-500';
      default: return 'text-slate-400';
    }
  };

  return (
    <>
      {createPortal(
        <div className="fixed-button-container-no-nav">
          <div className="max-w-lg mx-auto flex gap-3">
            <button type="button" onClick={() => navigate('/')} className="flex-1 px-6 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all">
              <ArrowLeft className={cn("w-5 h-5", isRtl && "rotate-180")} /> <span>{t('back')}</span>
            </button>
            <button type="button" onClick={() => estimate && (addTripEstimate(estimate) || navigate('/'))} disabled={!estimate} className="flex-1 px-6 bg-emerald-500 text-white dark:text-slate-950 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-xl shadow-emerald-500/25 active:scale-[0.98]">
              <Check className="w-5 h-5" /> <span>{t('save')}</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      <PageWrapper className="space-y-6 pb-32">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{t('trip_estimator')}</h1>
          <p className="text-sm text-slate-500 mt-1">Estimate fuel cost for your planned trip</p>
        </div>

        <Card className="space-y-6">
          <div className="flex items-center gap-2 mb-4">
            <Calculator className="w-5 h-5 text-emerald-500" />
            <h2 className="text-lg font-bold">{t('overview')}</h2>
          </div>

          <div className="space-y-2">
            <Label>{t('distance')}</Label>
            <div className="flex gap-2">
              <Input type="number" value={tripDistance} onChange={(e) => setTripDistance(e.target.value)} placeholder="..." className="flex-1" />
              <button className="px-4 bg-slate-100 dark:bg-slate-800 rounded-xl font-bold text-xs">KM</button>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="mb-0">{t('round_trip')}</Label>
            <button onClick={() => setIsRoundTrip(!isRoundTrip)} className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", isRoundTrip ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700")}>
              <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", isRoundTrip ? (isRtl ? "-translate-x-6" : "translate-x-6") : (isRtl ? "-translate-x-1" : "translate-x-1"))} />
            </button>
          </div>

          <div className="pt-4 border-t border-slate-200 dark:border-white/10 space-y-4">
             <div className="flex items-center justify-between">
                <Label className="mb-0">{t('manual_inputs')} ({t('avg_consumption')})</Label>
                <button onClick={() => setUseManualConsumption(!useManualConsumption)} className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", useManualConsumption ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700")}>
                  <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", useManualConsumption ? (isRtl ? "-translate-x-6" : "translate-x-6") : (isRtl ? "-translate-x-1" : "translate-x-1"))} />
                </button>
             </div>
             {useManualConsumption && <Input type="number" value={manualConsumption} onChange={(e) => setManualConsumption(e.target.value)} placeholder="km/L" />}
             
             <div className="flex items-center justify-between">
                <Label className="mb-0">{t('manual_inputs')} ({t('price')})</Label>
                <button onClick={() => setUseManualPrice(!useManualPrice)} className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", useManualPrice ? "bg-emerald-500" : "bg-slate-200 dark:bg-slate-700")}>
                  <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", useManualPrice ? (isRtl ? "-translate-x-6" : "translate-x-6") : (isRtl ? "-translate-x-1" : "translate-x-1"))} />
                </button>
             </div>
             {useManualPrice && <Input type="number" value={manualFuelPrice} onChange={(e) => setManualFuelPrice(e.target.value)} placeholder="EGP/L" />}
          </div>
        </Card>

        {estimate && (
          <Card className="space-y-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-bold">{t('estimated_cost')}</h2>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-200 dark:border-emerald-500/20">
                <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{estimate.estimatedCost.toFixed(0)}</div>
                <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 mt-1 uppercase">EGP {t('total_spent')}</div>
              </div>
              <div className="text-center p-4 bg-blue-50 dark:bg-blue-500/10 rounded-2xl border border-blue-200 dark:border-blue-500/20">
                <div className="text-3xl font-black text-blue-600 dark:text-blue-400">{estimate.estimatedLiters.toFixed(1)}</div>
                <div className="text-[10px] font-bold text-blue-700 dark:text-blue-300 mt-1 uppercase">{t('liters')}</div>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-white/10">
               <div className="flex justify-between text-sm"><span className="text-slate-500">{t('avg_consumption')}:</span> <span className="font-bold">{formatEfficiency2Dec(estimate.consumptionUsed)}</span></div>
               <div className="flex justify-between text-sm"><span className="text-slate-500">{t('price')}:</span> <span className="font-bold">{estimate.priceUsed.toFixed(2)} EGP/L</span></div>
               <div className="flex justify-between text-sm"><span className="text-slate-500">{t('overview')}:</span> <span className="font-bold">{t(estimate.methodUsed)}</span></div>
               <div className="flex justify-between text-sm"><span className="text-slate-500">{t('confidence')}:</span> <span className={cn("font-bold", getConfidenceColor(estimate.confidence))}>{t(estimate.confidence)}</span></div>
            </div>
          </Card>
        )}
      </PageWrapper>
    </>
  );
}
