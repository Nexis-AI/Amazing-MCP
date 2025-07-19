import { emotionService } from '../../src/services/emotion.service';

describe('Emotion Service', () => {
  beforeEach(async () => {
    // Reset emotion to neutral before each test
    await emotionService.resetEmotion();
  });

  describe('getCurrentEmotion', () => {
    it('should return initial neutral emotion', async () => {
      const emotion = await emotionService.getCurrentEmotion();
      
      expect(emotion.current).toBe('neutral');
      expect(emotion.points).toBe(0);
      // Reset adds one history entry
      expect(emotion.history).toHaveLength(1);
      expect(emotion.history[0].reason).toBe('Emotion reset');
    });
  });

  describe('updateEmotion', () => {
    it('should update emotion points positively', async () => {
      const emotion = await emotionService.updateEmotion(30, 'Good trade');
      
      expect(emotion.points).toBe(30);
      expect(emotion.current).toBe('neutral'); // Still neutral (< 50)
      expect(emotion.history).toHaveLength(2); // Reset + update
      expect(emotion.history[1].reason).toBe('Good trade');
    });

    it('should transition to happy state', async () => {
      const emotion = await emotionService.updateEmotion(60, 'Great profits');
      
      expect(emotion.points).toBe(60);
      expect(emotion.current).toBe('happy'); // >= 50
    });

    it('should transition to sad state', async () => {
      const emotion = await emotionService.updateEmotion(-30, 'Loss occurred');
      
      expect(emotion.points).toBe(-30);
      expect(emotion.current).toBe('sad'); // >= -50
    });

    it('should transition to scared state', async () => {
      const emotion = await emotionService.updateEmotion(-80, 'Major crash');
      
      expect(emotion.points).toBe(-80);
      expect(emotion.current).toBe('scared'); // < -50
    });

    it('should cap points at maximum', async () => {
      await emotionService.updateEmotion(80);
      const emotion = await emotionService.updateEmotion(50); // Total would be 130
      
      expect(emotion.points).toBe(100); // Capped at 100
    });

    it('should cap points at minimum', async () => {
      await emotionService.updateEmotion(-80);
      const emotion = await emotionService.updateEmotion(-50); // Total would be -130
      
      expect(emotion.points).toBe(-100); // Capped at -100
    });

    it('should maintain emotion history', async () => {
      await emotionService.updateEmotion(20, 'First update');
      await emotionService.updateEmotion(30, 'Second update');
      const emotion = await emotionService.updateEmotion(10, 'Third update');
      
      expect(emotion.history).toHaveLength(4); // Reset + 3 updates
      expect(emotion.history[0].reason).toBe('Emotion reset');
      expect(emotion.history[1].points).toBe(0); // After reset
      expect(emotion.history[2].points).toBe(20); // After first update
      expect(emotion.history[3].points).toBe(50); // After second update
    });

    it('should limit history to 50 entries', async () => {
      // Create 52 updates
      for (let i = 0; i < 52; i++) {
        await emotionService.updateEmotion(1, `Update ${i}`);
      }
      
      const emotion = await emotionService.getCurrentEmotion();
      expect(emotion.history).toHaveLength(50);
    });

    it('should throw error for invalid points', async () => {
      await expect(emotionService.updateEmotion(150)).rejects.toThrow('Invalid emotion points');
      await expect(emotionService.updateEmotion(-150)).rejects.toThrow('Invalid emotion points');
    });
  });

  describe('resetEmotion', () => {
    it('should reset emotion to neutral', async () => {
      // First set some emotion
      await emotionService.updateEmotion(75, 'Happy state');
      
      // Then reset
      const emotion = await emotionService.resetEmotion();
      
      expect(emotion.current).toBe('neutral');
      expect(emotion.points).toBe(0);
      expect(emotion.history).toHaveLength(1);
      expect(emotion.history[0].reason).toBe('Emotion reset');
    });
  });

  describe('getEmotionHistory', () => {
    it('should return limited emotion history', async () => {
      await emotionService.updateEmotion(10, 'Update 1');
      await emotionService.updateEmotion(20, 'Update 2');
      await emotionService.updateEmotion(30, 'Update 3');
      
      const history = await emotionService.getEmotionHistory(2);
      
      expect(history).toHaveLength(2);
      expect(history[0].points).toBe(10); // Second last
      expect(history[1].points).toBe(30); // Last
    });

    it('should return all history if limit exceeds available', async () => {
      await emotionService.updateEmotion(10, 'Update 1');
      await emotionService.updateEmotion(20, 'Update 2');
      
      const history = await emotionService.getEmotionHistory(10);
      
      expect(history).toHaveLength(3); // Reset + 2 updates
    });
  });

  describe('getEmotionModifiers', () => {
    it('should return happy modifiers', async () => {
      await emotionService.updateEmotion(60); // Happy state
      
      const modifiers = emotionService.getEmotionModifiers();
      
      expect(modifiers.responseDelay).toBe(0);
      expect(modifiers.confidenceModifier).toBe(1.2);
      expect(modifiers.verbosityModifier).toBe(1.1);
    });

    it('should return sad modifiers', async () => {
      await emotionService.updateEmotion(-30); // Sad state
      
      const modifiers = emotionService.getEmotionModifiers();
      
      expect(modifiers.responseDelay).toBe(500);
      expect(modifiers.confidenceModifier).toBe(0.8);
      expect(modifiers.verbosityModifier).toBe(0.9);
    });

    it('should return scared modifiers', async () => {
      await emotionService.updateEmotion(-80); // Scared state
      
      const modifiers = emotionService.getEmotionModifiers();
      
      expect(modifiers.responseDelay).toBe(1000);
      expect(modifiers.confidenceModifier).toBe(0.6);
      expect(modifiers.verbosityModifier).toBe(0.7);
    });

    it('should return neutral modifiers', async () => {
      const modifiers = emotionService.getEmotionModifiers();
      
      expect(modifiers.responseDelay).toBe(0);
      expect(modifiers.confidenceModifier).toBe(1.0);
      expect(modifiers.verbosityModifier).toBe(1.0);
    });
  });

  describe('shouldApplyEmotionImpacts', () => {
    it('should respect environment configuration', () => {
      const originalValue = process.env.ENABLE_EMOTION_SYSTEM;
      
      process.env.ENABLE_EMOTION_SYSTEM = 'true';
      expect(emotionService.shouldApplyEmotionImpacts()).toBe(true);
      
      process.env.ENABLE_EMOTION_SYSTEM = 'false';
      expect(emotionService.shouldApplyEmotionImpacts()).toBe(false);
      
      // Restore original value
      process.env.ENABLE_EMOTION_SYSTEM = originalValue;
    });
  });
});