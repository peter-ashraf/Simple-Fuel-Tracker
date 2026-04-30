import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Wrench, Calendar, DollarSign, Tag, ArrowLeft } from 'lucide-react';
import { useFuel } from '../hooks/useFuelContext';
import { Input, Label, Card, PageWrapper } from './ui';
import { MAINTENANCE_CATEGORIES, getMaintenanceCategory } from '../data/maintenanceCategories';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

export default function MaintenanceLogForm() {
  const { addMaintenanceLog, activeVehicle } = useFuel();
  const navigate = useNavigate();
  
  const [selectedCategories, setSelectedCategories] = useState(['oil_change']);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [odometer, setOdometer] = useState('');
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10));
  const [parts, setParts] = useState('');
  const [notes, setNotes] = useState('');

  const primaryCategory = getMaintenanceCategory(selectedCategories[0] || 'oil_change');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const baseDate = new Date(date);
    const now = new Date();
    baseDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

    const finalCategories = [...selectedCategories];
    if (selectedCategories.includes('custom') && customCategoryName.trim()) {
      // Replace 'custom' with actual custom name for storage
      const customIndex = finalCategories.indexOf('custom');
      finalCategories[customIndex] = customCategoryName.trim();
    }

    addMaintenanceLog({
      categoryIds: finalCategories,
      title: title.trim(),
      description: description.trim(),
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
              disabled={!title.trim()}
              className="flex-1 px-6 bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-500/25 active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              <span>Add Log</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      <PageWrapper>
        {/* Fixed header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add Maintenance Log</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Record service and maintenance for {activeVehicle?.name || 'your vehicle'}.</p>
        </div>

        {/* Scrollable content area */}
        <div className="pb-24">
          <form id="maintenance-log-form" onSubmit={handleSubmit} className="space-y-5">
            <Card className="p-6">
              <div className="space-y-5">
                <div>
                  <Label>Title *</Label>
                  <Input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Oil change, tire rotation"
                    required
                  />
                </div>

                <div>
                  <Label>Date *</Label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label>Odometer (km)</Label>
                  <Input
                    type="number"
                    value={odometer}
                    onChange={(e) => setOdometer(e.target.value)}
                    placeholder="Current odometer reading"
                    min="0"
                  />
                </div>

                <div>
                  <Label>Cost (EGP)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="Total cost of service"
                    min="0"
                  />
                </div>

                <div>
                  <Label>Categories (Select one or more)</Label>
                  <div className="grid grid-cols-2 gap-2 p-3 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl">
                    {Object.values(MAINTENANCE_CATEGORIES).map((cat) => (
                      <label
                        key={cat.id}
                        className={`flex items-center gap-2 p-3 text-sm font-bold rounded-xl cursor-pointer transition ${
                          selectedCategories.includes(cat.id) 
                            ? 'bg-white dark:bg-emerald-500 text-slate-900 dark:text-slate-950 shadow-sm' 
                            : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'
                        }`}
                        style={{ 
                          borderColor: selectedCategories.includes(cat.id) ? cat.color : 'transparent',
                          borderWidth: '2px'
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedCategories.includes(cat.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCategories([...selectedCategories, cat.id]);
                            } else {
                              setSelectedCategories(selectedCategories.filter(id => id !== cat.id));
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600 text-emerald-500 focus:ring-emerald-500/50"
                        />
                        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }}></span>
                        <span className="text-xs leading-tight">{cat.name}</span>
                      </label>
                    ))}
                  </div>
                  {selectedCategories.includes('custom') && (
                    <input
                      type="text"
                      value={customCategoryName}
                      onChange={(e) => setCustomCategoryName(e.target.value)}
                      placeholder="Enter custom category name"
                      className="mt-3 w-full px-3 py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      required
                    />
                  )}
                </div>

                <div>
                  <Label className="flex items-center gap-2">
                    <Tag className="w-4 h-4" />
                    Parts Used
                  </Label>
                  <Input
                    type="text"
                    value={parts}
                    onChange={(e) => setParts(e.target.value)}
                    placeholder="e.g. Oil Filter, 5W-30 Oil, Drain Plug Gasket (comma separated)"
                  />
                </div>

                <div>
                  <Label>Additional Notes</Label>
                  <textarea
                    className="w-full bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700/50 rounded-2xl px-5 py-4 text-left text-slate-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium resize-none"
                    rows="2"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional observations or notes..."
                  />
                </div>
              </div>
            </Card>
          </form>
        </div>
      </PageWrapper>
    </>
  );
}
