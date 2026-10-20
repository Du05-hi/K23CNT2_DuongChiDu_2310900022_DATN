import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';

interface DashboardAiResponseProps {
  content: string | null;
  isLoading: boolean;
  error: string | null;
  onAnalyze: () => void;
  title: string;
  buttonLabel: string;
}

const renderInlineMarkdown = (text: string) => {
  const pieces = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return pieces.map((piece, index) => {
    if (piece.startsWith('**') && piece.endsWith('**')) {
      return <strong key={index} className="font-semibold text-slate-900 dark:text-white">{piece.slice(2, -2)}</strong>;
    }
    if (piece.startsWith('`') && piece.endsWith('`')) {
      return <code key={index} className="rounded bg-slate-200/70 px-1 py-0.5 font-mono text-xs dark:bg-slate-800">{piece.slice(1, -1)}</code>;
    }
    return piece;
  });
};

const DashboardAiResponse: React.FC<DashboardAiResponseProps> = ({
  content,
  isLoading,
  error,
  onAnalyze,
  title,
  buttonLabel,
}) => {
  const safeContent = typeof content === 'string'
    ? content
    : Array.isArray(content)
    ? (content as any[]).map((c) => (typeof c === 'string' ? c : JSON.stringify(c))).join('\n')
    : content
    ? JSON.stringify(content, null, 2)
    : '';

  return (
    <section className="rounded-3xl border border-indigo-200 bg-gradient-to-r from-indigo-600/10 via-violet-600/10 to-slate-100 p-5 shadow-sm dark:border-indigo-500/40 dark:from-indigo-900/30 dark:via-violet-900/30 dark:to-slate-900">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-300">
            <Sparkles className="h-4 w-4 shrink-0" />
            {title}
          </div>
          {isLoading ? (
            <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
              <span>Đang phân tích dữ liệu thực tế</span>
              <span className="inline-flex gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500 [animation-delay:-0.1s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-indigo-500" />
              </span>
            </div>
          ) : error ? (
            <p role="alert" className="text-sm text-rose-600 dark:text-rose-300">{error}</p>
          ) : safeContent ? (
            <div className="space-y-2 text-sm leading-6 text-slate-700 dark:text-slate-200">
              {safeContent.split(/\r?\n/).map((rawLine, index) => {
                const line = rawLine.trim();
                if (!line) return null;
                const heading = line.match(/^#{1,3}\s+(.+)$/);
                if (heading) {
                  return <h4 key={index} className="pt-1 font-semibold text-slate-900 dark:text-white">{renderInlineMarkdown(heading[1])}</h4>;
                }
                const listItem = line.match(/^(?:[-*]|\d+[.)])\s+(.+)$/);
                if (listItem) {
                  return (
                    <p key={index} className="flex items-start gap-2 pl-1">
                      <span className="mt-0.5 text-indigo-500" aria-hidden="true">•</span>
                      <span>{renderInlineMarkdown(listItem[1])}</span>
                    </p>
                  );
                }
                return <p key={index}>{renderInlineMarkdown(line)}</p>;
              })}
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Chạy phân tích để nhận nhận xét dựa trên dữ liệu hiện tại.</p>
          )}
        </div>
        <button
          type="button"
          onClick={onAnalyze}
          disabled={isLoading}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 disabled:cursor-wait disabled:opacity-70 cursor-pointer"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {isLoading ? 'Đang phân tích...' : buttonLabel}
        </button>
      </div>
    </section>
  );
};

export default DashboardAiResponse;
