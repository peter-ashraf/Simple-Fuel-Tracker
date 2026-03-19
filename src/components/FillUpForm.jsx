import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useFuel } from '../hooks/useFuelContext';
import { Input, Label, Card, PageWrapper } from './ui';
import { useNavigate } from 'react-router-dom';

export default function FillUpForm() {
  const { fuelPrices, addFillUp, activeVehicleFillUps } = useFuel();
  const navigate = useNavigate();

  const [liters, setLiters] = useState('');
  const [moneySpent, setMoneySpent] = useState('');
  const [lastEditedField, setLastEditedField] = useState(null); // 'liters' or 'moneySpent'
  const [odometer, setOdometer] = useState('');
  const [selectedFuelType, setSelectedFuelType] = useState('92');
  
  // Advanced fields
  const [date, setDate] = useState(new Date().toISOString().substring(0, 10)); // YYYY-MM-DD
  const [station, setStation] = useState('');
  const [notes, setNotes] = useState('');
  
  // Auto-fill odometer suggestion from previous
  useEffect(() => {
     if (activeVehicleFillUps.length > 0 && !odometer) {
        setOdometer(String(activeVehicleFillUps[activeVehicleFillUps.length - 1].odometer));
     }
  }, [activeVehicleFillUps]);

  // Auto-calculate based on last edited field
  useEffect(() => {
    if (lastEditedField === 'liters' && liters && fuelPrices[selectedFuelType]) {
      const calculatedCost = Number(liters) * fuelPrices[selectedFuelType];
      setMoneySpent(calculatedCost.toFixed(2));
    } else if (lastEditedField === 'moneySpent' && moneySpent && fuelPrices[selectedFuelType]) {
      const calculatedLiters = Number(moneySpent) / fuelPrices[selectedFuelType];
      setLiters(calculatedLiters.toFixed(2));
    }
  }, [liters, moneySpent, selectedFuelType, fuelPrices, lastEditedField]);

  // Reset calculation when fuel type changes
  useEffect(() => {
    if (lastEditedField && fuelPrices[selectedFuelType]) {
      if (lastEditedField === 'liters' && liters) {
        const calculatedCost = Number(liters) * fuelPrices[selectedFuelType];
        setMoneySpent(calculatedCost.toFixed(2));
      } else if (lastEditedField === 'moneySpent' && moneySpent) {
        const calculatedLiters = Number(moneySpent) / fuelPrices[selectedFuelType];
        setLiters(calculatedLiters.toFixed(2));
      }
    }
  }, [selectedFuelType, fuelPrices]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if ((!liters && !moneySpent) || !odometer) return;

    const newOdometer = Number(odometer);
    const newDate = new Date(date);
    
    // Only validate odometer if this is a newer entry than the latest one
    if (activeVehicleFillUps.length > 0) {
      const latestFillUp = activeVehicleFillUps[activeVehicleFillUps.length - 1];
      const latestDate = new Date(latestFillUp.timestamp);
      
      // If new entry is newer than latest entry, odometer must be greater
      if (newDate >= latestDate && newOdometer <= latestFillUp.odometer) {
        alert("Odometer must be greater than previous fill-up for newer entries");
        return;
      }
    }

    const currentPrice = fuelPrices[selectedFuelType] || 0;

    // Use selected date, merge with current time to maintain chronological sorts safely
    const baseDate = new Date(date);
    const now = new Date();
    baseDate.setHours(now.getHours(), now.getMinutes(), now.getSeconds());

    addFillUp({
      timestamp: baseDate.toISOString(),
      fuelType: selectedFuelType,
      liters: Number(liters) || 0,
      odometer: newOdometer,
      pricePerLiter: Number(currentPrice),
      station: station.trim(),
      notes: notes.trim()
    });

    navigate('/'); // go to dashboard on success
  };

  return (
    <>
      <PageWrapper>
        <div className="mb-6">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Add Fill-up</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Log your latest trip and fuel stop.</p>
        </div>

        <form id="fillup-form" onSubmit={handleSubmit} className="space-y-5 pb-32">
        <Card className="p-6">
           <div className="space-y-5">
              
              <div>
                 <Label>Date</Label>
                 <Input 
                   type="date" 
                   value={date} 
                   onChange={(e) => setDate(e.target.value)}
                   required
                 />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                   <Label>Odometer (km)</Label>
                   <Input 
                     type="number" 
                     value={odometer} 
                     onChange={(e) => setOdometer(e.target.value)}
                     placeholder="12543"
                     required
                     min="0"
                   />
                 </div>
                 <div>
                   <Label>Liters</Label>
                   <Input 
                     type="number" 
                     step="0.01"
                     value={liters} 
                     onChange={(e) => {
                       setLastEditedField('liters');
                       setLiters(e.target.value);
                     }}
                     placeholder="45.5"
                     min="0.1"
                   />
                 </div>
              </div>
              <div>
                 <Label>Money Spent (EGP)</Label>
                 <Input 
                   type="number" 
                   step="0.01"
                   value={moneySpent} 
                   onChange={(e) => {
                     setLastEditedField('moneySpent');
                     setMoneySpent(e.target.value);
                   }}
                   placeholder="1000.00"
                   min="0.1"
                 />
              </div>

              <div>
                 <Label>Fuel Grade</Label>
                 <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/50 rounded-2xl">
                     <button 
                        type="button"
                        onClick={() => setSelectedFuelType('92')}
                        className={`py-3 text-sm font-bold rounded-xl transition ${selectedFuelType === '92' ? 'bg-white dark:bg-emerald-500 text-slate-900 dark:text-slate-950 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                     >
                        92
                     </button>
                     <button 
                        type="button"
                        onClick={() => setSelectedFuelType('95')}
                        className={`py-3 text-sm font-bold rounded-xl transition ${selectedFuelType === '95' ? 'bg-white dark:bg-emerald-500 text-slate-900 dark:text-slate-950 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                     >
                        95
                     </button>
                     <button 
                        type="button"
                        onClick={() => setSelectedFuelType('diesel')}
                        className={`py-3 text-sm font-bold rounded-xl transition ${selectedFuelType === 'diesel' ? 'bg-white dark:bg-emerald-500 text-slate-900 dark:text-slate-950 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white'}`}
                     >
                        Diesel
                     </button>
                 </div>
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-500 font-medium text-center mt-2 opacity-80">Will apply current price: {fuelPrices[selectedFuelType]} EGP/L</p>
              </div>

           </div>
        </Card>

        <Card className="p-6">
           <div className="space-y-4">
              <div>
                 <Label>Station (Optional)</Label>
                 <Input 
                   type="text" 
                   value={station}
                   onChange={e => setStation(e.target.value)}
                   placeholder="e.g. Total, Mobil, Wataniya"
                 />
              </div>
              <div>
                 <Label>Notes (Optional)</Label>
                 <textarea 
                   className="w-full bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-700/50 rounded-2xl px-5 py-4 text-left text-slate-900 dark:text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all font-medium resize-none"
                   rows="2"
                   value={notes}
                   onChange={e => setNotes(e.target.value)}
                   placeholder="e.g. Changed oil, tire pressure checked..."
                 />
              </div>
           </div>
        </Card>

        </form>
      </PageWrapper>

      <div className="fixed bottom-[80px] left-0 right-0 bg-white/80 dark:bg-slate-950/90 backdrop-blur-xl border-t border-slate-200/60 dark:border-slate-800/80 p-4 z-40 transition-colors duration-300">
        <div className="max-w-lg mx-auto">
          <button 
             type="submit" 
             form="fillup-form"
             disabled={(!liters && !moneySpent) || !odometer}
             className="w-full bg-emerald-500 hover:bg-emerald-400 text-white dark:text-slate-950 font-bold h-[64px] rounded-[1.5rem] flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-xl shadow-emerald-500/25 active:scale-[0.98]"
          >
            <Plus className="w-5 h-5" />
            <span>Save Fill-up</span>
          </button>
        </div>
      </div>
    </>
  );
}
