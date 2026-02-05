export default function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-center h-full min-h-[400px]">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-[#1A1A2E] mb-2">{title}</h2>
        <p className="text-[#6B7280] text-sm max-w-md">{description}</p>
      </div>
    </div>
  );
}
