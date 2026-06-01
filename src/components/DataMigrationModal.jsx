import { motion, AnimatePresence } from 'framer-motion';
import { CloudArrowUp, CloudArrowDown, ArrowsMerge, X, Warning, CheckCircle, XCircle, Spinner } from '@phosphor-icons/react';

export default function DataMigrationModal({ syncStatus, onDecision, onCancel, loading, loadingAction, result, onCloseResult, onRetry, disableClose }) {
  const { hasLocalData, hasCloudData, localCounts, cloudCounts } = syncStatus;

  // Detect imported data scenario: local exists, cloud empty
  const isImportedData = hasLocalData && !hasCloudData;

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

  const getLoadingMessage = () => {
    switch (loadingAction) {
      case 'upload':
        return 'Uploading local data to cloud...';
      case 'download':
        return 'Downloading cloud data...';
      case 'merge':
        return 'Merging local and cloud data...';
      case 'keep-local':
        return 'Preserving local data...';
      default:
        return 'Processing...';
    }
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
              {result ? (
                result.success ? (
                  <CheckCircle weight="duotone" className="text-emerald-500 dark:text-emerald-400 w-5 h-5" />
                ) : (
                  <XCircle weight="duotone" className="text-red-500 dark:text-red-400 w-5 h-5" />
                )
              ) : loading ? (
                <Spinner weight="duotone" className="text-emerald-500 dark:text-emerald-400 w-5 h-5 animate-spin" />
              ) : (
                <CloudArrowUp weight="duotone" className="text-emerald-500 dark:text-emerald-400 w-5 h-5" />
              )}
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {result ? (result.success ? 'Success' : 'Error') : loading ? 'Processing' : 'Data Sync Setup'}
            </h2>
          </div>
          {!disableClose && !loading && (
            <button
              onClick={result ? onCloseResult : onCancel}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              <X weight="duotone" className="text-slate-400 w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Loading State */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <Spinner weight="duotone" className="w-12 h-12 text-emerald-500 animate-spin" />
              <p className="text-lg font-semibold text-slate-700 dark:text-slate-300">{getLoadingMessage()}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">Please wait, this may take a moment...</p>
            </div>
          )}

          {/* Result State */}
          {result && !loading && (
            <div className="space-y-4">
              <div className={`flex items-start gap-3 p-4 rounded-2xl border ${result.success ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20' : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'}`}>
                {result.success ? (
                  <CheckCircle weight="duotone" className="text-emerald-500 w-6 h-6 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle weight="duotone" className="text-red-500 w-6 h-6 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <h3 className={`font-semibold mb-1 ${result.success ? 'text-emerald-900 dark:text-emerald-400' : 'text-red-900 dark:text-red-400'}`}>
                    {result.message}
                  </h3>
                  {result.counts && (result.counts.vehicles > 0 || result.counts.fillups > 0 || result.counts.maintenance > 0 || result.counts.tripEstimates > 0) && (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      {result.counts.vehicles > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                          <span className="text-slate-600 dark:text-slate-400">{result.counts.vehicles} Vehicles</span>
                        </div>
                      )}
                      {result.counts.fillups > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                          <span className="text-slate-600 dark:text-slate-400">{result.counts.fillups} Fill-ups</span>
                        </div>
                      )}
                      {result.counts.maintenance > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                          <span className="text-slate-600 dark:text-slate-400">{result.counts.maintenance} Maintenance</span>
                        </div>
                      )}
                      {result.counts.tripEstimates > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                          <span className="text-slate-600 dark:text-slate-400">{result.counts.tripEstimates} Trips</span>
                        </div>
                      )}
                    </div>
                  )}
                  {result.details && result.details.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() => {
                          const detailsEl = document.getElementById('migration-details');
                          if (detailsEl) {
                            detailsEl.classList.toggle('hidden');
                          }
                        }}
                        className="text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                      >
                        {result.details.length > 1 ? `View ${result.details.length} details` : 'View details'}
                      </button>
                      <div id="migration-details" className="hidden mt-2 p-3 bg-slate-50 dark:bg-slate-800 rounded-xl text-xs text-slate-600 dark:text-slate-400 space-y-1 max-h-32 overflow-y-auto">
                        {result.details.map((detail, idx) => (
                          <div key={idx}>• {detail}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={onCloseResult}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-2xl transition"
              >
                {result.success ? 'Continue' : 'OK'}
              </button>
              {!result.success && onRetry && (
                <button
                  onClick={onRetry}
                  className="w-full py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-2xl transition"
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* Decision State */}
          {!loading && !result && (
            <>
          {/* Scenario: Local data exists, cloud is empty */}
          {!hasCloudData && (
            <div className="space-y-4">
              <div className={`flex items-start gap-3 p-4 rounded-2xl border ${isImportedData ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20' : 'bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20'}`}>
                <CloudArrowUp weight="duotone" className={`${isImportedData ? 'text-amber-500' : 'text-blue-500'} w-6 h-6 mt-0.5 flex-shrink-0`} />
                <div>
                  <h3 className={`font-semibold mb-1 ${isImportedData ? 'text-amber-900 dark:text-amber-400' : 'text-blue-900 dark:text-blue-400'}`}>
                    {isImportedData ? 'Imported Data Detected' : (hasLocalData ? 'Local Data Found' : 'No Local Data')}
                  </h3>
                  <p className={`text-sm ${isImportedData ? 'text-amber-700 dark:text-amber-300' : 'text-blue-700 dark:text-blue-300'}`}>
                    {isImportedData
                      ? 'You have local data that has not been synced to the cloud yet. Please upload it to ensure your data is backed up.'
                      : (hasLocalData 
                        ? 'You have data on this device. Would you like to upload it to your cloud account?'
                        : 'You have no local data. Would you like to download your cloud data or start fresh?')}
                  </p>
                </div>
              </div>

              {/* Local Data Summary */}
              {hasLocalData && (
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
              )}

              {/* Actions */}
              <div className="space-y-3">
                {hasLocalData && (
                  <button
                    onClick={handleUpload}
                    className={`w-full py-3.5 ${isImportedData ? 'bg-amber-500 hover:bg-amber-400' : 'bg-emerald-500 hover:bg-emerald-400'} text-white font-semibold rounded-2xl transition flex items-center justify-center gap-2`}
                  >
                    <CloudArrowUp weight="duotone" className="w-5 h-5" />
                    {isImportedData ? 'Upload to Cloud (Recommended)' : 'Upload Local Data to Cloud'}
                  </button>
                )}
                {hasCloudData && (
                  <button
                    onClick={handleDownload}
                    className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold rounded-2xl transition flex items-center justify-center gap-2"
                  >
                    <CloudArrowDown weight="duotone" className="w-5 h-5" />
                    Download Cloud Data
                  </button>
                )}
                <button
                  onClick={handleKeepLocal}
                  className="w-full py-3.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-2xl transition"
                >
                  {hasLocalData ? 'Keep Local Only for Now' : 'Start Fresh (No Sync)'}
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
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
