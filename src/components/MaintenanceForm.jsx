import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Wrench, Calendar, Tag, ArrowLeft, Shield } from 'lucide-react';
import { useFuel } from '../hooks/useFuelContext';
import { Input, Label, Card, PageWrapper } from './ui';
import { MAINTENANCE_CATEGORIES, getMaintenanceCategory } from '../data/maintenanceCategories';
import { useNavigate } from 'react-router-dom';

export default function MaintenanceForm() {
  const { addMaintenanceEntry, activeVehicle, maintenanceSettings } = useFuel();
  const navigate = useNavigate();
  
  const [type, setType] = useState('oil_change');
  const [customType, setCustomType] = useState('');
  const [performedAtODO, setPerformedAtODO] = useState('');
  const [intervalKm, setIntervalKm] = useState('');
  const [safetyMarginKm, setSafetyMarginKm] = useState(maintenanceSettings.defaultSafetyMarginKm || 2000);
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!performedAtODO || !intervalKm) return;

    const finalType = type === 'custom' ? customType.trim() : type;
    
    addMaintenanceEntry({
      type: finalType,
      performedAtODO: Number(performedAtODO),
      intervalKm: Number(intervalKm),
      safetyMarginKm: Number(safetyMarginKm),
      notes: notes.trim()
    });

    navigate('/maintenance');
  };

  // Sync safety margin from settings if it changes
  useEffect(() => {
    setSafetyMarginKm(maintenanceSettings.defaultSafetyMarginKm || 2000);
  }, [maintenanceSettings.defaultSafetyMarginKm]);

  // Suggest interval based on category
  useEffect(() => {
    if (type !== 'custom') {
      const category = getMaintenanceCategory(type);
      if (category?.defaultInterval?.value) {
        setIntervalKm(category.defaultInterval.value);
      }
    }
  }, [type]);

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
              onClick={handleSubmit}
              disabled={!performedAtODO || !intervalKm}
              className="flex-1 px-6 bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-500/25 active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              <span>Save Entry</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      <PageWrapper>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">New Maintenance Entry</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Set up maintenance schedules and record service for {activeVehicle?.name}.</p>
        </div>

        <div className="pb-24">
          <form onSubmit={handleSubmit} className="space-y-5">
            <Card className="p-6">
              <div className="space-y-5">
                <div>
                  <Label>Maintenance Type</Label>
                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl">
                    {Object.values(MAINTENANCE_CATEGORIES).map((cat) => (
                      <label
                        key={cat.id}
                        className={`flex items-center gap-2 p-3 text-sm font-bold rounded-xl cursor-pointer transition ${
                          type === cat.id 
                            ? 'bg-white dark:bg-emerald-500 text-slate-900 dark:text-slate-950 shadow-sm' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                        }`}
                      >
                        <input
                          type="radio"
                          name="type"
                          value={cat.id}
                          checked={type === cat.id}
                          onChange={() => setType(cat.id)}
                          className="hidden"
                        />
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }}></span>
                        <span className="text-xs leading-tight">{cat.name}</span>
                      </label>
                    ))}
                  </div>
                  {type === 'custom' && (
                    <div className="mt-3">
                      <Input
                        type="text"
                        value={customType}
                        onChange={(e) => setCustomType(e.target.value)}
                        placeholder="Enter custom maintenance name"
                        className="w-full"
                        required
                      />
                    </div>
                  )}
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    Performed at Odometer (km) *
                  </Label>
                  <Input
                    type="number"
                    value={performedAtODO}
                    onChange={(e) => setPerformedAtODO(e.target.value)}
                    placeholder="e.g. 50000"
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
                      placeholder="e.g. 5000"
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
                    placeholder="Parts used, technician name, etc..."
                  />
                </div>
                
                {performedAtODO && intervalKm && (
                   <div className="mt-4 p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
                      <h4 className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-2">Calculated Thresholds</h4>
                      <div className="flex justify-between items-center">
                         <div>
                            <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/50 font-bold uppercase">Next Due</p>
                            <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">{(Number(performedAtODO) + Number(intervalKm)).toLocaleString()} km</p>
                         </div>
                         <div className="text-right">
                            <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/50 font-bold uppercase">Alert at</p>
                            <p className="text-lg font-black text-emerald-700 dark:text-emerald-400">{(Number(performedAtODO) + Number(intervalKm) - Number(safetyMarginKm)).toLocaleString()} km</p>
                         </div>
                      </div>
                   </div>
                )}
              </div>
            </Card>
          </form>
        </div>
      </PageWrapper>
    </>
  );
}
