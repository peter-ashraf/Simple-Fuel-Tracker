import { useState, useRef, useEffect } from 'react';
import { Robot, User, PaperPlaneRight, X, Download, Table, ArrowRight, Clock, Trash, Microphone, ImageSquare, SpinnerGap } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './index';
import Tesseract from 'tesseract.js';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Helper component to render query results as a table
function QueryResultsTable({ data }) {
  if (!data || typeof data !== 'object') return null;

  // Render Charts if data contains arrays suitable for charting
  let chartElement = null;
  
  if (data.monthlySpending && Array.isArray(data.monthlySpending) && data.monthlySpending.length > 0) {
    const chartData = {
      labels: data.monthlySpending.map(m => m.month),
      datasets: [{
        label: 'Monthly Spending',
        data: data.monthlySpending.map(m => m.total),
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 2,
        borderRadius: 4
      }]
    };
    chartElement = (
      <div className="h-48 mt-4 bg-white dark:bg-slate-900 rounded-xl p-2 border border-slate-200 dark:border-slate-700">
        <Bar options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} data={chartData} />
      </div>
    );
  } else if (data.monthlyBreakdown && Array.isArray(data.monthlyBreakdown) && data.monthlyBreakdown.length > 0) {
    const chartData = {
      labels: data.monthlyBreakdown.map(m => `${m.year}-${m.month}`),
      datasets: [{
        label: 'Total Cost',
        data: data.monthlyBreakdown.map(m => m.sum || m.totalCost || 0),
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 2,
        borderRadius: 4
      }]
    };
    chartElement = (
      <div className="h-48 mt-4 bg-white dark:bg-slate-900 rounded-xl p-2 border border-slate-200 dark:border-slate-700">
        <Bar options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} data={chartData} />
      </div>
    );
  } else if (data.efficiencyTrend && Array.isArray(data.efficiencyTrend) && data.efficiencyTrend.length > 0) {
    const chartData = {
      labels: data.efficiencyTrend.map((_, i) => `Fill #${i+1}`),
      datasets: [{
        label: 'Efficiency (km/L)',
        data: data.efficiencyTrend.map(e => e.value),
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        fill: true,
        tension: 0.4
      }]
    };
    chartElement = (
      <div className="h-48 mt-4 bg-white dark:bg-slate-900 rounded-xl p-2 border border-slate-200 dark:border-slate-700">
        <Line options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }} data={chartData} />
      </div>
    );
  }

  // Map technical field names to user-friendly labels
  const labelMap = {
    vehicleId: null, // Hide this field
    vehicleName: 'Vehicle',
    totalDistance: 'Total Distance',
    totalCost: 'Total Cost',
    avgEfficiency: 'Average Efficiency',
    fillUpCount: 'Fill-up Count',
    avgCostPerKm: 'Cost per KM',
    period: 'Period',
    metrics: 'Metrics',
    totalLiters: 'Total Liters',
    avgCostPerFill: 'Average Cost per Fill',
    monthlyBreakdown: 'Monthly Breakdown',
    year: 'Year',
    month: 'Month',
    sum: 'Total',
    avg: 'Average',
    count: 'Count',
    currency: 'Currency',
    maintenanceCount: 'Maintenance Count',
    dateRange: 'Date Range'
  };

  const getLabel = (key) => {
    if (labelMap.hasOwnProperty(key)) {
      return labelMap[key];
    }
    // Convert camelCase to Title Case
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  const shouldShowField = (key) => {
    return labelMap[key] !== null;
  };

  const renderValue = (value) => {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'number') {
      // Format numbers with 2 decimal places if they have decimals
      return Number.isInteger(value) ? value.toLocaleString() : value.toFixed(2);
    }
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const renderRow = (key, value, depth = 0) => {
    if (!shouldShowField(key)) return null;
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return (
        <div key={key} className={depth > 0 ? "ml-4 mt-2" : ""}>
          <div className="font-semibold text-xs uppercase text-slate-500 dark:text-slate-400 mb-1">
            {getLabel(key)}
          </div>
          {Object.entries(value).map(([k, v]) => renderRow(k, v, depth + 1))}
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div key={key} className={depth > 0 ? "ml-4 mt-2" : ""}>
          <div className="font-semibold text-xs uppercase text-slate-500 dark:text-slate-400 mb-1">
            {getLabel(key)} ({value.length} items)
          </div>
          {value.slice(0, 5).map((item, idx) => (
            <div key={idx} className="text-xs text-slate-600 dark:text-slate-300 ml-4">
              {typeof item === 'object' ? renderRow(`Item ${idx + 1}`, item, depth + 1) : String(item)}
            </div>
          ))}
          {value.length > 5 && (
            <div className="text-xs text-slate-400 dark:text-slate-500 ml-4">
              ... and {value.length - 5} more
            </div>
          )}
        </div>
      );
    }

    return (
      <div key={key} className="flex justify-between py-1 border-b border-slate-200 dark:border-slate-700 last:border-0">
        <span className="text-xs text-slate-600 dark:text-slate-300">{getLabel(key)}</span>
        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">{renderValue(value)}</span>
      </div>
    );
  };

  return (
    <div>
      <div className="mt-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
        {Object.entries(data).map(([key, value]) => renderRow(key, value))}
      </div>
      {chartElement}
    </div>
  );
}

