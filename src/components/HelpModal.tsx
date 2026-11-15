import React, { useEffect, useState } from 'react';
import { X, Mic, Keyboard, Sparkles, HelpCircle } from 'lucide-react';

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTryVoiceExample?: (phrase: string) => void;
}

interface VoiceCommandGroup {
  id: string;
  titleEn: string;
  titleHi: string;
  items: Array<{
    en: string;
    hi: string;
    noteEn: string;
    noteHi: string;
  }>;
}

interface ShortcutItem {
  keys: string[];
  en: string;
  hi: string;
}

const VOICE_COMMAND_GROUPS: VoiceCommandGroup[] = [
  {
    id: 'arithmetic',
    titleEn: 'Basic Arithmetic',
    titleHi: 'सामान्य गणित',
    items: [
      {
        en: 'what is 2 + 2',
        hi: '2 + 2 कितना होता है',
        noteEn: 'Instant addition, subtraction, multiplication, division',
        noteHi: 'तुरंत जोड़, घटाव, गुणा और भाग',
      },
      {
        en: '15 times 4',
        hi: '10 गुना 5',
        noteEn: 'Multiply numbers ("times", "into", "गुणा", "गुना")',
        noteHi: 'गुणा करने के लिए बोलें',
      },
      {
        en: '100 divided by 5',
        hi: '20 भागा 4',
        noteEn: 'Divide numbers ("divided by", "over", "भाग", "बटे")',
        noteHi: 'भाग देने के लिए बोलें',
      },
      {
        en: 'two plus two',
        hi: 'दो और दो कितना होगा',
        noteEn: 'Spoken number words in English & Hindi',
        noteHi: 'हिंदी और अंग्रेज़ी शब्दों में संख्याएं',
      },
    ],
  },
  {
    id: 'powers',
    titleEn: 'Powers, Roots & Percent',
    titleHi: 'घात, वर्गमूल और प्रतिशत',
    items: [
      {
        en: '25 squared',
        hi: '25 का स्क्वायर',
        noteEn: 'Square or cube ("squared", "cubed", "वर्ग", "घन")',
        noteHi: 'किसी संख्या का वर्ग या घन निकालें',
      },
      {
        en: 'square root of 144',
        hi: '144 का वर्गमूल',
        noteEn: 'Square root & cube root',
        noteHi: 'वर्गमूल या घनमूल निकालें',
      },
      {
        en: '10 percent of 200',
        hi: '200 का 10 प्रतिशत',
        noteEn: 'Percentage calculations',
        noteHi: 'प्रतिशत की गणना करें',
      },
    ],
  },
  {
    id: 'scientific',
    titleEn: 'Scientific & Graphing',
    titleHi: 'वैज्ञानिक और ग्राफ',
    items: [
      {
        en: 'sine of 30 degrees',
        hi: 'साइन 30 डिग्री का मान',
        noteEn: 'sin, cos, tan, ln, log (respects DEG / RAD / GRAD)',
        noteHi: 'त्रिकोणमिति और लॉग (DEG/RAD मोड के अनुसार)',
      },
      {
        en: 'plot sin(x) * cos(x/2)',
        hi: 'x^2 का ग्राफ बनाओ',
        noteEn: 'Opens interactive f(x) function grapher',
        noteHi: 'फंक्शन का लाइव ग्राफ खोलता है',
      },
    ],
  },
  {
    id: 'converter-memory',
    titleEn: 'Unit Converter, Memory & AI Chat',
    titleHi: 'यूनिट कन्वर्टर, मेमोरी और एआई बातचीत',
    items: [
      {
        en: 'convert 10 kilometers to miles',
        hi: '100 किलोमीटर को मील में बदलो',
        noteEn: 'Switches to Unit Converter with converted result',
        noteHi: 'यूनिट कन्वर्टर में बदलकर मान दिखाता है',
      },
      {
        en: 'clear calculator / add to memory / recall memory',
        hi: 'कैलकुलेटर साफ़ करो / मेमोरी में जोड़ो / मेमोरी दिखाओ',
        noteEn: 'Hands-free clear and M+ / MR / MC control',
        noteHi: 'बिना छुए क्लियर और मेमोरी कंट्रोल',
      },
      {
        en: 'Explain the Pythagorean theorem',
        hi: 'नमस्ते, तुम कैसे हो?',
        noteEn: 'Ask general math/science questions or chat with AI Agent',
        noteHi: 'एआई एजेंट से हिंदी या अंग्रेज़ी में बातचीत करें',
      },
    ],
  },
];

