import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Delete,
  RotateCcw,
  Volume2,
  Mic,
  TrendingUp,
  History,
  Trash2,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  Sigma,
  X,
} from 'lucide-react';
import {
  AngleUnit,
  EvalResult,
  evaluateExpression,
  sampleFunction,
  formatSciNumber,
} from '../lib/mathEngine';

export interface CalcHistoryItem {
  id: string;
  expression: string;
  result: string;
  numericValue: number;
  angleUnit: AngleUnit;
  source: 'keypad' | 'voice' | 'converter';
  timestamp: string;
}

interface CalculatorWorkspaceProps {
  expression: string;
  setExpression: React.Dispatch<React.SetStateAction<string>>;
  lastAnswer: number;
  lastFormatted: string;
  evalError: string | null;
  angleUnit: AngleUnit;
  setAngleUnit: (u: AngleUnit) => void;
  sciNotation: boolean;
  setSciNotation: (v: boolean) => void;
  memoryValue: number;
  onMemoryAction: (op: 'MC' | 'MR' | 'M+' | 'M-' | 'MS') => void;
  onEvaluate: (exprOverride?: string, source?: CalcHistoryItem['source']) => EvalResult | null;
  onClearAll: () => void;
  history: CalcHistoryItem[];
  onClearHistory: () => void;
  onSpeakText: (text: string, language?: 'en' | 'hi') => void;
  voiceLang?: 'hi' | 'en';
  graphExpression: string;
  setGraphExpression: (expr: string) => void;
  rightTab: 'tape' | 'graph';
  setRightTab: (tab: 'tape' | 'graph') => void;
  rightPanelOpen: boolean;
  setRightPanelOpen: (open: boolean) => void;
  lastEvalMeta?: { id: number; expression: string } | null;
  onTransferToConverter: (val: number) => void;
  voiceBarOpen: boolean;
  onTriggerVoice: () => void;
}

