import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Wrench, Calendar, Tag, ArrowLeft, Shield, Trash2, Save } from 'lucide-react';
import { useFuel } from '../hooks/useFuelContext';
import { Input, Label, Card, PageWrapper, ConfirmModal, cn } from './ui';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function MaintenanceLogEdit() {
  const { maintenanceEntries, updateMaintenanceEntry, deleteMaintenanceEntry, activeVehicle, getCategoryById } = useFuel();
  const navigate = useNavigate();
  const { id } = useParams();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  
  const [log, setLog] = useState(null);
  const [performedAtODO, setPerformedAtODO] = useState('');
  const [intervalKm, setIntervalKm] = useState('');
  const [safetyMarginKm, setSafetyMarginKm] = useState('');
  const [notes, setNotes] = useState('');
  const [deleteModal, setDeleteModal] = useState(false);

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

  if (!log) return null;

  const category = getCategoryById(log.type);

  return (
    <>
      {createPortal(
        <div className="fixed-button-container">
          <div className="max-w-lg mx-auto flex gap-3">
            <button type="button" onClick={() => navigate('/maintenance')} className="flex-1 px-6 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all">
              <ArrowLeft className={cn("w-5 h-5", isRtl && "rotate-180")} /> <span>{t('back')}</span>
            </button>
            <button type="button" onClick={() => setDeleteModal(true)} className="px-6 bg-red-50 dark:bg-red-500/10 text-red-500 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
              <Trash2 className="w-5 h-5" />
            </button>
            <button type="button" onClick={handleSubmit} disabled={!performedAtODO || !intervalKm} className="flex-[2] px-6 bg-emerald-500 text-white dark:text-slate-950 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-xl shadow-emerald-500/25 active:scale-[0.98]">
              <Save className="w-5 h-5" /> <span>{t('save')}</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      <PageWrapper>
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
             <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: category?.color }}><Wrench className="w-5 h-5" /></div>
             <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{t(category?.id)}</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{t('edit')}</p>
             </div>
          </div>
        </div>

        <div className="pb-24">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Card className="p-6">
              <div className="space-y-6">
                <div>
                  <Label className="flex items-center gap-2"><Calendar className="w-4 h-4" /> {t('odometer')} (km) *</Label>
                  <Input type="number" value={performedAtODO} onChange={(e) => setPerformedAtODO(e.target.value)} placeholder="..." required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="flex items-center gap-2"><Wrench className="w-4 h-4" /> {t('distance')} (km) *</Label>
                    <Input type="number" value={intervalKm} onChange={(e) => setIntervalKm(e.target.value)} placeholder="..." required />
                  </div>
                  <div>
                    <Label className="flex items-center gap-2"><Shield className="w-4 h-4" /> Safety</Label>
                    <Input type="number" value={safetyMarginKm} onChange={(e) => setSafetyMarginKm(e.target.value)} placeholder="..." />
                  </div>
                </div>
                <div>
                  <Label className="flex items-center gap-2"><Tag className="w-4 h-4" /> {t('config')}</Label>
                  <textarea className="input-field min-h-[100px]" rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="..." />
                </div>
              </div>
            </Card>
          </form>
        </div>
      </PageWrapper>

      <ConfirmModal isOpen={deleteModal} onClose={() => setDeleteModal(false)} onConfirm={confirmDelete} title={t('delete')} message={t('delete') + "?"} confirmText={t('delete')} cancelText={t('cancel')} variant="danger" />
    </>
  );
}
