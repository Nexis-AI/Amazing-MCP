import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface Memory {
  id: string;
  content: string;
  timestamp: string;
  tags?: string[];
  emotionAtCreation?: string;
}

interface MemoryPanelProps {
  memoryManagement: {
    memories: Memory[];
    totalMemories: number;
  };
}

export const MemoryPanel: React.FC<MemoryPanelProps> = ({ memoryManagement }) => {
  const [newMemory, setNewMemory] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const queryClient = useQueryClient();
  
  // Add memory mutation
  const addMemoryMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await axios.post('/api/mcp/memory/add', {
        content,
        userId: 'default'
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mcp'] });
      setNewMemory('');
    }
  });
  
  const handleAddMemory = (e: React.FormEvent) => {
    e.preventDefault();
    if (newMemory.trim()) {
      addMemoryMutation.mutate(newMemory.trim());
    }
  };
  
  // Filter memories based on search
  const filteredMemories = memoryManagement.memories.filter(mem =>
    mem.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (mem.tags && mem.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
  );
  
  return (
    <div className="space-y-4">
      {/* Add Memory Form */}
      <form onSubmit={handleAddMemory} className="space-y-2">
        <input
          type="text"
          value={newMemory}
          onChange={(e) => setNewMemory(e.target.value)}
          placeholder="Add a new memory..."
          className="w-full px-3 py-2 bg-surface-content border border-border-light rounded-lg text-content-primary placeholder-content-disabled focus:outline-none focus:border-accent-blue"
          disabled={addMemoryMutation.isPending}
        />
        <button
          type="submit"
          disabled={!newMemory.trim() || addMemoryMutation.isPending}
          className="w-full py-2 bg-accent-blue text-white rounded-lg font-medium hover:bg-accent-blue/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {addMemoryMutation.isPending ? 'Adding...' : 'Add Memory'}
        </button>
      </form>
      
      {/* Search */}
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search memories..."
        className="w-full px-3 py-2 bg-surface-content border border-border-light rounded-lg text-content-primary placeholder-content-disabled focus:outline-none focus:border-accent-blue"
      />
      
      {/* Memory List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {filteredMemories.length > 0 ? (
          filteredMemories.map((memory) => (
            <div
              key={memory.id}
              className="p-3 bg-surface-content rounded-lg border border-border-light"
            >
              <p className="text-sm text-content-primary">{memory.content}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-content-disabled">
                  {new Date(memory.timestamp).toLocaleString()}
                </span>
                {memory.emotionAtCreation && (
                  <span className="text-xs text-accent-blue">
                    {memory.emotionAtCreation}
                  </span>
                )}
              </div>
              {memory.tags && memory.tags.length > 0 && (
                <div className="flex gap-1 mt-2">
                  {memory.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="text-xs px-2 py-1 bg-accent-blue/10 text-accent-blue rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center text-sm text-content-disabled py-8">
            {searchQuery ? 'No memories found' : 'No memories yet'}
          </div>
        )}
      </div>
      
      {/* Total Count */}
      <div className="text-xs text-content-secondary text-right">
        Total memories: {memoryManagement.totalMemories}
      </div>
    </div>
  );
}; 