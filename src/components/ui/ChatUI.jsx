import { useState, useRef, useEffect } from 'react';
import { Robot, User, PaperPlaneRight, X, Download, Table, ArrowRight } from '@phosphor-icons/react';
import { cn } from './index';

// Helper component to render query results as a table
function QueryResultsTable({ data }) {
  if (!data || typeof data !== 'object') return null;

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
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      return (
        <div key={key} className={depth > 0 ? "ml-4 mt-2" : ""}>
          <div className="font-semibold text-xs uppercase text-slate-500 dark:text-slate-400 mb-1">
            {key}
          </div>
          {Object.entries(value).map(([k, v]) => renderRow(k, v, depth + 1))}
        </div>
      );
    }

    if (Array.isArray(value)) {
      return (
        <div key={key} className={depth > 0 ? "ml-4 mt-2" : ""}>
          <div className="font-semibold text-xs uppercase text-slate-500 dark:text-slate-400 mb-1">
            {key} ({value.length} items)
          </div>
          {value.slice(0, 5).map((item, idx) => (
            <div key={idx} className="text-xs text-slate-600 dark:text-slate-300 ml-4">
              {typeof item === 'object' ? JSON.stringify(item) : String(item)}
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
        <span className="text-xs text-slate-600 dark:text-slate-300">{key}</span>
        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">{renderValue(value)}</span>
      </div>
    );
  };

  return (
    <div className="mt-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700">
      {Object.entries(data).map(([key, value]) => renderRow(key, value))}
    </div>
  );
}

// Helper component for export buttons
function ExportButtons({ data, onExport }) {
  if (!data) return null;

  return (
    <div className="flex gap-2 mt-3">
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
    </div>
  );
}

export default function ChatUI({ 
  messages = [], 
  onSendMessage, 
  isLoading = false,
  onClose,
  onExport,
  placeholder = "Ask about your fuel data..."
}) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

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

  return (
    <div className="flex flex-col h-full">
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
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-xs">
                  "Show me fuel costs for January"
                </span>
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-xs">
                  "Compare my vehicles"
                </span>
                <span className="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-full text-xs">
                  "Export to Excel"
                </span>
              </div>
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div
              key={index}
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
                <p className="text-sm leading-6 whitespace-pre-wrap">{message.content}</p>
                {message.queryResults && (
                  <>
                    <QueryResultsTable data={message.queryResults} />
                    {onExport && (
                      <ExportButtons data={message.queryResults} onExport={handleExport} />
                    )}
                  </>
                )}
              </div>
              {message.role === 'user' && (
                <div className="flex-shrink-0 w-8 h-8 bg-slate-300 dark:bg-slate-600 rounded-xl flex items-center justify-center">
                  <User weight="fill" className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-3 justify-start">
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
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
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
