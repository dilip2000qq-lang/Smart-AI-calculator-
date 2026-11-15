import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
} from 'react';
import {
  Mic,
  Volume2,
  VolumeX,
  Loader2,
  Sparkles,
  Square,
  Globe,
  ShieldAlert,
  HelpCircle,
} from 'lucide-react';

export interface VoiceConversationTurn {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  language?: 'en' | 'hi';
}

export interface VoiceCommandBarHandle {
  toggleListening: () => void;
  stopListening: () => void;
  isListening: () => boolean;
}

interface VoiceCommandBarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenHelp?: () => void;
  onProcessTranscript: (transcript: string) => Promise<void>;
  onProcessAudioBlob: (audioBase64: string, mimeType: string) => Promise<void>;
  voiceReplyEnabled: boolean;
  setVoiceReplyEnabled: (v: boolean) => void;
  voiceLang: 'hi' | 'en';
  setVoiceLang: (lang: 'hi' | 'en') => void;
  lastTranscript: string;
  lastSummary: string;
  isProcessing: boolean;
  isSpeaking: boolean;
  onStopSpeaking: () => void;
  onSpeakText: (text: string, language?: 'en' | 'hi') => void;
  conversation: VoiceConversationTurn[];
  voiceError: string | null;
}

interface SpeechRecognitionEventLike {
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [subIndex: number]: { transcript: string };
    };
  };
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: SpeechRecognitionEventLike) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export const VoiceCommandBar = forwardRef<VoiceCommandBarHandle, VoiceCommandBarProps>(
  function VoiceCommandBar(
    {
      isOpen,
      onClose,
      onOpenHelp,
      onProcessTranscript,
      onProcessAudioBlob,
      voiceReplyEnabled,
      setVoiceReplyEnabled,
      voiceLang,
      setVoiceLang,
      lastTranscript,
      lastSummary,
      isProcessing,
      isSpeaking,
      onStopSpeaking,
      onSpeakText,
      conversation,
      voiceError,
    },
    ref
  ) {
    const [isListening, setIsListening] = useState(false);
    const [captureMode, setCaptureMode] = useState<'speech' | 'audio'>('speech');
    const [micPermission, setMicPermission] = useState<
      'granted' | 'denied' | 'prompt' | 'unknown'
    >('unknown');
    const [interimText, setInterimText] = useState('');
    const [manualText, setManualText] = useState('');
    const [localMicError, setLocalMicError] = useState<string | null>(null);

    const isListeningRef = useRef(false);
    const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const finalTranscriptRef = useRef('');
    const hasProcessedSessionRef = useRef(false);

    const speechApiSupported =
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    const mediaRecorderSupported =
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== 'undefined';

    const setListeningState = useCallback((val: boolean) => {
      isListeningRef.current = val;
      setIsListening(val);
    }, []);

    // Check microphone permission status safely when browser supports Permissions API
    useEffect(() => {
      let mounted = true;
      let statusObj: PermissionStatus | null = null;
      if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
        navigator.permissions
          .query({ name: 'microphone' as PermissionName })
          .then((status) => {
            if (!mounted) return;
            statusObj = status;
            setMicPermission(status.state);
            status.onchange = () => {
              if (!mounted) return;
              setMicPermission(status.state);
              if (status.state === 'granted') {
                setLocalMicError(null);
              }
            };
          })
          .catch(() => {
            // Safari/Firefox do not expose microphone via permissions.query
          });
      }
      return () => {
        mounted = false;
        if (statusObj) statusObj.onchange = null;
      };
    }, []);

    useEffect(() => {
      return () => {
        try {
          recognitionRef.current?.stop();
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
        } catch {
          // Safe cleanup
        }
      };
    }, []);

    const stopAllCapture = useCallback(() => {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Ignore
      }
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // Ignore
      }
      setListeningState(false);
    }, [setListeningState]);

    const startMediaRecorder = useCallback(async () => {
      if (!mediaRecorderSupported) {
        setListeningState(false);
        setLocalMicError(
          'Microphone capture is not supported in this browser. Type your question below instead.'
        );
        return;
      }

      try {
        setLocalMicError(null);
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        setMicPermission('granted');
        const recorder = new MediaRecorder(stream);
        chunksRef.current = [];
        setCaptureMode('audio');

        recorder.ondataavailable = (ev) => {
          if (ev.data.size > 0) chunksRef.current.push(ev.data);
        };

        recorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
          if (blob.size < 256) return;
          const reader = new FileReader();
          reader.onloadend = () => {
            if (typeof reader.result === 'string') {
              void onProcessAudioBlob(reader.result, blob.type || 'audio/webm');
            }
          };
          reader.readAsDataURL(blob);
        };

        mediaRecorderRef.current = recorder;
        setListeningState(true);
        recorder.start();
      } catch (err) {
        setListeningState(false);
        const errName = err instanceof DOMException ? err.name : '';
        if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
          setMicPermission('denied');
          setLocalMicError(
            'Microphone permission denied. Please allow microphone access in your browser site settings.'
          );
        } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
          setLocalMicError('No microphone device found. Connect a mic or type your command below.');
        } else {
          setLocalMicError(
            'Unable to access microphone. Check browser permissions or type your command.'
          );
        }
      }
    }, [mediaRecorderSupported, onProcessAudioBlob, setListeningState]);

    const startCapture = useCallback(async () => {
      if (isProcessing || isListeningRef.current) return;
      onStopSpeaking();
      setInterimText('');
      setLocalMicError(null);
      finalTranscriptRef.current = '';
      hasProcessedSessionRef.current = false;

      if (micPermission === 'denied') {
        setLocalMicError(
          'Microphone permission is blocked. Enable microphone access in browser settings and retry.'
        );
        return;
      }

      if (speechApiSupported) {
        const Ctor =
          (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionInstance })
            .SpeechRecognition ||
          (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionInstance })
            .webkitSpeechRecognition;
        if (Ctor) {
          try {
            const rec = new Ctor();
            rec.continuous = false;
            rec.interimResults = true;
            rec.lang = voiceLang === 'hi' ? 'hi-IN' : 'en-US';
            let fellBackToAudio = false;

            rec.onresult = (event) => {
              // Recompute cleanly from results[0..length-1] to prevent duplicate numbers/words
              let finalized = '';
              let interim = '';
              for (let i = 0; i < event.results.length; i++) {
                const res = event.results[i];
                const piece = res[0]?.transcript || '';
                if (res.isFinal) {
                  finalized += piece + ' ';
                } else {
                  interim += piece + ' ';
                }
              }
              finalTranscriptRef.current = finalized.trim();
              setInterimText((finalized + interim).trim());
            };

            rec.onerror = (ev) => {
              setListeningState(false);
              if (ev.error === 'service-not-allowed' || ev.error === 'network') {
                fellBackToAudio = true;
                void startMediaRecorder();
              } else if (ev.error === 'not-allowed') {
                setMicPermission('denied');
                setLocalMicError(
                  'Microphone permission denied. Allow microphone access in browser settings.'
                );
              } else if (ev.error === 'audio-capture') {
                setLocalMicError('No microphone detected. Check your audio input device.');
              } else if (ev.error === 'no-speech') {
                setLocalMicError('No speech detected. Tap Start Mic and speak clearly.');
              }
            };

            rec.onend = () => {
              if (fellBackToAudio) return;
              setListeningState(false);
              const cleaned = (finalTranscriptRef.current || interimTextRef.current).trim();
              if (cleaned && !hasProcessedSessionRef.current) {
                hasProcessedSessionRef.current = true;
                setInterimText('');
                void onProcessTranscript(cleaned);
              }
            };

            setCaptureMode('speech');
            recognitionRef.current = rec;
            setListeningState(true);
            rec.start();
            return;
          } catch {
            setListeningState(false);
          }
        }
      }

      await startMediaRecorder();
    }, [
      isProcessing,
      onStopSpeaking,
      micPermission,
      speechApiSupported,
      voiceLang,
      setListeningState,
      onProcessTranscript,
      startMediaRecorder,
    ]);

    const interimTextRef = useRef('');
    useEffect(() => {
      interimTextRef.current = interimText;
    }, [interimText]);

    useImperativeHandle(
      ref,
      () => ({
        toggleListening: () => {
          if (isListeningRef.current) {
            stopAllCapture();
          } else {
            void startCapture();
          }
        },
        stopListening: () => {
          stopAllCapture();
        },
        isListening: () => isListeningRef.current,
      }),
      [startCapture, stopAllCapture]
    );

    if (!isOpen) return null;

    const displayedError = localMicError || voiceError;

    return (
      <section
        aria-label="AI voice agent controller"
        className="bg-[#0B0F18] border border-cyan-500/30 rounded-lg p-3 sm:p-4 mb-5"
      >
        <div className="flex flex-col gap-3">
          {/* Row 1: Microphone Start/Stop, Language Selector, Voice Output ON/OFF */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void startCapture()}
                disabled={isProcessing || isListening}
                aria-pressed={isListening}
                aria-keyshortcuts="Space"
                className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 min-h-[40px] rounded-md text-xs font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  isListening
                    ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-300'
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950'
                } disabled:opacity-60`}
              >
                {isProcessing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
                <span>
                  {isProcessing
                    ? 'Thinking...'
                    : isListening
                    ? captureMode === 'audio'
                      ? 'Recording...'
                      : 'Listening...'
                    : 'Start Mic'}
                </span>
              </button>

              <button
                type="button"
                onClick={stopAllCapture}
                disabled={!isListening}
                aria-label="Stop microphone"
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2 min-h-[40px] rounded-md border border-rose-500/40 bg-rose-500/15 hover:bg-rose-500/25 text-xs font-semibold text-rose-300 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>{captureMode === 'audio' && isListening ? 'Stop & Send' : 'Stop'}</span>
              </button>

              <div
                className="inline-flex items-center p-0.5 rounded-md border border-slate-800 bg-[#07090E]"
                role="group"
                aria-label="Speech recognition language"
              >
                <span className="pl-2 pr-1 text-cyan-400 hidden sm:inline-flex">
                  <Globe className="w-3.5 h-3.5" />
                </span>
                <button
                  type="button"
                  onClick={() => setVoiceLang('hi')}
                  className={`px-2.5 py-1.5 rounded text-xs font-mono font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    voiceLang === 'hi'
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  हिन्दी (HI)
                </button>
                <button
                  type="button"
                  onClick={() => setVoiceLang('en')}
                  className={`px-2.5 py-1.5 rounded text-xs font-mono font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    voiceLang === 'en'
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  EN
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const next = !voiceReplyEnabled;
                  setVoiceReplyEnabled(next);
                  if (!next) onStopSpeaking();
                }}
                aria-pressed={voiceReplyEnabled}
                className={`inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-md border text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  voiceReplyEnabled
                    ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300'
                    : 'border-slate-800 bg-[#07090E] text-slate-400 hover:text-slate-200'
                }`}
              >
                {voiceReplyEnabled ? (
                  <Volume2 className="w-3.5 h-3.5" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5" />
                )}
                <span>Voice {voiceReplyEnabled ? 'ON' : 'OFF'}</span>
              </button>

              {isSpeaking && (
                <button
                  type="button"
                  onClick={onStopSpeaking}
                  className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-md border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 text-xs font-medium text-amber-300 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Mute</span>
                </button>
              )}

              {onOpenHelp && (
                <button
                  type="button"
                  onClick={onOpenHelp}
                  aria-label="Open Help Guide"
                  title="Voice Commands & Shortcuts Help (?)"
                  className="inline-flex items-center gap-1 px-2.5 py-2 min-h-[40px] rounded-md border border-slate-800 bg-[#07090E] hover:border-cyan-500/40 text-xs font-medium text-slate-300 hover:text-cyan-300 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Help</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  stopAllCapture();
                  onStopSpeaking();
                  onClose();
                }}
                className="px-2.5 py-2 min-h-[40px] text-xs text-slate-400 hover:text-slate-200 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
              >
                Hide
              </button>
            </div>
          </div>

          {/* Row 2: Text / Manual AI Command Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!manualText.trim() || isProcessing) return;
              void onProcessTranscript(manualText.trim());
              setManualText('');
            }}
            className="w-full flex items-center gap-2 min-w-0"
          >
            <input
              type="text"
              value={manualText}
              onChange={(e) => setManualText(e.target.value)}
              placeholder={
                voiceLang === 'hi'
                  ? 'बोलिए या लिखिए (जैसे: 2 + 2 कितना होता है, 25 का स्क्वायर)'
                  : 'Speak or type a command (e.g. what is 2 + 2, sqrt of 144)'
              }
              aria-label="Ask AI voice agent"
              className="flex-1 min-w-0 bg-[#07090E] border border-slate-800 rounded-md px-3 py-2 min-h-[40px] text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="submit"
              disabled={isProcessing || !manualText.trim()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[40px] rounded-md border border-slate-700 bg-[#111827] hover:bg-slate-800 text-xs font-medium text-slate-200 disabled:opacity-40 cursor-pointer whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Ask</span>
            </button>
          </form>
        </div>

        {(isListening ||
          interimText ||
          conversation.length > 0 ||
          lastTranscript ||
          lastSummary ||
          displayedError ||
          micPermission === 'denied') && (
          <div
            aria-live="polite"
            className="mt-3 pt-3 border-t border-slate-800/80 space-y-2 text-xs"
          >
            {isListening && (
              <div className="font-mono text-amber-300">
                {captureMode === 'audio'
                  ? 'Recording audio... Speak clearly and tap "Stop & Send".'
                  : interimText
                  ? `Listening: "${interimText}"`
                  : voiceLang === 'hi'
                  ? 'सुन रहा हूँ... बोलिए (जैसे: "2 + 2 कितना होता है")'
                  : 'Listening... speak your math or question.'}
              </div>
            )}

            {conversation.length > 0 ? (
              <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {conversation.slice(-4).map((turn) => (
                  <div
                    key={turn.id}
                    className={`flex items-start justify-between gap-3 px-3 py-2 rounded border ${
                      turn.role === 'user'
                        ? 'bg-[#07090E] border-slate-800 text-slate-200'
                        : 'bg-cyan-950/20 border-cyan-500/30 text-cyan-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400 mr-2">
                        {turn.role === 'user' ? 'You:' : 'AI Agent:'}
                      </span>
                      <span
                        className={
                          turn.role === 'assistant' &&
                          /^-?[0-9.,eE+∞-]+$/.test(turn.text.trim())
                            ? 'font-mono text-base font-bold text-white tabular-nums break-words'
                            : 'break-words'
                        }
                      >
                        {turn.text}
                      </span>
                    </div>
                    {turn.role === 'assistant' && (
                      <button
                        type="button"
                        onClick={() => onSpeakText(turn.text, turn.language)}
                        title="Replay spoken response"
                        className="p-1.5 rounded hover:bg-cyan-500/20 text-cyan-300 shrink-0 cursor-pointer"
                      >
                        <Volume2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <>
                {!isListening && lastTranscript && (
                  <div className="text-slate-300">
                    You: <span className="font-mono text-white">&ldquo;{lastTranscript}&rdquo;</span>
                  </div>
                )}
                {lastSummary && <div className="text-cyan-300 font-mono">AI Agent: {lastSummary}</div>}
              </>
            )}

            {displayedError && (
              <div className="flex items-start gap-2 text-rose-400 bg-rose-950/20 border border-rose-900/40 rounded px-3 py-2" role="alert">
                <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{displayedError}</span>
              </div>
            )}
          </div>
        )}
      </section>
    );
  }
);
