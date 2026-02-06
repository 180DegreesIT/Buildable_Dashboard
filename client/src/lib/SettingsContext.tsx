import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { fetchAllSettings, type BrandingSettings, type AlertThreshold } from './settingsApi';

interface SettingsContextValue {
  branding: BrandingSettings;
  alertThresholds: AlertThreshold[];
  passThroughCategories: string[];
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const BRANDING_DEFAULTS: BrandingSettings = {
  companyName: 'Buildable',
  logoPath: null,
  primaryColour: '#4573D2',
  accentColour: '#4573D2',
};

const SettingsContext = createContext<SettingsContextValue>({
  branding: BRANDING_DEFAULTS,
  alertThresholds: [],
  passThroughCategories: [],
  loading: true,
  refreshSettings: async () => {},
});

export function useSettings() {
  return useContext(SettingsContext);
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [branding, setBranding] = useState<BrandingSettings>(BRANDING_DEFAULTS);
  const [alertThresholds, setAlertThresholds] = useState<AlertThreshold[]>([]);
  const [passThroughCategories, setPassThroughCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await fetchAllSettings();
      if (data.branding) {
        setBranding({ ...BRANDING_DEFAULTS, ...data.branding });
      }
      if (Array.isArray(data.alert_thresholds)) {
        setAlertThresholds(data.alert_thresholds);
      }
      if (Array.isArray(data.pass_through_categories)) {
        setPassThroughCategories(data.pass_through_categories);
      }
    } catch {
      // Use defaults on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SettingsContext.Provider value={{ branding, alertThresholds, passThroughCategories, loading, refreshSettings: load }}>
      {children}
    </SettingsContext.Provider>
  );
}
