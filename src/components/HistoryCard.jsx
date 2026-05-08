import React, { useState } from 'react';
import { Trash, GasPump, CalendarBlank, MapPin, FloppyDisk, X, CheckSquare, Square } from '@phosphor-icons/react';
import { format } from 'date-fns';
import { calculateTripMetrics } from '../utils/calculations';
import { ConfirmModal, Input, Label, FuelGaugeSlider, cn } from './ui';
import { formatEfficiency2Dec, formatCurrency2Dec, formatVolume2Dec, formatDistance2Dec } from '../utils/formatting';
import './HistoryCard.css';
import { useTranslation } from 'react-i18next';

export default function HistoryCard({ fill, index, totalFillUps, fillUps, onDelete, onUpdate, fuelPrices }) {
  const { t, i18n } = useTranslation();
  const [isFlipped, setIsFlipped] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const isRtl = i18n.language.startsWith('ar');

  const [editForm, setEditForm] = useState({
    liters: fill.liters,
    odometer: fill.odometer,
    fuelType: fill.fuelType,
    station: fill.station || '',
    notes: fill.notes || '',
    date: new Date(fill.timestamp).toISOString().substring(0, 10),
    totalCost: fill.liters * (fill.pricePerLiter || 0),
    tankLevelAfter: fill.tankLevelAfter !== undefined ? fill.tankLevelAfter : 100
  });
  const [showPartialSlider, setShowPartialSlider] = useState(fill.isPartialFill || (fill.tankLevelAfter < 100));

  const metrics = calculateTripMetrics(fillUps, index);
  const tripCost = (fill.liters * (fill.pricePerLiter || 0)).toFixed(2);
  const kmPerLiterRaw = metrics.kmPerLiter;
  const kmPerLiter = formatEfficiency2Dec(kmPerLiterRaw);
  const litersPer100km = formatEfficiency2Dec(metrics.litersPer100km, 'L/100km');
  const tripDistance = formatDistance2Dec(metrics.distance);
  const isEstimated = metrics.isEstimated;
  
  const getEfficiencyColorStatus = (kmPerL) => {
    if (!kmPerL || kmPerL === "-" || kmPerL === 0 || isNaN(kmPerL)) return "text-slate-400";
    if (kmPerL > 12) return "text-emerald-500";
    if (kmPerL >= 8) return "text-amber-500";
    return "text-red-500";
  };

  const handleEdit = () => setIsFlipped(true);

  const handleSave = () => {
    const baseDate = new Date(editForm.date);
    const originalDate = new Date(fill.timestamp);
    baseDate.setHours(originalDate.getHours(), originalDate.getMinutes(), originalDate.getSeconds());
    
    onUpdate(fill.id, {
      timestamp: baseDate.toISOString(),
      liters: Number(editForm.liters),
      odometer: Number(editForm.odometer),
      fuelType: editForm.fuelType,
      station: editForm.station.trim(),
      notes: editForm.notes.trim(),
      tankLevelAfter: showPartialSlider ? editForm.tankLevelAfter : 100,
      isPartialFill: showPartialSlider
    });
    setIsFlipped(false);
  };

  const handleCancel = () => {
    setEditForm({
      liters: fill.liters,
      odometer: fill.odometer,
      fuelType: fill.fuelType,
      station: fill.station || '',
      notes: fill.notes || '',
      date: new Date(fill.timestamp).toISOString().substring(0, 10),
      totalCost: fill.liters * (fill.pricePerLiter || 0),
      tankLevelAfter: fill.tankLevelAfter !== undefined ? fill.tankLevelAfter : 100
    });
    setIsFlipped(false);
  };

  return (
    <div className={`flip-card ${isFlipped ? 'flipped' : ''} ${isRtl ? 'rtl' : ''}`}>
      <div className="flip-card-inner">
        <div className="flip-card-front">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{format(new Date(fill.timestamp), 'MMM d, yyyy')}</p>
                <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">P{fill.fuelType || '92'}</span>
              </div>
              {fill.station && (
                <p className="text-xs font-medium text-emerald-400 flex items-center gap-1 mt-1">
                  <MapPin weight="duotone" className="w-3 h-3"/> {fill.station}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-1">{fill.odometer.toLocaleString()} km</p>
            </div>
            <div className="text-end cursor-pointer hover:opacity-80" onClick={handleEdit}>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{tripCost} <span className="text-[10px] text-slate-500">{t('currency')}</span></p>
              <p className="text-[11px] text-slate-500">{fill.liters} {t('liters_abbr')} {t('at')} {fill.pricePerLiter}</p>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 grid grid-cols-3 gap-2 border border-slate-200 dark:border-slate-800/50">
            <div className="text-center">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">{t('distance')}</p>
              <p className="text-sm font-semibold">{index === 0 ? t('untracked') : (tripDistance !== "0" ? tripDistance : "-")}</p>
            </div>
            <div className="text-center border-s border-e border-slate-200 dark:border-slate-800/50">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">{t('avg_km_l_short')}</p>
              <p className={`text-sm font-bold flex items-center justify-center gap-1 ${getEfficiencyColorStatus(kmPerLiterRaw)}`}>
                {index === 0 ? t('untracked') : (kmPerLiterRaw > 0 ? kmPerLiter : "-")}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">{t('l_100km_short')}</p>
              <p className="text-sm font-semibold">{index === 0 ? t('untracked') : (litersPer100km !== "0" ? litersPer100km : "-")}</p>
            </div>
          </div>
          
          {fill.notes && (
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-4 italic bg-slate-100 dark:bg-slate-950/50 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800/50">
              "{fill.notes}"
            </p>
          )}
        </div>

        <div className="flip-card-back p-4">
          <div className="flex flex-col h-full">
            <div className="flex justify-between items-start mb-4">
              <div className="flex gap-2">
                <button onClick={handleSave} className="bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs">{t('save')}</button>
                <button onClick={handleCancel} className="bg-slate-500 text-white font-bold px-3 py-1.5 rounded-lg text-xs">{t('cancel')}</button>
                <button 
                  onClick={() => setShowPartialSlider(!showPartialSlider)} 
                  className={cn(
                    "font-bold px-3 py-1.5 rounded-lg text-[10px] transition-colors",
                    showPartialSlider ? "bg-amber-500/10 text-amber-500" : "bg-slate-100 dark:bg-white/5 text-slate-500"
                  )}
                >
                  {showPartialSlider ? t('no_not_partial') : t('was_it_partial')}
                </button>
              </div>
              <button onClick={() => setDeleteModal(true)} className="text-red-500 p-1"><Trash weight="duotone" className="w-4 h-4" /></button>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="text-[10px]">{t('date')}</Label>
                <Input type="date" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} className="py-1 px-2 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">{t('odometer')}</Label>
                <Input type="number" value={editForm.odometer} onChange={e => setEditForm({...editForm, odometer: e.target.value})} className="py-1 px-2 text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-[10px]">{t('liters')}</Label>
                <Input type="number" step="0.01" value={editForm.liters} onChange={e => {
                  const val = parseFloat(e.target.value) || 0;
                  setEditForm({...editForm, liters: e.target.value, totalCost: (val * (fill.pricePerLiter || 1)).toFixed(2)});
                }} className="py-1 px-2 text-xs" />
              </div>
              <div>
                <Label className="text-[10px]">{t('total_spent')}</Label>
                <Input type="number" step="0.01" value={editForm.totalCost} onChange={e => {
                  const val = parseFloat(e.target.value) || 0;
                  setEditForm({...editForm, totalCost: e.target.value, liters: (val / (fill.pricePerLiter || 1)).toFixed(2)});
                }} className="py-1 px-2 text-xs" />
              </div>
            </div>

            {showPartialSlider && (
              <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-200 dark:border-slate-800/50">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-2">{t('fuel_level_after_fill')}</p>
                <FuelGaugeSlider 
                  value={editForm.tankLevelAfter} 
                  onChange={(val) => setEditForm({...editForm, tankLevelAfter: val})} 
                />
              </div>
            )}
          </div>
        </div>
      </div>
      
      <ConfirmModal isOpen={deleteModal} onClose={() => setDeleteModal(false)} onConfirm={() => onDelete(fill.id)} title={t('delete')} message={t('delete') + "?"} confirmText={t('delete')} variant="danger" />
    </div>
  );
}
