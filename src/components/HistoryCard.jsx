import React, { useState } from 'react';
import { Trash2, Fuel, Calendar, MapPin, Save, X, CheckSquare, Square } from 'lucide-react';
import { format } from 'date-fns';
import { calculateTripMetrics } from '../utils/calculations';
import { ConfirmModal } from './ui';
import { formatEfficiency2Dec, formatCurrency2Dec, formatVolume2Dec, formatDistance2Dec } from '../utils/formatting';
import './HistoryCard.css';

export default function HistoryCard({ fill, index, totalFillUps, fillUps, onDelete, onUpdate, fuelPrices, isSelectionMode, isSelected, onToggleSelect }) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [deleteModal, setDeleteModal] = useState(false);
  const [editForm, setEditForm] = useState({
    liters: fill.liters,
    odometer: fill.odometer,
    fuelType: fill.fuelType,
    station: fill.station || '',
    notes: fill.notes || '',
    date: new Date(fill.timestamp).toISOString().substring(0, 10),
    totalCost: fill.liters * (fill.pricePerLiter || 0)
  });

  // Calculate proper trip metrics by comparing with previous fill-up
  const metrics = calculateTripMetrics(fillUps, index);
  const tripCost = fill.liters * (fill.pricePerLiter || 0);
  // Keep raw numeric value for color comparison
  const kmPerLiterRaw = metrics.kmPerLiter;
  const kmPerLiter = formatEfficiency2Dec(kmPerLiterRaw);
  const litersPer100km = formatEfficiency2Dec(metrics.litersPer100km, 'L/100km');
  const tripDistance = formatDistance2Dec(metrics.distance);
  
  const getEfficiencyColorStatus = (kmPerL) => {
    if (!kmPerL || kmPerL === "-" || kmPerL === 0 || isNaN(kmPerL)) return "text-slate-400";
    if (kmPerL > 12) return "text-emerald-500";
    if (kmPerL >= 8) return "text-amber-500";
    return "text-red-500";
  };

  const handleEdit = () => {
    setIsFlipped(true);
  };

  const handleSave = () => {
    // Use the liters value from the form (already synced with total cost)
    const litersToSave = parseFloat(editForm.liters) || 0;
    
    // Merge the selected date with the original timestamp time to preserve time of day
    const baseDate = new Date(editForm.date);
    const originalDate = new Date(fill.timestamp);
    baseDate.setHours(originalDate.getHours(), originalDate.getMinutes(), originalDate.getSeconds());
    
    onUpdate(fill.id, {
      timestamp: baseDate.toISOString(),
      liters: Number(litersToSave),
      odometer: Number(editForm.odometer),
      fuelType: editForm.fuelType,
      station: editForm.station.trim(),
      notes: editForm.notes.trim()
    });
    setIsFlipped(false);
  };

  const handleCancel = () => {
    // Reset form to original values
    setEditForm({
      liters: fill.liters,
      odometer: fill.odometer,
      fuelType: fill.fuelType,
      station: fill.station || '',
      notes: fill.notes || '',
      date: new Date(fill.timestamp).toISOString().substring(0, 10),
      totalCost: fill.liters * (fill.pricePerLiter || 0)
    });
    setIsFlipped(false);
  };

  return (
    <div className={`flip-card ${isFlipped ? 'flipped' : ''}`}>
      <div className="flip-card-inner">
        {/* Front Face */}
        <div className={`flip-card-front ${isSelectionMode ? 'cursor-pointer' : ''}`} onClick={isSelectionMode ? onToggleSelect : undefined}>
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                {isSelectionMode ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSelect();
                    }}
                    className="flex-shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Square className="w-5 h-5 text-slate-400" />
                    )}
                  </button>
                ) : null}
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {format(new Date(fill.timestamp), 'MMM d, yyyy')}
                </p>
                <span className="text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full border border-slate-300 dark:border-slate-700">P{fill.fuelType || '92'}</span>
              </div>
              {fill.station && (
                <p className="text-xs font-medium text-emerald-400 flex items-center gap-1 mt-1">
                  <MapPin className="w-3 h-3"/> {fill.station}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-1">
                {fill.odometer.toLocaleString()} km
              </p>
            </div>
            <div 
              className={`text-right ${isSelectionMode ? '' : 'cursor-pointer hover:opacity-80 transition-opacity'}`}
              onClick={isSelectionMode ? undefined : handleEdit}
              role={isSelectionMode ? undefined : "button"}
              tabIndex={isSelectionMode ? undefined : 0}
              aria-label="Edit fill-up"
              aria-expanded={isFlipped}
              onKeyDown={isSelectionMode ? undefined : (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleEdit();
                }
              }}
            >
              <p className="text-lg font-bold text-slate-900 dark:text-white font-mono tracking-tight">
                {tripCost} <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans uppercase">EGP</span>
              </p>
              <p className="text-[11px] text-slate-500">
                {fill.liters} L @ {fill.pricePerLiter}
              </p>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 grid grid-cols-3 gap-2 border border-slate-200 dark:border-slate-800/50 shrink-0 relative">
            <div className="text-center">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Dist</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {index === 0 ? "First trip" : (tripDistance !== "0" ? tripDistance : "-")}
              </p>
            </div>
            <div className="text-center border-l border-r border-slate-200 dark:border-slate-800/50">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Km/L</p>
              <p className={`text-sm font-bold ${getEfficiencyColorStatus(kmPerLiterRaw)}`}>
                {index === 0 ? "First trip" : (kmPerLiterRaw > 0 ? kmPerLiter : "-")}
              </p>
            </div>
            <div className="text-center">
              <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">L/100</p>
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                {index === 0 ? "First trip" : (litersPer100km !== "0" ? litersPer100km : "-")}
              </p>
            </div>
          </div>
          
          {fill.notes && (
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-4 italic bg-slate-100 dark:bg-slate-950/50 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800/50">
              "{fill.notes}"
            </p>
          )}
        </div>

        {/* Back Face */}
        <div className="flip-card-back">
          <div className="flex flex-col h-full relative">
            <div className="flex justify-between items-start mb-2">
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-3 py-1.5 rounded-lg transition-colors text-xs"
                >
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className="bg-slate-500 hover:bg-slate-400 text-white font-bold px-3 py-1.5 rounded-lg transition-colors text-xs"
                >
                  Cancel
                </button>
              </div>
              <button
                onClick={() => setDeleteModal(true)}
                className="text-red-500 hover:text-red-400 font-bold p-1 transition-colors"
                aria-label="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            <div className="flex justify-between items-start mb-4">
              <div className="flex-1">
                <div className="grid grid-cols-2 gap-10">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Date</label>
                    <input
                      type="date"
                      value={editForm.date}
                      onChange={(e) => setEditForm({...editForm, date: e.target.value})}
                      className="w-40 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Odometer</label>
                    <input
                      type="number"
                      value={editForm.odometer}
                      onChange={(e) => setEditForm({...editForm, odometer: e.target.value})}
                      className="w-40 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 grid grid-cols-3 gap-2 border border-slate-200 dark:border-slate-800/50 shrink-0 relative">
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Liters</p>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.liters}
                  onChange={(e) => {
                    const newLiters = parseFloat(e.target.value) || 0;
                    const pricePerLiter = fill.pricePerLiter || 1;
                    setEditForm({
                      ...editForm,
                      liters: e.target.value,
                      totalCost: newLiters * pricePerLiter
                    });
                  }}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-sm"
                />
              </div>
              <div className="text-center border-l border-r border-slate-200 dark:border-slate-800/50">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Price/L</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {fill.pricePerLiter || '0.00'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Total</p>
                <input
                  type="number"
                  step="0.01"
                  value={editForm.totalCost || ''}
                  onChange={(e) => {
                    const newTotal = parseFloat(e.target.value) || 0;
                    const pricePerLiter = fill.pricePerLiter || 1;
                    setEditForm({
                      ...editForm,
                      totalCost: e.target.value,
                      liters: newTotal / pricePerLiter
                    });
                  }}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1 text-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        onConfirm={() => onDelete(fill.id)}
        title="Delete Fill-up Entry"
        message="Are you sure you want to delete this fill-up entry?"
        confirmText="Delete Entry"
        variant="danger"
      />
    </div>
  );
}
