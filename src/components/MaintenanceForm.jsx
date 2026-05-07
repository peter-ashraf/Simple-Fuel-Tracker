import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Wrench, Calendar, Tag, ArrowLeft, Shield, ChevronRight } from 'lucide-react';
import { useFuel } from '../hooks/useFuelContext';
import { Input, Label, Card, PageWrapper } from './ui';
import { useNavigate, useLocation } from 'react-router-dom';

const ICON_MAP = { 
  Zap: Wrench, Disc: Wrench, Droplet: Wrench, Shield: Wrench, 
  Battery: Wrench, Car: Wrench, Wrench: Wrench 
};

export default function MaintenanceForm() {
  const { addMaintenanceEntry, activeVehicle, maintenanceSettings, maintenanceSystems, getCategoryById } = useFuel();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Parse URL params for pre-selection
  const queryParams = new URLSearchParams(location.search);
  const initialType = queryParams.get('type');
  
  const [type, setType] = useState(initialType || '');
  const [performedAtODO, setPerformedAtODO] = useState('');
  const [intervalKm, setIntervalKm] = useState('');
  const [safetyMarginKm, setSafetyMarginKm] = useState(maintenanceSettings.defaultSafetyMarginKm || 2000);
  const [notes, setNotes] = useState('');

  // Picker States
  const [selectedSystemId, setSelectedSystemId] = useState(null);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!performedAtODO || !intervalKm || !type) return;

    addMaintenanceEntry({
      type: type,
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
    if (type) {
      const category = getCategoryById(type);
      if (category?.defaultInterval?.value) {
        setIntervalKm(category.defaultInterval.value);
      }
    }
  }, [type, getCategoryById]);

  // If no type is selected, show the System/Category Picker
  if (!type) {
    return (
      <PageWrapper>
        <div className="mb-6">
          <button onClick={() => navigate('/maintenance')} className="flex items-center gap-2 text-slate-500 font-bold text-xs uppercase tracking-widest mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Maintenance
          </button>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Select Category</h2>
          <p className="text-sm text-slate-500 mt-1">What would you like to log for {activeVehicle?.name}?</p>
        </div>

        {!selectedSystemId ? (
          <div className="grid grid-cols-1 gap-3">
            {maintenanceSystems.map(system => (
              <Card 
                key={system.id} 
                className="p-4 flex items-center justify-between cursor-pointer active:scale-[0.98] border-0"
                onClick={() => setSelectedSystemId(system.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white" style={{ backgroundColor: system.color }}>
                    <Wrench className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white">{system.name}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300" />
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <button onClick={() => setSelectedSystemId(null)} className="text-xs font-bold text-emerald-500 uppercase tracking-widest flex items-center gap-1 mb-2">
              <ArrowLeft className="w-3 h-3" /> Back to Systems
            </button>
            {maintenanceSystems.find(s => s.id === selectedSystemId).categories.map(catId => {
              const cat = getCategoryById(catId);
              return (
                <Card 
                  key={catId} 
                  className="p-5 flex items-center justify-between cursor-pointer active:scale-[0.98] border-0 bg-white dark:bg-white/[0.05]"
                  onClick={() => setType(catId)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                    <span className="font-bold text-slate-900 dark:text-white">{cat.name}</span>
                  </div>
                  <Plus className="w-5 h-5 text-emerald-500" />
                </Card>
              );
            })}
          </div>
        )}
      </PageWrapper>
    );
  }

  const selectedCategory = getCategoryById(type);

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
              <span>Cancel</span>
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!performedAtODO || !intervalKm}
              className="flex-[2] px-6 bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-500/25 active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              <span>Save {selectedCategory?.name}</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      <PageWrapper>
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
             <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white" style={{ backgroundColor: selectedCategory?.color }}>
                <Wrench className="w-5 h-5" />
             </div>
             <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">{selectedCategory?.name}</h2>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">New Service Record</p>
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
                    placeholder="Current mileage"
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
                
                {performedAtODO && intervalKm && (
                   <div className="mt-4 p-5 bg-emerald-50 dark:bg-emerald-500/10 rounded-[2rem] border border-emerald-100 dark:border-emerald-500/20">
                      <h4 className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-[0.2em] mb-3">Calculated Schedule</h4>
                      <div className="flex justify-between items-center">
                         <div>
                            <p className="text-[9px] text-emerald-600/60 dark:text-emerald-400/40 font-black uppercase tracking-tighter">Next Due At</p>
                            <p className="text-xl font-black text-emerald-800 dark:text-emerald-400">{(Number(performedAtODO) + Number(intervalKm)).toLocaleString()} <span className="text-xs font-bold opacity-50 ml-1">km</span></p>
                         </div>
                         <div className="text-right">
                            <p className="text-[9px] text-emerald-600/60 dark:text-emerald-400/40 font-black uppercase tracking-tighter">Alert Starts At</p>
                            <p className="text-xl font-black text-emerald-800 dark:text-emerald-400">{(Number(performedAtODO) + Number(intervalKm) - Number(safetyMarginKm)).toLocaleString()} <span className="text-xs font-bold opacity-50 ml-1">km</span></p>
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
