import { 
  getDefaultPersonas, 
  getPersonaById, 
  getPersonasByTool, 
  getActivePersonas,
  savePersonas 
} from '../../src/services/persona.service';
import { log } from '../../src/utils/logger';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies
jest.mock('../../src/utils/logger');
jest.mock('fs/promises');

describe('Persona Service', () => {
  const mockPersonasFromFile = [
    {
      id: 'custom-persona',
      name: 'Custom Persona',
      guidelines: 'A custom persona from file',
      tools: ['custom-tool'],
      active: true,
    },
    {
      id: 'inactive-persona',
      name: 'Inactive Persona',
      guidelines: 'An inactive persona',
      tools: ['test-tool'],
      active: false,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getDefaultPersonas', () => {
    it('should load personas from config file when available', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockPersonasFromFile));
      
      const personas = await getDefaultPersonas();
      
      expect(fs.readFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'configs', 'personas.json'),
        'utf-8'
      );
      expect(personas).toHaveLength(2);
      expect(personas[0].id).toBe('custom-persona');
      expect(log.info).toHaveBeenCalledWith('Loaded 2 personas from config');
    });

    it('should use default personas when config file not found', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
      
      const personas = await getDefaultPersonas();
      
      expect(personas.length).toBeGreaterThan(10);
      expect(personas[0].id).toBe('general-assistant');
      expect(log.warn).toHaveBeenCalledWith(
        'Failed to load personas from config, using defaults',
        expect.any(Error)
      );
    });

    it('should validate personas and filter invalid ones', async () => {
      const invalidPersonas = [
        ...mockPersonasFromFile,
        {
          // Missing required fields
          name: 'Invalid Persona',
        },
      ];
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(invalidPersonas));
      
      const personas = await getDefaultPersonas();
      
      // Should only return valid personas
      expect(personas).toHaveLength(2);
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('Invalid persona in config:')
      );
    });

    it('should handle JSON parse errors', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue('invalid json');
      
      const personas = await getDefaultPersonas();
      
      // Should fallback to defaults
      expect(personas.length).toBeGreaterThan(10);
      expect(log.warn).toHaveBeenCalled();
    });

    it('should include all required default personas', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
      
      const personas = await getDefaultPersonas();
      
      const personaIds = personas.map(p => p.id);
      expect(personaIds).toContain('general-assistant');
      expect(personaIds).toContain('defi-expert');
      expect(personaIds).toContain('crypto-trader');
      expect(personaIds).toContain('blockchain-developer');
      expect(personaIds).toContain('nft-specialist');
      expect(personaIds).toContain('security-auditor');
      expect(personaIds).toContain('yield-optimizer');
      expect(personaIds).toContain('cross-chain-navigator');
      expect(personaIds).toContain('market-analyst');
      expect(personaIds).toContain('wallet-advisor');
      expect(personaIds).toContain('oracle-specialist');
      expect(personaIds).toContain('ai-defi-strategist');
      expect(personaIds).toContain('fiat-bridge-expert');
      expect(personaIds).toContain('research-analyst');
      expect(personaIds).toContain('liquidity-provider');
    });

    it('should have proper structure for default personas', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
      
      const personas = await getDefaultPersonas();
      
      personas.forEach(persona => {
        expect(persona).toHaveProperty('id');
        expect(persona).toHaveProperty('name');
        expect(persona).toHaveProperty('guidelines');
        expect(persona).toHaveProperty('tools');
        expect(persona).toHaveProperty('active');
        expect(typeof persona.id).toBe('string');
        expect(typeof persona.name).toBe('string');
        expect(typeof persona.guidelines).toBe('string');
        expect(Array.isArray(persona.tools)).toBe(true);
        expect(persona.active).toBe(true);
      });
    });
  });

  describe('getPersonaById', () => {
    it('should return persona by ID', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockPersonasFromFile));
      
      const persona = await getPersonaById('custom-persona');
      
      expect(persona).toBeDefined();
      expect(persona?.id).toBe('custom-persona');
      expect(persona?.name).toBe('Custom Persona');
    });

    it('should return null for non-existent ID', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockPersonasFromFile));
      
      const persona = await getPersonaById('non-existent');
      
      expect(persona).toBeNull();
    });

    it('should work with default personas', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
      
      const persona = await getPersonaById('defi-expert');
      
      expect(persona).toBeDefined();
      expect(persona?.id).toBe('defi-expert');
      expect(persona?.name).toBe('DeFi Expert');
    });
  });

  describe('getPersonasByTool', () => {
    it('should return personas that have the tool', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockPersonasFromFile));
      
      const personas = await getPersonasByTool('custom-tool');
      
      expect(personas).toHaveLength(1);
      expect(personas[0].id).toBe('custom-persona');
    });

    it('should not return inactive personas', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockPersonasFromFile));
      
      const personas = await getPersonasByTool('test-tool');
      
      expect(personas).toHaveLength(0);
    });

    it('should return personas that have tool in dependencies', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
      
      const personas = await getPersonasByTool('web3');
      
      expect(personas.length).toBeGreaterThan(0);
      
      // Check that personas have web3 in tools or dependencies
      personas.forEach(persona => {
        const hasInTools = persona.tools?.includes('web3') || false;
        const hasInDeps = persona.dependencies?.includes('web3') || false;
        expect(hasInTools || hasInDeps).toBe(true);
      });
    });

    it('should work with default personas for DeFi tools', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
      
      const personas = await getPersonasByTool('uniswap');
      
      expect(personas.length).toBeGreaterThan(0);
      expect(personas.some(p => p.id === 'defi-expert')).toBe(true);
      expect(personas.some(p => p.id === 'liquidity-provider')).toBe(true);
    });

    it('should return empty array for unknown tool', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockPersonasFromFile));
      
      const personas = await getPersonasByTool('unknown-tool');
      
      expect(personas).toHaveLength(0);
    });
  });

  describe('getActivePersonas', () => {
    it('should return only active personas', async () => {
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockPersonasFromFile));
      
      const personas = await getActivePersonas();
      
      expect(personas).toHaveLength(1);
      expect(personas[0].id).toBe('custom-persona');
      expect(personas[0].active).toBe(true);
    });

    it('should return all default personas (all active)', async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));
      
      const personas = await getActivePersonas();
      
      expect(personas.length).toBeGreaterThan(10);
      personas.forEach(persona => {
        expect(persona.active).toBe(true);
      });
    });

    it('should handle mixed active/inactive personas', async () => {
      const mixedPersonas = [
        { id: 'p1', name: 'P1', guidelines: 'G1', tools: [], active: true },
        { id: 'p2', name: 'P2', guidelines: 'G2', tools: [], active: false },
        { id: 'p3', name: 'P3', guidelines: 'G3', tools: [] }, // undefined active defaults to true
      ];
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mixedPersonas));
      
      const personas = await getActivePersonas();
      
      expect(personas).toHaveLength(2);
      expect(personas.map(p => p.id)).toEqual(['p1', 'p3']);
    });
  });

  describe('savePersonas', () => {
    it('should save personas to config file', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);
      
      await savePersonas(mockPersonasFromFile);
      
      expect(fs.mkdir).toHaveBeenCalledWith(
        path.join(process.cwd(), 'configs'),
        { recursive: true }
      );
      expect(fs.writeFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'configs', 'personas.json'),
        JSON.stringify(mockPersonasFromFile, null, 2)
      );
      expect(log.info).toHaveBeenCalledWith('Personas saved to config file');
    });

    it('should handle write errors', async () => {
      const error = new Error('Write failed');
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockRejectedValue(error);
      
      await expect(savePersonas(mockPersonasFromFile)).rejects.toThrow('Write failed');
      
      expect(log.error).toHaveBeenCalledWith('Failed to save personas:', error);
    });

    it('should handle mkdir errors', async () => {
      const error = new Error('Mkdir failed');
      (fs.mkdir as jest.Mock).mockRejectedValue(error);
      
      await expect(savePersonas(mockPersonasFromFile)).rejects.toThrow('Mkdir failed');
      
      expect(log.error).toHaveBeenCalledWith('Failed to save personas:', error);
    });
  });
});