import { useState } from 'react';
import type { DataTypeDefinition, ParseResult, AutoMapResult, ApplyMappingResult } from '../../lib/api';
import DataTypeSelector from './DataTypeSelector';
import FileUploader from './FileUploader';
import ColumnMapper from './ColumnMapper';
import PreviewValidate from './PreviewValidate';
import ConfirmImport from './ConfirmImport';

export type WizardStep = 1 | 2 | 3 | 4 | 5;

export interface WizardState {
  dataType: DataTypeDefinition | null;
  file: File | null;
  parseResult: ParseResult | null;
  autoMapResult: AutoMapResult | null;
  mapping: Record<string, string>;
  savedMappingId: number | null;
  validationResult: ApplyMappingResult | null;
  duplicateStrategy: 'overwrite' | 'skip' | 'merge';
}

const STEP_LABELS = ['Select Data Type', 'Upload File', 'Map Columns', 'Preview & Validate', 'Import'];

export default function UploadWizard({ onNavigateHistory }: { onNavigateHistory: () => void }) {
  const [step, setStep] = useState<WizardStep>(1);
  const [state, setState] = useState<WizardState>({
    dataType: null,
    file: null,
    parseResult: null,
    autoMapResult: null,
    mapping: {},
    savedMappingId: null,
    validationResult: null,
    duplicateStrategy: 'skip',
  });

  function update(partial: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...partial }));
  }

  function reset() {
    setState({
      dataType: null,
      file: null,
      parseResult: null,
      autoMapResult: null,
      mapping: {},
      savedMappingId: null,
      validationResult: null,
      duplicateStrategy: 'skip',
    });
    setStep(1);
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Step indicator */}
      <div className="mb-8">
        <nav className="flex items-center justify-between">
          {STEP_LABELS.map((label, i) => {
            const stepNum = (i + 1) as WizardStep;
            const isActive = step === stepNum;
            const isCompleted = step > stepNum;
            return (
              <div key={i} className="flex items-center flex-1">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : isCompleted
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {isCompleted ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      stepNum
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium hidden sm:block ${
                      isActive ? 'text-indigo-700' : isCompleted ? 'text-indigo-600' : 'text-gray-400'
                    }`}
                  >
                    {label}
                  </span>
                </div>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`flex-1 h-px mx-3 ${isCompleted ? 'bg-indigo-300' : 'bg-gray-200'}`} />
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Step content */}
      {step === 1 && (
        <DataTypeSelector
          onSelect={(dt) => {
            update({ dataType: dt });
            setStep(2);
          }}
        />
      )}

      {step === 2 && state.dataType && (
        <FileUploader
          dataType={state.dataType}
          onParsed={(file, parseResult, autoMapResult) => {
            const mapping: Record<string, string> = autoMapResult?.mapping ?? {};
            update({
              file,
              parseResult,
              autoMapResult,
              mapping,
              savedMappingId: autoMapResult?.mappingId ?? null,
            });
            setStep(3);
          }}
          onBack={() => setStep(1)}
        />
      )}

      {step === 3 && state.dataType && state.parseResult && (
        <ColumnMapper
          dataType={state.dataType}
          parseResult={state.parseResult}
          autoMapResult={state.autoMapResult}
          initialMapping={state.mapping}
          onConfirm={(mapping, validationResult) => {
            update({ mapping, validationResult });
            setStep(4);
          }}
          onBack={() => setStep(2)}
        />
      )}

      {step === 4 && state.validationResult && state.dataType && (
        <PreviewValidate
          dataType={state.dataType}
          result={state.validationResult}
          duplicateStrategy={state.duplicateStrategy}
          onStrategyChange={(s) => update({ duplicateStrategy: s })}
          onConfirm={() => setStep(5)}
          onBack={() => setStep(3)}
        />
      )}

      {step === 5 && state.dataType && state.validationResult && state.file && (
        <ConfirmImport
          dataType={state.dataType}
          fileName={state.file.name}
          mapping={state.mapping}
          savedMappingId={state.savedMappingId}
          validationResult={state.validationResult}
          duplicateStrategy={state.duplicateStrategy}
          onDone={reset}
          onNavigateHistory={onNavigateHistory}
          onBack={() => setStep(4)}
        />
      )}
    </div>
  );
}
