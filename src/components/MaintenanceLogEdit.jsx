import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Wrench, ArrowLeft, Calendar, DollarSign, Tag, Trash2 } from 'lucide-react';
import { useFuel } from '../hooks/useFuelContext';
import { Input, Label, Card, PageWrapper, ConfirmModal } from './ui';
import { MAINTENANCE_CATEGORIES, getMaintenanceCategory } from '../data/maintenanceCategories';
import { format } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';

export default function MaintenanceLogEdit() {
  const { maintenanceLogs, updateMaintenanceLog, activeVehicle } = useFuel();
  const navigate = useNavigate();
  const { id } = useParams();
  
  const [log, setLog] = useState(null);
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [odometer, setOdometer] = useState('');
  const [date, setDate] = useState('');
  const [parts, setParts] = useState('');
  const [notes, setNotes] = useState('');
  const [deleteModal, setDeleteModal] = useState(false);

  // Load the log data on component mount
  useEffect(() => {
    const foundLog = maintenanceLogs.find(l => l.id === parseInt(id));
    if (foundLog) {
      setLog(foundLog);
      setSelectedCategories(foundLog.categoryIds || [foundLog.categoryId]);
      setTitle(foundLog.title || '');
      setDescription(foundLog.description || '');
      setCost(foundLog.cost ? String(foundLog.cost) : '');
      setOdometer(foundLog.odometer ? String(foundLog.odometer) : '');
      setDate(format(new Date(foundLog.timestamp), 'yyyy-MM-dd'));
      setParts(foundLog.parts ? foundLog.parts.join(', ') : '');
      setNotes(foundLog.notes || '');
    } else {
      navigate('/maintenance');
    }
  }, [id, maintenanceLogs, navigate]);

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

    updateMaintenanceLog(log.id, {
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

  const handleDelete = () => {
    setDeleteModal(true);
  };

  const confirmDelete = () => {
    // We'll need to add delete functionality to the context
    setDeleteModal(false);
    navigate('/maintenance');
  };

  if (!log) {
    return (
      <PageWrapper>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Loading...</h2>
        </div>
      </PageWrapper>
    );
  }

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
              onClick={handleDelete}
              className="flex-1 px-6 bg-red-500 hover:bg-red-400 text-white font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all shadow-xl shadow-red-500/25 active:scale-[0.98]"
            >
              <Trash2 className="w-5 h-5" />
              <span>Delete</span>
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!title.trim()}
              className="flex-1 px-6 bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-500/25 active:scale-[0.98]"
            >
              <Plus className="w-5 h-5" />
              <span>Update Log</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      <PageWrapper>
        {/* Fixed header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Edit Maintenance Log</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Update service record for {activeVehicle?.name || 'your vehicle'}.</p>
        </div>

        {/* Scrollable content area */}
        <div className="pb-24">
          <form id="maintenance-edit-form" onSubmit={handleSubmit} className="space-y-5">
            <Card className="p-6">
              <div className="space-y-5">
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
                  <Input
                    type="text"
                    value={customCategoryName}
                    onChange={(e) => setCustomCategoryName(e.target.value)}
                    placeholder="Enter custom category name"
                    className="mt-3"
                    required
                  />
                )}
              </div>

              <div>
                <Label>Title *</Label>
                <Input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Regular oil change"
                  required
                />
              </div>

              <div>
                <Label>Description</Label>
                <textarea
                  className="w-full bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700/50 rounded-2xl px-5 py-4 text-left text-slate-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium resize-none"
                  rows="3"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What was done during this service?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Cost</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={cost}
                    onChange={(e) => setCost(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label>Odometer</Label>
                  <Input
                    type="number"
                    value={odometer}
                    onChange={(e) => setOdometer(e.target.value)}
                    placeholder="Current km"
                  />
                </div>
              </div>

              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label>Parts Used (comma-separated)</Label>
                <textarea
                  className="w-full bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700/50 rounded-2xl px-5 py-4 text-left text-slate-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium resize-none"
                  rows="2"
                  value={parts}
                  onChange={(e) => setParts(e.target.value)}
                  placeholder="e.g. Oil filter, Engine oil 5W-30, Air filter"
                />
              </div>

              <div>
                <Label>Additional Notes</Label>
                <textarea
                  className="w-full bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700/50 rounded-2xl px-5 py-4 text-left text-slate-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium resize-none"
                  rows="3"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional notes or observations..."
                />
              </div>
            </div>
          </Card>
        </form>
      </div>

      
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        onConfirm={confirmDelete}
        title="Delete Maintenance Log"
        message="Are you sure you want to delete this maintenance log? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </PageWrapper>
    </>
  );
}
