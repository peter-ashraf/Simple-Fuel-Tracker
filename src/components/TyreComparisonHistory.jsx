import { useState } from 'react';
import { Circle, Clock, ArrowRight, Trash2, Gauge, TrendingUp, RotateCcw } from 'lucide-react';
import { Card, PageWrapper, ConfirmModal } from './ui';
import { useFuel } from '../hooks/useFuelContext';
import { formatTyreSize } from '../utils/tyreCalculator';

export default function TyreComparisonHistory() {
  const { tyreComparisons, deleteTyreComparison } = useFuel();
  const [deleteId, setDeleteId] = useState(null);

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
    <div className="space-y-3">
      {tyreComparisons.slice(0, 5).map((comparison) => (
        <Card key={comparison.id} className="relative overflow-hidden">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-500/20 p-2 rounded-lg">
                <Circle className="w-4 h-4 text-indigo-500 dark:text-indigo-400" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                  {formatTyreSize(comparison.original)} → {formatTyreSize(comparison.new)}
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {new Date(comparison.timestamp).toLocaleDateString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => setDeleteId(comparison.id)}
              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-slate-400 hover:text-red-500"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Speed Impact</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {comparison.speedImpact.speedometerSpeed} → {comparison.speedImpact.actualSpeed} km/h
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                {comparison.speedImpact.speedPercentageChange} difference
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">RPM Change</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">
                {comparison.rpmImpact.originalRPM} → {comparison.rpmImpact.newRPM}
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                {comparison.rpmImpact.rpmPercentageChange} difference
              </p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-800 flex justify-between text-xs text-slate-500">
            <span>Diameter: {comparison.original.diameter}" → {comparison.new.diameter}" ({comparison.differences.diameterDifference > 0 ? '+' : ''}{comparison.differences.diameterDifference}")</span>
            <span>Circ: {comparison.differences.circumferenceDifference}</span>
          </div>
        </Card>
      ))}

      <ConfirmModal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={() => {
          deleteTyreComparison(deleteId);
          setDeleteId(null);
        }}
        title="Delete Comparison"
        message="Are you sure you want to delete this tyre comparison? This action cannot be undone."
      />
    </div>
  );
}
