import BrandingSection from './BrandingSection';
import PassThroughSection from './PassThroughSection';
import AlertThresholds from './AlertThresholds';
import SystemStatus from './SystemStatus';

export default function AdminSettings() {
  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#1A1A2E]">Admin Settings</h1>
        <p className="text-sm text-[#6B7280] mt-1">
          Configure system appearance, business rules, and integrations.
        </p>
      </div>

      <div className="space-y-8">
        <BrandingSection />
        <PassThroughSection />
        <AlertThresholds />
        <SystemStatus />
      </div>
    </div>
  );
}
