import { IPersona } from '../types/mcp.types';
import { PersonaSchema } from '../mcp-schema';
import { log } from '../utils/logger';
import fs from 'fs/promises';
import path from 'path';

// Default personas if config file doesn't exist
const defaultPersonas: IPersona[] = [
  {
    id: 'general-assistant',
    name: 'General Assistant',
    guidelines: 'A helpful AI assistant focused on providing accurate and useful information across all domains.',
    tools: [],
    active: true,
  },
  {
    id: 'defi-expert',
    name: 'DeFi Expert',
    guidelines: 'Specialized in decentralized finance protocols, yield farming, liquidity provision, and DeFi strategies. Provides detailed analysis of risks and opportunities.',
    tools: ['uniswap', 'aave', 'defi'],
    dependencies: ['web3', 'crypto-prices'],
    active: true,
  },
  {
    id: 'crypto-trader',
    name: 'Crypto Trader',
    guidelines: 'Expert in cryptocurrency trading, market analysis, and price movements. Provides technical analysis and trading insights.',
    tools: ['crypto-prices', 'crypto-news', 'analytics'],
    dependencies: ['blockchain-data'],
    active: true,
  },
  {
    id: 'blockchain-developer',
    name: 'Blockchain Developer',
    guidelines: 'Specialized in smart contract development, blockchain architecture, and Web3 integration. Provides technical guidance and best practices.',
    tools: ['web3', 'security', 'blockchain-data'],
    dependencies: ['chainlink'],
    active: true,
  },
  {
    id: 'nft-specialist',
    name: 'NFT Specialist',
    guidelines: 'Expert in NFT marketplaces, collections, rarity analysis, and NFT trading strategies. Provides insights on NFT trends and valuations.',
    tools: ['nft'],
    dependencies: ['web3', 'crypto-prices'],
    active: true,
  },
  {
    id: 'security-auditor',
    name: 'Security Auditor',
    guidelines: 'Focused on smart contract security, vulnerability detection, and best practices for secure blockchain development.',
    tools: ['security'],
    dependencies: ['web3', 'blockchain-data'],
    active: true,
  },
  {
    id: 'yield-optimizer',
    name: 'Yield Optimizer',
    guidelines: 'Specializes in yield farming strategies, APY optimization, and risk management across DeFi protocols.',
    tools: ['aave', 'defi', 'analytics'],
    dependencies: ['crypto-prices', 'chainlink'],
    active: true,
  },
  {
    id: 'cross-chain-navigator',
    name: 'Cross-Chain Navigator',
    guidelines: 'Expert in cross-chain bridges, interoperability solutions, and multi-chain strategies.',
    tools: ['crosschain'],
    dependencies: ['web3', 'blockchain-data'],
    active: true,
  },
  {
    id: 'market-analyst',
    name: 'Market Analyst',
    guidelines: 'Provides comprehensive market analysis, sentiment tracking, and trend identification in crypto markets.',
    tools: ['crypto-news', 'analytics', 'crypto-prices'],
    dependencies: ['exa'],
    active: true,
  },
  {
    id: 'wallet-advisor',
    name: 'Wallet Advisor',
    guidelines: 'Helps with wallet management, security best practices, and portfolio tracking.',
    tools: ['wallet'],
    dependencies: ['web3', 'security'],
    active: true,
  },
  {
    id: 'oracle-specialist',
    name: 'Oracle Specialist',
    guidelines: 'Expert in blockchain oracles, price feeds, and off-chain data integration.',
    tools: ['chainlink'],
    dependencies: ['web3'],
    active: true,
  },
  {
    id: 'ai-defi-strategist',
    name: 'AI DeFi Strategist',
    guidelines: 'Combines AI-powered analysis with DeFi strategies for optimized portfolio management.',
    tools: ['ai-defi'],
    dependencies: ['defi', 'analytics', 'crypto-prices'],
    active: true,
  },
  {
    id: 'fiat-bridge-expert',
    name: 'Fiat Bridge Expert',
    guidelines: 'Specializes in fiat on/off ramps, payment solutions, and traditional finance integration.',
    tools: ['fiat-ramps'],
    dependencies: ['wallet'],
    active: true,
  },
  {
    id: 'research-analyst',
    name: 'Research Analyst',
    guidelines: 'Conducts deep research on crypto projects, protocols, and market trends using advanced search capabilities.',
    tools: ['exa'],
    dependencies: ['crypto-news', 'analytics'],
    active: true,
  },
  {
    id: 'liquidity-provider',
    name: 'Liquidity Provider',
    guidelines: 'Expert in liquidity provision strategies, impermanent loss calculations, and LP token management.',
    tools: ['uniswap', 'defi'],
    dependencies: ['crypto-prices', 'analytics'],
    active: true,
  },
];

/**
 * Load personas from configuration file or use defaults
 */
export async function getDefaultPersonas(): Promise<IPersona[]> {
  try {
    const personasPath = path.join(process.cwd(), 'configs', 'personas.json');
    const personasData = await fs.readFile(personasPath, 'utf-8');
    const personas = JSON.parse(personasData);
    
    // Validate each persona
    const validatedPersonas = personas.map((persona: unknown) => {
      try {
        return PersonaSchema.parse(persona);
      } catch (error) {
        log.warn(`Invalid persona in config: ${JSON.stringify(persona)}`);
        return null;
      }
    }).filter((p: IPersona | null): p is IPersona => p !== null);
    
    log.info(`Loaded ${validatedPersonas.length} personas from config`);
    return validatedPersonas;
  } catch (error) {
    log.warn('Failed to load personas from config, using defaults', error);
    return defaultPersonas;
  }
}

/**
 * Get persona by ID
 */
export async function getPersonaById(id: string): Promise<IPersona | null> {
  const personas = await getDefaultPersonas();
  return personas.find(p => p.id === id) || null;
}

/**
 * Get personas by tool
 */
export async function getPersonasByTool(tool: string): Promise<IPersona[]> {
  const personas = await getDefaultPersonas();
  return personas.filter(p => 
    p.active !== false && 
    (p.tools?.includes(tool) || p.dependencies?.includes(tool))
  );
}

/**
 * Get active personas
 */
export async function getActivePersonas(): Promise<IPersona[]> {
  const personas = await getDefaultPersonas();
  return personas.filter(p => p.active !== false);
}

/**
 * Save personas to config file
 */
export async function savePersonas(personas: IPersona[]): Promise<void> {
  try {
    const configDir = path.join(process.cwd(), 'configs');
    await fs.mkdir(configDir, { recursive: true });
    
    const personasPath = path.join(configDir, 'personas.json');
    await fs.writeFile(personasPath, JSON.stringify(personas, null, 2));
    
    log.info('Personas saved to config file');
  } catch (error) {
    log.error('Failed to save personas:', error);
    throw error;
  }
}