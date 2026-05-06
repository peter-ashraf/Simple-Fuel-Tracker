import { useState } from 'react';
import { Circle, Clock, ArrowRight, Trash2, Gauge, TrendingUp, RotateCcw, Check, CheckSquare, Square, X } from 'lucide-react';
import { Card, PageWrapper, ConfirmModal } from './ui';
import { useFuel } from '../hooks/useFuelContext';
import { formatTyreSize } from '../utils/tyreCalculator';
import { motion, AnimatePresence } from 'framer-motion';

export default function TyreComparisonHistory() {
  const { tyreComparisons, deleteTyreComparison, deleteMultipleTyreComparisons } = useFuel();
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, isBulk: false });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

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
    if (selectedIds.size === tyreComparisons.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tyreComparisons.map(c => c.id)));
    }
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const handleBulkDelete = () => {
    deleteMultipleTyreComparisons(Array.from(selectedIds));
    setSelectedIds(new Set());
    setIsSelectionMode(false);
    setDeleteModal({ isOpen: false, id: null, isBulk: false });
  };

  if (tyreComparisons.length === 0) {
    return (
      <div className="text-center py-8 px-6 border-2 border-dashed border-slate-200 dark:border-slate-800/80 rounded-3xl">
        <Circle className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400 font-medium tracking-tight">
          No tyre comparisons yet.<br />Use the calculator to compare sizes!
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3 px-1">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Recent Comparisons</h3>
        {!isSelectionMode ? (
          <button 
            onClick={() => setIsSelectionMode(true)}
            className="text-[10px] font-bold text-indigo-500 hover:text-indigo-600 uppercase tracking-wider flex items-center gap-1"
          >
            <CheckSquare className="w-3 h-3" /> Select
          </button>
        ) : (
          <button 
            onClick={clearSelection}
            className="text-[10px] font-bold text-slate-400 hover:text-slate-600 uppercase tracking-wider"
          >
            Cancel
          </button>
        )}
      </div>

      <div className="space-y-3">
        {tyreComparisons.slice(0, 10).map((comparison) => {
          const isSelected = selectedIds.has(comparison.id);
          return (
            <div key={comparison.id} className="relative flex items-center gap-3">
              {isSelectionMode && (
                <button 
                  onClick={() => toggleSelection(comparison.id)}
                  className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-500 border-indigo-500 text-white' : 'border-slate-300 dark:border-slate-600 bg-transparent'}`}
                >
                  {isSelected && <Check className="w-3.5 h-3.5" />}
                </button>
              )}
              <Card 
                className={`relative overflow-hidden flex-1 ${isSelectionMode ? 'cursor-pointer select-none' : ''}`}
                onClick={isSelectionMode ? () => toggleSelection(comparison.id) : undefined}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="bg-indigo-500/10 p-2 rounded-lg">
                      <Circle className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {formatTyreSize(comparison.original)} → {formatTyreSize(comparison.new)}
                      </h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {new Date(comparison.timestamp).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  {!isSelectionMode && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteModal({ isOpen: true, id: comparison.id, isBulk: false });
                      }}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-slate-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-50 dark:bg-white/[0.03] rounded-lg p-3">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider font-bold">Speed Impact</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {comparison.speedImpact.speedometerSpeed} → {comparison.speedImpact.actualSpeed} km/h
                    </p>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 font-bold">
                      {comparison.speedImpact.speedPercentageChange} diff
                    </p>
                  </div>
                  <div className="bg-slate-50 dark:bg-white/[0.03] rounded-lg p-3">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider font-bold">RPM Change</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">
                      {comparison.rpmImpact.originalRPM} → {comparison.rpmImpact.newRPM}
                    </p>
                    <p className="text-[10px] text-purple-600 dark:text-purple-400 mt-1 font-bold">
                      {comparison.rpmImpact.rpmPercentageChange} diff
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800/50 flex justify-between text-[10px] text-slate-500 italic">
                  <span>Diameter: {comparison.original.diameter}" → {comparison.new.diameter}" ({comparison.differences.diameterDifference > 0 ? '+' : ''}{comparison.differences.diameterDifference}")</span>
                  <span>Circ: {comparison.differences.circumferenceDifference}</span>
                </div>
              </Card>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {isSelectionMode && selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-[90%] sm:max-w-[400px] bg-slate-900 dark:bg-slate-800 text-white rounded-2xl shadow-2xl p-4 flex items-center justify-between z-[100] origin-bottom"
          >
             <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold text-sm">
                   {selectedIds.size}
                </div>
                <span className="font-semibold text-sm">Selected</span>
             </div>
             
             <div className="flex gap-2">
                <button 
                  onClick={selectAll}
                  className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-400 font-semibold text-sm rounded-xl transition-all flex items-center gap-2"
                >
                  {selectedIds.size === tyreComparisons.length ? <Square className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                  <span>{selectedIds.size === tyreComparisons.length ? 'Deselect' : 'Select All'}</span>
                </button>
                <button 
                  onClick={() => setDeleteModal({ isOpen: true, id: null, isBulk: true })}
                  className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-semibold text-sm rounded-xl transition-all flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null, isBulk: false })}
        onConfirm={() => {
          if (deleteModal.isBulk) handleBulkDelete();
          else {
            deleteTyreComparison(deleteModal.id);
            setDeleteModal({ isOpen: false, id: null, isBulk: false });
          }
        }}
        title={deleteModal.isBulk ? "Delete Comparisons" : "Delete Comparison"}
        message={deleteModal.isBulk ? `Are you sure you want to delete ${selectedIds.size} comparisons?` : "Are you sure you want to delete this tyre comparison?"}
        confirmText="Delete"
        variant="danger"
      />
    </>
  );
}