// Helper component for export buttons
function ExportButtons({ data, onExport }) {
  if (!data) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex gap-2 mt-3">
      <button
        onClick={() => onExport('excel', data)}
        className="flex items-center gap-2 px-3 py-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-xs font-semibold hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition"
      >
        <Download weight="duotone" className="w-4 h-4" />
        Excel
      </button>
      <button
        onClick={() => onExport('pdf', data)}
        className="flex items-center gap-2 px-3 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg text-xs font-semibold hover:bg-purple-200 dark:hover:bg-purple-900/50 transition"
      >
        <Download weight="duotone" className="w-4 h-4" />
        PDF
      </button>
    </motion.div>
  );
}

// Typewriter effect for AI messages
function TypewriterText({ text, shouldAnimate, onComplete }) {
  const [displayedText, setDisplayedText] = useState(shouldAnimate ? "" : text);
  const [index, setIndex] = useState(shouldAnimate ? 0 : text.length);

  useEffect(() => {
    if (!shouldAnimate) {
      setDisplayedText(text);
      return;
    }
    
    if (index < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text.charAt(index));
        setIndex(prev => prev + 1);
      }, 15);
      return () => clearTimeout(timeout);
    } else if (onComplete) {
      onComplete();
    }
  }, [index, text, shouldAnimate, onComplete]);

  return <p className="text-sm leading-6 whitespace-pre-wrap">{displayedText}</p>;
}

