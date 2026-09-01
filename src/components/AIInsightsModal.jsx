import { useMemo, useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Robot, ArrowRight, ChartBar, ChatCircle, Sparkle, Brain, Microphone } from "@phosphor-icons/react";
import { Modal, Card, cn } from "./ui";
import { useFuel } from "../hooks/useFuelContext";
import { aiService } from "../services/aiService";
import {
  prepareInsightsData,
  prepareMonthlyReportData,
  preparePredictiveData,
} from "../utils/aiDataPrep";
import { useTranslation } from "react-i18next";
import { useLocalStorage } from "../hooks/useLocalStorage";
import ChatUI from "./ui/ChatUI";
import { parseQuery } from "../utils/queryParser";
import { executeQuery } from "../services/queryExecutor";
import { exportToExcel, exportToPDF, downloadBlob } from "../services/exportService";

const MODES = [
  {
    id: "chat",
    title: "Chat with AI",
    description: "Ask questions about your fuel data and get personalized insights.",
    icon: ChatCircle,
  },
  {
    id: "insights",
    title: "AI Insights",
    description: "Interpret your current vehicle statistics and get concise trends, cost-saving tips, and efficiency recommendations.",
    icon: Robot,
  },
  {
    id: "monthly-report",
    title: "Monthly Report",
    description: "Generate a professional monthly fuel report with performance review, spending breakdown, and practical recommendations.",
    icon: ChartBar,
  },
];

