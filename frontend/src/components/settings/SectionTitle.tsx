export default function SectionTitle({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-bold uppercase tracking-wider text-primary border-b border-border-secondary pb-1">
      {title}
    </h2>
  );
}