const KEYBOARD_SHORTCUTS: ShortcutItem[] = [
  {
    keys: ['Space'],
    en: 'Start or stop Voice AI microphone (when not typing in a text field)',
    hi: 'वॉइस एआई माइक चालू या बंद करें (टेक्स्ट बॉक्स से बाहर)',
  },
  {
    keys: ['Ctrl', 'M'],
    en: 'Toggle Voice AI bar & microphone from anywhere (Cmd + M on Mac)',
    hi: 'कहीं से भी वॉइस एआई बार और माइक चालू/बंद करें',
  },
  {
    keys: ['Enter', '='],
    en: 'Evaluate current expression',
    hi: 'लिखे हुए समीकरण का उत्तर निकालें',
  },
  {
    keys: ['Backspace'],
    en: 'Delete last character',
    hi: 'आखिरी अंक या चिह्न हटाएं',
  },
  {
    keys: ['Esc'],
    en: 'Stop listening / Close Help modal / Clear All (AC)',
    hi: 'सुनना बंद करें / हेल्प बंद करें / कैलकुलेटर साफ़ करें',
  },
  {
    keys: ['0–9', '+ - * / ^ % ( )'],
    en: 'Direct numeric, operator, percentage, and bracket input',
    hi: 'सीधे संख्या, ऑपरेटर, प्रतिशत और कोष्ठक टाइप करें',
  },
  {
    keys: ['s', 'c', 't'],
    en: 'Insert sin(, cos(, or tan(',
    hi: 'sin(, cos( या tan( जोड़ें',
  },
  {
    keys: ['r', 'l', 'p', 'a'],
    en: 'Insert sqrt(, ln(, π (pi), or ANS (last answer)',
    hi: 'sqrt( (वर्गमूल), ln(, π (पाई) या ANS (पिछला उत्तर) जोड़ें',
  },
  {
    keys: ['Alt', '1 / 2'],
    en: 'Switch between Calculator (Alt+1) and Unit Converter (Alt+2)',
    hi: 'कैलकुलेटर (Alt+1) और यूनिट कन्वर्टर (Alt+2) के बीच बदलें',
  },
  {
    keys: ['?', 'F1'],
    en: 'Open or close this Help guide',
    hi: 'यह हेल्प गाइड खोलें या बंद करें',
  },
];

