import { useState, useRef, useEffect } from 'react';
import { Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Home, List, PieChart, Plus, Settings, Fuel, ChevronDown, Check } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useFuel } from './hooks/useFuelContext';

// Pages
import Dashboard from './components/Dashboard';
import History from './components/History';
import FillUpForm from './components/FillUpForm';
import Analytics from './components/Analytics';
import SettingsScreen from './components/Settings';

function Header() {
  const { vehicles, selectedVehicleId, setSelectedVehicleId } = useFuel();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isSettings = location.pathname === '/settings';
  const activeVehicle = vehicles.find(v => v.id === selectedVehicleId);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-white/5 px-5 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3 relative" ref={dropdownRef}>
        <div className="bg-emerald-500/20 p-2 rounded-xl border border-emerald-500/30 shadow-lg shadow-emerald-500/10">
          <Fuel className="text-emerald-400 w-5 h-5" />
        </div>
        
        <button 
          onClick={() => !isSettings && setIsOpen(!isOpen)}
          disabled={isSettings}
          className={`flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white tracking-tight focus:outline-none transition-opacity ${isSettings ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-80'}`}
        >
           <span>{activeVehicle ? activeVehicle.name : 'Select Vehicle'}</span>
           {!isSettings && (
              <motion.div animate={{ rotate: isOpen ? 180 : 0 }} transition={{ type: "spring", stiffness: 300, damping: 20 }}>
                 <ChevronDown className="w-5 h-5 text-slate-400" />
              </motion.div>
           )}
        </button>

        <AnimatePresence>
          {isOpen && !isSettings && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95, transition: { duration: 0.15 } }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="absolute top-12 left-12 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl overflow-hidden z-50 origin-top-left"
            >
              <div className="p-1">
                {vehicles.map(v => (
                  <button
                    key={v.id}
                    onClick={() => {
                      setSelectedVehicleId(v.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors ${selectedVehicleId === v.id ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}
                  >
                    <span className="truncate">{v.name}</span>
                    {selectedVehicleId === v.id && <Check className="w-4 h-4" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
}

export default function App() {
  const cn = (...classes) => classes.filter(Boolean).join(' ');

  return (
    <div className="pb-28 max-w-lg mx-auto relative min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      <Header />
      
      <main className="flex-1 px-5 pt-6">
         <AnimatePresence mode="wait">
           <Routes location={location} key={location.pathname}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/history" element={<History />} />
              <Route path="/add" element={<FillUpForm />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/settings" element={<SettingsScreen />} />
           </Routes>
         </AnimatePresence>
      </main>
      
      {/* Bottom Tab Bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800/80 p-1 z-50 transition-colors duration-300">
         <div className="flex items-center justify-between h-[72px] max-w-lg mx-auto px-4 relative">
            
            <NavLink to="/" className={({isActive}) => cn("flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors relative", isActive ? "text-emerald-500" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300")}>
               {({ isActive }) => (
                 <motion.div whileTap={{ scale: 0.85 }} className="flex flex-col items-center">
                    <Home className="w-[22px] h-[22px]" />
                    <span className="text-[10px] font-semibold mt-0.5">Home</span>
                    {isActive && <motion.div layoutId="nav-pill" className="absolute -bottom-1 w-8 h-1 bg-emerald-500 rounded-t-full" />}
                 </motion.div>
               )}
            </NavLink>
            
            <NavLink to="/history" className={({isActive}) => cn("flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors relative", isActive ? "text-emerald-500" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300")}>
               {({ isActive }) => (
                 <motion.div whileTap={{ scale: 0.85 }} className="flex flex-col items-center">
                    <List className="w-[22px] h-[22px]" />
                    <span className="text-[10px] font-semibold mt-0.5">History</span>
                    {isActive && <motion.div layoutId="nav-pill" className="absolute -bottom-1 w-8 h-1 bg-emerald-500 rounded-t-full" />}
                 </motion.div>
               )}
            </NavLink>

            {/* Center Floating FAB */}
            <div className="relative -top-5 flex justify-center w-20">
               <NavLink to="/add" className={({isActive}) => cn("flex items-center justify-center w-[60px] h-[60px] rounded-[1.5rem] shadow-2xl transition-all border", isActive ? "bg-emerald-600 text-white shadow-emerald-500/30 border-emerald-500 ring-4 ring-emerald-500/20" : "bg-emerald-500 text-white dark:text-slate-950 shadow-emerald-500/20 border-emerald-400 hover:bg-emerald-400")}>
                  <motion.div whileTap={{ scale: 0.9, rotate: 90 }} transition={{ type: "spring", stiffness: 400, damping: 10 }}>
                    <Plus className="w-8 h-8" strokeWidth={2.5}/>
                  </motion.div>
               </NavLink>
            </div>

            <NavLink to="/analytics" className={({isActive}) => cn("flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors relative", isActive ? "text-emerald-500" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300")}>
               {({ isActive }) => (
                 <motion.div whileTap={{ scale: 0.85 }} className="flex flex-col items-center">
                    <PieChart className="w-[22px] h-[22px]" />
                    <span className="text-[10px] font-semibold mt-0.5">Stats</span>
                    {isActive && <motion.div layoutId="nav-pill" className="absolute -bottom-1 w-8 h-1 bg-emerald-500 rounded-t-full" />}
                 </motion.div>
               )}
            </NavLink>

            <NavLink to="/settings" className={({isActive}) => cn("flex flex-col items-center justify-center gap-1 w-16 h-full transition-colors relative", isActive ? "text-emerald-500" : "text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300")}>
               {({ isActive }) => (
                 <motion.div whileTap={{ scale: 0.85 }} className="flex flex-col items-center">
                    <Settings className="w-[22px] h-[22px]" />
                    <span className="text-[10px] font-semibold mt-0.5">Config</span>
                    {isActive && <motion.div layoutId="nav-pill" className="absolute -bottom-1 w-8 h-1 bg-emerald-500 rounded-t-full" />}
                 </motion.div>
               )}
            </NavLink>

         </div>
      </nav>
    </div>
  );
}
