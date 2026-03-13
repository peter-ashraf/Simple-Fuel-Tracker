import { useState } from 'react';
import { useFuel } from '../hooks/useFuelContext';
import { useTheme } from '../hooks/useTheme';
import { Card, Input, Label, cn, PageWrapper } from './ui';
import { Trash2, Plus, CarFront, DollarSign, AlertCircle, Palette, Pencil, Check } from 'lucide-react';

export default function Settings() {
  const { vehicles, selectedVehicleId, fuelPrices, setFuelPrices, addVehicle, editVehicle, deleteVehicle } = useFuel();
  const { theme, setTheme } = useTheme();
  const [newVehicleName, setNewVehicleName] = useState('');
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [editingName, setEditingName] = useState('');

  const handleCreateVehicle = (e) => {
    e.preventDefault();
    if (newVehicleName.trim()) {
      addVehicle({ name: newVehicleName.trim(), type: 'car' });
      setNewVehicleName('');
    }
  };

  const handleSaveEdit = (id) => {
    if (editingName.trim()) {
      editVehicle(id, editingName.trim());
    }
    setEditingVehicleId(null);
  };

  const handleClearApp = () => {
    if (confirm("DANGER: Are you sure you want to completely erase all data in this app? This action is irreversible offline.")) {
      window.localStorage.clear();
      window.location.reload();
    }
  };

  return (
    <PageWrapper className="space-y-6 pb-1">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Manage vehicles and fuel preferences.</p>
      </div>

      <section>
         <h3 className="text-xs font-bold text-blue-500 dark:text-blue-400 uppercase tracking-wider mb-3 flex items-center gap-2 ml-1"><CarFront className="w-4 h-4"/> Your Garage</h3>
         
         <div className="space-y-3 mb-4">
            {vehicles.map(v => (
               <div key={v.id} className={cn("glass-card group p-4 rounded-xl flex items-center justify-between shadow-sm dark:shadow-none border-slate-200 dark:border-slate-800", v.id === selectedVehicleId && "border-blue-500/50 bg-blue-50 dark:bg-blue-500/5")}>
                  {editingVehicleId === v.id ? (
                    <div className="flex-1 mr-3 flex items-center gap-2">
                       <Input 
                         type="text" 
                         value={editingName} 
                         onChange={e => setEditingName(e.target.value)}
                         autoFocus
                         className="py-1.5 px-3 text-sm h-auto bg-slate-100 dark:bg-slate-900 focus:ring-blue-500/50 focus:border-blue-500/50"
                         onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveEdit(v.id);
                            if (e.key === 'Escape') setEditingVehicleId(null);
                         }}
                       />
                       <button onClick={() => handleSaveEdit(v.id)} className="text-emerald-500 hover:text-emerald-400 p-1.5 bg-emerald-500/10 rounded-lg">
                          <Check className="w-4 h-4" />
                       </button>
                    </div>
                  ) : (
                    <div className="flex-1 mr-3 flex items-center gap-2">
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-slate-200 block">{v.name}</span>
                        {v.id === selectedVehicleId && <span className="text-[10px] font-bold text-blue-500 dark:text-blue-400 uppercase">Active</span>}
                      </div>
                      <button 
                        onClick={() => {
                          setEditingVehicleId(v.id);
                          setEditingName(v.name);
                        }}
                        className="text-slate-400 hover:text-blue-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity md:opacity-100 ml-auto"
                      >
                         <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  
                  <div className="shrink-0 flex items-center border-l border-slate-200 dark:border-slate-800 pl-2 ml-1">
                     <button 
                        onClick={() => {
                           if(confirm(`Are you sure you want to delete ${v.name}? All its history will be lost.`)) deleteVehicle(v.id);
                        }} 
                        disabled={vehicles.length === 1 || editingVehicleId === v.id}
                        className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-2 disabled:opacity-20 disabled:hover:text-slate-400 transition-colors"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                  </div>
               </div>
            ))}
         </div>

         <form onSubmit={handleCreateVehicle} className="flex gap-2">
            <Input 
              type="text" 
              placeholder="New vehicle name (e.g., Wife's Car)" 
              value={newVehicleName}
              onChange={e => setNewVehicleName(e.target.value)}
              className="py-3"
            />
            <button type="submit" disabled={!newVehicleName} className="bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-slate-950 px-5 rounded-2xl font-bold transition flex items-center justify-center">
              <Plus className="w-5 h-5"/>
            </button>
         </form>
      </section>

      <section className="pt-4">
         <h3 className="text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider mb-3 flex items-center gap-2 ml-1"><Palette className="w-4 h-4"/> Theme Preferences</h3>
         <Card className="px-5 py-6">
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl">
              <button type="button" onClick={() => setTheme('light')} className={`py-3 text-sm font-bold rounded-xl transition cursor-pointer ${theme === 'light' ? 'bg-white dark:bg-indigo-500 text-slate-950 dark:text-white shadow-sm dark:shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Light</button>
              <button type="button" onClick={() => setTheme('dark')} className={`py-3 text-sm font-bold rounded-xl transition cursor-pointer ${theme === 'dark' ? 'bg-white dark:bg-indigo-500 text-slate-950 dark:text-white shadow-sm dark:shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>Dark</button>
              <button type="button" onClick={() => setTheme('system')} className={`py-3 text-sm font-bold rounded-xl transition cursor-pointer ${theme === 'system' ? 'bg-white dark:bg-indigo-500 text-slate-950 dark:text-white shadow-sm dark:shadow-md' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}>System</button>
            </div>
         </Card>
      </section>

      <section className="pt-4">
         <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2 ml-1"><DollarSign className="w-4 h-4"/> Global Fuel Prices</h3>
         
         <Card className="px-5 py-6">
            <div className="space-y-4">
               <div>
                  <Label>Petrol 92 (EGP/L)</Label>
                  <Input 
                    type="number" step="0.01"
                    value={fuelPrices[92] || ''} 
                    onChange={e => setFuelPrices({...fuelPrices, 92: Number(e.target.value)})}
                  />
               </div>
               <div>
                  <Label>Petrol 95 (EGP/L)</Label>
                  <Input 
                    type="number" step="0.01"
                    value={fuelPrices[95] || ''} 
                    onChange={e => setFuelPrices({...fuelPrices, 95: Number(e.target.value)})}
                  />
               </div>
               <div>
                  <Label>Diesel (EGP/L)</Label>
                  <Input 
                    type="number" step="0.01"
                    value={fuelPrices['diesel'] || ''} 
                    onChange={e => setFuelPrices({...fuelPrices, 'diesel': Number(e.target.value)})}
                  />
               </div>
            </div>
         </Card>
      </section>

      <section className="pt-8 mb-2">
         <button onClick={handleClearApp} className="w-full py-4 rounded-[1.5rem] border border-red-500/20 text-red-500 font-bold hover:bg-red-500/10 transition flex justify-center gap-2 items-center shadow-lg shadow-red-500/5">
            <AlertCircle className="w-5 h-5" /> Factory Reset App
         </button>
         <p className="text-center text-xs text-slate-500 mt-3">Clears all local storage data and refreshes.</p>
      </section>

    </PageWrapper>
  );
}
