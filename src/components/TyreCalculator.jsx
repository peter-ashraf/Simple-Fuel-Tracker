import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Calculator, RotateCcw, Save, Clock, Circle, TrendingUp, AlertTriangle, Check, History, ChevronDown, Pencil, Gauge, ArrowLeft } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { Card, Input, Label, PageWrapper, cn } from './ui';
import { useFuel } from '../hooks/useFuelContext';
import { compareTyreSizes, validateTyreDimensions, commonTyreSizes, formatTyreSize } from '../utils/tyreCalculator';
import { formatTo2Decimals } from '../utils/formatting';
import TyreComparisonHistory from './TyreComparisonHistory';
import { useTranslation } from 'react-i18next';

export default function TyreCalculator() {
  const { addTyreComparison, activeVehicle } = useFuel();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  
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
      ...originalValidation.errors.map(e => `${t('engine')}: ${e}`),
      ...newValidation.errors.map(e => `${t('tires')}: ${e}`)
    ];
    if (allErrors.length > 0) {
      setErrors(allErrors);
      setResult(null);
      return;
    }
    setErrors([]);
    setResult(compareTyreSizes(originalTyre, newTyre, { speedKmh: 100, gearRatio: 1.0, finalDriveRatio: 3.5 }));
  };

  const handleReset = () => {
    setNewTyre({ width: 215, aspectRatio: 55, rimSize: 16 });
    setResult(null);
    setErrors([]);
    setSaved(false);
    setSizesOpen(false);
  };

  return (
    <>
      {createPortal(
        <div className="fixed-button-container-no-nav">
          <div className="max-w-lg mx-auto flex gap-3">
            <button type="button" onClick={() => navigate('/')} className="flex-1 px-6 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all">
              <ArrowLeft className={cn("w-5 h-5", isRtl && "rotate-180")} /> <span>{t('back')}</span>
            </button>
            <button type="button" onClick={() => { addTyreComparison(result); setSaved(true); setTimeout(() => setSaved(false), 3000); }} disabled={!result || saved} className="flex-1 px-6 bg-emerald-500 text-white dark:text-slate-950 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-xl shadow-emerald-500/25 active:scale-[0.98]">
              <Save className="w-5 h-5" /> <span>{saved ? t('save') : t('save')}</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      <PageWrapper className="space-y-6 pb-32">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <Circle className="w-6 h-6 text-emerald-500" /> {t('tyre_calculator')}
          </h1>
          <p className="text-sm text-slate-500 mt-1">Compare tyre sizes and impacts</p>
        </div>

        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">{t('overview')}</h2>
            <Link to="/settings" className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 rounded-lg transition-colors">
              <Pencil className="w-3 h-3" /> {t('edit')}
            </Link>
          </div>
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-500">{t('active_vehicle')}:</span> <span className="font-bold">{activeVehicle?.name}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">{t('tyre_size')}:</span> <span className="font-bold">{formatTyreSize(originalTyre)}</span></div>
          </div>
        </Card>

        <Card className="space-y-4">
          <div className="flex items-center justify-between">
             <h2 className="text-lg font-bold text-emerald-500">{t('tires')}</h2>
             <div className="relative">
                <button onClick={() => setSizesOpen(!sizesOpen)} className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg text-xs font-bold flex items-center gap-1">
                   {t('tools')} <ChevronDown size={14} className={cn("transition-transform", sizesOpen && "rotate-180")} />
                </button>
                <AnimatePresence>
                   {sizesOpen && (
                     <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className={cn("absolute top-full mt-2 w-40 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl shadow-xl z-20", isRtl ? "left-0" : "right-0")}>
                        <div className="p-1 max-h-48 overflow-y-auto no-scrollbar">
                           {commonTyreSizes.map((s, i) => (
                             <button key={i} onClick={() => { setNewTyre(s); setSizesOpen(false); }} className="w-full text-start px-3 py-2 text-xs font-bold hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg">{s.label}</button>
                           ))}
                        </div>
                     </motion.div>
                   )}
                </AnimatePresence>
             </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label className="text-[10px] uppercase opacity-60 text-center block mb-2">{t('width')}</Label><Input type="number" value={newTyre.width} onChange={e => setNewTyre({...newTyre, width: parseInt(e.target.value) || 0})} className="text-center font-black text-lg" /></div>
            <div><Label className="text-[10px] uppercase opacity-60 text-center block mb-2">{t('ratio')}</Label><Input type="number" value={newTyre.aspectRatio} onChange={e => setNewTyre({...newTyre, aspectRatio: parseInt(e.target.value) || 0})} className="text-center font-black text-lg" /></div>
            <div><Label className="text-[10px] uppercase opacity-60 text-center block mb-2">{t('rim')}</Label><Input type="number" value={newTyre.rimSize} onChange={e => setNewTyre({...newTyre, rimSize: parseInt(e.target.value) || 0})} className="text-center font-black text-lg" /></div>
          </div>
          <div className="bg-slate-100 dark:bg-white/5 p-3 rounded-xl text-center font-black text-slate-500">
             {formatTyreSize(newTyre)}
          </div>
        </Card>

        <div className="flex gap-3">
          <button onClick={handleCalculate} className="flex-1 bg-emerald-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">{t('calculate')}</button>
          <button onClick={handleReset} className="bg-slate-100 dark:bg-slate-800 p-4 rounded-xl"><RotateCcw className="w-5 h-5" /></button>
        </div>

        {result && (
          <div className="space-y-6">
            <Card className="space-y-6">
              <h2 className="text-lg font-bold flex items-center gap-2"><TrendingUp className="w-5 h-5 text-emerald-500" /> {t('overview')}</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl"><p className="text-[10px] font-bold uppercase text-blue-500 mb-1">{t('active_vehicle')}</p><p className="text-lg font-black">{formatTyreSize(result.original)}</p></div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl"><p className="text-[10px] font-bold uppercase text-emerald-500 mb-1">{t('tires')}</p><p className="text-lg font-black">{formatTyreSize(result.new)}</p></div>
              </div>
            </Card>
            
            <Card className="p-6">
               <div className="flex items-center gap-2 mb-6"><Gauge className="w-5 h-5 text-amber-500"/><h2 className="text-lg font-bold">{t('trends_visualization')}</h2></div>
               <div className="grid grid-cols-3 gap-4 text-center">
                  <div><p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Diameter</p><p className={cn("text-xl font-black", result.differences.diameterDifference > 0 ? "text-red-500" : "text-emerald-500")}>{result.differences.diameterDifference > 0 ? '+' : ''}{result.differences.diameterDifference}"</p></div>
                  <div><p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Speed</p><p className="text-xl font-black text-amber-500">{result.speedImpact.speedPercentageChange}</p></div>
                  <div><p className="text-[10px] font-bold text-slate-500 uppercase mb-1">Actual @ 100</p><p className="text-xl font-black">{result.speedImpact.actualSpeed} <span className="text-[10px]">km/h</span></p></div>
               </div>
            </Card>

            <section>
              <div className="flex items-center gap-2 mb-4"><History className="w-5 h-5 text-slate-500" /><h2 className="text-lg font-bold">{t('history')}</h2></div>
              <TyreComparisonHistory />
            </section>
          </div>
        )}
      </PageWrapper>
    </>
  );
}
