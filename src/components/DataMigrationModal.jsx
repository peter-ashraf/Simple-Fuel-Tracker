import { motion, AnimatePresence } from 'framer-motion';
import { CloudArrowUp, CloudArrowDown, ArrowsMerge, X, Warning } from '@phosphor-icons/react';

export default function DataMigrationModal({ syncStatus, onDecision, onCancel }) {
  const { hasLocalData, hasCloudData, localCounts, cloudCounts } = syncStatus;

  const handleUpload = async () => {
    onDecision('upload');
  };

  const handleDownload = async () => {
    onDecision('download');
  };

  const handleMerge = async () => {
    onDecision('merge');
  };

  const handleKeepLocal = async () => {
    onDecision('keep-local');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center">
              <CloudArrowUp weight="duotone" className="text-emerald-500 dark:text-emerald-400 w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Data Sync Setup
            </h2>
          </div>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
          >
            <X weight="duotone" className="text-slate-400 w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Scenario: Local data exists, cloud is empty */}
          {!hasCloudData && hasLocalData && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-500/10 rounded-2xl border border-blue-200 dark:border-blue-500/20">
                <CloudArrowUp weight="duotone" className="text-blue-500 w-6 h-6 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-blue-900 dark:text-blue-400 mb-1">
                    Local Data Found
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    You have data on this device. Would you like to upload it to your cloud account?
                  </p>
                </div>
              </div>

              {/* Local Data Summary */}
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                  Your Local Data
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {localCounts.vehicles} Vehicles
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {localCounts.fillups} Fill-ups
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {localCounts.maintenance} Maintenance
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                    <span className="text-sm text-slate-600 dark:text-slate-400">
                      {localCounts.tripEstimates} Trips
                    </span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={handleUpload}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-2xl transition flex items-center justify-center gap-2"
                >
                  <CloudArrowUp weight="duotone" className="w-5 h-5" />
                  Upload Local Data to Cloud
                </button>
                <button
                  onClick={handleKeepLocal}
                  className="w-full py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-2xl transition"
                >
                  Keep Local Only for Now
                </button>
              </div>
            </div>
          )}

          {/* Scenario: Both local and cloud have data */}
          {hasCloudData && hasLocalData && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-200 dark:border-amber-500/20">
                <Warning weight="duotone" className="text-amber-500 w-6 h-6 mt-0.5 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-amber-900 dark:text-amber-400 mb-1">
                    Data Conflict Detected
                  </h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    You have data both locally and in the cloud. Please choose how to proceed.
                  </p>
                </div>
              </div>

              {/* Data Comparison */}
              <div className="grid grid-cols-2 gap-4">
                {/* Local Data */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                    Local Data
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {localCounts.vehicles} Vehicles
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {localCounts.fillups} Fill-ups
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {localCounts.maintenance} Maintenance
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {localCounts.tripEstimates} Trips
                      </span>
                    </div>
                  </div>
                </div>

                {/* Cloud Data */}
                <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                  <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                    Cloud Data
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {cloudCounts.vehicles} Vehicles
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {cloudCounts.fillups} Fill-ups
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {cloudCounts.maintenance} Maintenance
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span className="text-sm text-slate-600 dark:text-slate-400">
                        {cloudCounts.tripEstimates} Trips
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <button
                  onClick={handleMerge}
                  className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-2xl transition flex items-center justify-center gap-2"
                >
                  <ArrowsMerge weight="duotone" className="w-5 h-5" />
                  Merge Data (Recommended)
                </button>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={handleKeepLocal}
                    className="py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-2xl transition text-sm"
                  >
                    Keep Local Data
                  </button>
                  <button
                    onClick={handleDownload}
                    className="py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-2xl transition text-sm flex items-center justify-center gap-2"
                  >
                    <CloudArrowDown weight="duotone" className="w-4 h-4" />
                    Use Cloud Data
                  </button>
                </div>
              </div>

              {/* Warning */}
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
                Choosing "Use Cloud Data" will overwrite your local data. This action cannot be undone.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
