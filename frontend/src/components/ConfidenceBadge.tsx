interface Props {
  confidence: number;
  type: 'answer' | 'escalation';
}

export default function ConfidenceBadge({ confidence, type }: Props) {
  const pct = Math.round(confidence * 100);

  // High-confidence escalations come from tier 1 (rule-based) or tier 2 (retrieval gate)
  // They don't need a percentage — just "Escalated"
  if (type === 'escalation' && confidence >= 0.85) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
        Escalated
      </span>
    );
  }

  if (confidence >= 0.7) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
        {pct}% · High
      </span>
    );
  }

  if (confidence >= 0.45) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
        {pct}% · Medium
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
      {pct > 0 ? `${pct}% · Low` : 'Low'}
    </span>
  );
}
