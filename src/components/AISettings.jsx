import { useState } from "react";
import { Card } from "./ui";
import { Sparkle, CheckCircle, WarningCircle, ArrowClockwise, ChartLine, Gauge, CurrencyDollar, Drop, Wrench, CaretDown, Check } from "@phosphor-icons/react";
import { aiService } from "../services/aiService";
import { useTranslation } from "react-i18next";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { AnimatePresence, motion as Motion } from "framer-motion";

export default function AISettings() {
  const { t, i18n } = useTranslation();
  const [testStatus, setTestStatus] = useState("idle"); // idle, loading, success, error
  const [testResult, setTestResult] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [floatingButtonsEnabled, setFloatingButtonsEnabled] = useLocalStorage(
    "fueltracker-ai-floating-buttons-enabled-v1",
    true,
  );
  const [dashboardInsightsEnabled, setDashboardInsightsEnabled] = useLocalStorage(
    "fueltracker-ai-dashboard-insights-enabled-v1",
    true,
  );
  const [insightPreferences, setInsightPreferences] = useLocalStorage(
    "fueltracker-ai-insight-preferences-v1",
    {
      fuelUsage: true,
      averageMileage: true,
      averageCost: true,
      priceTrends: true,
      efficiency: true,
      maintenance: true,
    }
  );
  const [conversationHistoryDays, setConversationHistoryDays] = useLocalStorage(
    "fueltracker-ai-conversation-history-days-v1",
    7
  );
  const [isHistoryDropdownOpen, setIsHistoryDropdownOpen] = useState(false);
  const historyDropdownRef = useState({ current: null })[0];

  const historyOptions = [
    { value: 1, label: '1 day' },
    { value: 3, label: '3 days' },
    { value: 7, label: '7 days' },
    { value: 14, label: '14 days' },
    { value: 30, label: '30 days' },
    { value: 0, label: 'Forever' },
  ];

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestStatus("loading");
    setTestResult("");

    try {
      const result = await aiService.testConnection();
      setTestResult(result.text);
      setTestStatus("success");
    } catch (error) {
      setTestResult(error.message || "Connection test failed");
      setTestStatus("error");
    } finally {
      setIsTesting(false);
    }
  };

  const currentLanguage = i18n.language.startsWith("ar") ? "ar" : "en";

  return (
    <section className="pt-4">
      <h3 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-3 flex items-center gap-2 ms-1">
        <Sparkle weight="duotone" className="w-4 h-4" /> AI Configuration
      </h3>
      <Card className="px-5 py-6 space-y-4">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            AI-Powered Insights
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Test your AI provider connection to enable dashboard insights and monthly reports.
          </p>
        </div>

        <button
          type="button"
          onClick={handleTestConnection}
          disabled={isTesting}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-purple-500 hover:bg-purple-400 px-4 py-3 text-sm font-bold text-white transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 shadow-lg shadow-purple-500/20"
        >
          {isTesting ? (
            <>
              <ArrowClockwise weight="duotone" className="h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Sparkle weight="duotone" className="h-4 w-4" />
              Test Connection
            </>
          )}
        </button>

        {testStatus !== "idle" && (
          <div
            className={`rounded-2xl p-4 ${
              testStatus === "success"
                ? "bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20"
                : testStatus === "error"
                  ? "bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20"
                  : "bg-slate-50 dark:bg-white/[0.04]"
            }`}
          >
            <div className="flex items-start gap-3">
              {testStatus === "success" && (
                <CheckCircle weight="duotone" className="h-5 w-5 text-emerald-500 flex-shrink-0 mt-0.5" />
              )}
              {testStatus === "error" && (
                <WarningCircle weight="duotone" className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
              )}
              {testStatus === "loading" && (
                <ArrowClockwise weight="duotone" className="h-5 w-5 text-slate-400 animate-spin flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-semibold ${
                    testStatus === "success"
                      ? "text-emerald-700 dark:text-emerald-300"
                      : testStatus === "error"
                        ? "text-red-700 dark:text-red-300"
                        : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {testStatus === "success"
                    ? "Connection Successful"
                    : testStatus === "error"
                      ? "Connection Failed"
                      : "Testing Connection..."}
                </p>
                {testResult && (
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 break-words">
                    {testResult}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      <Card className="px-5 py-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Floating AI Button
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Toggle whether the AI assistant button appears on Dashboard and Analytics.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={floatingButtonsEnabled}
            onClick={() => setFloatingButtonsEnabled((prev) => !prev)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              floatingButtonsEnabled
                ? "bg-emerald-500"
                : "bg-slate-300 dark:bg-slate-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                floatingButtonsEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </Card>

      <Card className="px-5 py-6 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white">
              Dashboard Insights
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Show AI-powered insights and alerts on your dashboard.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={dashboardInsightsEnabled}
            onClick={() => setDashboardInsightsEnabled((prev) => !prev)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              dashboardInsightsEnabled
                ? "bg-emerald-500"
                : "bg-slate-300 dark:bg-slate-600"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                dashboardInsightsEnabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </Card>

      {dashboardInsightsEnabled && (
        <Card className="px-5 py-6 space-y-4">
          <div>
            <p className="text-sm font-medium text-slate-900 dark:text-white mb-4">
              Insight Preferences
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 mb-4">
              Customize which insights appear on your dashboard.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Drop weight="duotone" className="h-4 w-4 text-purple-500" />
                <p className="text-sm text-slate-700 dark:text-slate-300">Fuel Usage</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={insightPreferences.fuelUsage}
                onClick={() => setInsightPreferences(prev => ({ ...prev, fuelUsage: !prev.fuelUsage }))}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  insightPreferences.fuelUsage
                    ? "bg-emerald-500"
                    : "bg-slate-300 dark:bg-slate-600"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    insightPreferences.fuelUsage ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Gauge weight="duotone" className="h-4 w-4 text-purple-500" />
                <p className="text-sm text-slate-700 dark:text-slate-300">Average Mileage</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={insightPreferences.averageMileage}
                onClick={() => setInsightPreferences(prev => ({ ...prev, averageMileage: !prev.averageMileage }))}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  insightPreferences.averageMileage
                    ? "bg-emerald-500"
                    : "bg-slate-300 dark:bg-slate-600"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    insightPreferences.averageMileage ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <CurrencyDollar weight="duotone" className="h-4 w-4 text-purple-500" />
                <p className="text-sm text-slate-700 dark:text-slate-300">Average Cost</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={insightPreferences.averageCost}
                onClick={() => setInsightPreferences(prev => ({ ...prev, averageCost: !prev.averageCost }))}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  insightPreferences.averageCost
                    ? "bg-emerald-500"
                    : "bg-slate-300 dark:bg-slate-600"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    insightPreferences.averageCost ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <ChartLine weight="duotone" className="h-4 w-4 text-purple-500" />
                <p className="text-sm text-slate-700 dark:text-slate-300">Price Trends</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={insightPreferences.priceTrends}
                onClick={() => setInsightPreferences(prev => ({ ...prev, priceTrends: !prev.priceTrends }))}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  insightPreferences.priceTrends
                    ? "bg-emerald-500"
                    : "bg-slate-300 dark:bg-slate-600"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    insightPreferences.priceTrends ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Gauge weight="duotone" className="h-4 w-4 text-purple-500" />
                <p className="text-sm text-slate-700 dark:text-slate-300">Efficiency</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={insightPreferences.efficiency}
                onClick={() => setInsightPreferences(prev => ({ ...prev, efficiency: !prev.efficiency }))}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  insightPreferences.efficiency
                    ? "bg-emerald-500"
                    : "bg-slate-300 dark:bg-slate-600"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    insightPreferences.efficiency ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Wrench weight="duotone" className="h-4 w-4 text-purple-500" />
                <p className="text-sm text-slate-700 dark:text-slate-300">Maintenance</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={insightPreferences.maintenance}
                onClick={() => setInsightPreferences(prev => ({ ...prev, maintenance: !prev.maintenance }))}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  insightPreferences.maintenance
                    ? "bg-emerald-500"
                    : "bg-slate-300 dark:bg-slate-600"
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    insightPreferences.maintenance ? "translate-x-5" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </Card>
      )}

      <Card className="px-5 py-6 space-y-4">
        <div>
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            Conversation History
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Set how long to save AI conversation history for context awareness.
          </p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-700 dark:text-slate-300">History Duration</p>
          </div>
          <div className="relative" ref={historyDropdownRef}>
            <button
              onClick={() => setIsHistoryDropdownOpen(!isHistoryDropdownOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-white/[0.06] hover:bg-slate-200 dark:hover:bg-white/[0.08] rounded-xl transition-colors border-0"
            >
              <span>{historyOptions.find(o => o.value === conversationHistoryDays)?.label || '7 days'}</span>
              <Motion.div
                animate={{ rotate: isHistoryDropdownOpen ? 180 : 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <CaretDown weight="duotone" className="w-4 h-4 text-slate-400" />
              </Motion.div>
            </button>

            <AnimatePresence>
              {isHistoryDropdownOpen && (
                <Motion.div
                  initial={{ opacity: 0, y: -10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    y: -10,
                    scale: 0.95,
                    transition: { duration: 0.15 },
                  }}
                  transition={{ type: "spring", stiffness: 300, damping: 25 }}
                  className="absolute right-0 top-10 w-32 bg-white/95 dark:bg-black/90 backdrop-blur-2xl border border-slate-200/50 dark:border-white/[0.1] rounded-2xl shadow-2xl overflow-hidden z-50 origin-top-right"
                >
                  <div className="p-1">
                    {historyOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setConversationHistoryDays(option.value);
                          setIsHistoryDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-xl transition-colors ${conversationHistoryDays === option.value ? "bg-emerald-500 text-white" : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.04]"}`}
                      >
                        <span>{option.label}</span>
                        {conversationHistoryDays === option.value && (
                          <Check className="w-4 h-4" />
                        )}
                      </button>
                    ))}
                  </div>
                </Motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Card>
    </section>
  );
}
