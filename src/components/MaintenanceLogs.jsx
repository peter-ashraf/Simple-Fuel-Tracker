import { useState } from 'react';
import { Wrench, Plus, Faders, CalendarBlank, CurrencyDollar, Tag, MagnifyingGlass, Pencil, Trash, Bell, CaretRight } from '@phosphor-icons/react';
import { useFuel } from '../hooks/useFuelContext';
import { Card, PageWrapper, ConfirmModal, cn } from './ui';
import { getMaintenanceCategory } from '../data/maintenanceCategories';
import { format } from 'date-fns';
import { formatCurrency2Dec } from '../utils/formatting';
import { useTranslation } from 'react-i18next';

export default function MaintenanceLogs() {
  const { maintenanceLogs, deleteMaintenanceLog, activeVehicle } = useFuel();
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, logId: null });

  const filteredLogs = maintenanceLogs.filter(log => {
    const matchesSearch = !searchTerm || 
      log.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.description || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.parts.some(part => part.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const logCategories = log.categoryIds || [log.categoryId];
    const matchesCategory = selectedCategory === 'all' || logCategories.includes(selectedCategory);
    return matchesSearch && matchesCategory;
  });

  const getTotalCost = () => filteredLogs.reduce((total, log) => total + (log.cost || 0), 0);

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
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('maintenance')} {t('history')}</h2>
          <p className="text-sm text-slate-500 mt-1">{activeVehicle?.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="p-4 border border-emerald-500/10">
          <p className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-1"><Wrench weight="duotone" className="w-3 h-3" /> {t('systems')}</p>
          <p className="text-2xl font-bold">{filteredLogs.length}</p>
        </Card>
        <Card className="p-4 border border-blue-500/10">
          <p className="text-[10px] uppercase font-bold text-blue-400 tracking-wider flex items-center gap-1"><CurrencyDollar weight="duotone" className="w-3 h-3" /> {t('total_spent')}</p>
          <p className="text-2xl font-bold">{formatCurrency2Dec(getTotalCost()).replace('L.E ', '')}</p>
        </Card>
      </div>

      <Card className="p-4 mb-6">
        <div className="flex flex-col gap-4">
          <div className="relative">
            <MagnifyingGlass weight="duotone" className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400", isRtl ? "right-3" : "left-3")} />
            <input type="text" placeholder={t('search')} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className={cn("w-full py-2 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white focus:outline-none", isRtl ? "pr-10 pl-4" : "pl-10 pr-4")} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setSelectedCategory('all')} className={cn("px-3 py-1 text-sm font-bold rounded-xl transition", selectedCategory === 'all' ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-900/60 text-slate-600')}>{t('all_categories')}</button>
            {getUniqueCategories().map(catId => {
              const category = getMaintenanceCategory(catId);
              return (
                <button key={catId} onClick={() => setSelectedCategory(catId)} className={cn("px-3 py-1 text-sm font-bold rounded-xl transition flex items-center gap-1", selectedCategory === catId ? 'bg-emerald-500 text-white' : 'bg-slate-100 dark:bg-slate-900/60 text-slate-600')}>
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: category.color }}></span> {t(catId)}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {filteredLogs.length === 0 ? (
        <Card className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800">
          <p className="text-slate-500 font-medium">{t('untracked')}</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredLogs.map((log) => (
            <Card key={log.id} className="p-4">
              <div className="flex justify-between items-start gap-4">
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 dark:text-white">{log.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-slate-400">{format(new Date(log.timestamp), 'MMM d, yyyy')}</span>
                    {log.odometer && <span className="text-[10px] font-bold text-emerald-500">{log.odometer.toLocaleString()} km</span>}
                  </div>
                </div>
                <div className="text-end">
                  <p className="font-bold text-slate-900 dark:text-white">{log.cost ? formatCurrency2Dec(log.cost).replace('L.E ', '') : '0'} <span className="text-[10px] text-slate-500">EGP</span></p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ConfirmModal isOpen={deleteModal.isOpen} onClose={() => setDeleteModal({ isOpen: false, logId: null })} onConfirm={() => { deleteMaintenanceLog(deleteModal.logId); setDeleteModal({ isOpen: false, logId: null }); }} title={t('delete')} message={t('delete') + "?"} confirmText={t('delete')} variant="danger" />
    </PageWrapper>
  );
}
