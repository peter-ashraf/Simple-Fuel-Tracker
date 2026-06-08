import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Tag, CaretLeft } from '@phosphor-icons/react';
import { useFuel } from '../hooks/useFuelContext';
import { Input, Label, Card, PageWrapper, cn } from './ui';
import { MAINTENANCE_CATEGORIES } from '../data/maintenanceCategories';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function MaintenanceLogForm() {
  const { addMaintenanceLog, activeVehicle } = useFuel();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  
  const [selectedCategories, setSelectedCategories] = useState(['oil_change']);
  const [title, setTitle] = useState('');
  const [cost, setCost] = useState('');
  const [odometer, setOdometer] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [parts, setParts] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const baseDate = new Date(date);
    const now = new Date();
    baseDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

    addMaintenanceLog({
      categoryIds: selectedCategories,
      title: title.trim(),
      description: '',
      cost: cost ? Number(cost) : 0,
      odometer: odometer ? Number(odometer) : null,
      timestamp: baseDate.toISOString(),
      parts: parts.trim().split(',').map(p => p.trim()).filter(p => p),
      notes: notes.trim()
    });

    navigate('/maintenance');
  };

  return (
    <>
      {createPortal(
        <div className="fixed-button-container">
          <div className="max-w-lg mx-auto flex gap-3">
            <button type="button" onClick={() => navigate('/maintenance')} className="flex-1 px-6 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all">
              <CaretLeft weight="duotone" className={cn("w-5 h-5", isRtl && "rotate-180")} /> <span>{t('back')}</span>
            </button>
            <button type="button" onClick={handleSubmit} disabled={!title.trim()} className="flex-1 px-6 bg-emerald-500 text-white dark:text-slate-950 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all disabled:opacity-50 shadow-xl shadow-emerald-500/25 active:scale-[0.98]">
              <Plus weight="duotone" className="w-5 h-5" /> <span>{t('add_maintenance')}</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      <PageWrapper>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('add_maintenance')}</h2>
          <p className="text-sm text-slate-500 mt-1">{t('active_vehicle')}: {activeVehicle?.name}</p>
        </div>

        <div className="pb-24">
          <form id="maintenance-log-form" onSubmit={handleSubmit} className="space-y-5">
            <Card className="p-6">
              <div className="space-y-5">
                <div>
                  <Label>Title *</Label>
                  <Input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="..." required />
                </div>
                <div>
                  <Label>{t('history')} *</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('odometer')} (km)</Label>
                    <Input type="number" value={odometer} onChange={(e) => setOdometer(e.target.value)} placeholder="..." />
                  </div>
                  <div>
                    <Label>{t('price')} (EGP)</Label>
                    <Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="..." />
                  </div>
                </div>
                <div>
                  <Label>{t('sub_categories')}</Label>
                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-100 dark:bg-slate-900/60 rounded-2xl">
                    {Object.values(MAINTENANCE_CATEGORIES).map((cat) => (
                      <label key={cat.id} className={cn("flex items-center gap-2 p-3 text-sm font-bold rounded-xl cursor-pointer transition", selectedCategories.includes(cat.id) ? 'bg-white dark:bg-emerald-500 text-slate-900 dark:text-slate-950 shadow-sm border-2' : 'text-slate-500')} style={{ borderColor: selectedCategories.includes(cat.id) ? cat.color : 'transparent' }}>
                        <input type="checkbox" checked={selectedCategories.includes(cat.id)} onChange={(e) => e.target.checked ? setSelectedCategories([...selectedCategories, cat.id]) : setSelectedCategories(selectedCategories.filter(id => id !== cat.id))} className="w-4 h-4 rounded text-emerald-500" />
                        <span className="text-xs">{t(cat.id)}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="flex items-center gap-2"><Tag weight="duotone" className="w-4 h-4" /> Parts</Label>
                  <Input type="text" value={parts} onChange={(e) => setParts(e.target.value)} placeholder="..." />
                </div>
                <div>
                  <Label>{t('config')}</Label>
                  <textarea className="input-field min-h-[80px]" rows="2" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="..." />
                </div>
              </div>
            </Card>
          </form>
        </div>
      </PageWrapper>
    </>
  );
}
