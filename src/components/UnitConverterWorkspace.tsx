import React, { useMemo, useState } from 'react';
import { ArrowRightLeft, Copy, Check, Calculator, Volume2 } from 'lucide-react';
import {
  UNIT_CATEGORIES,
  convertUnitValue,
  formatConvertedNumber,
} from '../lib/unitDefinitions';

interface UnitConverterWorkspaceProps {
  categoryId: string;
  setCategoryId: (id: string) => void;
  fromUnitId: string;
  setFromUnitId: (id: string) => void;
  toUnitId: string;
  setToUnitId: (id: string) => void;
  inputValue: string;
  setInputValue: (v: string) => void;
  lastCalculatorAnswer: number;
  onSendToCalculator: (value: number, label: string) => void;
  onSpeakText: (text: string) => void;
}

export function UnitConverterWorkspace({
  categoryId,
  setCategoryId,
  fromUnitId,
  setFromUnitId,
  toUnitId,
  setToUnitId,
  inputValue,
  setInputValue,
  lastCalculatorAnswer,
  onSendToCalculator,
  onSpeakText,
}: UnitConverterWorkspaceProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const activeCategory = useMemo(
    () => UNIT_CATEGORIES.find((c) => c.id === categoryId) || UNIT_CATEGORIES[0],
    [categoryId]
  );

  const numericInput = useMemo(() => {
    const parsed = Number(inputValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [inputValue]);

  const fromUnit = useMemo(
    () => activeCategory.units.find((u) => u.id === fromUnitId) || activeCategory.units[0],
    [activeCategory, fromUnitId]
  );

  const toUnit = useMemo(
    () => activeCategory.units.find((u) => u.id === toUnitId) || activeCategory.units[1] || activeCategory.units[0],
    [activeCategory, toUnitId]
  );

  const primaryConverted = useMemo(() => {
    return convertUnitValue(activeCategory.id, fromUnit.id, toUnit.id, numericInput);
  }, [activeCategory.id, fromUnit.id, toUnit.id, numericInput]);

  const unitFactorNote = useMemo(() => {
    const oneUnit = convertUnitValue(activeCategory.id, fromUnit.id, toUnit.id, 1);
    return `1 ${fromUnit.symbol} = ${formatConvertedNumber(oneUnit)} ${toUnit.symbol}`;
  }, [activeCategory.id, fromUnit, toUnit]);

  const matrixRows = useMemo(() => {
    return activeCategory.units.map((u) => {
      const val = convertUnitValue(activeCategory.id, fromUnit.id, u.id, numericInput);
      return {
        unit: u,
        raw: val,
        formatted: formatConvertedNumber(val),
      };
    });
  }, [activeCategory, fromUnit.id, numericInput]);

  const handleSelectCategory = (catId: string) => {
    const cat = UNIT_CATEGORIES.find((c) => c.id === catId);
    if (!cat) return;
    setCategoryId(cat.id);
    setFromUnitId(cat.units[0].id);
    setToUnitId(cat.units[1]?.id || cat.units[0].id);
  };

  const handleSwap = () => {
    const prevFrom = fromUnit.id;
    const prevTo = toUnit.id;
    setFromUnitId(prevTo);
    setToUnitId(prevFrom);
  };

  const copyValue = async (id: string, val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="space-y-6">
      {/* Category Selector Bar */}
      <div className="bg-[#0B0F18] border border-slate-800 rounded-lg p-3">
        <div className="flex flex-wrap gap-1.5">
          {UNIT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => handleSelectCategory(cat.id)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeCategory.id === cat.id
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/40'
                  : 'bg-[#07090E] text-slate-400 border border-slate-800/90 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Primary Bidirectional Conversion Console */}
      <div className="bg-[#0B0F18] border border-slate-800 rounded-lg p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">
              {activeCategory.label} Conversion
            </h2>
            <p className="text-xs font-mono text-slate-400 mt-0.5 tabular-nums">
              {unitFactorNote}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setInputValue(String(lastCalculatorAnswer))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-800 bg-[#07090E] hover:border-slate-700 text-xs font-medium text-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Calculator className="w-3.5 h-3.5 text-cyan-400" />
              <span>Import ANS ({formatConvertedNumber(lastCalculatorAnswer)})</span>
            </button>
            <button
              type="button"
              onClick={() =>
                onSpeakText(
                  `${inputValue || 0} ${fromUnit.name} equals ${formatConvertedNumber(primaryConverted)} ${toUnit.name}`
                )
              }
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-800 bg-[#07090E] hover:border-slate-700 text-xs font-medium text-slate-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Volume2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Speak</span>
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
          {/* Source Input */}
          <div className="bg-[#07090E] border border-slate-800 rounded-md p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label htmlFor="unit-from-select" className="text-xs uppercase tracking-wider text-slate-400 font-medium">
                From
              </label>
              <select
                id="unit-from-select"
                value={fromUnit.id}
                onChange={(e) => setFromUnitId(e.target.value)}
                className="bg-[#0D111A] border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {activeCategory.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-baseline gap-2">
              <input
                type="number"
                step="any"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                aria-label="Source conversion value"
                className="w-full bg-transparent text-2xl sm:text-3xl font-mono font-bold text-white tabular-nums focus:outline-none"
              />
              <span className="text-sm font-mono text-slate-400 shrink-0">{fromUnit.symbol}</span>
            </div>
          </div>

          {/* Swap Control */}
          <div className="flex justify-center">
            <button
              type="button"
              onClick={handleSwap}
              className="w-11 h-11 rounded-md border border-slate-700 bg-[#0D111A] hover:bg-slate-800 hover:border-cyan-500/50 text-cyan-300 flex items-center justify-center transition-colors cursor-pointer"
              title="Swap source and target units"
            >
              <ArrowRightLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Target Output */}
          <div className="bg-[#07090E] border border-slate-800 rounded-md p-4">
            <div className="flex items-center justify-between gap-2 mb-2">
              <label htmlFor="unit-to-select" className="text-xs uppercase tracking-wider text-slate-400 font-medium">
                To
              </label>
              <select
                id="unit-to-select"
                value={toUnit.id}
                onChange={(e) => setToUnitId(e.target.value)}
                className="bg-[#0D111A] border border-slate-700 rounded px-2.5 py-1 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500"
              >
                {activeCategory.units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.symbol})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-2xl sm:text-3xl font-mono font-bold text-cyan-300 tabular-nums truncate">
                {formatConvertedNumber(primaryConverted)}
              </div>
              <span className="text-sm font-mono text-slate-400 shrink-0">{toUnit.symbol}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={() => copyValue('primary', formatConvertedNumber(primaryConverted))}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded border border-slate-800 bg-[#07090E] hover:border-slate-700 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
          >
            {copiedId === 'primary' ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
            <span>{copiedId === 'primary' ? 'Copied' : 'Copy Output'}</span>
          </button>
          <button
            type="button"
            onClick={() =>
              onSendToCalculator(
                primaryConverted,
                `${numericInput} ${fromUnit.symbol} → ${toUnit.symbol}`
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>Send to Calculator</span>
          </button>
        </div>
      </div>

      {/* Multi-Unit Equivalence Matrix */}
      <div className="bg-[#0B0F18] border border-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-800">
          <h3 className="text-sm font-medium text-slate-200">
            All {activeCategory.label} Equivalents
          </h3>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            Base: {numericInput} {fromUnit.symbol}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {matrixRows.map(({ unit, raw, formatted }) => {
            const isTarget = unit.id === toUnit.id;
            return (
              <div
                key={unit.id}
                className={`p-3 rounded-md border flex items-center justify-between gap-3 transition-colors ${
                  isTarget
                    ? 'border-cyan-500/40 bg-cyan-500/5'
                    : 'border-slate-800/80 bg-[#07090E]'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs text-slate-400 truncate">
                    {unit.name} <span className="font-mono text-slate-500">({unit.symbol})</span>
                  </div>
                  <div className="font-mono text-base font-semibold text-slate-100 tabular-nums truncate mt-0.5">
                    {formatted}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => copyValue(unit.id, formatted)}
                    className="p-1.5 rounded border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-slate-200 cursor-pointer"
                    title="Copy value"
                  >
                    {copiedId === unit.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onSendToCalculator(raw, `${numericInput} ${fromUnit.symbol} → ${unit.symbol}`)
                    }
                    className="p-1.5 rounded border border-slate-800 hover:border-cyan-500/40 text-slate-400 hover:text-cyan-300 cursor-pointer"
                    title="Use in Calculator"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