export function HelpModal({ isOpen, onClose, onTryVoiceExample }: HelpModalProps) {
  const [sectionFilter, setSectionFilter] = useState<'all' | 'voice' | 'shortcuts'>('all');

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-modal-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-4xl max-h-[88vh] flex flex-col bg-[#0B0F18] border border-slate-700/90 rounded-lg shadow-2xl overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-800 flex items-start sm:items-center justify-between gap-3 bg-[#07090E]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-cyan-400 shrink-0" />
              <h2
                id="help-modal-title"
                className="font-display text-base sm:text-lg font-bold text-white"
              >
                Help Guide · सहायता गाइड
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Bilingual Voice Commands &amp; Keyboard Shortcuts (English / हिन्दी)
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close help modal"
            className="p-2 rounded-md border border-slate-800 bg-[#0B0F18] hover:border-slate-600 text-slate-300 hover:text-white transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Section Filter Bar */}
        <div className="px-4 sm:px-6 py-2.5 border-b border-slate-800/80 bg-[#0B0F18] flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 p-1 bg-[#07090E] border border-slate-800 rounded-md">
            {(
              [
                ['all', 'All · सभी'],
                ['voice', 'Voice Commands · वॉइस कमांड'],
                ['shortcuts', 'Shortcuts · शॉर्टकट'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSectionFilter(key)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  sectionFilter === key
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {onTryVoiceExample && (
            <span className="text-[11px] font-mono text-slate-500">
              Tip: Tap any voice phrase to test it live
            </span>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {(sectionFilter === 'all' || sectionFilter === 'voice') && (
            <section aria-labelledby="help-voice-heading" className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <Mic className="w-4 h-4 text-cyan-400" />
                <h3
                  id="help-voice-heading"
                  className="font-display text-sm font-semibold text-white uppercase tracking-wider"
                >
                  Voice Commands · वॉइस कमांड (English &amp; हिन्दी)
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {VOICE_COMMAND_GROUPS.map((group) => (
                  <div
                    key={group.id}
                    className="bg-[#07090E] border border-slate-800 rounded-md p-3.5 space-y-3"
                  >
                    <div className="border-b border-slate-800/80 pb-2">
                      <div className="text-xs font-semibold text-cyan-300">
                        {group.titleEn}
                      </div>
                      <div className="text-xs text-slate-400">{group.titleHi}</div>
                    </div>

                    <div className="space-y-2.5">
                      {group.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="p-2.5 rounded border border-slate-800/80 bg-[#0B0F18] space-y-1.5"
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            {onTryVoiceExample ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onTryVoiceExample(item.en);
                                  onClose();
                                }}
                                title="Run English voice command"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/80 hover:bg-cyan-500/20 border border-slate-700 hover:border-cyan-500/40 font-mono text-xs text-slate-100 hover:text-cyan-200 transition-colors cursor-pointer text-left"
                              >
                                <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
                                <span>&ldquo;{item.en}&rdquo;</span>
                              </button>
                            ) : (
                              <span className="font-mono text-xs text-slate-100">
                                &ldquo;{item.en}&rdquo;
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-1.5">
                            {onTryVoiceExample ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onTryVoiceExample(item.hi);
                                  onClose();
                                }}
                                title="Run Hindi voice command"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800/60 hover:bg-amber-500/15 border border-slate-700/80 hover:border-amber-500/40 text-xs text-amber-200 transition-colors cursor-pointer text-left"
                              >
                                <Sparkles className="w-3 h-3 text-amber-400 shrink-0" />
                                <span>&ldquo;{item.hi}&rdquo;</span>
                              </button>
                            ) : (
                              <span className="text-xs text-amber-200">
                                &ldquo;{item.hi}&rdquo;
                              </span>
                            )}
                          </div>

                          <div className="text-[11px] text-slate-400 leading-relaxed">
                            <span>{item.noteEn}</span>
                            <span className="mx-1.5 text-slate-600">·</span>
                            <span className="text-slate-300">{item.noteHi}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {(sectionFilter === 'all' || sectionFilter === 'shortcuts') && (
            <section aria-labelledby="help-shortcuts-heading" className="space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                <Keyboard className="w-4 h-4 text-cyan-400" />
                <h3
                  id="help-shortcuts-heading"
                  className="font-display text-sm font-semibold text-white uppercase tracking-wider"
                >
                  Keyboard Shortcuts · कीबोर्ड शॉर्टकट
                </h3>
              </div>

              <div className="bg-[#07090E] border border-slate-800 rounded-md divide-y divide-slate-800/80">
                {KEYBOARD_SHORTCUTS.map((sc, idx) => (
                  <div
                    key={idx}
                    className="px-3.5 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4"
                  >
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0 sm:min-w-[180px]">
                      {sc.keys.map((k) => (
                        <kbd
                          key={k}
                          className="px-2 py-1 rounded border border-slate-700 bg-[#0D111A] font-mono text-xs font-semibold text-cyan-300"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>

                    <div className="flex-1 text-xs space-y-0.5 sm:text-right">
                      <div className="text-slate-200">{sc.en}</div>
                      <div className="text-slate-400">{sc.hi}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 sm:px-6 py-3 border-t border-slate-800 bg-[#07090E] flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">
            Press <kbd className="px-1.5 py-0.5 rounded border border-slate-700 bg-[#0D111A] font-mono text-[11px] text-slate-200">Esc</kbd> to close · बंद करने के लिए Esc दबाएं
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Close · बंद करें
          </button>
        </div>
      </div>
    </div>
  );
}
