interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({ icon = "📭", title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <span className="text-4xl">{icon}</span>
      <h3 className="mt-3 font-heading font-semibold text-text">{title}</h3>
      {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
      {actionLabel && onAction && (
        <button onClick={onAction} className="mt-4 rounded-btn bg-forest-green px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-forest-green-dark">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
