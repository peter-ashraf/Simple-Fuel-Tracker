import { Trash2, Fuel, Calendar, MapPin, Edit2, Save, X, CheckSquare, Square } from 'lucide-react';
import { useState } from 'react';
import { useFuel } from '../hooks/useFuelContext';
import { format } from 'date-fns';
import { calculateTripMetrics } from '../utils/calculations';
import { PageWrapper, ConfirmModal } from './ui';
import HistoryCard from './HistoryCard';

export default function History() {
  const { activeVehicleFillUps, activeVehicleFillUpsByOdometer, deleteFillUp, deleteMultipleFillUps, updateFillUp, fuelPrices } = useFuel();
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  
  const reversedTrips = [...activeVehicleFillUps].reverse();

  const toggleSelection = (id) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const selectAll = () => {
    if (selectedIds.size === activeVehicleFillUps.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeVehicleFillUps.map(f => f.id)));
    }
  };

  const handleBulkDelete = () => {
    // Use bulk delete function to delete all at once
    deleteMultipleFillUps(Array.from(selectedIds));
    setSelectedIds(new Set());
    setShowBulkDeleteModal(false);
    setIsSelectionMode(false);
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  return (
    <PageWrapper 
      className="max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-none" 
      style={{ 
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        WebkitOverflowScrolling: 'touch'
      }}
    >
      {/* Header with bulk actions */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">All Fill-ups</h2>
          {isSelectionMode ? (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 px-3 py-1 bg-emerald-100 dark:bg-emerald-500/20 rounded-full">
              {selectedIds.size} selected
            </span>
          ) : (
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 px-3 py-1 bg-slate-200 dark:bg-slate-800/50 rounded-full border border-slate-300 dark:border-slate-700/50">
              {activeVehicleFillUps.length} entries
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {isSelectionMode ? (
            <>
              <button
                onClick={selectAll}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                title={selectedIds.size === activeVehicleFillUps.length ? "Deselect All" : "Select All"}
              >
                {selectedIds.size === activeVehicleFillUps.length ? (
                  <><Square className="w-4 h-4" /><span className="hidden sm:inline">Deselect All</span></>
                ) : (
                  <><CheckSquare className="w-4 h-4" /><span className="hidden sm:inline">Select All</span></>
                )}
              </button>
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setShowBulkDeleteModal(true)}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-xl transition-colors"
                  title={`Delete ${selectedIds.size} selected`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Delete ({selectedIds.size})</span>
                </button>
              )}
              <button
                onClick={clearSelection}
                className="px-2 sm:px-3 py-2 text-xs font-medium text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
                title="Cancel"
              >
                <X className="w-4 h-4 sm:hidden" />
                <span className="hidden sm:inline">Cancel</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsSelectionMode(true)}
              className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              title="Select"
            >
              <CheckSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Select</span>
            </button>
          )}
        </div>
      </div>

      {activeVehicleFillUps.length === 0 ? (
        <div className="text-center py-16 px-6 border-2 border-dashed border-slate-300 dark:border-slate-700/50 rounded-3xl">
          <Fuel className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">Your history is empty.</p>
        </div>
      ) : (
        <ul className="space-y-4 pb-4">
          {reversedTrips.map((fill, reversedIndex) => {
            const originalIndex = activeVehicleFillUps.length - 1 - reversedIndex;
            return (
              <li key={fill.id} className="group">
                <HistoryCard
                  fill={fill}
                  index={originalIndex}
                  totalFillUps={activeVehicleFillUps.length}
                  fillUps={activeVehicleFillUps}
                  onDelete={deleteFillUp}
                  onUpdate={updateFillUp}
                  fuelPrices={fuelPrices}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedIds.has(fill.id)}
                  onToggleSelect={() => toggleSelection(fill.id)}
                />
              </li>
            );
          })}
        </ul>
      )}

      {/* Bulk Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        onConfirm={handleBulkDelete}
        title="Delete Selected Entries"
        message={`Are you sure you want to delete ${selectedIds.size} fill-up entries? This action cannot be undone.`}
        confirmText="Delete Selected"
        variant="danger"
      />
    </PageWrapper>
  );
}
