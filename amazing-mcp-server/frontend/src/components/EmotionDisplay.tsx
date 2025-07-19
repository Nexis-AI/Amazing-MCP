import React from 'react';

interface EmotionDisplayProps {
  emotionSystem: {
    currentEmotion: string;
    points: number;
    history: Array<{
      emotion: string;
      timestamp: string;
      trigger?: string;
    }>;
  };
}

const emotionColors: Record<string, string> = {
  Happy: 'text-accent-green',
  Excited: 'text-accent-blue',
  Neutral: 'text-content-secondary',
  Anxious: 'text-accent-orange',
  Sad: 'text-accent-orange',
  Scared: 'text-accent-red'
};

const emotionEmojis: Record<string, string> = {
  Happy: '😊',
  Excited: '🎉',
  Neutral: '😐',
  Anxious: '😰',
  Sad: '😢',
  Scared: '😨'
};

export const EmotionDisplay: React.FC<EmotionDisplayProps> = ({ emotionSystem }) => {
  const { currentEmotion, points, history } = emotionSystem;
  
  // Calculate progress percentage (from -100 to 100, normalized to 0-100)
  const progressPercentage = ((points + 100) / 200) * 100;
  
  return (
    <div className="space-y-4">
      {/* Current Emotion */}
      <div className="text-center">
        <div className="text-4xl mb-2">{emotionEmojis[currentEmotion] || '😐'}</div>
        <div className={`text-2xl font-semibold ${emotionColors[currentEmotion] || 'text-content-primary'}`}>
          {currentEmotion}
        </div>
        <div className="text-sm text-content-secondary mt-1">Points: {points}</div>
      </div>
      
      {/* Emotion Bar */}
      <div className="relative">
        <div className="h-4 bg-surface-content rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-500"
            style={{
              width: `${progressPercentage}%`,
              background: `linear-gradient(to right, #EF5350, #FFB74D, #30D98B)`
            }}
          />
        </div>
        <div className="flex justify-between text-xs text-content-secondary mt-1">
          <span>-100</span>
          <span>0</span>
          <span>100</span>
        </div>
      </div>
      
      {/* Recent History */}
      <div>
        <h3 className="text-sm font-medium text-content-secondary mb-2">Recent Changes</h3>
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {history.slice(-5).reverse().map((entry, index) => (
            <div key={index} className="text-xs flex items-center gap-2">
              <span>{emotionEmojis[entry.emotion] || '😐'}</span>
              <span className={emotionColors[entry.emotion] || 'text-content-primary'}>
                {entry.emotion}
              </span>
              {entry.trigger && (
                <span className="text-content-disabled">- {entry.trigger}</span>
              )}
              <span className="text-content-disabled ml-auto">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}; 