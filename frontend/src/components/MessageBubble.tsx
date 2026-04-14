import { useState } from 'react';
import { Message } from '../App';
import ConfidenceBadge from './ConfidenceBadge';

interface Props {
  message: Message;
}

export default function MessageBubble({ message }: Props) {
  const [showDetails, setShowDetails] = useState(false);

  // User message
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm leading-relaxed">
          {message.content}
        </div>
      </div>
    );
  }

  // Welcome message (no type metadata)
  if (!message.type) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-gray-800 leading-relaxed shadow-sm">
          {message.content}
        </div>
      </div>
    );
  }

  const isEscalation = message.type === 'escalation';
  const leftBorderClass = isEscalation ? 'border-l-amber-400' : 'border-l-green-500';
  const typeLabelClass = isEscalation
    ? 'bg-amber-100 text-amber-700 border border-amber-200'
    : 'bg-green-100 text-green-700 border border-green-200';
  const typeLabel = isEscalation ? 'Escalation' : 'Answer';

  return (
    <div className="flex justify-start">
      <div
        className={`max-w-[85%] bg-white border border-gray-200 border-l-4 ${leftBorderClass} rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm`}
      >
        {/* Type badge + confidence */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${typeLabelClass}`}
          >
            {typeLabel}
          </span>
          {message.confidence !== undefined && (
            <ConfidenceBadge confidence={message.confidence} type={message.type} />
          )}
        </div>

        {/* Message body */}
        <p className="text-sm text-gray-800 leading-relaxed">{message.content}</p>

        {/* Expandable decision details */}
        {message.reasoning && (
          <div className="mt-2.5">
            <button
              onClick={() => setShowDetails(v => !v)}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="text-[10px]">{showDetails ? '▲' : '▼'}</span>
              <span>Why this decision?</span>
            </button>

            {showDetails && (
              <div className="mt-2 pt-2 border-t border-gray-100 space-y-1.5">
                <p className="text-xs text-gray-500 leading-relaxed">{message.reasoning}</p>
                {message.retrievedArticles && message.retrievedArticles.length > 0 && (
                  <p className="text-xs text-gray-400">
                    <span className="font-medium">Sources:</span>{' '}
                    {message.retrievedArticles.join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
