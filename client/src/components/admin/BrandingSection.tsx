import { useState, useRef, useCallback, type DragEvent } from 'react';
import { useSettings } from '../../lib/SettingsContext';
import { updateBranding, uploadLogo, deleteLogo } from '../../lib/settingsApi';

const PRESET_COLOURS = [
  { hex: '#4573D2', label: 'Blue' },
  { hex: '#6AAF50', label: 'Green' },
  { hex: '#E8A442', label: 'Amber' },
  { hex: '#D94F4F', label: 'Red' },
  { hex: '#1A1A2E', label: 'Dark' },
];

const MAX_LOGO_SIZE = 2 * 1024 * 1024; // 2MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'];

export default function BrandingSection() {
  const { branding, refreshSettings } = useSettings();

  const [companyName, setCompanyName] = useState(branding.companyName);
  const [primaryColour, setPrimaryColour] = useState(branding.primaryColour);
  const [accentColour, setAccentColour] = useState(branding.accentColour);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(branding.logoPath);
  const [removeLogo, setRemoveLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync state when context changes (e.g. after save + refresh)
  // We use the branding prop as initial values but don't re-sync on every render
  // to preserve local edits

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return 'Invalid file type. Accepted: PNG, JPEG, SVG, WebP';
    }
    if (file.size > MAX_LOGO_SIZE) {
      return 'File too large. Maximum size is 2MB';
    }
    return null;
  };

  const handleFileSelect = (file: File) => {
    const error = validateFile(file);
    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setRemoveLogo(false);
    setMessage(null);
  };

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, []);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogo(true);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);

    try {
      // Upload new logo first if selected
      if (logoFile) {
        await uploadLogo(logoFile);
      } else if (removeLogo && branding.logoPath) {
        await deleteLogo();
      }

      // Update branding text fields
      await updateBranding({
        companyName,
        primaryColour,
        accentColour,
      });

      // Refresh global settings context so sidebar updates immediately
      await refreshSettings();

      setLogoFile(null);
      setRemoveLogo(false);
      setMessage({ type: 'success', text: 'Branding saved successfully' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to save branding' });
    } finally {
      setSaving(false);
    }
  };

  const hasChanges =
    companyName !== branding.companyName ||
    primaryColour !== branding.primaryColour ||
    accentColour !== branding.accentColour ||
    logoFile !== null ||
    removeLogo;

  return (
    <section id="branding" className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
      <h2 className="text-lg font-semibold text-[#1A1A2E] mb-1">Branding</h2>
      <p className="text-sm text-[#6B7280] mb-6">
        Customise the dashboard appearance with your company branding.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left column: form fields */}
        <div className="space-y-6">
          {/* Logo upload */}
          <div>
            <label className="block text-sm font-medium text-[#1A1A2E] mb-2">Company Logo</label>
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                dragOver
                  ? 'border-[#4573D2] bg-[#4573D2]/5'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {logoPreview ? (
                <div className="flex items-center justify-center">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="max-h-16 max-w-[200px] object-contain"
                  />
                </div>
              ) : (
                <div>
                  <svg className="mx-auto w-8 h-8 text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5a2.25 2.25 0 002.25-2.25V5.25a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z" />
                  </svg>
                  <p className="text-sm text-[#6B7280]">
                    Drag and drop a logo, or <span className="text-[#4573D2] font-medium">click to browse</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">PNG, JPEG, SVG, or WebP (max 2MB)</p>
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                className="hidden"
              />
            </div>
            {logoPreview && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveLogo();
                }}
                className="mt-2 text-sm text-[#D94F4F] hover:text-red-700 font-medium"
              >
                Remove logo
              </button>
            )}
          </div>

          {/* Company name */}
          <div>
            <label className="block text-sm font-medium text-[#1A1A2E] mb-2">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              maxLength={100}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-[#1A1A2E] focus:border-[#4573D2] focus:ring-1 focus:ring-[#4573D2]/20 transition-colors"
              placeholder="Your company name"
            />
            <p className="text-xs text-gray-400 mt-1">{companyName.length}/100 characters</p>
          </div>

          {/* Primary colour */}
          <div>
            <label className="block text-sm font-medium text-[#1A1A2E] mb-2">Primary Colour</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={primaryColour}
                onChange={(e) => setPrimaryColour(e.target.value)}
                className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={primaryColour}
                onChange={(e) => {
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
                    setPrimaryColour(e.target.value);
                  }
                }}
                className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono text-[#1A1A2E] focus:border-[#4573D2] focus:ring-1 focus:ring-[#4573D2]/20"
                placeholder="#4573D2"
              />
              <div className="flex gap-1.5">
                {PRESET_COLOURS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setPrimaryColour(c.hex)}
                    title={c.label}
                    className={`w-7 h-7 rounded-md border-2 transition-all ${
                      primaryColour === c.hex ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Accent colour */}
          <div>
            <label className="block text-sm font-medium text-[#1A1A2E] mb-2">Accent Colour</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accentColour}
                onChange={(e) => setAccentColour(e.target.value)}
                className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
              />
              <input
                type="text"
                value={accentColour}
                onChange={(e) => {
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(e.target.value)) {
                    setAccentColour(e.target.value);
                  }
                }}
                className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono text-[#1A1A2E] focus:border-[#4573D2] focus:ring-1 focus:ring-[#4573D2]/20"
                placeholder="#4573D2"
              />
              <div className="flex gap-1.5">
                {PRESET_COLOURS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setAccentColour(c.hex)}
                    title={c.label}
                    className={`w-7 h-7 rounded-md border-2 transition-all ${
                      accentColour === c.hex ? 'border-gray-800 scale-110' : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right column: live preview */}
        <div>
          <label className="block text-sm font-medium text-[#1A1A2E] mb-2">Preview</label>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            {/* Mini sidebar preview */}
            <div className="bg-white p-4 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                {logoPreview ? (
                  <img src={logoPreview} alt="" className="max-h-8 max-w-[120px] object-contain" />
                ) : (
                  <span className="text-sm font-bold tracking-tight" style={{ color: primaryColour }}>
                    {companyName || 'Company'}
                  </span>
                )}
              </div>
              {/* Sample nav items */}
              <div className="space-y-1">
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium"
                  style={{ backgroundColor: primaryColour + '1A', color: primaryColour }}
                >
                  <div className="w-3.5 h-3.5 rounded-sm" style={{ backgroundColor: primaryColour }} />
                  Executive Summary
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-gray-500">
                  <div className="w-3.5 h-3.5 rounded-sm bg-gray-300" />
                  Financial
                </div>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-gray-500">
                  <div className="w-3.5 h-3.5 rounded-sm bg-gray-300" />
                  Regional
                </div>
              </div>
            </div>
            {/* Mini header preview */}
            <div className="p-3 flex items-center justify-between" style={{ borderTop: `2px solid ${accentColour}` }}>
              <span className="text-xs text-gray-400">Top bar accent</span>
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                style={{ backgroundColor: primaryColour }}
              >
                DA
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Save button and status */}
      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !hasChanges}
          className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
            saving || !hasChanges
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-[#4573D2] text-white hover:bg-[#3b62b5]'
          }`}
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {message && (
          <p className={`text-sm font-medium ${message.type === 'success' ? 'text-[#6AAF50]' : 'text-[#D94F4F]'}`}>
            {message.text}
          </p>
        )}
      </div>
    </section>
  );
}