export default function ChatUI({ 
  messages = [], 
  conversations = [],
  onSendMessage, 
  isLoading = false,
  onClose,
  onExport,
  onClearHistory,
  onLoadConversation,
  autoStartMic,
  onMicStartComplete,
  placeholder = "Ask about your fuel data..."
}) {
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Voice Input State
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  
  // OCR State
  const [isOcrProcessing, setIsOcrProcessing] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        recognitionRef.current = new SpeechRecognition();
        recognitionRef.current.continuous = false;
        recognitionRef.current.interimResults = false;
        
        recognitionRef.current.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setInput((prev) => prev ? `${prev} ${transcript}` : transcript);
          setIsListening(false);
        };
        
        recognitionRef.current.onerror = (event) => {
          console.error('Speech recognition error', event.error);
          setIsListening(false);
        };
        
        recognitionRef.current.onend = () => {
          setIsListening(false);
        };
      }
    }
  }, []);

  useEffect(() => {
    if (autoStartMic && !isListening && recognitionRef.current) {
      // Small timeout to ensure modal transition finishes
      setTimeout(() => {
        toggleListening();
        if (onMicStartComplete) {
          onMicStartComplete();
        }
      }, 300);
    }
  }, [autoStartMic]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error("Speech recognition failed to start", e);
      }
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsOcrProcessing(true);
    try {
      const result = await Tesseract.recognize(file, 'eng');
      const text = result.data.text;
      
      const ocrPrompt = `I just scanned a fuel receipt. Here is the raw OCR text. Please extract the fill-up details (cost, liters, date) and ask me if I want to log it:\n\n${text}`;
      onSendMessage(ocrPrompt);
    } catch (err) {
      console.error('OCR failed', err);
      alert("Failed to scan receipt. Please try again.");
    } finally {
      setIsOcrProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const handleExport = (format, data) => {
    if (onExport) {
      onExport(format, data);
    }
  };

  const handleClearHistory = () => {
    if (onClearHistory) {
      onClearHistory();
    }
  };

  const handleLoadConversation = (conversationId) => {
    if (onLoadConversation) {
      onLoadConversation(conversationId);
      setShowHistory(false);
    }
  };

  const handleDeleteConversation = (conversationId, e) => {
    e.stopPropagation();
    if (onDeleteConversation) {
      onDeleteConversation(conversationId);
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with history button */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors",
              showHistory 
                ? "bg-emerald-500 text-white" 
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            )}
          >
            <Clock weight="duotone" className="w-4 h-4" />
            <span>Conversations ({conversations.length})</span>
          </button>
        </div>
        {conversations.length > 0 && onClearHistory && (
          <button
            onClick={handleClearHistory}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            <Trash weight="duotone" className="w-4 h-4" />
            <span>Clear All</span>
          </button>
        )}
      </div>

      {/* Conversations Panel */}
      {showHistory && (
        <div className="mb-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 max-h-48 overflow-y-auto">
          {conversations.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center py-2">No conversation history</p>
          ) : (
            <div className="space-y-2">
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  onClick={() => handleLoadConversation(conv.id)}
                  className="group relative p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-emerald-500 dark:hover:border-emerald-500 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{conv.title}</p>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {formatDate(conv.timestamp)} • {conv.messages.length} messages
                      </p>
                    </div>
                    <button
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all"
                    >
                      <Trash weight="duotone" className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-3 py-8">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
              <Robot weight="duotone" className="w-8 h-8 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                Ask about your fuel data
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                I can help you analyze your fuel efficiency, costs, and driving patterns
              </p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSendMessage("Show me fuel costs for January")}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full text-xs font-medium cursor-pointer transition-colors border-0"
                >
                  "Show me fuel costs for January"
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSendMessage("Compare my vehicles")}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full text-xs font-medium cursor-pointer transition-colors border-0"
                >
                  "Compare my vehicles"
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onSendMessage("Export my data to Excel")}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-full text-xs font-medium cursor-pointer transition-colors border-0"
                >
                  "Export to Excel"
                </motion.button>
              </div>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((message, index) => {
              const isRecent = Date.now() - message.timestamp < 3000;
              const isLastMessage = index === messages.length - 1;
              const shouldTypewrite = message.role === 'assistant' && isRecent && isLastMessage;

              return (
                <motion.div
                  key={message.timestamp + index}
                  initial={{ opacity: 0, y: 15, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  className={cn(
                    "flex gap-3",
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center">
                      <Robot weight="fill" className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-3",
                      message.role === 'user'
                        ? 'bg-emerald-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'
                    )}
                  >
                    {message.role === 'assistant' ? (
                      <TypewriterText text={message.content} shouldAnimate={shouldTypewrite} onComplete={scrollToBottom} />
                    ) : (
                      <p className="text-sm leading-6 whitespace-pre-wrap">{message.content}</p>
                    )}
                    
                    {message.queryResults && (
                      <motion.div
                        initial={shouldTypewrite ? { opacity: 0, height: 0 } : false}
                        animate={shouldTypewrite ? { opacity: 1, height: 'auto' } : false}
                        transition={{ delay: 1 }}
                        className="overflow-hidden"
                      >
                        <QueryResultsTable data={message.queryResults} />
                        {onExport && (
                          <ExportButtons data={message.queryResults} onExport={handleExport} />
                        )}
                      </motion.div>
                    )}
                  </div>
                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 bg-slate-300 dark:bg-slate-600 rounded-xl flex items-center justify-center">
                      <User weight="fill" className="w-4 h-4 text-white" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0, y: 15 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex gap-3 justify-start"
          >
            <div className="flex-shrink-0 w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center">
              <Robot weight="fill" className="w-4 h-4 text-white" />
            </div>
            <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
        <input
          type="file"
          accept="image/*"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileUpload}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading || isOcrProcessing}
          className={cn(
            "px-3 py-3 rounded-xl transition flex items-center justify-center",
            isOcrProcessing 
              ? "bg-slate-100 dark:bg-slate-800 text-emerald-500" 
              : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
          )}
          title="Scan Receipt"
        >
          {isOcrProcessing ? (
            <SpinnerGap weight="bold" className="w-5 h-5 animate-spin" />
          ) : (
            <ImageSquare weight="fill" className="w-5 h-5" />
          )}
        </button>
        <button
          type="button"
          onClick={toggleListening}
          disabled={isLoading || !recognitionRef.current}
          className={cn(
            "px-3 py-3 rounded-xl transition flex items-center justify-center relative",
            isListening 
              ? "bg-red-100 dark:bg-red-900/30 text-red-500" 
              : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
          )}
          title="Voice Input"
        >
          {isListening && (
            <span className="absolute inset-0 rounded-xl bg-red-400 opacity-25 animate-ping" />
          )}
          <Microphone weight="fill" className="w-5 h-5 relative z-10" />
        </button>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={placeholder}
          disabled={isLoading}
          className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed text-sm"
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          <PaperPlaneRight weight="fill" className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
