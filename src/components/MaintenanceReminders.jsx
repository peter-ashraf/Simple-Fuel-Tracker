import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Bell, Plus, CalendarBlank, Warning, Check, Trash, Pencil, GearSix, Wrench, CaretLeft } from '@phosphor-icons/react';
import { useFuel } from '../hooks/useFuelContext';
import { Card, PageWrapper, ConfirmModal } from './ui';
import { MAINTENANCE_CATEGORIES, getMaintenanceCategory } from '../data/maintenanceCategories';
import { format, addDays, addMonths, isAfter, isBefore, differenceInDays } from 'date-fns';
import { formatCurrency2Dec } from '../utils/formatting';
import { useNavigate } from 'react-router-dom';

export default function MaintenanceReminders() {
  const {
    maintenanceReminders,
    addMaintenanceReminder,
    updateMaintenanceReminder,
    deleteMaintenanceReminder,
    activeVehicleFillUps,
    activeVehicle
  } = useFuel();
  const navigate = useNavigate();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingReminder, setEditingReminder] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, reminderId: null });
  const [completeModal, setCompleteModal] = useState({ isOpen: false, reminderId: null });

  // Listen for custom event from floating add button
  useEffect(() => {
    const handleToggleForm = () => {
      setShowAddForm(true);
    };

    window.addEventListener('toggleMaintenanceReminderForm', handleToggleForm);
    return () => {
      window.removeEventListener('toggleMaintenanceReminderForm', handleToggleForm);
    };
  }, []);

  // Get current odometer from latest fill-up
  const currentOdometer = activeVehicleFillUps.length > 0 
    ? activeVehicleFillUps[activeVehicleFillUps.length - 1].odometer 
    : 0;

  // Calculate reminder status
  const getReminderStatus = (reminder) => {
    const today = new Date();
    const dueDate = new Date(reminder.nextDueDate || reminder.dueDate);
    
    let status = 'upcoming';
    let daysUntilDue = differenceInDays(dueDate, today);
    
    if (daysUntilDue < 0) {
      status = 'overdue';
    } else if (daysUntilDue <= 7) {
      status = 'due-soon';
    }
    
    // Check odometer-based reminders
    if (reminder.odometerInterval && currentOdometer >= reminder.odometerThreshold) {
      status = 'overdue';
    } else if (reminder.odometerInterval && currentOdometer >= (reminder.odometerThreshold - 1000)) {
      status = 'due-soon';
    }
    
    return { status, daysUntilDue };
  };

  // Update next due dates for reminders
  useEffect(() => {
    maintenanceReminders.forEach(reminder => {
      if (reminder.lastCompletedDate) {
        const nextDue = calculateNextDueDate(reminder);
        if (nextDue && nextDue !== reminder.nextDueDate) {
          updateMaintenanceReminder(reminder.id, { nextDueDate: nextDue });
        }
      }
    });
  }, [maintenanceReminders]);

  const calculateNextDueDate = (reminder) => {
    if (!reminder.lastCompletedDate) return reminder.dueDate;
    
    const lastCompleted = new Date(reminder.lastCompletedDate);
    const category = getMaintenanceCategory(reminder.categoryId);
    
    if (reminder.timeInterval) {
      return addMonths(lastCompleted, reminder.timeInterval);
    }
    
    return reminder.dueDate;
  };

  const handleCompleteReminder = (reminderId) => {
    setCompleteModal({ isOpen: true, reminderId });
  };

  const confirmCompleteReminder = () => {
    if (completeModal.reminderId) {
      const reminder = maintenanceReminders.find(r => r.id === completeModal.reminderId);
      if (!reminder) return;
      
      const today = new Date();
      const nextDue = calculateNextDueDate({ ...reminder, lastCompletedDate: today.toISOString() });
      
      updateMaintenanceReminder(completeModal.reminderId, {
        lastCompletedDate: today.toISOString(),
        nextDueDate: nextDue,
        lastCompletedOdometer: currentOdometer
      });
      
      setCompleteModal({ isOpen: false, reminderId: null });
      navigate('/maintenance/add');
    }
  };

  const handleAddReminder = (reminderData) => {
    const category = getMaintenanceCategory(reminderData.categoryId);
    const nextDue = reminderData.dueDate || 
      (reminderData.timeInterval ? addMonths(new Date(), reminderData.timeInterval).toISOString() : null);
    
    addMaintenanceReminder({
      ...reminderData,
      dueDate: reminderData.dueDate,
      nextDueDate: nextDue,
      odometerThreshold: reminderData.odometerThreshold || (category.defaultInterval?.value || 0) + (reminderData.odometerOffset || 0),
      timeInterval: reminderData.timeInterval || category.defaultIntervalTime?.value,
      odometerInterval: category.defaultInterval?.type === 'distance'
    });
    
    setShowAddForm(false);
  };

  const sortedReminders = [...maintenanceReminders].sort((a, b) => {
    const aStatus = getReminderStatus(a);
    const bStatus = getReminderStatus(b);
    
    // Sort by status priority: overdue > due-soon > upcoming
    const statusPriority = { overdue: 0, 'due-soon': 1, upcoming: 2 };
    if (statusPriority[aStatus.status] !== statusPriority[bStatus.status]) {
      return statusPriority[aStatus.status] - statusPriority[bStatus.status];
    }
    
    // Then sort by days until due
    return aStatus.daysUntilDue - bStatus.daysUntilDue;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'overdue': return 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-800/50';
      case 'due-soon': return 'text-amber-500 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-800/50';
      case 'upcoming': return 'text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-800/50';
      default: return 'text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/50';
    }
  };

  return (
    <PageWrapper className="pb-20">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Maintenance Reminders</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Never miss a service for {activeVehicle?.name || 'your vehicle'}.</p>
        </div>
        <button
          onClick={() => navigate('/maintenance')}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 rounded-xl transition-colors"
        >
          <Wrench weight="duotone" className="w-4 h-4" />
          Logs
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card className="flex flex-col gap-2 p-4">
          <p className="text-[10px] uppercase font-bold text-red-400 tracking-wider flex items-center gap-1">
            <Warning weight="duotone" className="w-3 h-3" />
            Overdue
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {sortedReminders.filter(r => getReminderStatus(r).status === 'overdue').length}
          </p>
          <p className="text-[11px] text-slate-500">Need attention</p>
        </Card>
        <Card className="flex flex-col gap-2 p-4">
          <p className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1">
            <CalendarBlank weight="duotone" className="w-3 h-3" />
            Due Soon
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {sortedReminders.filter(r => getReminderStatus(r).status === 'due-soon').length}
          </p>
          <p className="text-[11px] text-slate-500">Next 7 days</p>
        </Card>
        <Card className="flex flex-col gap-2 p-4">
          <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
            <Bell weight="duotone" className="w-3 h-3" />
            Active
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{sortedReminders.length}</p>
          <p className="text-[11px] text-slate-500">Total reminders</p>
        </Card>
      </div>

      {/* Add Reminder Form */}
      {showAddForm && (
        <AddReminderForm
          onSubmit={handleAddReminder}
          onCancel={() => setShowAddForm(false)}
          currentOdometer={currentOdometer}
        />
      )}

      {/* Reminders List */}
      {sortedReminders.length === 0 ? (
        <Card className="p-8 text-center">
          <Bell weight="duotone" className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">No maintenance reminders set</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">Set up reminders to never miss important service</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {sortedReminders.map((reminder) => {
            const reminderCategories = reminder.categoryIds || [reminder.categoryId];
            const primaryCategory = getMaintenanceCategory(reminderCategories[0]);
            const status = getReminderStatus(reminder);
            const statusColor = getStatusColor(status.status);
            
            return (
              <Card key={reminder.id} className={`p-4 border-2 ${statusColor}`}>
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex gap-1">
                        {reminderCategories.slice(0, 3).map((catId) => {
                          const category = getMaintenanceCategory(catId);
                          return (
                            <span
                              key={catId}
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: category.color }}
                              title={category.name}
                            ></span>
                          );
                        })}
                        {reminderCategories.length > 3 && (
                          <span className="text-xs text-slate-400 ml-1">+{reminderCategories.length - 3}</span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                        {reminderCategories.map(catId => {
                          const category = getMaintenanceCategory(catId);
                          return category.name;
                        }).join(', ')}
                      </span>
                      <span className={`px-2 py-1 text-xs font-bold rounded-lg ${statusColor}`}>
                        {status.status === 'overdue' && 'Overdue'}
                        {status.status === 'due-soon' && 'Due Soon'}
                        {status.status === 'upcoming' && 'Upcoming'}
                      </span>
                    </div>
                    
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{reminder.title}</h3>
                    
                    {reminder.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">{reminder.description}</p>
                    )}
                    
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                      {reminder.nextDueDate && (
                        <span className="flex items-center gap-1">
                          <CalendarBlank weight="duotone" className="w-3 h-3" />
                          {format(new Date(reminder.nextDueDate), 'MMM d, yyyy')}
                          {status.daysUntilDue >= 0 && ` (${status.daysUntilDue} days)`}
                        </span>
                      )}
                      {reminder.odometerThreshold && (
                        <span className="flex items-center gap-1">
                          <GearSix weight="duotone" className="w-3 h-3" />
                          Due at {reminder.odometerThreshold.toLocaleString()} km
                          {currentOdometer > 0 && ` (${(reminder.odometerThreshold - currentOdometer).toLocaleString()} km left)`}
                        </span>
                      )}
                      {reminder.lastCompletedDate && (
                        <span className="flex items-center gap-1">
                          <Check weight="duotone" className="w-3 h-3" />
                          Last: {format(new Date(reminder.lastCompletedDate), 'MMM d, yyyy')}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {status.status !== 'upcoming' && (
                      <button
                        onClick={() => handleCompleteReminder(reminder.id)}
                        className="p-2 text-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                        title="Mark as completed"
                      >
                        <Check weight="duotone" className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setEditingReminder(reminder)}
                      className="p-2 text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
                      title="Edit reminder"
                    >
                      <Pencil weight="duotone" className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteModal({ isOpen: true, reminderId: reminder.id })}
                      className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      title="Delete reminder"
                    >
                      <Trash weight="duotone" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, reminderId: null })}
        onConfirm={() => {
          if (deleteModal.reminderId) {
            deleteMaintenanceReminder(deleteModal.reminderId);
            setDeleteModal({ isOpen: false, reminderId: null });
          }
        }}
        title="Delete Reminder"
        message="Are you sure you want to delete this reminder? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Complete Confirmation Modal */}
      <ConfirmModal
        isOpen={completeModal.isOpen}
        onClose={() => setCompleteModal({ isOpen: false, reminderId: null })}
        onConfirm={confirmCompleteReminder}
        title="Mark as Completed"
        message="Mark this reminder as completed and add a maintenance log?"
        confirmText="Complete & Add Log"
        cancelText="Just Mark Complete"
        variant="info"
      />
    </PageWrapper>
  );
}

// Add Reminder Form Component
function AddReminderForm({ onSubmit, onCancel, currentOdometer }) {
  const [selectedCategories, setSelectedCategories] = useState(['oil_change']);
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [timeInterval, setTimeInterval] = useState('');
  const [odometerThreshold, setOdometerThreshold] = useState('');
  const [odometerOffset, setOdometerOffset] = useState('0');

  const primaryCategory = getMaintenanceCategory(selectedCategories[0] || 'oil_change');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const finalCategories = [...selectedCategories];
    if (selectedCategories.includes('custom') && customCategoryName.trim()) {
      // Replace 'custom' with actual custom name for storage
      const customIndex = finalCategories.indexOf('custom');
      finalCategories[customIndex] = customCategoryName.trim();
    }

    onSubmit({
      categoryIds: finalCategories,
      title: title.trim(),
      description: description.trim(),
      dueDate: dueDate || null,
      timeInterval: timeInterval ? Number(timeInterval) : null,
      odometerThreshold: odometerThreshold ? Number(odometerThreshold) : null,
      odometerOffset: odometerOffset ? Number(odometerOffset) : 0
    });
  };

  // Auto-fill default values when primary category changes
  useEffect(() => {
    if (primaryCategory.defaultInterval) {
      if (primaryCategory.defaultInterval.type === 'distance') {
        setOdometerThreshold(String(primaryCategory.defaultInterval.value + (currentOdometer || 0)));
      } else {
        setTimeInterval(String(primaryCategory.defaultInterval.value));
      }
    }
  }, [selectedCategories, primaryCategory, currentOdometer]);

  return (
    <>
      {createPortal(
        <div className="fixed-button-container">
          <div className="max-w-lg mx-auto flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-6 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all"
            >
              <CaretLeft weight="duotone" className="w-5 h-5" />
              <span>Back</span>
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!title.trim()}
              className="flex-1 px-6 bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-500/25 active:scale-[0.98]"
            >
              <Plus weight="duotone" className="w-5 h-5" />
              <span>Add Reminder</span>
            </button>
          </div>
        </div>,
        document.body
      )}

      <Card className="p-6 mb-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Add Maintenance Reminder</h3>
        
        {/* Scrollable content area */}
        <div className="pb-4">
          <form id="reminder-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Categories (Select one or more)</label>
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
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Regular oil change"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional notes about this reminder..."
                className="w-full px-3 py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                rows="2"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Due Date (Optional)</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Recurring Interval (months)</label>
                <input
                  type="number"
                  value={timeInterval}
                  onChange={(e) => setTimeInterval(e.target.value)}
                  placeholder="e.g. 6"
                  min="0"
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Odometer Threshold (km)</label>
              <input
                type="number"
                value={odometerThreshold}
                onChange={(e) => setOdometerThreshold(e.target.value)}
                placeholder="e.g. 50000"
                min="0"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Odometer Offset (km)</label>
              <input
                type="number"
                value={odometerOffset}
                onChange={(e) => setOdometerOffset(e.target.value)}
                placeholder="e.g. 0"
                min="0"
                className="w-full px-3 py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          </form>
        </div>
      </Card>

          </>
  );
}
