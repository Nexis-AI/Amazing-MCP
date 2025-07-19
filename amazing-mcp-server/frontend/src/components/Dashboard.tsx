import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { useWebSocket } from '../hooks/useWebSocket';
import { EmotionDisplay } from './EmotionDisplay';
import { PriceTicker } from './PriceTicker';
import { PersonaSelector } from './PersonaSelector';
import { MemoryPanel } from './MemoryPanel';

interface MCP {
  version: string;
  timestamp: string;
  agentPersonas: Array<{
    id: string;
    name: string;
    role: string;
    tool: string;
  }>;
  emotionSystem: {
    currentEmotion: string;
    points: number;
    history: Array<{
      emotion: string;
      timestamp: string;
      trigger?: string;
    }>;
  };
  memoryManagement: {
    memories: Array<{
      id: string;
      content: string;
      timestamp: string;
      tags?: string[];
    }>;
    totalMemories: number;
  };
}

export const Dashboard: React.FC = () => {
  const { isConnected, lastMessage } = useWebSocket();
  const [selectedPersona, setSelectedPersona] = useState<string>('general');

  // Fetch MCP data
  const { data: mcp, isLoading, error, refetch } = useQuery({
    queryKey: ['mcp', selectedPersona],
    queryFn: async () => {
      const response = await axios.get<{ data: MCP }>('/api/mcp', {
        params: { tool: selectedPersona }
      });
      return response.data.data;
    },
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  // Listen for emotion changes
  useEffect(() => {
    if (lastMessage?.type === 'emotion_change') {
      refetch();
    }
  }, [lastMessage, refetch]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-content-secondary">Loading MCP data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-accent-red">Error loading MCP data</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <div className="w-64 bg-surface-sidebar border-r border-border-light flex flex-col">
        <div className="p-4 border-b border-border-light">
          <h1 className="text-xl font-semibold text-content-primary">Amazing MCP</h1>
          <div className="mt-2 text-sm text-content-secondary">
            {isConnected ? (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-accent-green rounded-full"></span>
                Connected
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-accent-red rounded-full"></span>
                Disconnected
              </span>
            )}
          </div>
        </div>
        
        <div className="flex-1 p-4">
          <PersonaSelector
            personas={mcp?.agentPersonas || []}
            selectedPersona={selectedPersona}
            onSelect={setSelectedPersona}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="h-16 bg-surface-topbar border-b border-border-light flex items-center px-6">
          <PriceTicker />
        </div>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Emotion Display */}
            <div className="bg-surface-sidebar rounded-lg border border-border-light p-6">
              <h2 className="text-lg font-semibold text-content-primary mb-4">Emotion System</h2>
              {mcp && <EmotionDisplay emotionSystem={mcp.emotionSystem} />}
            </div>

            {/* Memory Panel */}
            <div className="bg-surface-sidebar rounded-lg border border-border-light p-6">
              <h2 className="text-lg font-semibold text-content-primary mb-4">Memory Management</h2>
              {mcp && <MemoryPanel memoryManagement={mcp.memoryManagement} />}
            </div>

            {/* System Info */}
            <div className="bg-surface-sidebar rounded-lg border border-border-light p-6 lg:col-span-2">
              <h2 className="text-lg font-semibold text-content-primary mb-4">System Information</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-content-secondary">Version:</span>
                  <span className="ml-2 text-content-primary">{mcp?.version}</span>
                </div>
                <div>
                  <span className="text-content-secondary">Last Updated:</span>
                  <span className="ml-2 text-content-primary">
                    {mcp && new Date(mcp.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div>
                  <span className="text-content-secondary">Active Persona:</span>
                  <span className="ml-2 text-content-primary">
                    {mcp?.agentPersonas.find(p => p.tool === selectedPersona)?.name || 'None'}
                  </span>
                </div>
                <div>
                  <span className="text-content-secondary">Total Memories:</span>
                  <span className="ml-2 text-content-primary">{mcp?.memoryManagement.totalMemories || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}; 