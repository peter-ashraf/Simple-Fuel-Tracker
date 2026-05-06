import { Trash2, Fuel, Calendar, MapPin, Edit2, Save, X, Check, Square, CheckSquare } from 'lucide-react';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useFuel } from '../hooks/useFuelContext';
import { format } from 'date-fns';
import { calculateTripMetrics } from '../utils/calculations';
import { PageWrapper, ConfirmModal } from './ui';
import HistoryCard from './HistoryCard';

export default function History() {
  const { activeVehicleFillUps, activeVehicleFillUpsByOdometer, deleteFillUp, deleteMultipleFillUps, updateFillUp, fuelPrices } = useFuel();
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  
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
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">All Fill-ups</h2>
        <button 
          onClick={() => {
            setSelectionMode(!selectionMode);
            if (!selectionMode) {
              setSelectedIds(new Set());
            }
          }}
          className="text-xs font-medium text-slate-500 dark:text-slate-400 px-3 py-1 bg-slate-200 dark:bg-slate-800/50 rounded-full border border-slate-300 dark:border-slate-700/50 hover:bg-slate-300 dark:hover:bg-slate-700/50 transition-colors cursor-pointer"
        >
          {activeVehicleFillUps.length} entries
        </button>
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
            const isSelected = selectedIds.has(fill.id);
            return (
              <motion.li 
                key={fill.id} 
                className="relative flex items-center"
                layout
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                 <AnimatePresence>
                   {selectionMode && (
                     <motion.button
                             initial={{ opacity: 0, scale: 0.8, x: -10 }}
                             animate={{ opacity: 1, scale: 1, x: 0 }}
                             exit={{ opacity: 0, scale: 0.8, x: -10 }}
                             transition={{ duration: 0.2, ease: "easeOut" }}
                             onClick={() => toggleSelection(fill.id)}
                             className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-300 dark:border-slate-600 bg-transparent'}`}
                     >
                             <motion.div
                               initial={{ scale: 0 }}
                               animate={{ scale: 1 }}
                               exit={{ scale: 0 }}
                               transition={{ duration: 0.15, ease: "easeOut" }}
                             >
                               {isSelected && <Check className="w-3.5 h-3.5" />}
                             </motion.div>
                     </motion.button>
                   )}
                 </AnimatePresence>
                 <motion.div 
                   className="flex-1"
                   animate={{ 
                     scaleX: selectionMode ? 0.92 : 1,
                     x: selectionMode ? 24 : 0, // Slide right when circles appear, left when they disappear
                     originX: 0
                   }}
                   transition={{ 
                     duration: 0.2, 
                     ease: selectionMode ? "easeInOut" : [0.68, -0.55, 0.265, 1.55] // Spring effect for expansion
                   }}
                 >
                  <HistoryCard
                    fill={fill}
                    index={originalIndex}
                    totalFillUps={activeVehicleFillUps.length}
                    fillUps={activeVehicleFillUps}
                    onDelete={deleteFillUp}
                    onUpdate={updateFillUp}
                    fuelPrices={fuelPrices}
                  />
                 </motion.div>
              </motion.li>
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

      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 w-full max-w-[95%] sm:max-w-[500px] bg-slate-900 dark:bg-slate-800 text-white rounded-3xl shadow-2xl p-3 sm:p-4 flex items-center justify-between z-50 origin-bottom border border-white/10"
          >
             <div className="flex items-center gap-2 sm:gap-3 ml-1 sm:ml-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-emerald-500/20">
                   {selectedIds.size}
                </div>
                <span className="font-bold text-xs sm:text-sm tracking-tight hidden xs:block">Selected</span>
             </div>
             
             <div className="flex items-center gap-1.5 sm:gap-2">
                <button 
                  onClick={selectAll}
                  className="h-10 px-3 sm:px-4 bg-white/10 hover:bg-white/20 text-white font-bold text-xs sm:text-sm rounded-2xl transition-all flex items-center gap-2 border border-white/5"
                  title={selectedIds.size === activeVehicleFillUps.length ? 'Deselect All' : 'Select All'}
                >
                  {selectedIds.size === activeVehicleFillUps.length ? <Square className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
                  <span className="hidden sm:inline">{selectedIds.size === activeVehicleFillUps.length ? 'Deselect' : 'Select All'}</span>
                </button>
                
                <button 
                  onClick={() => setShowBulkDeleteModal(true)}
                  className="h-10 px-3 sm:px-4 bg-red-500 hover:bg-red-600 text-white font-bold text-xs sm:text-sm rounded-2xl transition-all flex items-center gap-2 shadow-lg shadow-red-500/20"
                  title="Delete Selected"
                >
                  <Trash2 className="w-4 h-4" /> 
                  <span className="hidden sm:inline">Delete</span>
                </button>
                
                <div className="w-[1px] h-6 bg-white/10 mx-1 hidden sm:block"></div>

                <button 
                  onClick={() => {
                    setSelectedIds(new Set());
                    setSelectionMode(false);
                  }}
                  className="h-10 px-3 text-xs sm:text-sm font-bold text-slate-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
             </div>
          </motion.div>
        )}
      </AnimatePresence>
    </PageWrapper>
  );
}
