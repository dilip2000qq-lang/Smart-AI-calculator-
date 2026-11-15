import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Mic, PanelTop, PanelTopClose, HelpCircle } from 'lucide-react';
import {
  AngleUnit,
  cleanNumericString,
  evaluateExpression,
  formatSciNumber,
  tryFastVoiceParse,
} from './lib/mathEngine';
import {
  convertUnitValue,
  findUnitMatch,
  formatConvertedNumber,
} from './lib/unitDefinitions';
import {
  CalculatorWorkspace,
  CalcHistoryItem,
} from './components/CalculatorWorkspace';
import { UnitConverterWorkspace } from './components/UnitConverterWorkspace';
import {
  VoiceCommandBar,
  VoiceCommandBarHandle,
  VoiceConversationTurn,
} from './components/VoiceCommandBar';
import { HelpModal } from './components/HelpModal';

type WorkspaceTab = 'calculator' | 'converter';

interface VoiceIntentResponse {
  action:
    | 'calculate'
    | 'convert'
    | 'graph'
    | 'clear'
    | 'memory_add'
    | 'memory_recall'
    | 'memory_clear'
    | 'reply';
  replyLanguage?: 'en' | 'hi';
  expression?: string;
  conversionCategory?: string;
  conversionValue?: number;
  conversionFrom?: string;
  conversionTo?: string;
  graphExpression?: string;
  spokenSummary: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('calculator');
  const [showTopBar, setShowTopBar] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  // Calculator state
  const [expression, setExpression] = useState('');
  const [lastAnswer, setLastAnswer] = useState(0);
  const [lastFormatted, setLastFormatted] = useState('0');
  const [evalError, setEvalError] = useState<string | null>(null);
  const [angleUnit, setAngleUnit] = useState<AngleUnit>(() => {
    try {
      const saved = window.localStorage.getItem('axiom_lab_angle_unit');
      if (saved === 'DEG' || saved === 'RAD' || saved === 'GRAD') {
        return saved;
      }
    } catch {
      // Ignore storage access errors
    }
    return 'DEG';
  });
  const [sciNotation, setSciNotation] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem('axiom_lab_sci_notation') === 'true';
    } catch {
      return false;
    }
  });
  const [memoryValue, setMemoryValue] = useState(0);
  const [history, setHistory] = useState<CalcHistoryItem[]>([]);
  const [graphExpression, setGraphExpression] = useState('sin(x) * cos(x/2)');
  const [calcRightTab, setCalcRightTab] = useState<'tape' | 'graph'>('tape');
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [lastEvalMeta, setLastEvalMeta] = useState<{ id: number; expression: string } | null>(null);

  // Persist angle unit and scientific notation preferences
  useEffect(() => {
    try {
      window.localStorage.setItem('axiom_lab_angle_unit', angleUnit);
    } catch {
      // Ignore storage access errors
    }
  }, [angleUnit]);

  useEffect(() => {
    try {
      window.localStorage.setItem('axiom_lab_sci_notation', String(sciNotation));
    } catch {
      // Ignore storage access errors
    }
    setLastFormatted(formatSciNumber(lastAnswer, sciNotation));
  }, [sciNotation, lastAnswer]);

  // Unit Converter state
  const [convCategoryId, setConvCategoryId] = useState('length');
  const [convFromUnitId, setConvFromUnitId] = useState('km');
  const [convToUnitId, setConvToUnitId] = useState('mi');
  const [convInputValue, setConvInputValue] = useState('1');

  // Voice Command & Two-Way AI Agent state
  const [voiceBarOpen, setVoiceBarOpen] = useState(false);
  const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(true);
  const [voiceLang, setVoiceLang] = useState<'hi' | 'en'>(() => {
    try {
      return window.localStorage.getItem('axiom_lab_voice_lang') === 'en' ? 'en' : 'hi';
    } catch {
      return 'hi';
    }
  });
  const [voiceProcessing, setVoiceProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastVoiceSummary, setLastVoiceSummary] = useState('');
  const [voiceConversation, setVoiceConversation] = useState<VoiceConversationTurn[]>([]);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const voiceBarRef = useRef<VoiceCommandBarHandle | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const speakRequestIdRef = useRef(0);

  useEffect(() => {
    try {
      window.localStorage.setItem('axiom_lab_voice_lang', voiceLang);
    } catch {
      // Ignore storage access errors
    }
  }, [voiceLang]);

  // Global keyboard shortcuts: Spacebar / Ctrl+M for voice trigger, Alt+1..2 for workspace tabs
  useEffect(() => {
    const onGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTextField =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        Boolean(target?.isContentEditable);
      const isInteractiveControl = tag === 'BUTTON' || tag === 'A';

      // Ctrl+M / Cmd+M works everywhere to toggle voice listening
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
        e.preventDefault();
        setVoiceBarOpen(true);
        voiceBarRef.current?.toggleListening();
        return;
      }

      // Spacebar triggers voice command when focus is not on a text field, button, or link
      if (
        (e.code === 'Space' || e.key === ' ') &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        !e.shiftKey &&
        !isTextField &&
        !isInteractiveControl
      ) {
        e.preventDefault();
        setVoiceBarOpen(true);
        voiceBarRef.current?.toggleListening();
        return;
      }

      // Escape stops active voice capture if listening
      if (e.key === 'Escape' && voiceBarRef.current?.isListening()) {
        e.preventDefault();
        voiceBarRef.current.stopListening();
        return;
      }

      // ? or F1 toggles bilingual Help modal (outside text inputs)
      if (
        (e.key === 'F1' || (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTextField))
      ) {
        e.preventDefault();
        setHelpOpen((prev) => !prev);
        return;
      }

      // Alt+1..2 switches workspaces cleanly
      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        if (e.key === '1') {
          e.preventDefault();
          setActiveTab('calculator');
        } else if (e.key === '2') {
          e.preventDefault();
          setActiveTab('converter');
        }
      }
    };

    window.addEventListener('keydown', onGlobalKeyDown);
    return () => window.removeEventListener('keydown', onGlobalKeyDown);
  }, []);

  const stopSpeaking = useCallback(() => {
    speakRequestIdRef.current += 1;
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const speakWithBrowserFallback = useCallback(
    (text: string, language?: 'en' | 'hi') => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setIsSpeaking(false);
        return;
      }
      window.speechSynthesis.cancel();
      const cleaned = cleanNumericString(text.trim());
      const hasDevanagari = /[\u0900-\u097F]/.test(cleaned);
      const targetLang = language === 'hi' || hasDevanagari ? 'hi' : 'en';

      let spokenText = cleaned;
      if (/^-?\d+$/.test(cleaned)) {
        const hiWords: Record<string, string> = {
          '0': 'शून्य', '1': 'एक', '2': 'दो', '3': 'तीन', '4': 'चार',
          '5': 'पांच', '6': 'छह', '7': 'सात', '8': 'आठ', '9': 'नौ',
          '10': 'दस', '11': 'ग्यारह', '12': 'बारह', '13': 'तेरह', '14': 'चौदह',
          '15': 'पंद्रह', '16': 'सोलह', '17': 'सत्रह', '18': 'अठारह', '19': 'उन्नीस', '20': 'बीस',
        };
        const enWords: Record<string, string> = {
          '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four',
          '5': 'five', '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine',
          '10': 'ten', '11': 'eleven', '12': 'twelve', '13': 'thirteen', '14': 'fourteen',
          '15': 'fifteen', '16': 'sixteen', '17': 'seventeen', '18': 'eighteen', '19': 'nineteen', '20': 'twenty',
        };
        const isNeg = cleaned.startsWith('-');
        const absStr = isNeg ? cleaned.slice(1) : cleaned;
        const word = targetLang === 'hi' ? hiWords[absStr] : enWords[absStr];
        if (word) {
          spokenText = isNeg ? `${targetLang === 'hi' ? 'माइनस' : 'minus'} ${word}` : word;
        }
      }

      const utter = new SpeechSynthesisUtterance(spokenText);
      utter.lang = targetLang === 'hi' ? 'hi-IN' : 'en-US';
      utter.rate = 1.0;
      utter.pitch = 1.0;
      utter.onend = () => setIsSpeaking(false);
      utter.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utter);
    },
    []
  );

  const speakText = useCallback(
    (text: string, language?: 'en' | 'hi') => {
      if (!text) return;
      stopSpeaking();
      const requestId = ++speakRequestIdRef.current;
      setIsSpeaking(true);

      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 6000);

      fetch('/api/voice/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }),
        signal: ctrl.signal,
      })
        .then(async (r) => {
          const d = (await r.json()) as { audioBase64?: string; mimeType?: string };
          if (!r.ok || !d.audioBase64) {
            throw new Error('TTS unavailable');
          }
          if (requestId !== speakRequestIdRef.current) return;

          const audio = new Audio(
            `data:${d.mimeType || 'audio/wav'};base64,${d.audioBase64}`
          );
          activeAudioRef.current = audio;
          audio.onended = () => {
            if (activeAudioRef.current === audio) activeAudioRef.current = null;
            setIsSpeaking(false);
          };
          audio.onerror = () => {
            if (activeAudioRef.current === audio) activeAudioRef.current = null;
            speakWithBrowserFallback(text, language);
          };
          await audio.play();
        })
        .catch(() => {
          if (requestId !== speakRequestIdRef.current) return;
          speakWithBrowserFallback(text, language);
        })
        .finally(() => {
          clearTimeout(timer);
        });
    },
    [stopSpeaking, speakWithBrowserFallback]
  );

  const recordHistory = useCallback(
    (
      expr: string,
      formatted: string,
      numericValue: number,
      source: CalcHistoryItem['source']
    ) => {
      const item: CalcHistoryItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        expression: expr,
        result: formatted,
        numericValue,
        angleUnit,
        source,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
      };
      setHistory((prev) => [item, ...prev].slice(0, 40));
    },
    [angleUnit]
  );

  const handleEvaluate = useCallback(
    (exprOverride?: string, source: CalcHistoryItem['source'] = 'keypad') => {
      const targetExpr = (exprOverride ?? expression).trim();
      if (!targetExpr) return null;

      const res = evaluateExpression(targetExpr, angleUnit, lastAnswer, sciNotation);
      if (!res.ok || res.value === undefined || !res.formatted) {
        setEvalError(res.error || 'Invalid expression');
        return null;
      }

      setEvalError(null);
      setExpression(targetExpr);
      setLastAnswer(res.value);
      setLastFormatted(res.formatted);
      setLastEvalMeta({ id: Date.now(), expression: targetExpr });
      recordHistory(targetExpr, res.formatted, res.value, source);
      return res;
    },
    [expression, angleUnit, lastAnswer, sciNotation, recordHistory]
  );

  const handleClearAll = useCallback(() => {
    setExpression('');
    setLastAnswer(0);
    setLastFormatted('0');
    setEvalError(null);
    setLastEvalMeta(null);
  }, []);

  const handleMemoryAction = useCallback(
    (op: 'MC' | 'MR' | 'M+' | 'M-' | 'MS') => {
      if (op === 'MC') {
        setMemoryValue(0);
      } else if (op === 'MR') {
        setExpression((prev) => prev + formatSciNumber(memoryValue));
      } else if (op === 'M+') {
        setMemoryValue((m) => m + lastAnswer);
      } else if (op === 'M-') {
        setMemoryValue((m) => m - lastAnswer);
      } else if (op === 'MS') {
        setMemoryValue(lastAnswer);
      }
    },
    [memoryValue, lastAnswer]
  );

  const appendConversationTurns = useCallback(
    (userText: string, assistantText: string, language?: 'en' | 'hi') => {
      const now = Date.now();
      setVoiceConversation((prev) => [
        ...prev.slice(-8),
        { id: `u-${now}`, role: 'user', text: userText },
        { id: `a-${now + 1}`, role: 'assistant', text: assistantText, language },
      ]);
    },
    []
  );

  const applyVoiceIntent = useCallback(
    (transcript: string, intent: VoiceIntentResponse) => {
      const lang: 'en' | 'hi' = /[\u0900-\u097F]/.test(transcript)
        ? 'hi'
        : intent.replyLanguage || voiceLang;
      setLastTranscript(transcript);

      const finishReply = (rawMsg: string) => {
        const msg = cleanNumericString(rawMsg);
        setLastVoiceSummary(msg);
        appendConversationTurns(transcript, msg, lang);
        if (voiceReplyEnabled && msg) {
          speakText(msg, lang);
        }
      };

      if (intent.action === 'calculate' && intent.expression) {
        setActiveTab('calculator');
        const res = handleEvaluate(intent.expression, 'voice');
        const msg = res?.formatted
          ? res.formatted
          : intent.spokenSummary || 'Could not evaluate expression';
        finishReply(msg);
        return;
      }

      if (
        intent.action === 'convert' &&
        intent.conversionFrom &&
        intent.conversionTo
      ) {
        const fromMatch = findUnitMatch(
          intent.conversionFrom,
          intent.conversionCategory
        );
        const toMatch = findUnitMatch(
          intent.conversionTo,
          fromMatch?.categoryId || intent.conversionCategory
        );
        const val = intent.conversionValue ?? 1;

        if (fromMatch && toMatch && fromMatch.categoryId === toMatch.categoryId) {
          setConvCategoryId(fromMatch.categoryId);
          setConvFromUnitId(fromMatch.unitId);
          setConvToUnitId(toMatch.unitId);
          setConvInputValue(String(val));
          setActiveTab('converter');

          const converted = convertUnitValue(
            fromMatch.categoryId,
            fromMatch.unitId,
            toMatch.unitId,
            val
          );
          const formattedConv = formatConvertedNumber(converted);
          const msg = `${formattedConv} ${intent.conversionTo}`;
          finishReply(msg);
          return;
        }
      }

      if (intent.action === 'graph' && intent.graphExpression) {
        setGraphExpression(intent.graphExpression);
        setCalcRightTab('graph');
        setRightPanelOpen(true);
        setActiveTab('calculator');
        const msg =
          lang === 'hi'
            ? `f(x) बराबर ${intent.graphExpression} का ग्राफ बना दिया है।`
            : `Plotting f of x equals ${intent.graphExpression}`;
        finishReply(msg);
        return;
      }

      if (intent.action === 'clear') {
        handleClearAll();
        finishReply(lang === 'hi' ? 'कैलकुलेटर साफ़ कर दिया गया है।' : 'Calculator cleared');
        return;
      }

      if (intent.action === 'memory_add') {
        handleMemoryAction('M+');
        finishReply(
          lang === 'hi'
            ? `${lastFormatted} को मेमोरी में जोड़ दिया गया है।`
            : `Added ${lastFormatted} to memory`
        );
        return;
      }

      if (intent.action === 'memory_recall') {
        handleMemoryAction('MR');
        const memStr = formatSciNumber(memoryValue);
        finishReply(
          lang === 'hi' ? `मेमोरी से ${memStr} वापस लाया गया।` : `Recalled ${memStr}`
        );
        return;
      }

      if (intent.action === 'memory_clear') {
        handleMemoryAction('MC');
        finishReply(lang === 'hi' ? 'मेमोरी साफ़ कर दी गई है।' : 'Memory cleared');
        return;
      }

      finishReply(intent.spokenSummary);
    },
    [
      handleEvaluate,
      voiceReplyEnabled,
      speakText,
      handleClearAll,
      handleMemoryAction,
      lastFormatted,
      memoryValue,
      appendConversationTurns,
      voiceLang,
    ]
  );

  const handleProcessVoiceTranscript = useCallback(
    async (transcript: string) => {
      setVoiceError(null);
      setLastTranscript(transcript);

      // Zero-latency local match for direct arithmetic/trig
      const fastExpr = tryFastVoiceParse(transcript);
      if (fastExpr) {
        applyVoiceIntent(transcript, {
          action: 'calculate',
          replyLanguage: /[\u0900-\u097F]/.test(transcript) ? 'hi' : voiceLang,
          expression: fastExpr,
          spokenSummary: fastExpr,
        });
        return;
      }

      setVoiceProcessing(true);
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 18000);
      try {
        const res = await fetch('/api/voice/interpret', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript,
            angleUnit,
            ans: lastAnswer,
            conversationHistory: voiceConversation.map((t) => ({
              role: t.role,
              text: t.text,
            })),
          }),
          signal: ctrl.signal,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Voice interpretation failed.');
        applyVoiceIntent(data.transcript || transcript, data.intent);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setVoiceError(
            voiceLang === 'hi'
              ? 'एआई जवाब देने में समय लग रहा है। कृपया फिर से प्रयास करें।'
              : 'AI Agent timed out. Please try again.'
          );
        } else {
          setVoiceError(err instanceof Error ? err.message : 'Unable to interpret voice command.');
        }
      } finally {
        clearTimeout(timer);
        setVoiceProcessing(false);
      }
    },
    [angleUnit, lastAnswer, voiceConversation, applyVoiceIntent, voiceLang]
  );

  const handleProcessAudioBlob = useCallback(
    async (audioBase64: string, mimeType: string) => {
      setVoiceError(null);
      setVoiceProcessing(true);
      try {
        const res = await fetch('/api/voice/interpret', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioBase64,
            audioMimeType: mimeType,
            angleUnit,
            ans: lastAnswer,
            conversationHistory: voiceConversation.map((t) => ({
              role: t.role,
              text: t.text,
            })),
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Audio transcription failed.');
        applyVoiceIntent(data.transcript || 'Audio command', data.intent);
      } catch (err) {
        setVoiceError(err instanceof Error ? err.message : 'Unable to transcribe audio.');
      } finally {
        setVoiceProcessing(false);
      }
    },
    [angleUnit, lastAnswer, voiceConversation, applyVoiceIntent]
  );

  const handleReceiveExternalValue = useCallback(
    (value: number, label: string) => {
      const formatted = formatSciNumber(value, sciNotation);
      setExpression(String(value));
      setLastAnswer(value);
      setLastFormatted(formatted);
      setEvalError(null);
      recordHistory(label, formatted, value, 'converter');
      setActiveTab('calculator');
    },
    [sciNotation, recordHistory]
  );

  const handleTransferToConverter = useCallback((val: number) => {
    setConvInputValue(String(val));
    setActiveTab('converter');
  }, []);

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 flex flex-col">
      {/* Collapsible Top Navigation Bar */}
      {showTopBar && (
        <header className="border-b border-slate-800/90 bg-[#07090E]">
          <div className="max-w-[1280px] mx-auto px-3 sm:px-6 min-h-14 py-2 sm:py-0 sm:h-16 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 sm:gap-8">
            {/* Zone 1: Single-line Wordmark */}
            <a
              href="#top"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('calculator');
              }}
              className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
            >
              Axiom Lab
            </a>

            {/* Zone 2: Concise single-line navigation links */}
            <nav className="order-3 sm:order-2 w-full sm:w-auto flex items-center gap-5 sm:gap-6 overflow-x-auto pb-1 sm:pb-0">
              {(
                [
                  ['calculator', 'Calculator'],
                  ['converter', 'Unit Converter'],
                ] as Array<[WorkspaceTab, string]>
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`text-sm font-medium py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeTab === id
                      ? 'text-cyan-300 border-cyan-400'
                      : 'text-slate-400 border-transparent hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {label}
                </button>
              ))}
            </nav>

            {/* Zone 3: Single Primary Action + Hide Toggle */}
            <div className="order-2 sm:order-3 flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (voiceBarOpen) {
                    voiceBarRef.current?.stopListening();
                    setVoiceBarOpen(false);
                  } else {
                    setVoiceBarOpen(true);
                  }
                }}
                aria-expanded={voiceBarOpen}
                aria-keyshortcuts="Space Control+M"
                title="Voice Command (Spacebar)"
                className={`inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  voiceBarOpen
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-[#111827] border border-slate-700 hover:border-cyan-500/50 text-slate-100'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Voice Command</span>
              </button>
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                aria-label="Open Help Guide"
                title="Help · सहायता (?)"
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-md border border-slate-800 bg-[#0B0F18] hover:border-cyan-500/50 text-xs font-medium text-slate-300 hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                <span>Help</span>
              </button>
              <button
                type="button"
                onClick={() => setShowTopBar(false)}
                aria-label="Hide top navigation bar"
                title="Hide top bar"
                className="p-2 rounded-md border border-slate-800 bg-[#0B0F18] hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                <PanelTopClose className="w-4 h-4" />
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Workspace Container */}
      <main className="flex-1 w-full max-w-[1280px] mx-auto px-3 py-4 sm:px-6 sm:py-6">
        {!showTopBar && (
          <div className="flex items-center justify-end gap-2 mb-3 sm:mb-4">
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              aria-label="Open Help Guide"
              title="Help · सहायता (?)"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-800 bg-[#0B0F18] hover:border-cyan-500/50 text-xs font-medium text-slate-300 hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
              <span>Help</span>
            </button>
            <button
              type="button"
              onClick={() => setShowTopBar(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-slate-800 bg-[#0B0F18] hover:border-cyan-500/50 text-xs font-medium text-slate-300 hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <PanelTop className="w-3.5 h-3.5 text-cyan-400" />
              <span>Show Top Bar</span>
            </button>
          </div>
        )}
        <VoiceCommandBar
          ref={voiceBarRef}
          isOpen={voiceBarOpen}
          onClose={() => setVoiceBarOpen(false)}
          onOpenHelp={() => setHelpOpen(true)}
          onProcessTranscript={handleProcessVoiceTranscript}
          onProcessAudioBlob={handleProcessAudioBlob}
          voiceReplyEnabled={voiceReplyEnabled}
          setVoiceReplyEnabled={setVoiceReplyEnabled}
          voiceLang={voiceLang}
          setVoiceLang={setVoiceLang}
          lastTranscript={lastTranscript}
          lastSummary={lastVoiceSummary}
          isProcessing={voiceProcessing}
          isSpeaking={isSpeaking}
          onStopSpeaking={stopSpeaking}
          onSpeakText={speakText}
          conversation={voiceConversation}
          voiceError={voiceError}
        />

        {activeTab === 'calculator' && (
          <CalculatorWorkspace
            expression={expression}
            setExpression={setExpression}
            lastAnswer={lastAnswer}
            lastFormatted={lastFormatted}
            evalError={evalError}
            angleUnit={angleUnit}
            setAngleUnit={setAngleUnit}
            sciNotation={sciNotation}
            setSciNotation={setSciNotation}
            memoryValue={memoryValue}
            onMemoryAction={handleMemoryAction}
            onEvaluate={handleEvaluate}
            onClearAll={handleClearAll}
            history={history}
            onClearHistory={() => setHistory([])}
            onSpeakText={speakText}
            voiceLang={voiceLang}
            graphExpression={graphExpression}
            setGraphExpression={setGraphExpression}
            rightTab={calcRightTab}
            setRightTab={setCalcRightTab}
            rightPanelOpen={rightPanelOpen}
            setRightPanelOpen={setRightPanelOpen}
            lastEvalMeta={lastEvalMeta}
            onTransferToConverter={handleTransferToConverter}
            voiceBarOpen={voiceBarOpen}
            onTriggerVoice={() => {
              setVoiceBarOpen(true);
              voiceBarRef.current?.toggleListening();
            }}
          />
        )}

        {activeTab === 'converter' && (
          <UnitConverterWorkspace
            categoryId={convCategoryId}
            setCategoryId={setConvCategoryId}
            fromUnitId={convFromUnitId}
            setFromUnitId={setConvFromUnitId}
            toUnitId={convToUnitId}
            setToUnitId={setConvToUnitId}
            inputValue={convInputValue}
            setInputValue={setConvInputValue}
            lastCalculatorAnswer={lastAnswer}
            onSendToCalculator={handleReceiveExternalValue}
            onSpeakText={speakText}
          />
        )}
      </main>

      <HelpModal
        isOpen={helpOpen}
        onClose={() => setHelpOpen(false)}
        onTryVoiceExample={(phrase) => {
          setVoiceBarOpen(true);
          void handleProcessVoiceTranscript(phrase);
        }}
      />
    </div>
  );
}
