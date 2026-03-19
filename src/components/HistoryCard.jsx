import React, { useState } from 'react';
import { Trash2, Fuel, Calendar, MapPin, Save, X } from 'lucide-react';
import { format } from 'date-fns';
import { calculateTripMetrics } from '../utils/calculations';
import { ConfirmModal } from './ui';
import './HistoryCard.css';

export default function HistoryCard({ fill, index, totalFillUps, fillUps, onDelete, onUpdate, fuelPrices }) {
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
  const kmPerLiter = metrics.kmPerLiter > 0 ? metrics.kmPerLiter.toFixed(2) : "-";
  const litersPer100km = metrics.litersPer100km > 0 ? metrics.litersPer100km.toFixed(2) : "-";
  const tripDistance = metrics.distance > 0 ? metrics.distance.toFixed(0) : "-";
  
  const getEfficiencyColorStatus = (kmPerL) => {
    if (!kmPerL || kmPerL === "-" || kmPerL === 0) return "text-slate-400";
    if (kmPerL > 12) return "text-emerald-500";
    if (kmPerL >= 8) return "text-amber-500";
    return "text-red-500";
  };

  const handleEdit = () => {
    setIsFlipped(true);
  };

  const handleSave = () => {
    // Calculate liters from total cost if total cost is provided
    const litersToSave = editForm.totalCost ? (editForm.totalCost / (fill.pricePerLiter || 1)) : editForm.liters;
    
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
        <div className="flip-card-front">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
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
              className="text-right cursor-pointer hover:opacity-80 transition-opacity"
              onClick={handleEdit}
              role="button"
              tabIndex={0}
              aria-label="Edit fill-up"
              aria-expanded={isFlipped}
              onKeyDown={(e) => {
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
              <p className={`text-sm font-bold ${getEfficiencyColorStatus(kmPerLiter)}`}>
                {index === 0 ? "First trip" : (kmPerLiter !== "0" ? kmPerLiter : "-")}
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
            <div className="absolute top-[-10px] right-0 flex gap-2">
              <button
                onClick={handleSave}
                className="bg-emerald-500/50 hover:bg-emerald-400/50 text-white dark:text-slate-950 font-bold p-2 rounded-full transition-colors shadow-lg opacity-75 hover:opacity-100"
                aria-label="Save"
              >
                <Save className="w-2 h-2" />
              </button>
              <button
                onClick={() => setDeleteModal(true)}
                className="bg-red-300/50 hover:bg-red-400/50 text-white font-bold p-2 rounded-full transition-colors shadow-lg opacity-75 hover:opacity-100"
                aria-label="Delete"
              >
                <Trash2 className="w-2 h-2" />
              </button>
              <button
                onClick={handleCancel}
                className="bg-slate-500/50 hover:bg-slate-400/50 text-white font-bold p-2 rounded-full transition-colors shadow-lg opacity-75 hover:opacity-100"
                aria-label="Cancel"
              >
                <X className="w-2 h-2" />
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
                  onChange={(e) => setEditForm({...editForm, liters: e.target.value})}
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
                  onChange={(e) => setEditForm({...editForm, totalCost: e.target.value})}
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
