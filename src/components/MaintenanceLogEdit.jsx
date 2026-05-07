import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Wrench, Calendar, Tag, ArrowLeft, Shield, Trash2, Save } from 'lucide-react';
import { useFuel } from '../hooks/useFuelContext';
import { Input, Label, Card, PageWrapper, ConfirmModal } from './ui';
import { useNavigate, useParams } from 'react-router-dom';

export default function MaintenanceLogEdit() {
  const { maintenanceEntries, updateMaintenanceEntry, deleteMaintenanceEntry, activeVehicle, getCategoryById } = useFuel();
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [log, setLog] = useState(null);
  const [performedAtODO, setPerformedAtODO] = useState('');
  const [intervalKm, setIntervalKm] = useState('');
  const [safetyMarginKm, setSafetyMarginKm] = useState('');
  const [notes, setNotes] = useState('');
  const [deleteModal, setDeleteModal] = useState(false);

  // Load the log data on component mount
  useEffect(() => {
    const foundLog = maintenanceEntries.find(l => String(l.id) === String(id));
    if (foundLog) {
      setLog(foundLog);
      setPerformedAtODO(foundLog.performedAtODO ? String(foundLog.performedAtODO) : '');
      setIntervalKm(foundLog.intervalKm ? String(foundLog.intervalKm) : '');
      setSafetyMarginKm(foundLog.safetyMarginKm ? String(foundLog.safetyMarginKm) : '');
      setNotes(foundLog.notes || '');
    } else {
      navigate('/maintenance');
    }
  }, [id, maintenanceEntries, navigate]);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!performedAtODO || !intervalKm) return;

    updateMaintenanceEntry(log.id, {
      performedAtODO: Number(performedAtODO),
      intervalKm: Number(intervalKm),
      safetyMarginKm: Number(safetyMarginKm),
      notes: notes.trim()
    });

    navigate('/maintenance');
  };

  const confirmDelete = () => {
    deleteMaintenanceEntry(log.id);
    setDeleteModal(false);
    navigate('/maintenance');
  };

  if (!log) {
    return (
      <PageWrapper>
        <div className="mb-6 h-32 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
        </div>
      </PageWrapper>
    );
  }

  const category = getCategoryById(log.type);

  return (
    <>
      {createPortal(
        <div className="fixed-button-container">
          <div className="max-w-lg mx-auto flex gap-3">
            <button
              type="button"
              onClick={() => navigate('/maintenance')}
              className="flex-1 px-6 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={() => setDeleteModal(true)}
              className="px-6 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 text-red-500 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!performedAtODO || !intervalKm}
              className="flex-[2] px-6 bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-500/25 active:scale-[0.98]"
            >
              <Save className="w-5 h-5" />
              <span>Update Record</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      <PageWrapper>
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
             <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: category?.color }}>
                <Wrench className="w-5 h-5" />
             </div>
             <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{category?.name}</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Edit Service Record</p>
             </div>
          </div>
        </div>

        <div className="pb-24">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <Label className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Performed at Odometer (km) *
                  </Label>
                  <Input
                    type="number"
                    value={performedAtODO}
                    onChange={(e) => setPerformedAtODO(e.target.value)}
                    placeholder="Mileage at service"
                    min="0"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="flex items-center gap-2">
                      <Wrench className="w-4 h-4" />
                      Interval (km) *
                    </Label>
                    <Input
                      type="number"
                      value={intervalKm}
                      onChange={(e) => setIntervalKm(e.target.value)}
                      placeholder="e.g. 10000"
                      min="1"
                      required
                    />
                  </div>
                  <div>
                    <Label className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      Safety Margin (km)
                    </Label>
                    <Input
                      type="number"
                      value={safetyMarginKm}
                      onChange={(e) => setSafetyMarginKm(e.target.value)}
                      placeholder="2000"
                      min="0"
                    />
                  </div>
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Notes (Optional)
                  </Label>
                  <textarea
                    className="w-full bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700/50 rounded-2xl px-5 py-4 text-left text-slate-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium resize-none shadow-inner"
                    rows="3"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add details about parts or shop..."
                  />
                </div>
              </div>
            </Card>
          </form>
        </div>
      </PageWrapper>

      <ConfirmModal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete Record"
        message={`Are you sure you want to delete this ${category?.name} record? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </>
  );
}
