import { IEmotion, IEmotionHistory } from '../types/mcp.types';
import { log } from '../utils/logger';
import { isValidEmotionPoints } from '../utils/validators';
import { mem0Integration } from '../integrations/mem0';
import { broadcastEmotions } from '../utils/websocket';

class EmotionService {
  private emotion: IEmotion;
  private mem0Initialized = false;
  private readonly EMOTION_MEMORY_ID = 'emotion-state';
  private readonly EMOTION_USER_ID = 'system';
  private readonly emotionThresholds = {
    happy: 50,
    neutral: 0,
    sad: -50,
    scared: -100,
  };

  constructor() {
    // Initialize with neutral emotion
    this.emotion = {
      current: 'neutral',
      points: 0,
      lastUpdated: new Date(),
      history: [],
    };
    
    // Initialize Mem0 and load emotion state
    this.initializeMem0();
  }

  /**
   * Get current emotion state
   */
  async getCurrentEmotion(): Promise<IEmotion> {
    return { ...this.emotion };
  }

  /**
   * Update emotion based on points
   */
  async updateEmotion(points: number, reason?: string): Promise<IEmotion> {
    // Validate points
    if (!isValidEmotionPoints(points)) {
      throw new Error('Invalid emotion points. Must be between -100 and 100.');
    }

    // Calculate new points
    const oldPoints = this.emotion.points;
    const newPoints = Math.max(-100, Math.min(100, this.emotion.points + points));

    // Determine new emotion state
    const oldEmotion = this.emotion.current;
    const newEmotion = this.calculateEmotionState(newPoints);

    // Update emotion
    this.emotion = {
      current: newEmotion,
      points: newPoints,
      lastUpdated: new Date(),
      history: [
        ...this.emotion.history,
        {
          emotion: oldEmotion,
          points: oldPoints,
          timestamp: new Date(),
          reason,
        },
      ].slice(-50), // Keep last 50 entries
    };

    // Log emotion change
    if (oldEmotion !== newEmotion) {
      log.info(`Emotion changed from ${oldEmotion} to ${newEmotion} (points: ${newPoints})`);
    }

    // Persist to Mem0
    await this.persistToMem0();
    
    // Broadcast emotion update via WebSocket
    try {
      broadcastEmotions({
        current: this.emotion.current,
        points: this.emotion.points,
        previousEmotion: oldEmotion,
        previousPoints: oldPoints,
        reason,
        timestamp: this.emotion.lastUpdated,
      });
    } catch (error) {
      log.error('Failed to broadcast emotion update:', error);
    }

    return { ...this.emotion };
  }

  /**
   * Calculate emotion state based on points
   */
  private calculateEmotionState(points: number): 'happy' | 'neutral' | 'sad' | 'scared' {
    if (points >= this.emotionThresholds.happy) {
      return 'happy';
    } else if (points >= this.emotionThresholds.neutral) {
      return 'neutral';
    } else if (points >= this.emotionThresholds.sad) {
      return 'sad';
    } else {
      return 'scared';
    }
  }

  /**
   * Reset emotion to neutral
   */
  async resetEmotion(): Promise<IEmotion> {
    this.emotion = {
      current: 'neutral',
      points: 0,
      lastUpdated: new Date(),
      history: [
        {
          emotion: this.emotion.current,
          points: this.emotion.points,
          timestamp: new Date(),
          reason: 'Emotion reset',
        },
      ],
    };

    log.info('Emotion reset to neutral');
    
    // Persist to Mem0
    await this.persistToMem0();
    
    // Broadcast emotion reset via WebSocket
    try {
      broadcastEmotions({
        current: this.emotion.current,
        points: this.emotion.points,
        previousEmotion: 'reset',
        previousPoints: 0,
        reason: 'Emotion reset to neutral',
        timestamp: this.emotion.lastUpdated,
      });
    } catch (error) {
      log.error('Failed to broadcast emotion reset:', error);
    }
    
    return { ...this.emotion };
  }