export function CalculatorWorkspace({
  expression,
  setExpression,
  lastAnswer,
  lastFormatted,
  evalError,
  angleUnit,
  setAngleUnit,
  sciNotation,
  setSciNotation,
  memoryValue,
  onMemoryAction,
  onEvaluate,
  onClearAll,
  history,
  onClearHistory,
  onSpeakText,
  voiceLang = 'hi',
  graphExpression,
  setGraphExpression,
  rightTab,
  setRightTab,
  rightPanelOpen,
  setRightPanelOpen,
  lastEvalMeta,
  onTransferToConverter,
  voiceBarOpen,
  onTriggerVoice,
}: CalculatorWorkspaceProps) {
  const [secondMode, setSecondMode] = useState(false);
  const [hypMode, setHypMode] = useState(false);
  const [showScientificKeys, setShowScientificKeys] = useState(false);
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [lastCompletedExpr, setLastCompletedExpr] = useState('');
  const [xRange, setXRange] = useState<{ min: number; max: number }>({ min: -10, max: 10 });
  const [hoverPoint, setHoverPoint] = useState<{ x: number; y: number } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const lastEvalIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (lastEvalMeta && lastEvalMeta.id !== lastEvalIdRef.current) {
      lastEvalIdRef.current = lastEvalMeta.id;
      setLastCompletedExpr(lastEvalMeta.expression);
      setJustEvaluated(true);
    } else if (!lastEvalMeta && lastEvalIdRef.current !== null) {
      lastEvalIdRef.current = null;
      setLastCompletedExpr('');
      setJustEvaluated(false);
    }
  }, [lastEvalMeta]);

  const livePreview = useMemo(() => {
    const trimmed = expression.trim();
    if (!trimmed) return null;
    const cleaned = trimmed.replace(/[+\-*/^]+$/, '').trim();
    if (!cleaned) return null;
    const res = evaluateExpression(cleaned, angleUnit, lastAnswer, sciNotation);
    return res.ok ? res.formatted ?? null : null;
  }, [expression, angleUnit, lastAnswer, sciNotation]);

  const pressDigitOrDot = (token: string) => {
    if (justEvaluated) {
      setExpression(token === '.' ? '0.' : token);
      setJustEvaluated(false);
      return;
    }

    setExpression((prev) => {
      if (token === '.') {
        const currentNumber = prev.split(/[+\-*/^()]/).pop() ?? '';
        if (currentNumber.includes('.')) return prev;
        return currentNumber === '' ? `${prev}0.` : `${prev}.`;
      }
      if (prev === '0') return token;
      return prev + token;
    });
  };

  const pressOperator = (op: '+' | '-' | '*' | '/' | '^') => {
    if (justEvaluated) {
      setExpression(`${lastAnswer}${op}`);
      setJustEvaluated(false);
      return;
    }

    setExpression((prev) => {
      const trimmed = prev.trimEnd();
      if (!trimmed) {
        if (op === '-') return '-';
        return `${lastAnswer !== 0 ? lastAnswer : 0}${op}`;
      }
      if (/[+\-*/^]$/.test(trimmed)) {
        return trimmed.slice(0, -1) + op;
      }
      return prev + op;
    });
  };

  const pressPercent = () => {
    if (justEvaluated) {
      setExpression(`${lastAnswer}%`);
      setJustEvaluated(false);
      return;
    }

    setExpression((prev) => {
      const trimmed = prev.trimEnd();
      if (!trimmed || /[+\-*/^(%]$/.test(trimmed)) return prev;
      return `${prev}%`;
    });
  };

  const pressSciToken = (token: string) => {
    const isPostfix = token.startsWith('^');
    if (justEvaluated) {
      setExpression(isPostfix ? `${lastAnswer}${token}` : token);
      setJustEvaluated(false);
      return;
    }
    setExpression((prev) => prev + token);
  };

  const handleBackspace = () => {
    if (justEvaluated) {
      setExpression('');
      setJustEvaluated(false);
      return;
    }
    setExpression((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setJustEvaluated(false);
    setLastCompletedExpr('');
    onClearAll();
  };

  const triggerEvaluate = () => {
    const trimmed = expression.trim().replace(/[+\-*/^]+$/, '').trim();
    if (!trimmed) return;
    const res = onEvaluate(trimmed, 'keypad');
    if (res && res.ok) {
      setLastCompletedExpr(trimmed);
      setJustEvaluated(true);
    }
  };

  // Global calculator keyboard shortcuts when active
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const isAnyInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);
      const isOtherInput = isAnyInput && target !== inputRef.current;
      if (isOtherInput) return;

      // Evaluate on Enter or '=' (both globally and inside expression input)
      if (e.key === 'Enter' || (e.key === '=' && !e.shiftKey)) {
        e.preventDefault();
        triggerEvaluate();
        return;
      }

      // Clear All on Escape (and Delete when not editing inside the text field)
      if (e.key === 'Escape' || (e.key === 'Delete' && target !== inputRef.current)) {
        e.preventDefault();
        handleClear();
        return;
      }

      // Let the user type freely inside the expression input box
      if (target === inputRef.current) return;

      // Spacebar is reserved for the global voice command trigger
      if (e.code === 'Space' || e.key === ' ') return;

      if (/^[0-9.]$/.test(e.key)) {
        e.preventDefault();
        pressDigitOrDot(e.key);
        return;
      }

      if (e.key === '+' || e.key === '-' || e.key === '*' || e.key === '/' || e.key === '^') {
        e.preventDefault();
        pressOperator(e.key);
        return;
      }

      if (e.key === '%') {
        e.preventDefault();
        pressPercent();
        return;
      }

      if (e.key === '(' || e.key === ')' || e.key === ',') {
        e.preventDefault();
        pressSciToken(e.key);
        return;
      }

      if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
        return;
      }

      // Accessible single-key scientific function shortcuts when outside text inputs
      const lower = e.key.toLowerCase();
      if (lower === 's') {
        e.preventDefault();
        pressSciToken('sin(');
      } else if (lower === 'c') {
        e.preventDefault();
        pressSciToken('cos(');
      } else if (lower === 't') {
        e.preventDefault();
        pressSciToken('tan(');
      } else if (lower === 'r') {
        e.preventDefault();
        pressSciToken('sqrt(');
      } else if (lower === 'l') {
        e.preventDefault();
        pressSciToken('ln(');
      } else if (lower === 'p') {
        e.preventDefault();
        pressSciToken('pi');
      } else if (lower === 'a') {
        e.preventDefault();
        pressSciToken('ANS');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // SVG Grapher data
  const graphData = useMemo(() => {
    const pts = sampleFunction(graphExpression, xRange.min, xRange.max, 220, angleUnit);
    const validYs = pts.map((p) => p.y).filter((y): y is number => y !== null);
    if (validYs.length === 0) {
      return { pts, yMin: -10, yMax: 10, pathD: '' };
    }
    let yMin = Math.min(...validYs);
    let yMax = Math.max(...validYs);
    if (Math.abs(yMax - yMin) < 1e-6) {
      yMin -= 5;
      yMax += 5;
    } else {
      const pad = (yMax - yMin) * 0.14;
      yMin -= pad;
      yMax += pad;
    }

    const W = 440;
    const H = 260;
    const toSvgX = (x: number) => ((x - xRange.min) / (xRange.max - xRange.min)) * W;
    const toSvgY = (y: number) => H - ((y - yMin) / (yMax - yMin)) * H;

    let d = '';
    let drawing = false;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      if (p.y === null) {
        drawing = false;
        continue;
      }
      const sx = toSvgX(p.x);
      const sy = toSvgY(p.y);
      if (!drawing) {
        d += `M ${sx.toFixed(2)} ${sy.toFixed(2)} `;
        drawing = true;
      } else {
        const prev = pts[i - 1];
        if (prev && prev.y !== null && Math.abs(p.y - prev.y) > (yMax - yMin) * 0.85) {
          d += `M ${sx.toFixed(2)} ${sy.toFixed(2)} `;
        } else {
          d += `L ${sx.toFixed(2)} ${sy.toFixed(2)} `;
        }
      }
    }

    return { pts, yMin, yMax, pathD: d };
  }, [graphExpression, xRange, angleUnit]);

  const trigLabel = (base: 'sin' | 'cos' | 'tan') => {
    if (hypMode && secondMode) return `a${base}h`;
    if (hypMode) return `${base}h`;
    if (secondMode) return `a${base}`;
    return base;
  };

  const sciButtonCls =
    'h-11 px-1.5 sm:px-2 rounded-md border border-slate-800 bg-[#0F141F] hover:bg-slate-800/80 hover:border-slate-700 active:scale-[0.98] text-slate-200 text-[11px] sm:text-xs font-mono font-medium transition-all duration-150 flex items-center justify-center whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500';
  const numButtonCls =
    'h-11 sm:h-12 px-2 sm:px-3 rounded-md border border-slate-800/90 bg-[#141A28] hover:bg-slate-800 hover:border-slate-700 active:scale-[0.98] text-slate-50 text-base font-mono font-semibold tabular-nums transition-all duration-150 flex items-center justify-center whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500';
  const opButtonCls =
    'h-11 sm:h-12 px-2 sm:px-3 rounded-md border border-slate-700/80 bg-[#111827] hover:bg-slate-800 hover:border-cyan-500/40 active:scale-[0.98] text-cyan-300 text-base font-mono font-semibold transition-all duration-150 flex items-center justify-center whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500';

  const toggleSidePanel = (tab: 'tape' | 'graph') => {
    if (rightPanelOpen && rightTab === tab) {
      setRightPanelOpen(false);
    } else {
      setRightTab(tab);
      setRightPanelOpen(true);
    }
  };

  return (
    <div
      className={
        rightPanelOpen
          ? 'grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start'
          : 'max-w-xl mx-auto'
      }
    >
      {/* Left Primary Console: LCD Display + Calculator Keypad */}
      <div
        className={`${
          rightPanelOpen ? 'lg:col-span-7 xl:col-span-7' : 'w-full'
        } bg-[#0B0F18] border border-slate-800 rounded-lg p-3.5 sm:p-5`}
      >
        {/* Calibrated Mode, History & Memory Strip */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-800/90">
          <div className="flex items-center gap-1 p-1 bg-[#07090E] border border-slate-800 rounded-md">
            {(['DEG', 'RAD', 'GRAD'] as AngleUnit[]).map((unit) => (
              <button
                key={unit}
                type="button"
                onClick={() => setAngleUnit(unit)}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  angleUnit === unit
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {unit}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => toggleSidePanel('tape')}
              aria-expanded={rightPanelOpen && rightTab === 'tape'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                rightPanelOpen && rightTab === 'tape'
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                  : 'bg-[#07090E] text-slate-300 border-slate-800 hover:border-cyan-500/40 hover:text-cyan-300'
              }`}
              title="Open Calculation History"
            >
              <History className="w-3.5 h-3.5 text-cyan-400" />
              <span>History{history.length > 0 ? ` (${history.length})` : ''}</span>
            </button>

            <button
              type="button"
              onClick={() => toggleSidePanel('graph')}
              aria-expanded={rightPanelOpen && rightTab === 'graph'}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                rightPanelOpen && rightTab === 'graph'
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                  : 'bg-[#07090E] text-slate-300 border-slate-800 hover:border-cyan-500/40 hover:text-cyan-300'
              }`}
              title="Open Function Plotter"
            >
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              <span>Graph</span>
            </button>

            <button
              type="button"
              onClick={() => setSciNotation(!sciNotation)}
              className={`px-2.5 py-1 text-xs font-mono rounded border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                sciNotation
                  ? 'bg-cyan-500/15 text-cyan-300 border-cyan-500/40'
                  : 'bg-[#07090E] text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
              title="Toggle Engineering/Scientific Notation"
            >
              SCI {sciNotation ? 'ON' : 'AUTO'}
            </button>

            <div className="text-xs font-mono text-slate-400 tabular-nums px-1">
              M: <span className="text-slate-200">{formatSciNumber(memoryValue)}</span>
            </div>
          </div>
        </div>

        {/* Precision Readout Viewport */}
        <div className="my-3.5 sm:my-4 bg-[#07090E] border border-slate-800 rounded-md p-3.5 sm:p-4">
          <div className="flex items-center justify-between gap-2 mb-1 min-h-[18px]">
            {justEvaluated && lastCompletedExpr ? (
              <button
                type="button"
                onClick={() => {
                  setJustEvaluated(false);
                  setExpression(lastCompletedExpr);
                  inputRef.current?.focus();
                }}
                className="text-xs font-mono text-slate-400 hover:text-cyan-300 truncate cursor-pointer text-left"
                title="Click to edit expression"
              >
                {lastCompletedExpr} =
              </button>
            ) : (
              <span className="text-xs font-mono text-slate-500 uppercase tracking-wider truncate">
                Expression Input
              </span>
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={justEvaluated ? '' : expression}
            onChange={(e) => {
              setJustEvaluated(false);
              setExpression(e.target.value);
            }}
            placeholder={justEvaluated ? 'Type or speak next...' : '0'}
            aria-label="Mathematical expression"
            className="w-full bg-transparent text-right font-mono text-xl sm:text-2xl text-slate-100 placeholder:text-slate-600 focus:outline-none tabular-nums"
          />

          <div className="mt-3 pt-3 border-t border-slate-800/80 flex flex-col-reverse sm:flex-row sm:items-end sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onTriggerVoice}
                aria-pressed={voiceBarOpen}
                aria-keyshortcuts="Space Control+M"
                className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  voiceBarOpen
                    ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-300'
                    : 'border-slate-800 bg-[#0D111A] hover:border-cyan-500/40 text-slate-300'
                }`}
                title="Voice Command (Spacebar)"
              >
                <Mic className="w-3.5 h-3.5 text-cyan-400" />
                <span>Voice</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onSpeakText(
                    !justEvaluated && livePreview ? livePreview : lastFormatted,
                    voiceLang
                  )
                }
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-800 bg-[#0D111A] hover:border-slate-700 text-xs font-medium text-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Read result aloud"
              >
                <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
                <span>Speak</span>
              </button>
              <button
                type="button"
                onClick={() => onTransferToConverter(lastAnswer)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded border border-slate-800 bg-[#0D111A] hover:border-slate-700 text-xs font-medium text-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                title="Convert this value in Unit Converter"
              >
                <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                <span>Convert</span>
              </button>
            </div>

            <div className="text-right min-w-0" aria-live="polite" aria-atomic="true">
              {evalError ? (
                <div className="text-sm font-mono text-rose-400 truncate" role="alert">
                  Error: {evalError}
                </div>
              ) : !justEvaluated && expression.trim() && livePreview !== null ? (
                <div className="text-2xl sm:text-3xl font-mono font-bold text-cyan-300 tabular-nums tracking-tight truncate">
                  = {livePreview}
                </div>
              ) : (
                <div className="text-3xl sm:text-4xl font-mono font-bold text-white tabular-nums tracking-tight truncate">
                  {lastFormatted}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Memory Register Row */}
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mb-3">
          {(['MC', 'MR', 'M+', 'M-', 'MS'] as const).map((memOp) => (
            <button
              key={memOp}
              type="button"
              onClick={() => onMemoryAction(memOp)}
              className="h-9 rounded border border-slate-800/80 bg-[#07090E] hover:bg-slate-800/80 text-xs font-mono font-medium text-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {memOp}
            </button>
          ))}
        </div>

        {/* Toggle for 4-Row Scientific Matrix */}
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setShowScientificKeys((prev) => !prev)}
            aria-expanded={showScientificKeys}
            className={`w-full h-9 px-3 rounded border text-xs font-mono font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${
              showScientificKeys
                ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                : 'border-slate-800/80 bg-[#07090E] hover:border-cyan-500/40 text-slate-300 hover:text-cyan-300'
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <Sigma className="w-3.5 h-3.5 text-cyan-400" />
              <span>
                {showScientificKeys ? 'Hide Scientific Functions' : 'Show Scientific Functions'}
              </span>
            </span>
            {showScientificKeys ? (
              <ChevronUp className="w-4 h-4 text-cyan-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>
        </div>

        {/* Scientific Matrix (4 Rows) */}
        {showScientificKeys && (
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2 mb-3">
            <button
              type="button"
              onClick={() => setSecondMode(!secondMode)}
              className={`${sciButtonCls} ${
                secondMode ? 'border-amber-500/60 bg-amber-500/15 text-amber-300' : ''
              }`}
            >
              2nd
            </button>
            <button
              type="button"
              onClick={() => setHypMode(!hypMode)}
              className={`${sciButtonCls} ${
                hypMode ? 'border-cyan-500/60 bg-cyan-500/15 text-cyan-300' : ''
              }`}
            >
              HYP
            </button>
            <button type="button" onClick={() => pressSciToken(`${trigLabel('sin')}(`)} className={sciButtonCls}>
              {trigLabel('sin')}
            </button>
            <button type="button" onClick={() => pressSciToken(`${trigLabel('cos')}(`)} className={sciButtonCls}>
              {trigLabel('cos')}
            </button>
            <button type="button" onClick={() => pressSciToken(`${trigLabel('tan')}(`)} className={sciButtonCls}>
              {trigLabel('tan')}
            </button>

            <button
              type="button"
              onClick={() => pressSciToken(secondMode ? '^(1/3)' : '^2')}
              className={sciButtonCls}
            >
              {secondMode ? 'x^(1/3)' : 'x²'}
            </button>
            <button
              type="button"
              onClick={() => (secondMode ? pressSciToken('nthRoot(') : pressOperator('^'))}
              className={sciButtonCls}
            >
              {secondMode ? 'ⁿ√x' : 'xʸ'}
            </button>
            <button
              type="button"
              onClick={() => pressSciToken(secondMode ? 'cbrt(' : 'sqrt(')}
              className={sciButtonCls}
            >
              {secondMode ? '∛x' : '√x'}
            </button>
            <button
              type="button"
              onClick={() => pressSciToken(secondMode ? '10^(' : 'log10(')}
              className={sciButtonCls}
            >
              {secondMode ? '10ˣ' : 'log₁₀'}
            </button>
            <button
              type="button"
              onClick={() => pressSciToken(secondMode ? 'e^(' : 'ln(')}
              className={sciButtonCls}
            >
              {secondMode ? 'eˣ' : 'ln'}
            </button>

            <button
              type="button"
              onClick={() => pressSciToken(secondMode ? '2^(' : 'log2(')}
              className={sciButtonCls}
            >
              {secondMode ? '2ˣ' : 'log₂'}
            </button>
            <button type="button" onClick={() => pressSciToken('abs(')} className={sciButtonCls}>
              |x|
            </button>
            <button type="button" onClick={() => pressSciToken('factorial(')} className={sciButtonCls}>
              n!
            </button>
            <button
              type="button"
              onClick={() => pressSciToken(secondMode ? 'nPr(' : 'nCr(')}
              className={sciButtonCls}
            >
              {secondMode ? 'nPr' : 'nCr'}
            </button>
            <button type="button" onClick={() => pressSciToken('^(-1)')} className={sciButtonCls}>
              1/x
            </button>

            <button type="button" onClick={() => pressSciToken('pi')} className={sciButtonCls}>
              π
            </button>
            <button type="button" onClick={() => pressSciToken('e')} className={sciButtonCls}>
              e
            </button>
            <button type="button" onClick={() => pressSciToken('phi')} className={sciButtonCls}>
              φ
            </button>
            <button type="button" onClick={() => pressSciToken('(')} className={sciButtonCls}>
              (
            </button>
            <button type="button" onClick={() => pressSciToken(')')} className={sciButtonCls}>
              )
            </button>
          </div>
        )}

        {/* Standard Numeric & Operator Keypad */}
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
          <button type="button" onClick={() => pressDigitOrDot('7')} className={numButtonCls}>
            7
          </button>
          <button type="button" onClick={() => pressDigitOrDot('8')} className={numButtonCls}>
            8
          </button>
          <button type="button" onClick={() => pressDigitOrDot('9')} className={numButtonCls}>
            9
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            aria-label="Backspace"
            aria-keyshortcuts="Backspace"
            className="h-11 sm:h-12 px-2 sm:px-3 rounded-md border border-slate-800 bg-[#141A28] hover:bg-slate-800 text-amber-300 font-mono text-sm flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            title="Backspace"
          >
            <Delete className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleClear}
            aria-label="All Clear"
            aria-keyshortcuts="Escape Delete"
            className="h-11 sm:h-12 px-2 sm:px-3 rounded-md border border-rose-900/50 bg-rose-950/30 hover:bg-rose-950/60 text-rose-300 font-mono text-sm font-semibold flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            title="All Clear (Esc)"
          >
            AC
          </button>

          <button type="button" onClick={() => pressDigitOrDot('4')} className={numButtonCls}>
            4
          </button>
          <button type="button" onClick={() => pressDigitOrDot('5')} className={numButtonCls}>
            5
          </button>
          <button type="button" onClick={() => pressDigitOrDot('6')} className={numButtonCls}>
            6
          </button>
          <button type="button" onClick={() => pressOperator('*')} aria-label="Multiply" className={opButtonCls}>
            ×
          </button>
          <button type="button" onClick={() => pressOperator('/')} aria-label="Divide" className={opButtonCls}>
            ÷
          </button>

          <button type="button" onClick={() => pressDigitOrDot('1')} className={numButtonCls}>
            1
          </button>
          <button type="button" onClick={() => pressDigitOrDot('2')} className={numButtonCls}>
            2
          </button>
          <button type="button" onClick={() => pressDigitOrDot('3')} className={numButtonCls}>
            3
          </button>
          <button type="button" onClick={() => pressOperator('+')} aria-label="Add" className={opButtonCls}>
            +
          </button>
          <button type="button" onClick={() => pressOperator('-')} aria-label="Subtract" className={opButtonCls}>
            −
          </button>

          <button type="button" onClick={() => pressDigitOrDot('0')} className={numButtonCls}>
            0
          </button>
          <button type="button" onClick={() => pressDigitOrDot('.')} className={numButtonCls}>
            .
          </button>
          <button type="button" onClick={pressPercent} aria-label="Percent" className={opButtonCls} title="Percent (%)">
            %
          </button>
          <button type="button" onClick={() => pressSciToken('ANS')} className={sciButtonCls + ' h-11 sm:h-12'}>
            ANS
          </button>
          <button
            type="button"
            onClick={triggerEvaluate}
            aria-label="Evaluate expression"
            aria-keyshortcuts="Enter ="
            className="h-11 sm:h-12 px-3 sm:px-4 rounded-md bg-cyan-500 hover:bg-cyan-400 active:scale-[0.98] text-slate-950 font-mono text-lg font-bold transition-all duration-150 flex items-center justify-center cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            =
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 font-mono">
          <span>Space: Voice · Enter / =: Evaluate · Esc: Clear</span>
          <span>0–9 + − * / % ( ) · s/c/t/r/l/p/a: Sci</span>
        </div>
      </div>

      {/* Right Column: History Tape & Live f(x) Function Grapher (Shown Only When Tapped) */}
      {rightPanelOpen && (
      <div className="lg:col-span-5 xl:col-span-5 bg-[#0B0F18] border border-slate-800 rounded-lg p-5">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-1 p-1 bg-[#07090E] border border-slate-800 rounded-md">
            <button
              type="button"
              onClick={() => setRightTab('tape')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                rightTab === 'tape'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>History Tape</span>
            </button>
            <button
              type="button"
              onClick={() => setRightTab('graph')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                rightTab === 'graph'
                  ? 'bg-slate-800 text-slate-100'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Function Plotter</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {rightTab === 'tape' && history.length > 0 && (
              <button
                type="button"
                onClick={onClearHistory}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-slate-400 hover:text-rose-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setRightPanelOpen(false)}
              aria-label="Close panel"
              title="Close panel"
              className="p-1.5 rounded border border-slate-800 bg-[#07090E] hover:border-slate-700 text-slate-400 hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {rightTab === 'tape' ? (
          <div className="mt-4">
            {history.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-800 rounded-md">
                <p className="text-sm text-slate-400">No calculations recorded yet.</p>
                <p className="text-xs text-slate-500 mt-1">
                  Try saying &ldquo;square root of 1728 plus sine of 45 degrees&rdquo; or enter an equation.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80 max-h-[430px] overflow-y-auto pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    className="py-3 flex items-center justify-between gap-4 hover:bg-slate-900/50 px-2 rounded transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setJustEvaluated(false);
                        setExpression(item.expression);
                      }}
                      className="text-left min-w-0 flex-1 cursor-pointer"
                      title="Click to load expression"
                    >
                      <div className="text-xs text-slate-500 flex items-center gap-2">
                        <span>{item.source === 'voice' ? 'Voice' : item.source === 'converter' ? 'Converter' : 'Keypad'}</span>
                        <span aria-hidden="true">·</span>
                        <span>{item.angleUnit}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{item.timestamp}</span>
                      </div>
                      <div className="font-mono text-sm text-slate-300 truncate mt-0.5">
                        {item.expression}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => pressSciToken(item.result)}
                      className="font-mono text-base font-semibold text-cyan-300 hover:text-cyan-200 tabular-nums shrink-0 cursor-pointer"
                      title="Insert result into expression"
                    >
                      = {item.result}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Quick Voice Command Reference */}
            <div className="mt-5 pt-4 border-t border-slate-800">
              <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2.5">
                Hands-Free Voice Examples
              </h3>
              <div className="space-y-1.5 text-xs text-slate-400">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-300">&ldquo;Cube root of 1728 plus cosine of 60 degrees&rdquo;</span>
                  <span className="font-mono text-slate-500 shrink-0">Calculate</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-300">&ldquo;Convert 88 miles per hour to meters per second&rdquo;</span>
                  <span className="font-mono text-slate-500 shrink-0">Convert</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-300">&ldquo;Plot sine of x times x squared&rdquo;</span>
                  <span className="font-mono text-slate-500 shrink-0">Graph</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-300">&ldquo;Distance from Tokyo to San Francisco&rdquo;</span>
                  <span className="font-mono text-slate-500 shrink-0">Map</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm text-cyan-400 shrink-0">f(x) =</span>
              <input
                type="text"
                value={graphExpression}
                onChange={(e) => setGraphExpression(e.target.value)}
                placeholder="sin(x) * x"
                className="flex-1 bg-[#07090E] border border-slate-800 rounded px-3 py-2 font-mono text-sm text-slate-100 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={() => setGraphExpression('sin(x) * cos(x/2)')}
                className="p-2 rounded border border-slate-800 bg-[#07090E] hover:border-slate-700 text-slate-400 hover:text-slate-200 cursor-pointer"
                title="Reset sample curve"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs text-slate-400">
                <span>x min</span>
                <input
                  type="number"
                  value={xRange.min}
                  onChange={(e) => setXRange((r) => ({ ...r, min: Number(e.target.value) || -10 }))}
                  className="mt-1 w-full bg-[#07090E] border border-slate-800 rounded px-2.5 py-1.5 font-mono text-xs text-slate-200 tabular-nums"
                />
              </label>
              <label className="block text-xs text-slate-400">
                <span>x max</span>
                <input
                  type="number"
                  value={xRange.max}
                  onChange={(e) => setXRange((r) => ({ ...r, max: Number(e.target.value) || 10 }))}
                  className="mt-1 w-full bg-[#07090E] border border-slate-800 rounded px-2.5 py-1.5 font-mono text-xs text-slate-200 tabular-nums"
                />
              </label>
            </div>

            <div className="relative bg-[#07090E] border border-slate-800 rounded-md p-2">
              <svg
                viewBox="0 0 440 260"
                className="w-full h-64 cursor-crosshair select-none"
                onMouseMove={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const nx = (e.clientX - rect.left) / rect.width;
                  const x = xRange.min + nx * (xRange.max - xRange.min);
                  const res = evaluateExpression(
                    graphExpression.replace(/\bx\b/g, `(${x})`),
                    angleUnit,
                    0
                  );
                  if (res.ok && res.value !== undefined && Number.isFinite(res.value)) {
                    setHoverPoint({ x, y: res.value });
                  } else {
                    setHoverPoint(null);
                  }
                }}
                onMouseLeave={() => setHoverPoint(null)}
              >
                {/* Grid lines */}
                {[0.25, 0.5, 0.75].map((frac) => (
                  <g key={frac}>
                    <line
                      x1={440 * frac}
                      y1={0}
                      x2={440 * frac}
                      y2={260}
                      stroke="#1E293B"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <line
                      x1={0}
                      y1={260 * frac}
                      x2={440}
                      y2={260 * frac}
                      stroke="#1E293B"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                  </g>
                ))}

                {/* Zero axes if in view */}
                {xRange.min < 0 && xRange.max > 0 && (
                  <line
                    x1={((-xRange.min) / (xRange.max - xRange.min)) * 440}
                    y1={0}
                    x2={((-xRange.min) / (xRange.max - xRange.min)) * 440}
                    y2={260}
                    stroke="#334155"
                    strokeWidth="1.2"
                  />
                )}
                {graphData.yMin < 0 && graphData.yMax > 0 && (
                  <line
                    x1={0}
                    y1={260 - ((-graphData.yMin) / (graphData.yMax - graphData.yMin)) * 260}
                    x2={440}
                    y2={260 - ((-graphData.yMin) / (graphData.yMax - graphData.yMin)) * 260}
                    stroke="#334155"
                    strokeWidth="1.2"
                  />
                )}

                {graphData.pathD && (
                  <path
                    d={graphData.pathD}
                    fill="none"
                    stroke="#06B6D4"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                )}
              </svg>

              <div className="flex items-center justify-between px-2 pt-2 border-t border-slate-800/80 text-xs font-mono text-slate-400 tabular-nums">
                <span>
                  y ∈ [{formatSciNumber(graphData.yMin)}, {formatSciNumber(graphData.yMax)}]
                </span>
                {hoverPoint ? (
                  <span className="text-cyan-300">
                    ({hoverPoint.x.toFixed(3)}, {formatSciNumber(hoverPoint.y)})
                  </span>
                ) : (
                  <span>Hover curve to probe (x, y)</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