export default function AIInsightsModal() {
  const { stats, activeVehicleFillUps, activeVehicle } = useFuel();
  const { t, i18n } = useTranslation();
  const [floatingEnabled] = useLocalStorage(
    "fueltracker-ai-floating-buttons-enabled-v1",
    true,
  );
  const [isOpen, setIsOpen] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState(null);
  const [autoStartMic, setAutoStartMic] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resultText, setResultText] = useState("");
  const [error, setError] = useState("");
  
  // Chat state
  const [messages, setMessages] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [conversationHistoryDays] = useLocalStorage(
    "fueltracker-ai-conversation-history-days-v1",
    7
  );
  const [conversations, setConversations] = useState([]);
  const [currentConversationId, setCurrentConversationId] = useState(null);

  // Load conversation history from localStorage on mount
  useEffect(() => {
    try {
      const savedConversations = localStorage.getItem('fueltracker-ai-conversations-v1');
      if (savedConversations) {
        const parsedConversations = JSON.parse(savedConversations);
        const filteredConversations = filterConversationsByDate(parsedConversations, conversationHistoryDays);
        setConversations(filteredConversations);
      }
    } catch (error) {
      console.error('[AIInsightsModal] Error loading conversations:', error);
    }
  }, [conversationHistoryDays]);

  // Save conversations to localStorage when they change
  useEffect(() => {
    try {
      localStorage.setItem('fueltracker-ai-conversations-v1', JSON.stringify(conversations));
    } catch (error) {
      console.error('[AIInsightsModal] Error saving conversations:', error);
    }
  }, [conversations]);

  // Start new conversation when modal opens
  useEffect(() => {
    if (isOpen && selectedMode === 'chat') {
      const newConversationId = Date.now().toString();
      setCurrentConversationId(newConversationId);
      setMessages([]);
    }
  }, [isOpen, selectedMode]);

  // Filter conversations based on time window
  const filterConversationsByDate = (conversations, days) => {
    if (days === 0) return conversations; // Keep all history if set to 0 (forever)
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return conversations.filter(conv => {
      const convDate = new Date(conv.timestamp);
      return convDate >= cutoffDate;
    });
  };

  // Load a specific conversation
  const loadConversation = (conversationId) => {
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation) {
      setMessages(conversation.messages);
      setCurrentConversationId(conversationId);
    }
  };

  const currentLanguage = i18n.language.startsWith("ar") ? "ar" : "en";
  const hasEnoughData = activeVehicleFillUps.length >= 2;

  const insightsPayload = useMemo(
    () => prepareInsightsData(stats, activeVehicleFillUps, activeVehicle?.name || 'Vehicle', t('currency') || 'currency'),
    [stats, activeVehicleFillUps, activeVehicle?.name, t],
  );

  const reportPayload = useMemo(
    () =>
      prepareMonthlyReportData(
        stats,
        activeVehicleFillUps,
        activeVehicle?.name || "Vehicle",
        t('currency') || 'currency'
      ),
    [stats, activeVehicleFillUps, activeVehicle?.name, t],
  );

  const currentPayload = selectedMode === "monthly-report" ? reportPayload : insightsPayload;

  const handleOpen = () => {
    setIsOpen(true);
    setSelectedMode(null);
    setResultText("");
    setError("");
    // Don't clear messages here - let the mode selection handle it
  };

  const handleClose = () => {
    // Save current conversation before closing
    if (messages.length > 0 && currentConversationId) {
      const conversation = {
        id: currentConversationId,
        timestamp: parseInt(currentConversationId),
        messages: messages,
        title: messages[0]?.content?.substring(0, 50) || 'New Conversation'
      };
      setConversations(prev => [conversation, ...prev]);
    }
    
    setIsOpen(false);
    setSelectedMode(null);
    setAutoStartMic(false);
    setResultText("");
    setError("");
    setIsLoading(false);
    setMessages([]);
    setCurrentConversationId(null);
  };

  const handleModeSelect = (modeId) => {
    setSelectedMode(modeId);
    setResultText("");
    setError("");
    if (modeId === 'chat') {
      setMessages([]);
    }
  };

  const handleGenerate = async () => {
    if (!selectedMode || selectedMode === 'chat') return;

    setError("");
    setResultText("");
    setIsLoading(true);

    try {
      const payload = selectedMode === "monthly-report" ? reportPayload : insightsPayload;
      const result =
        selectedMode === "monthly-report"
          ? await aiService.generateMonthlyReport(payload, currentLanguage)
          : await aiService.generateInsights(payload, currentLanguage);

      const text = result.text || "";
      setResultText(text);
      setIsResultOpen(true);
    } catch (err) {
      setError(err?.message || "Unable to generate AI output. Please try again.");
      setIsResultOpen(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (message) => {
    if (!message.trim()) return;

    // Add user message with timestamp
    const userMessage = { role: 'user', content: message, timestamp: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    setIsChatLoading(true);

    try {
      // Parse the query to understand what the user wants, with conversation history for context
      const parsedQuery = parseQuery(message, messages);
      
      // Execute the query locally to get data
      const queryResults = executeQuery(parsedQuery);
      
      // OPTIMIZATION: Limit context payload if it contains large arrays
      let optimizedResults = { ...queryResults };
      if (optimizedResults.data) {
        if (Array.isArray(optimizedResults.data.fillUps) && optimizedResults.data.fillUps.length > 100) {
          optimizedResults.data.fillUps = optimizedResults.data.fillUps.slice(-100);
        }
        if (Array.isArray(optimizedResults.data.maintenance) && optimizedResults.data.maintenance.length > 100) {
          optimizedResults.data.maintenance = optimizedResults.data.maintenance.slice(-100);
        }
      }
      
      const predictiveContext = activeVehicle ? preparePredictiveData(activeVehicle.id) : null;

      // Send to AI for interpretation with query results
      const result = await aiService.executeQuery(
        message,
        parsedQuery,
        optimizedResults,
        currentLanguage,
        stats,
        predictiveContext
      );

      const aiMessage = { 
        role: 'assistant', 
        content: result.text || '',
        queryResults: queryResults.success ? queryResults.data : null,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      const errorMessage = { role: 'assistant', content: `Error: ${err?.message || 'Failed to get response'}` };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleClearHistory = () => {
    setConversations([]);
    setMessages([]);
    setCurrentConversationId(null);
  };

  const handleDeleteConversation = (conversationId) => {
    setConversations(prev => prev.filter(c => c.id !== conversationId));
    if (currentConversationId === conversationId) {
      setMessages([]);
      setCurrentConversationId(null);
    }
  };

  const handleExport = async (format, data) => {
    try {
      let blob;
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `fuel-data-${timestamp}`;
      const vehicleName = activeVehicle?.name || 'Vehicle';
      
      if (format === 'excel') {
        blob = await exportToExcel(data, filename, vehicleName);
        downloadBlob(blob, filename, 'xlsx');
      } else if (format === 'pdf') {
        blob = await exportToPDF(data, filename, vehicleName);
        downloadBlob(blob, filename, 'pdf');
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const summaryRows = useMemo(() => {
    const baseRows = [];

    if (selectedMode === "monthly-report") {
      baseRows.push(
        ["Vehicle", reportPayload.vehicleName],
        ["Period", reportPayload.period],
        ["Total Distance", `${reportPayload.totalDistance.toLocaleString()} km`],
        ["Total Fuel Cost", `${reportPayload.totalFuelCost.toFixed(2)} ${t('currency') || 'currency'}`],
        ["Average Efficiency", `${reportPayload.avgEfficiency.toFixed(2)} km/L`],
        ["Fill-up Count", reportPayload.fillUpCount],
        ["Best Efficiency", `${reportPayload.bestEfficiency.toFixed(2)} km/L`],
        ["Worst Efficiency", `${reportPayload.worstEfficiency.toFixed(2)} km/L`],
        ["Cost per KM", `${reportPayload.costPerKm.toFixed(2)} ${t('currency') || 'currency'}/km`],
        ["Driving Days", reportPayload.drivingDays],
        ["Average Daily Distance", `${reportPayload.avgDailyDistance.toFixed(1)} km`],
      );
    } else {
      baseRows.push(
        ["Total Distance", `${insightsPayload.totalDistance.toLocaleString()} km`],
        ["Total Cost", `${insightsPayload.totalCost.toFixed(2)} ${t('currency') || 'currency'}`],
        ["Average Efficiency", `${insightsPayload.avgKmPerLiter.toFixed(2)} km/L`],
        ["Average Consumption", `${insightsPayload.avgL100km.toFixed(2)} L/100km`],
        ["Cost per KM", `${insightsPayload.costPerKm.toFixed(2)} ${t('currency') || 'currency'}/km`],
        ["Number of Fill-ups", insightsPayload.fillUpCount],
        ["Date Range", `${new Date(insightsPayload.dateRange.start).toLocaleDateString()} - ${new Date(insightsPayload.dateRange.end).toLocaleDateString()}`],
      );
    }

    return baseRows;
  }, [insightsPayload, reportPayload, selectedMode, t]);

  const spendingRows = useMemo(() => {
    const spending = currentPayload.monthlySpending || [];
    return spending.map((item) => [item.month, `${item.total.toFixed(2)} ${t('currency') || 'currency'}`]);
  }, [currentPayload.monthlySpending, t]);

  return (
    <>
      {floatingEnabled && !isOpen && createPortal(
        <div className="flex flex-col gap-3" style={{ position: 'fixed', bottom: '96px', right: '24px', zIndex: 99999, direction: 'ltr' }}>
          <button
            type="button"
            onClick={handleOpen}
            className="group relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/30 transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-purple-500/50 active:scale-95 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            {/* Pulsing glow effect */}
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 opacity-75 animate-ping" />
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 opacity-50 blur-md group-hover:opacity-75 transition-opacity duration-300" />
            
            {/* Inner glow */}
            <span className="absolute inset-0 rounded-full bg-gradient-to-br from-violet-400/20 to-indigo-400/20 blur-sm" />
            
            {/* Icon */}
            <Brain weight="fill" className="w-7 h-7 relative z-10" />
            
            {/* Tooltip */}
            <span className="absolute right-full mr-3 px-3 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
              AI Assistant
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              handleOpen();
              setSelectedMode('chat');
              setAutoStartMic(true);
            }}
            className="group relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-lg shadow-red-500/30 transition-all duration-300 hover:scale-110 hover:shadow-xl hover:shadow-red-500/50 active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2 dark:focus:ring-offset-slate-900"
          >
            <Microphone weight="fill" className="w-6 h-6 relative z-10" />
            <span className="absolute right-full mr-3 px-3 py-1.5 bg-slate-900 dark:bg-slate-700 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap pointer-events-none">
              Voice Input
            </span>
          </button>
        </div>,
        document.body
      )}

      <Modal isOpen={isOpen} onClose={handleClose} title="AI Assistant" size="xl">
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-950">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">Choose a feature</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select an AI experience to interact with your fuel data.
                </p>
              </div>
              <div className="inline-flex rounded-full bg-white/90 px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 shadow-sm shadow-emerald-500/10 dark:bg-slate-900 dark:text-emerald-400">
                {hasEnoughData ? "Data ready" : "Need 2+ fill-ups"}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {MODES.map((mode) => {
              const ModeIcon = mode.icon;
              const active = selectedMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => handleModeSelect(mode.id)}
                  disabled={!hasEnoughData && mode.id !== 'chat'}
                  className={cn(
                    "rounded-2xl border p-4 text-left transition",
                    active
                      ? "border-emerald-500 bg-emerald-500/10 shadow-sm"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:hover:border-slate-600 dark:hover:bg-slate-900",
                    (!hasEnoughData && mode.id !== 'chat') && "cursor-not-allowed opacity-60",
                  )}
                >
                  <div className="flex flex-col items-center gap-2 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500 text-white">
                      <ModeIcon weight="fill" className="w-5 h-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{mode.title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                        {mode.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedMode === 'chat' && (
            <div className="h-[500px]">
              <ChatUI
                autoStartMic={autoStartMic}
                onMicStartComplete={() => setAutoStartMic(false)}
                messages={messages}
                conversations={conversations}
                onSendMessage={handleSendMessage}
                isLoading={isChatLoading}
                onExport={handleExport}
                onClearHistory={handleClearHistory}
                onLoadConversation={loadConversation}
                onDeleteConversation={handleDeleteConversation}
                placeholder="Ask about your fuel data..."
              />
            </div>
          )}

          {selectedMode && selectedMode !== 'chat' && (
            <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
              <div className="flex-1 min-h-0 overflow-y-auto pr-1">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">
                        {selectedMode === "monthly-report" ? "Monthly Fuel Report" : "AI Insights"}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {selectedMode === "monthly-report"
                          ? "Review the monthly summary data and generate a professional report."
                          : "Review current statistics and generate concise insights."}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => handleModeSelect(null)}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                      >
                        Choose another feature
                      </button>
                      <button
                        type="button"
                        onClick={handleGenerate}
                        disabled={!hasEnoughData || isLoading}
                        className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isLoading ? "Generating..." : "Generate"}
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10">
                      {error}
                    </div>
                  )}

                  <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-0 text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                    <div className="overflow-x-auto">
                      <table className="min-w-full border-collapse text-sm">
                        <tbody>
                          {summaryRows.map(([label, value]) => (
                            <tr key={label} className="border-t border-slate-200 dark:border-slate-800">
                              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                                {label}
                              </th>
                              <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {value}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </Card>

                  {spendingRows.length > 0 && (
                    <Card className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 dark:border-slate-700 dark:bg-slate-950">
                      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                          Monthly Spending
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse text-sm">
                          <thead>
                            <tr className="bg-slate-100 text-left text-[10px] uppercase tracking-[0.2em] text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                              <th className="px-4 py-3">Month</th>
                              <th className="px-4 py-3 text-right">Spent</th>
                            </tr>
                          </thead>
                          <tbody>
                            {spendingRows.map(([month, amount]) => (
                              <tr key={month} className="border-t border-slate-200 dark:border-slate-800">
                                <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{month}</td>
                                <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">{amount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}
                </div>
              </div>

              {resultText && (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-900 shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                    <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      <Robot className="w-4 h-4 text-emerald-500" />
                      <span>{selectedMode === "monthly-report" ? "AI Report" : "AI Insights"}</span>
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      Your AI response is ready. Open the dedicated result window for the full formatted output.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsResultOpen(true)}
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400"
                  >
                    View full AI result
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isResultOpen}
        onClose={() => setIsResultOpen(false)}
        title={selectedMode === 'monthly-report' ? 'AI Monthly Report' : 'AI Insights'}
        size="xl"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-slate-950 p-4 shadow-2xl dark:border-slate-700">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-500">
                  {selectedMode === 'monthly-report' ? 'AI Monthly Report' : 'AI Insights'}
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-200">
                  The AI response is shown below. Scroll to read the full formatted output.
                </p>
              </div>
              <span className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase text-emerald-300">
                {selectedMode === 'monthly-report' ? 'Report' : 'Insights'}
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow-lg">
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/95 shadow-inner">
              <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                <span>AI Output</span>
                <span>{selectedMode === 'monthly-report' ? 'Monthly Fuel Report' : 'Insights'}</span>
              </div>
              <div className="max-h-[60vh] overflow-y-auto p-4 text-sm leading-6 text-slate-100">
                <pre className="whitespace-pre-wrap break-words font-sans">{resultText}</pre>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
