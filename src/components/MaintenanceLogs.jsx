import { useState } from 'react';
import { Wrench, Plus, Filter, Calendar, DollarSign, Tag, Search, Edit2, Trash2, Bell } from 'lucide-react';
import { useFuel } from '../hooks/useFuelContext';
import { Card, PageWrapper, ConfirmModal } from './ui';
import { getMaintenanceCategory } from '../data/maintenanceCategories';
import { format } from 'date-fns';
import { formatCurrency2Dec } from '../utils/formatting';
import { useNavigate } from 'react-router-dom';

export default function MaintenanceLogs() {
  const { maintenanceLogs, deleteMaintenanceLog, activeVehicle } = useFuel();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [expandedCards, setExpandedCards] = useState(new Set());
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, logId: null });

  // Filter logs based on search and category
  const filteredLogs = maintenanceLogs.filter(log => {
    const matchesSearch = !searchTerm || 
      log.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.parts.some(part => part.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const logCategories = log.categoryIds || [log.categoryId];
    const matchesCategory = selectedCategory === 'all' || logCategories.includes(selectedCategory);
    
    return matchesSearch && matchesCategory;
  });

  const handleDelete = (id) => {
    setDeleteModal({ isOpen: true, logId: id });
  };

  const confirmDelete = () => {
    if (deleteModal.logId) {
      deleteMaintenanceLog(deleteModal.logId);
      setDeleteModal({ isOpen: false, logId: null });
    }
  };

  const toggleCardExpansion = (id) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const getTotalCost = () => {
    return filteredLogs.reduce((total, log) => total + (log.cost || 0), 0);
  };

  const getUniqueCategories = () => {
    const categories = new Set();
    maintenanceLogs.forEach(log => {
      const logCategories = log.categoryIds || [log.categoryId];
      logCategories.forEach(catId => categories.add(catId));
    });
    return Array.from(categories);
  };

  return (
    <PageWrapper>
      <div className="mb-6 flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Maintenance Logs</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Service history for {activeVehicle?.name || 'your vehicle'}.</p>
        </div>
        <button
          onClick={() => navigate('/maintenance/reminders')}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 rounded-xl transition-colors"
        >
          <Bell className="w-4 h-4" />
          Reminders
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="flex flex-col gap-2 p-4">
          <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1">
            <Wrench className="w-3 h-3" />
            Total Services
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{filteredLogs.length}</p>
          <p className="text-[11px] text-slate-500">All time</p>
        </Card>
        <Card className="flex flex-col gap-2 p-4">
          <p className="text-[10px] uppercase font-bold text-blue-400 tracking-wider flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            Total Cost
          </p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency2Dec(getTotalCost())}</p>
          <p className="text-[11px] text-slate-500">EGP</p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
            />
          </div>
          
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3 py-1 text-sm font-bold rounded-xl transition ${
                selectedCategory === 'all'
                  ? 'bg-emerald-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/60'
              }`}
            >
              All
            </button>
            {getUniqueCategories().map(categoryId => {
              const category = getMaintenanceCategory(categoryId);
              return (
                <button
                  key={categoryId}
                  onClick={() => setSelectedCategory(categoryId)}
                  className={`px-3 py-1 text-sm font-bold rounded-xl transition flex items-center gap-1 ${
                    selectedCategory === categoryId
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-100 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }}></span>
                  {category.name}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Logs List */}
      {filteredLogs.length === 0 ? (
        <Card className="p-8 text-center">
          <Wrench className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {maintenanceLogs.length === 0 ? 'No maintenance logs yet' : 'No logs match your filters'}
          </p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
            {maintenanceLogs.length === 0 ? 'Start by adding your first maintenance record' : 'Try adjusting your search or filters'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredLogs.map((log) => {
            const logCategories = log.categoryIds || [log.categoryId];
            const isExpanded = expandedCards.has(log.id);
            
            return (
              <Card 
                key={log.id} 
                className={`p-4 cursor-pointer transition-all ${isExpanded ? 'ring-2 ring-emerald-500/50' : 'hover:shadow-md'}`}
                onClick={() => toggleCardExpansion(log.id)}
              >
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    {/* Title at the top */}
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-2 text-lg">{log.title}</h3>
                    
                    {/* Only show details when expanded */}
                    {isExpanded && (
                      <div className="space-y-3">
                        {/* Categories in grid layout */}
                        <div>
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Categories:</p>
                          <div className="grid grid-cols-2 gap-2">
                            {logCategories.map((catId) => {
                              const category = getMaintenanceCategory(catId);
                              return (
                                <div
                                  key={catId}
                                  className="flex items-center gap-2 p-2 rounded-lg border"
                                  style={{ 
                                    backgroundColor: category.color + '20',
                                    borderColor: category.color + '50'
                                  }}
                                >
                                  <span
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: category.color }}
                                  ></span>
                                  <span className="text-xs font-medium" style={{ color: category.color }}>
                                    {category.name}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        
                        {/* Date */}
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                          {format(new Date(log.timestamp), 'MMMM d, yyyy')}
                        </div>
                        
                        {/* Description */}
                        {log.description && (
                          <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description:</p>
                            <p className="text-sm text-slate-600 dark:text-slate-400">{log.description}</p>
                          </div>
                        )}
                        
                        {/* Odometer, Cost, Parts */}
                        <div className="flex flex-wrap gap-4 text-sm text-slate-600 dark:text-slate-400">
                          {log.odometer && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {log.odometer.toLocaleString()} km
                            </span>
                          )}
                          {log.cost && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="w-4 h-4" />
                              {formatCurrency2Dec(log.cost)}
                            </span>
                          )}
                          {log.parts.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Tag className="w-4 h-4" />
                              {log.parts.length} parts
                            </span>
                          )}
                        </div>
                        
                        {/* Parts Used */}
                        {log.parts.length > 0 && (
                          <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Parts Used:</p>
                            <div className="flex flex-wrap gap-1">
                              {log.parts.map((part, idx) => (
                                <span 
                                  key={idx}
                                  className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-400 rounded-lg"
                                >
                                  {part}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Additional Notes */}
                        {log.notes && (
                          <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Additional Notes:</p>
                            <p className="text-sm text-slate-500 dark:text-slate-400 italic">{log.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                    
                    {/* When collapsed, show minimal category indicators */}
                    {!isExpanded && (
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          {logCategories.slice(0, 3).map((catId) => {
                            const category = getMaintenanceCategory(catId);
                            return (
                              <span
                                key={catId}
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: category.color }}
                                title={category.name}
                              ></span>
                            );
                          })}
                          {logCategories.length > 3 && (
                            <span className="text-xs text-slate-400">+{logCategories.length - 3}</span>
                          )}
                        </div>
                        <span className="text-xs text-slate-400">
                          {format(new Date(log.timestamp), 'MMM d, yyyy')}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => navigate(`/maintenance/edit/${log.id}`)}
                      className="p-2 text-slate-400 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors"
                      title="Edit log"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(log.id)}
                      className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      title="Delete log"
                    >
                      <Trash2 className="w-4 h-4" />
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
        onClose={() => setDeleteModal({ isOpen: false, logId: null })}
        onConfirm={confirmDelete}
        title="Delete Maintenance Log"
        message="Are you sure you want to delete this maintenance log? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </PageWrapper>
  );
}