  /**
   * Get emotion history
   */
  async getEmotionHistory(limit = 10): Promise<IEmotionHistory[]> {
    return this.emotion.history.slice(-limit);
  }

  /**
   * Apply emotion-based modifiers to responses
   */
  getEmotionModifiers(): {
    responseDelay?: number;
    confidenceModifier?: number;
    verbosityModifier?: number;
  } {
    switch (this.emotion.current) {
      case 'happy':
        return {
          responseDelay: 0,
          confidenceModifier: 1.2,
          verbosityModifier: 1.1,
        };
      case 'sad':
        return {
          responseDelay: 500,
          confidenceModifier: 0.8,
          verbosityModifier: 0.9,
        };
      case 'scared':
        return {
          responseDelay: 1000,
          confidenceModifier: 0.6,
          verbosityModifier: 0.7,
        };
      default:
        return {
          responseDelay: 0,
          confidenceModifier: 1.0,
          verbosityModifier: 1.0,
        };
    }
  }

  /**
   * Check if emotion impacts should be applied
   */
  shouldApplyEmotionImpacts(): boolean {
    return process.env.ENABLE_EMOTION_SYSTEM === 'true';
  }

  /**
   * Initialize Mem0 and load emotion state
   */
  private async initializeMem0(): Promise<void> {
    try {
      await mem0Integration.initialize();
      this.mem0Initialized = mem0Integration.isAvailable();
      
      if (this.mem0Initialized) {
        log.info('Emotion service using Mem0 for persistence');
        await this.loadFromMem0();
      } else {
        log.info('Emotion service using in-memory storage');
      }
    } catch (error) {
      log.error('Failed to initialize Mem0 in emotion service:', error);
    }
  }

  /**
   * Load emotion state from Mem0
   */
  private async loadFromMem0(): Promise<void> {
    if (!this.mem0Initialized) return;

    try {
      const memories = await mem0Integration.searchMemories(
        this.EMOTION_MEMORY_ID,
        {
          userId: this.EMOTION_USER_ID,
          limit: 1,
        }
      );

      if (memories.length > 0) {
        const savedState = JSON.parse(memories[0].memory);
        if (savedState && savedState.emotion) {
          this.emotion = {
            current: savedState.emotion.current,
            points: savedState.emotion.points,
            lastUpdated: new Date(savedState.emotion.lastUpdated),
            history: savedState.emotion.history.map((h: any) => ({
              ...h,
              timestamp: new Date(h.timestamp),
            })),
          };
          log.info('Loaded emotion state from Mem0');
        }
      }
    } catch (error) {
      log.error('Failed to load emotion state from Mem0:', error);
    }
  }

  /**
   * Persist emotion state to Mem0
   */
  private async persistToMem0(): Promise<void> {
    if (!this.mem0Initialized) return;

    try {
      const emotionData = JSON.stringify({
        emotion: this.emotion,
        savedAt: new Date().toISOString(),
      });

      // Try to update existing memory first
      const existingMemories = await mem0Integration.searchMemories(
        this.EMOTION_MEMORY_ID,
        {
          userId: this.EMOTION_USER_ID,
          limit: 1,
        }
      );

      if (existingMemories.length > 0) {
        // Update existing memory
        await mem0Integration.updateMemory(existingMemories[0].id, emotionData);
        log.debug('Updated emotion state in Mem0');
      } else {
        // Create new memory
        await mem0Integration.addMemory(
          emotionData,
          this.EMOTION_USER_ID,
          {
            tags: ['emotion-state', 'system'],
            type: 'emotion-state',
            memoryId: this.EMOTION_MEMORY_ID,
          }
        );
        log.debug('Created new emotion state in Mem0');
      }
    } catch (error) {
      log.error('Failed to persist emotion state to Mem0:', error);
    }
  }
}

// Export singleton instance
export const emotionService = new EmotionService();