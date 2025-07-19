import React from 'react';

interface Persona {
  id: string;
  name: string;
  role: string;
  tool: string;
}

interface PersonaSelectorProps {
  personas: Persona[];
  selectedPersona: string;
  onSelect: (tool: string) => void;
}

const personaIcons: Record<string, string> = {
  general: '🤖',
  uniswap: '🦄',
  security: '🔒',
  chainlink: '⛓️',
  portfolio: '📊',
  aave: '👻',
  web3: '🌐',
  nft: '🎨',
  defi: '💰',
  analytics: '📈'
};

export const PersonaSelector: React.FC<PersonaSelectorProps> = ({
  personas,
  selectedPersona,
  onSelect
}) => {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-content-secondary mb-3">Select Persona</h3>
      <div className="space-y-1">
        {personas.map((persona) => (
          <button
            key={persona.id}
            onClick={() => onSelect(persona.tool)}
            className={`w-full p-3 rounded-lg border transition-all text-left ${
              selectedPersona === persona.tool
                ? 'bg-accent-blue/10 border-accent-blue text-content-primary'
                : 'border-border-light hover:bg-surface-content hover:border-content-disabled'
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">{personaIcons[persona.tool] || '🤖'}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{persona.name}</div>
                <div className="text-xs text-content-secondary truncate">{persona.role}</div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}; 